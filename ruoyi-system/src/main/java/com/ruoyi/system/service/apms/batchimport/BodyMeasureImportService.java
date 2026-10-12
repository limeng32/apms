package com.ruoyi.system.service.apms.batchimport;

import java.math.BigDecimal;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import com.alibaba.fastjson2.JSON;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.mapper.apms.ApmsBodyMeasureMapper;
import com.ruoyi.system.service.apms.IApmsBodyMeasureService;
import com.ruoyi.system.service.apms.InputRangeValidator;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.CellVo;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.ConflictVo;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.Header;
import com.ruoyi.system.service.apms.batchimport.ImportPreviewVo.RowVo;
import com.ruoyi.system.service.apms.batchimport.BodyImportDraft.DraftRow;

/**
 * 体态测量两阶段批量导入。
 *
 * <p>列：athlete_id, athlete_name, measure_date, height, weight, sit_height, body_fat_rate, waist
 * （表头按列名定位，大小写/下划线驼峰兼容；# 说明行跳过）。
 *
 * @author apms
 */
@Component
public class BodyMeasureImportService {

    public static final String DOMAIN = "body";

    /** 字段 key → 中文列名（表头/提示） */
    private static final LinkedHashMap<String, String> COLUMNS = new LinkedHashMap<>();
    static {
        COLUMNS.put("height", "身高");
        COLUMNS.put("weight", "体重");
        COLUMNS.put("sitHeight", "坐高");
        COLUMNS.put("bodyFatRate", "体脂率");
        COLUMNS.put("waist", "腰围");
    }

    @Autowired private TabularFileReader reader;
    @Autowired private AthleteImportResolver resolver;
    @Autowired private InputRangeValidator rangeValidator;
    @Autowired private ImportDraftStore draftStore;
    @Autowired private IApmsBodyMeasureService measureService;
    @Autowired private ApmsBodyMeasureMapper measureMapper;

    public ImportPreviewVo preview(MultipartFile file, Long userId) {
        List<String[]> matrix;
        try {
            matrix = reader.read(file.getInputStream(), file.getOriginalFilename());
        } catch (Exception e) {
            throw new ServiceException("文件读取失败：" + e.getMessage());
        }

        ImportPreviewVo vo = new ImportPreviewVo();
        vo.setDomain(DOMAIN);
        // headers 仅放动态数据列（行号/运动员/日期为固定列，由前端组件固定渲染）
        COLUMNS.forEach((k, label) -> vo.getHeaders().add(new Header(k, label, null)));

        // 定位表头
        int headerIdx = -1;
        for (int i = 0; i < matrix.size(); i++) {
            String[] l = matrix.get(i);
            if (l.length == 0) continue;
            String first = l[0] == null ? "" : l[0].trim();
            if (first.startsWith("#")) continue;
            if (allBlank(l)) continue;
            headerIdx = i;
            break;
        }
        if (headerIdx < 0) {
            vo.getErrors().add("缺少表头行（需包含 athlete_id、measure_date 列）");
            return vo;
        }
        String[] header = matrix.get(headerIdx);
        int idIdx = -1, nameIdx = -1, dateIdx = -1;
        Map<String, Integer> colIdx = new LinkedHashMap<>();
        for (int i = 0; i < header.length; i++) {
            String h = norm(header[i]);
            if ("athleteid".equals(h)) idIdx = i;
            else if ("athletename".equals(h)) nameIdx = i;
            else if ("measuredate".equals(h)) dateIdx = i;
            else if (COLUMNS.containsKey(h)) colIdx.put(h, i);
        }
        if (idIdx < 0 || dateIdx < 0) {
            vo.getErrors().add("缺少必须列：athlete_id、measure_date");
            return vo;
        }

        BodyImportDraft draft = new BodyImportDraft();
        draft.setDomain(DOMAIN);
        draft.setUserId(userId);
        boolean hasImportConflict = false;

        for (int lineNo = headerIdx + 1; lineNo < matrix.size(); lineNo++) {
            String[] cols = matrix.get(lineNo);
            if (allBlank(cols)) continue;
            if (cols[0] != null && cols[0].trim().startsWith("#")) continue;

            RowVo rv = new RowVo();
            rv.lineNo = lineNo + 1;
            List<String> rowErrors = new ArrayList<>();

            String idRaw = cell(cols, idIdx);
            String nameRaw = nameIdx >= 0 ? cell(cols, nameIdx) : null;
            String dateRaw = cell(cols, dateIdx);
            rv.date = dateRaw;

            AthleteImportResolver.Result ar = resolver.resolve(idRaw, nameRaw);
            Long athleteId = null;
            if (!ar.matched) {
                rowErrors.add(ar.error);
            } else {
                rv.matched = true;
                athleteId = ar.athlete.getAthleteId();
                rv.athleteId = athleteId;
                rv.athleteName = ar.athlete.getName();
                if (ar.warning != null) vo.getWarnings().add("第 " + rv.lineNo + " 行：" + ar.warning);
            }

            Date measureDate = null;
            if (dateRaw == null || dateRaw.isEmpty()) {
                rowErrors.add("测量日期为空");
            } else {
                try {
                    measureDate = ResultTabularParser.parseMeasureDate(dateRaw);
                } catch (ParseException e) {
                    rowErrors.add("日期格式错误：" + dateRaw);
                }
            }

            // 5 个数值字段
            ApmsBodyMeasure probe = new ApmsBodyMeasure();
            boolean hasAnyValue = false;
            boolean rowWarn = false;
            for (Map.Entry<String, String> e : COLUMNS.entrySet()) {
                String key = e.getKey();
                Integer ci = colIdx.get(key);
                String raw = ci == null ? null : cell(cols, ci);
                if (raw == null || raw.isEmpty()) continue;
                hasAnyValue = true;
                CellVo cv = new CellVo();
                cv.key = key;
                cv.raw = raw;
                BigDecimal num;
                try {
                    num = new BigDecimal(raw.trim());
                } catch (NumberFormatException ex) {
                    num = null;
                }
                if (num == null) {
                    cv.status = "error";
                    cv.message = "必须是数字";
                    rowErrors.add(e.getValue() + " 必须是数字：" + raw);
                } else {
                    setField(probe, key, num);
                    String level = rangeValidator.classifyBody(probe).get(key);
                    if ("hard-low".equals(level) || "hard-high".equals(level)) {
                        cv.status = "error";
                        cv.message = "超出允许范围";
                        rowErrors.add(e.getValue() + " " + num + " 超出允许范围");
                    } else if ("warn-low".equals(level) || "warn-high".equals(level)) {
                        cv.status = "warn";
                        rowWarn = true;
                    } else {
                        cv.status = "ok";
                    }
                }
                rv.cells.add(cv);
            }
            if (!hasAnyValue) rowErrors.add("没有任何测量数据");

            // 冲突检查（人、日期都有效时）
            if (athleteId != null && measureDate != null) {
                ApmsBodyMeasure q = new ApmsBodyMeasure();
                q.setAthleteId(athleteId);
                q.setMeasureDate(measureDate);
                List<ApmsBodyMeasure> conflicts = measureMapper.selectConflictOnDate(q);
                if (conflicts != null && !conflicts.isEmpty()) {
                    ApmsBodyMeasure existing = conflicts.get(0);
                    if ("import".equalsIgnoreCase(existing.getDataSource())) {
                        rv.conflict = new ConflictVo("IMPORT_CONFLICT", existing.getId(), existing.getDataSource());
                        hasImportConflict = true;
                    } else {
                        rowErrors.add("当天已有" + sourceLabel(existing.getDataSource()) + "记录，不能覆盖");
                    }
                }
            }

            if (!rowErrors.isEmpty()) {
                rv.rowError = String.join("；", rowErrors);
                vo.getSummary().error++;
            } else {
                if (rv.conflict != null) {
                    vo.getSummary().importConflict++;
                } else if (rowWarn) {
                    vo.getSummary().warn++;
                } else {
                    vo.getSummary().valid++;
                }
                DraftRow dr = new DraftRow();
                dr.lineNo = rv.lineNo;
                dr.athleteId = athleteId;
                dr.measureDate = dateRaw;
                dr.height = probe.getHeight();
                dr.weight = probe.getWeight();
                dr.sitHeight = probe.getSitHeight();
                dr.bodyFatRate = probe.getBodyFatRate();
                dr.waist = probe.getWaist();
                if (rv.conflict != null) dr.conflictExistingId = rv.conflict.existingId;
                draft.getRows().add(dr);
            }
            vo.getSummary().total++;
            vo.getRows().add(rv);
        }

        vo.setAllowOverwriteOption(hasImportConflict);
        if (vo.getErrors().isEmpty()) {
            vo.setToken(draftStore.saveDraft(DOMAIN, draft));
        }
        return vo;
    }

    /** 提交（overwriteImport 仅作用于 IMPORT_CONFLICT 行） */
    public Object commit(String token, boolean overwriteImport, Long userId) {
        BodyImportDraft draft = draftStore.acquire(DOMAIN, token, userId, BodyImportDraft.class);
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
        for (DraftRow row : draft.getRows()) {
            String who = "第 " + row.lineNo + " 行（运动员 " + row.athleteId + "）";
            if (!resolver.existsInScope(row.athleteId)) {
                result.setFailed(result.getFailed() + 1);
                result.getFailedDetails().add(who + "：运动员已不在当前数据权限范围内，未导入");
                continue;
            }

            if (row.isConflict()) {
                if (!overwriteImport) {
                    result.setSkipped(result.getSkipped() + 1);
                    result.getSkippedDetails().add(who + "：当天已有导入数据，未勾选覆盖，跳过");
                    continue;
                }
                // 重查：仍必须是 import 来源才允许覆盖
                ApmsBodyMeasure m = measureMapper.selectById(row.conflictExistingId);
                if (m == null || !"import".equalsIgnoreCase(m.getDataSource())) {
                    result.setFailed(result.getFailed() + 1);
                    result.getFailedDetails().add(who + "：原导入记录来源已变化，未覆盖");
                    continue;
                }
                try {
                    measureService.importUpdateImported(row.conflictExistingId, toMeasure(row));
                    result.setCommitted(result.getCommitted() + 1);
                } catch (Exception e) {
                    result.setFailed(result.getFailed() + 1);
                    result.getFailedDetails().add(who + "：" + e.getMessage());
                }
                continue;
            }

            try {
                measureService.importInsert(toMeasure(row));
                result.setCommitted(result.getCommitted() + 1);
            } catch (Exception e) {
                result.setFailed(result.getFailed() + 1);
                result.getFailedDetails().add(who + "：" + e.getMessage());
            }
        }
        draftStore.complete(DOMAIN, token, result);
        return result;
    }

    // ================= 工具 =================

    private ApmsBodyMeasure toMeasure(DraftRow row) {
        ApmsBodyMeasure m = new ApmsBodyMeasure();
        m.setAthleteId(row.athleteId);
        try {
            m.setMeasureDate(ResultTabularParser.parseMeasureDate(row.measureDate));
        } catch (ParseException e) {
            // preview 已校验，理论不会发生
            throw new ServiceException("日期格式错误：" + row.measureDate);
        }
        m.setHeight(row.height);
        m.setWeight(row.weight);
        m.setSitHeight(row.sitHeight);
        m.setBodyFatRate(row.bodyFatRate);
        m.setWaist(row.waist);
        return m;
    }

    private void setField(ApmsBodyMeasure m, String key, BigDecimal v) {
        switch (key) {
            case "height" -> m.setHeight(v);
            case "weight" -> m.setWeight(v);
            case "sitHeight" -> m.setSitHeight(v);
            case "bodyFatRate" -> m.setBodyFatRate(v);
            case "waist" -> m.setWaist(v);
            default -> { }
        }
    }

    private String sourceLabel(String source) {
        if (source == null) return "其他";
        return switch (source) {
            case "manual" -> "手工";
            case "task" -> "任务";
            case "cycle" -> "周期";
            default -> source.startsWith("DEVICE") ? "设备" : source;
        };
    }

    /** 表头归一：去空格/下划线/连字符并小写（sit_height → sitHeight 驼峰） */
    private String norm(String h) {
        if (h == null) return "";
        String s = h.trim();
        StringBuilder out = new StringBuilder();
        boolean upperNext = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '_' || c == '-' || c == ' ') { upperNext = true; continue; }
            out.append(upperNext ? Character.toUpperCase(c) : Character.toLowerCase(c));
            upperNext = false;
        }
        return out.toString();
    }

    private String cell(String[] cols, int idx) {
        if (idx < 0 || idx >= cols.length || cols[idx] == null) return null;
        String v = cols[idx].trim();
        return v.isEmpty() ? null : v;
    }

    private boolean allBlank(String[] cols) {
        if (cols == null || cols.length == 0) return true;
        for (String c : cols) {
            if (c != null && !c.trim().isEmpty()) return false;
        }
        return true;
    }
}
