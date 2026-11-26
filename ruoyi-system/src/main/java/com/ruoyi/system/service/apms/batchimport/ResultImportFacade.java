package com.ruoyi.system.service.apms.batchimport;

import java.math.BigDecimal;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import com.alibaba.fastjson2.JSON;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsTaskItem;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.domain.apms.ApmsTestTask;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskMemberMapper;
import com.ruoyi.system.mapper.apms.ApmsTestResultMapper;
import com.ruoyi.system.mapper.apms.ApmsTestResultValueMapper;
import com.ruoyi.system.service.apms.InputRangeValidator;
import com.ruoyi.system.service.apms.ITestResultImportProvider.ImportResult;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.CellVo;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.Header;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.RowVo;
import com.ruoyi.system.service.apms.batchimport.ResultImportDraft.DraftCell;
import com.ruoyi.system.service.apms.batchimport.ResultImportDraft.DraftRow;

/**
 * 测试成绩两阶段批量导入：预览（解析/精确匹配/范围标色）+ 一次性 token 提交。
 *
 * <p>一期仅支持 INDICATOR；MODEL 列预览灰显忽略。
 * <p>提交去重：单元格成绩与该队员/该任务/当日同指标的最新一次成绩数值一致时跳过不写，
 * 计入 skipped 并给明细，避免重新上传含已录数据的模板时产生重复 attempt。
 *
 * @author apms
 */
@Component
public class ResultImportFacade {

    public static final String DOMAIN = "result";

    @Autowired private TabularFileReader reader;
    @Autowired private ResultTabularParser parser;
    @Autowired private AthleteImportResolver resolver;
    @Autowired private TaskScopeQuery taskScopeQuery;
    @Autowired private ApmsIndicatorMapper indicatorMapper;
    @Autowired private ApmsTaskItemMapper taskItemMapper;
    @Autowired private ApmsTaskMemberMapper taskMemberMapper;
    @Autowired private ApmsTestResultMapper resultMapper;
    @Autowired private ApmsTestResultValueMapper resultValueMapper;
    @Autowired private InputRangeValidator rangeValidator;
    @Autowired private ImportDraftStore draftStore;
    @Autowired private ResultImportRowWriter rowWriter;

    /** 预览（不入库） */
    public ImportPreviewVo preview(MultipartFile file, Long taskId, Long userId) {
        // 批量导入必须绑定任务，不允许散录批量导入（前端已禁用，后端兜底防绕过）
        if (taskId == null) {
            throw new ServiceException("批量导入必须指定关联任务，不支持散录批量导入");
        }
        List<String[]> matrix;
        try {
            matrix = reader.read(file.getInputStream(), file.getOriginalFilename());
        } catch (Exception e) {
            throw new ServiceException("文件读取失败：" + e.getMessage());
        }
        ImportResult parsed = parser.parseRows(matrix, taskId);

        ImportPreviewVo vo = new ImportPreviewVo();
        vo.setDomain(DOMAIN);
        vo.getErrors().addAll(parsed.errorRows);
        vo.getWarnings().addAll(parsed.warnings);

        // 任务必须存在且在数据权限内
        ApmsTestTask q = new ApmsTestTask();
        q.setId(taskId);
        if (taskScopeQuery.findScopedById(q) == null) {
            vo.getErrors().add("任务 " + taskId + " 不存在或不在当前数据权限范围内");
        }

        // 任务指标项索引（任务模式）：indicatorId → taskItemId
        Map<Long, Long> taskItemIdIndex = new HashMap<>();
        Set<Long> taskIndicatorIds = new HashSet<>();
        if (taskId != null) {
            for (ApmsTaskItem item : taskItemMapper.selectByTaskId(taskId)) {
                if ("INDICATOR".equals(item.getItemType()) && item.getIndicatorId() != null) {
                    taskIndicatorIds.add(item.getIndicatorId());
                    taskItemIdIndex.put(item.getIndicatorId(), item.getId());
                }
            }
        }

        // MODEL 列：一期忽略并明示
        for (String modelHeader : parsed.headerToModelId.keySet()) {
            vo.getIgnoredColumns().add(modelHeader);
        }
        if (!parsed.headerToModelId.isEmpty()) {
            vo.getWarnings().add("模型类指标（MODEL CODE）暂不支持批量导入，相关列已跳过（"
                    + String.join("、", parsed.headerToModelId.keySet()) + "），请在测试任务中手工录入");
        }

        // 指标列表头（code → 名称/单位）
        Map<String, ApmsIndicator> indByHeader = new LinkedHashMap<>();
        for (Map.Entry<String, Long> e : parsed.headerToIndicatorId.entrySet()) {
            ApmsIndicator ind = indicatorMapper.selectById(e.getValue());
            if (ind != null) indByHeader.put(e.getKey(), ind);
            vo.getHeaders().add(new Header(e.getKey(),
                    ind != null ? ind.getName() : e.getKey(),
                    ind != null ? ind.getUnit() : null));
        }

        ResultImportDraft draft = new ResultImportDraft();
        draft.setDomain(DOMAIN);
        draft.setUserId(userId);

        for (ImportResult.Row r : parsed.rows) {
            RowVo rv = new RowVo();
            rv.lineNo = r.lineNo;
            rv.date = r.measureDate;
            List<String> rowErrors = new ArrayList<>();

            // 1) 运动员精确匹配
            AthleteImportResolver.Result ar = resolver.resolve(r.athleteIdRaw, r.athleteNameRaw);
            if (!ar.matched) {
                rowErrors.add(ar.error);
            } else {
                rv.matched = true;
                rv.athleteId = ar.athlete.getAthleteId();
                rv.athleteName = ar.athlete.getName();
                if (ar.warning != null) vo.getWarnings().add("第 " + r.lineNo + " 行：" + ar.warning);
            }

            // 2) 日期
            Date measureDate = null;
            if (r.measureDate == null || r.measureDate.isEmpty()) {
                rowErrors.add("测试日期为空");
            } else {
                try {
                    measureDate = ResultTabularParser.parseMeasureDate(r.measureDate);
                } catch (ParseException e) {
                    rowErrors.add("日期格式错误：" + r.measureDate);
                }
            }

            // 3) 任务成员/指标归属（任务模式）
            if (ar.matched && taskId != null) {
                if (taskScopeQuery.findScopedById(idQuery(taskId)) == null) {
                    // 致命错误已在前面汇总
                } else if (taskMemberMapper.selectByTaskAndAthlete(taskId, ar.athlete.getAthleteId()) == null) {
                    rowErrors.add("该队员不是任务 " + taskId + " 的参测成员");
                }
            }

            // 4) 指标单元格
            boolean rowWarn = false;
            boolean hasValue = false;
            List<DraftCell> draftCells = new ArrayList<>();
            for (Map.Entry<String, ApmsIndicator> e : indByHeader.entrySet()) {
                String header = e.getKey();
                ApmsIndicator ind = e.getValue();
                String raw = r.values.get(header);
                if (raw == null || raw.isEmpty()) {
                    continue; // 空列不展示
                }
                hasValue = true;
                CellVo cv = new CellVo();
                cv.key = header;
                cv.raw = raw;
                BigDecimal num;
                try {
                    num = new BigDecimal(raw.trim());
                } catch (NumberFormatException ex) {
                    num = null;
                }
                if (num == null) {
                    cv.status = "error";
                    cv.message = "成绩必须是数字";
                    rowErrors.add(ind.getName() + " 成绩必须是数字：" + raw);
                } else if (taskId != null && !taskIndicatorIds.contains(ind.getId())) {
                    cv.status = "error";
                    cv.message = "该指标不在任务测试项中";
                    rowErrors.add(ind.getName() + " 不在任务 " + taskId + " 的测试项中");
                } else {
                    String level = rangeValidator.classifyIndicatorByCode(ind.getCode(), num);
                    if ("hard-low".equals(level) || "hard-high".equals(level)) {
                        cv.status = "error";
                        cv.message = "超出允许范围";
                        rowErrors.add(ind.getName() + " " + num + " 超出允许范围");
                    } else if ("warn-low".equals(level) || "warn-high".equals(level)) {
                        cv.status = "warn";
                        rowWarn = true;
                    } else {
                        cv.status = "ok";
                    }
                    DraftCell dc = new DraftCell();
                    dc.indicatorId = ind.getId();
                    dc.code = ind.getCode();
                    dc.value = num;
                    draftCells.add(dc);
                }
                rv.cells.add(cv);
            }
            if (!hasValue) {
                rowErrors.add("没有任何成绩");
            }

            if (!rowErrors.isEmpty()) {
                rv.rowError = String.join("；", rowErrors);
                vo.getSummary().error++;
            } else {
                if (rowWarn) vo.getSummary().warn++; else vo.getSummary().valid++;
                // 入草稿
                DraftRow dr = new DraftRow();
                dr.lineNo = r.lineNo;
                dr.athleteId = rv.athleteId;
                dr.measureDate = r.measureDate;
                dr.sessionKey = r.sessionKey;
                dr.taskId = taskId;
                dr.cells = draftCells;
                draft.getRows().add(dr);
            }
            vo.getSummary().total++;
            vo.getRows().add(rv);
        }

        // 致命错误存在时不发 token（无法提交）
        if (vo.getErrors().isEmpty()) {
            String token = draftStore.saveDraft(DOMAIN, draft);
            vo.setToken(token);
        }
        return vo;
    }

    /** 提交（一次性 token；行级事务；双击幂等） */
    public Object commit(String token, Long userId) {
        ResultImportDraft draft = draftStore.acquire(DOMAIN, token, userId, ResultImportDraft.class);
        if (draft == null) {
            Object[] holder = new Object[1];
            CommitOutcome state = draftStore.committedState(DOMAIN, token, holder);
            if (state == CommitOutcome.DONE && holder[0] != null) {
                return JSON.parseObject(JSON.toJSONString(holder[0]), ImportCommitResult.class);
            }
            if (state == CommitOutcome.PROCESSING) {
                throw new ServiceException("该导入正在处理中，请勿重复提交");
            }
            throw new ServiceException("预览草稿不存在或已过期，请重新上传文件");
        }

        ImportCommitResult result = new ImportCommitResult();
        Map<Long, Long> taskItemIdIndex = null;
        if (draft.getRows().stream().anyMatch(r -> r.taskId != null)) {
            taskItemIdIndex = new HashMap<>();
            Long taskId = draft.getRows().get(0).taskId;
            for (ApmsTaskItem item : taskItemMapper.selectByTaskId(taskId)) {
                if ("INDICATOR".equals(item.getItemType()) && item.getIndicatorId() != null) {
                    taskItemIdIndex.put(item.getIndicatorId(), item.getId());
                }
            }
        }

        for (DraftRow row : draft.getRows()) {
            String who = "第 " + row.lineNo + " 行（运动员 " + row.athleteId + "）";
            // commit 前数据权限复检
            if (!resolver.existsInScope(row.athleteId)) {
                result.setFailed(result.getFailed() + 1);
                result.getFailedDetails().add(who + "：运动员已不在当前数据权限范围内，未导入");
                continue;
            }
            Date measureDate;
            try {
                measureDate = ResultTabularParser.parseMeasureDate(row.measureDate);
            } catch (ParseException e) {
                result.setFailed(result.getFailed() + 1);
                result.getFailedDetails().add(who + "：日期格式错误，未导入");
                continue;
            }
            List<ResultImportItem> items = new ArrayList<>();
            for (DraftCell c : row.cells) {
                // 去重：与该队员/该任务/当日同指标的最新一次成绩数值一致则不再记录
                // （重新上传含已录数据的模板时，未改动的格子不会产生重复 attempt）
                BigDecimal latestValue = latestValueOnDate(row.taskId, row.athleteId, c.indicatorId, measureDate);
                if (latestValue != null && latestValue.compareTo(c.value) == 0) {
                    result.setSkipped(result.getSkipped() + 1);
                    result.getSkippedDetails().add(who + "：指标 " + c.code + " 成绩 "
                            + c.value.stripTrailingZeros().toPlainString()
                            + " 与当日最新成绩一致，跳过不重复记录");
                    continue;
                }
                ApmsTestResult tr = new ApmsTestResult();
                tr.setAthleteId(row.athleteId);
                tr.setTaskId(row.taskId);
                tr.setTaskItemId(taskItemIdIndex == null ? null : taskItemIdIndex.get(c.indicatorId));
                tr.setMeasureDate(measureDate);
                tr.setSessionKey(row.sessionKey);
                tr.setItemType("INDICATOR");
                tr.setIndicatorId(c.indicatorId);
                tr.setIsValid("1");
                tr.setIsSelected("1");
                tr.setDataSource("import");
                ApmsTestResultValue tv = new ApmsTestResultValue();
                tv.setIndicatorId(c.indicatorId);
                tv.setFieldKey("result");
                tv.setIsDerived("0");
                tv.setNumericValue(c.value);
                items.add(new ResultImportItem(tr, Collections.singletonList(tv)));
            }
            // 整行成绩全部命中去重：无内容可写，不计入成功/失败
            if (items.isEmpty()) continue;
            try {
                rowWriter.writeRow(items);
                result.setCommitted(result.getCommitted() + 1);
            } catch (Exception e) {
                result.setFailed(result.getFailed() + 1);
                result.getFailedDetails().add(who + "：" + e.getMessage());
            }
        }
        draftStore.complete(DOMAIN, token, result);
        return result;
    }

    /**
     * 查该队员在指定任务/日期/指标下最新一次成绩的主值（用于导入去重）。
     *
     * <p>口径：selectList 按 attempt_no 升序，末条即当日最新一次尝试（含本批次先前行已提交的记录，
     * 因此同一文件内的重复行同样会被跳过）；主值优先取 fieldKey='result'，缺省回退首个数值。
     * 数值比较用 {@link BigDecimal#compareTo}，58 与 58.0 视为相等。
     *
     * @return 最新成绩数值；无当日记录或记录无值时返回 null（null 不触发去重）
     */
    private BigDecimal latestValueOnDate(Long taskId, Long athleteId, Long indicatorId, Date measureDate) {
        ApmsTestResult q = new ApmsTestResult();
        q.setTaskId(taskId);
        q.setAthleteId(athleteId);
        q.setIndicatorId(indicatorId);
        q.setMeasureDate(measureDate);
        q.setItemType("INDICATOR");
        List<ApmsTestResult> sameDay = resultMapper.selectList(q);
        if (sameDay == null || sameDay.isEmpty()) return null;
        ApmsTestResult latest = sameDay.get(sameDay.size() - 1);
        List<ApmsTestResultValue> vals = resultValueMapper.selectByResultId(latest.getId());
        if (vals == null || vals.isEmpty()) return null;
        BigDecimal fallback = null;
        for (ApmsTestResultValue v : vals) {
            if (v.getNumericValue() == null) continue;
            if ("result".equals(v.getFieldKey())) return v.getNumericValue();
            if (fallback == null) fallback = v.getNumericValue();
        }
        return fallback;
    }

    private ApmsTestTask idQuery(Long id) {
        ApmsTestTask q = new ApmsTestTask();
        q.setId(id);
        return q;
    }
}
