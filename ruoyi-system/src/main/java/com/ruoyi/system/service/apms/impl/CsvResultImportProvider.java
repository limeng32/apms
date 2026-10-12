package com.ruoyi.system.service.apms.impl;

import java.io.InputStream;
import java.math.BigDecimal;
import java.text.ParseException;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.service.apms.IApmsTestResultService;
import com.ruoyi.system.service.apms.ITestResultImportProvider;
import com.ruoyi.system.service.apms.batchimport.ResultTabularParser;
import com.ruoyi.system.service.apms.batchimport.TabularFileReader;

/**
 * CSV 测试结果导入实现（历史链路，行为保持不变）。
 *
 * <p>
 * 链路：TabularFileReader 读 CSV → ResultTabularParser 纯解析（不做人员匹配）
 * → {@link #legacyResolveAthlete}（旧规则：数字 ID 优先，失败按姓名 LIKE 取第一条）
 * → persist。
 *
 * <p>新两阶段批量导入（预览/精确匹配/DataScope/Excel）走 batchimport 包，与本类无关。
 *
 * @author apms
 */
@Service
public class CsvResultImportProvider implements ITestResultImportProvider {

    @Autowired private ApmsAthleteMapper       athleteMapper;
    @Autowired private ApmsTaskItemMapper      taskItemMapper;
    @Autowired private IApmsTestResultService  testResultService;
    @Autowired private TabularFileReader       tabularFileReader;
    @Autowired private ResultTabularParser     tabularParser;

    @Override
    public ImportResult parse(InputStream inputStream, Long taskId) {
        List<String[]> lines = tabularFileReader.read(inputStream, "import.csv");
        ImportResult result = tabularParser.parseRows(lines, taskId);
        legacyResolveAthlete(result);
        return result;
    }

    /**
     * 旧人员解析规则（仅历史 /import/csv 使用，新批量导入已禁用）：
     * athlete_id 数字优先精确查；失败/非数字按姓名走列表查询（LIKE），
     * 重名取第一条。无法解析的行从 rows 移除并记入 errorRows。
     */
    public void legacyResolveAthlete(ImportResult result) {
        var it = result.rows.iterator();
        while (it.hasNext()) {
            ImportResult.Row row = it.next();
            String raw = (row.athleteIdRaw != null && !row.athleteIdRaw.isEmpty())
                    ? row.athleteIdRaw : row.athleteNameRaw;
            Long id = legacyResolveAthleteId(raw);
            if (id == null) {
                result.errorRows.add("第 " + row.lineNo + " 行：athlete_id='" + raw + "' 无法解析");
                it.remove();
                continue;
            }
            row.athleteId = id;
        }
    }

    private Long legacyResolveAthleteId(String raw) {
        if (raw == null || raw.trim().isEmpty()) return null;
        try {
            long id = Long.parseLong(raw.trim());
            ApmsAthlete a = athleteMapper.selectApmsAthleteByAthleteId(id);
            if (a != null) return a.getAthleteId();
        } catch (NumberFormatException ignored) {}

        ApmsAthlete query = new ApmsAthlete();
        query.setName(raw.trim());
        List<ApmsAthlete> list = athleteMapper.selectApmsAthleteList(query);
        if (!list.isEmpty()) return list.get(0).getAthleteId(); // 旧规则：重名取第一条
        return null;
    }

    // ============== 持久化阶段 ==============

    /** 加载任务测试项索引："I:"+indicatorId / "M:"+modelId → taskItemId */
    private Map<String, Long> loadTaskItemIndex(Long taskId) {
        Map<String, Long> index = new HashMap<>();
        for (ApmsTaskItem item : taskItemMapper.selectByTaskId(taskId)) {
            if ("INDICATOR".equals(item.getItemType()) && item.getIndicatorId() != null) {
                index.put("I:" + item.getIndicatorId(), item.getId());
            } else if ("MODEL".equals(item.getItemType()) && item.getModelId() != null) {
                index.put("M:" + item.getModelId(), item.getId());
            }
        }
        return index;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int persist(ImportResult parsed) {
        int written = 0;
        Map<Long, Map<String, Long>> taskItemCache = new HashMap<>();

        for (ImportResult.Row row : parsed.rows) {
            Date measureDate;
            try {
                measureDate = ResultTabularParser.parseMeasureDate(row.measureDate);
            } catch (ParseException e) {
                throw new ServiceException("第 " + row.lineNo + " 行 measure_date 格式错误："
                        + row.measureDate + "（支持 YYYY-MM-DD 或 YYYY/MM/DD）");
            }
            Map<String, Long> itemIndex = row.taskId == null ? null
                    : taskItemCache.computeIfAbsent(row.taskId, this::loadTaskItemIndex);

            for (Map.Entry<String, String> valEntry : row.values.entrySet()) {
                String headerName = valEntry.getKey();
                String rawValue = valEntry.getValue();

                Long indicatorId = parsed.headerToIndicatorId.get(headerName);
                Long modelId     = parsed.headerToModelId.get(headerName);

                ApmsTestResult result = new ApmsTestResult();
                result.setAthleteId(row.athleteId);
                result.setTaskId(row.taskId);
                result.setMeasureDate(measureDate);
                result.setSessionKey(row.sessionKey);
                result.setIsValid("1");
                result.setDataSource("CSV_IMPORT");

                if (indicatorId != null) {
                    result.setItemType("INDICATOR");
                    result.setIndicatorId(indicatorId);
                    if (itemIndex != null) {
                        result.setTaskItemId(itemIndex.get("I:" + indicatorId));
                    }
                } else if (modelId != null) {
                    result.setItemType("MODEL");
                    result.setModelId(modelId);
                    if (itemIndex != null) {
                        result.setTaskItemId(itemIndex.get("M:" + modelId));
                    }
                }

                ApmsTestResultValue rv = new ApmsTestResultValue();
                rv.setIndicatorId(indicatorId);
                rv.setModelId(modelId);
                rv.setFieldKey("result");
                rv.setIsDerived("0");
                try {
                    rv.setNumericValue(new BigDecimal(rawValue));
                } catch (NumberFormatException e) {
                    rv.setTextValue(rawValue);
                }

                testResultService.add(result, Collections.singletonList(rv));
                written++;
            }
        }

        parsed.writtenResultCount = written;
        return written;
    }
}
