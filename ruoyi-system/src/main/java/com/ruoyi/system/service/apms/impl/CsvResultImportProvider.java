package com.ruoyi.system.service.apms.impl;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelMapper;
import com.ruoyi.system.service.apms.IApmsTestResultService;
import com.ruoyi.system.service.apms.ITestResultImportProvider;

/**
 * CSV 测试结果导入实现
 *
 * <p>
 * 格式约定（UTF-8）：
 * <pre>
 *   athlete_id,measure_date,session_key,HEIGHT,WEIGHT,50M_SPRINT,RSA_10X40
 *   1001,2026-09-18,S1,178.5,72.3,5.21,"5.21,5.34,5.19,5.28,5.31,5.22,5.30,5.26,5.24,5.27"
 * </pre>
 *
 * <p>
 * 写操作（persist）调用链路复用现有 ApmsTestResultServiceImpl.add()：
 *   add() → 自动 autoSelectBest + computeRep + TaskProgressService.recalculate + BodyMeasureSync
 *   所以 CSV 导入天然触发任务进度刷新和体态同步。
 *
 * @author apms
 */
@Service
public class CsvResultImportProvider implements ITestResultImportProvider {

    private static final String[] REQUIRED_HEADERS = {"athlete_id", "measure_date"};

    @Autowired private ApmsIndicatorMapper       indicatorMapper;
    @Autowired private ApmsTestModelMapper       modelMapper;
    @Autowired private ApmsAthleteMapper         athleteMapper;
    @Autowired private IApmsTestResultService    testResultService;

    // ============== 解析阶段 ==============

    @Override
    public ImportResult parse(InputStream inputStream, Long taskId) {
        ImportResult result = new ImportResult();
        result.headerToIndicatorId = new LinkedHashMap<>();
        result.headerToModelId     = new LinkedHashMap<>();
        result.headerToType        = new LinkedHashMap<>();
        result.headerMultiValues   = new LinkedHashMap<>();

        List<String[]> lines = parseCsvLines(inputStream);
        if (lines.isEmpty()) {
            result.errorRows.add("CSV 文件为空");
            return result;
        }

        String[] header = lines.get(0);

        // 1. 校验必须列 + 解析指标/模型列
        int athleteIdx = -1, dateIdx = -1, sessionIdx = -1;
        for (int i = 0; i < header.length; i++) {
            String h = header[i].trim().toLowerCase();
            if ("athlete_id".equals(h)) athleteIdx = i;
            else if ("measure_date".equals(h)) dateIdx = i;
            else if ("session_key".equals(h)) sessionIdx = i;
            else resolveHeader(h, i, result);
        }

        if (athleteIdx < 0 || dateIdx < 0) {
            result.errorRows.add("缺少必须列：" + Arrays.toString(REQUIRED_HEADERS));
            return result;
        }
        if (result.headerToIndicatorId.isEmpty() && result.headerToModelId.isEmpty()) {
            result.warnings.add("CSV 没有任何可识别的指标列（请检查列名是否匹配 indicator.code 或 model.code）");
        }

        // 2. 解析数据行
        for (int lineNo = 1; lineNo < lines.size(); lineNo++) {
            String[] cols = lines.get(lineNo);
            if (cols.length == 0 || cols[0].trim().isEmpty()) continue; // 跳过空行

            ImportResult.Row row = new ImportResult.Row();
            row.lineNo = lineNo + 1; // CSV 从 1 计数
            row.measureDate = get(cols, dateIdx);
            row.sessionKey  = sessionIdx >= 0 ? get(cols, sessionIdx) : null;

            // athlete_id 可能是纯数字也可能是名字，先当数字解析，失败当名字查
            String athleteRaw = get(cols, athleteIdx);
            row.athleteId = resolveAthleteId(athleteRaw);
            if (row.athleteId == null) {
                result.errorRows.add("第 " + row.lineNo + " 行：athlete_id='" + athleteRaw + "' 无法解析");
                continue;
            }

            // 收集指标值
            for (Map.Entry<String, Long> e : result.headerToIndicatorId.entrySet()) {
                String headerName = e.getKey();
                int colIdx = indexOfHeader(header, headerName);
                String val = colIdx >= 0 ? get(cols, colIdx) : null;
                if (val != null && !val.trim().isEmpty()) {
                    row.values.put(headerName, val.trim());
                }
            }
            // 同理 model 列
            for (Map.Entry<String, Long> e : result.headerToModelId.entrySet()) {
                String headerName = e.getKey();
                int colIdx = indexOfHeader(header, headerName);
                String val = colIdx >= 0 ? get(cols, colIdx) : null;
                if (val != null && !val.trim().isEmpty()) {
                    row.values.put(headerName, val.trim());
                }
            }

            if (row.values.isEmpty()) {
                result.warnings.add("第 " + row.lineNo + " 行：运动员 " + row.athleteId + " 没有任何指标值，跳过");
            } else {
                result.rows.add(row);
            }
        }

        return result;
    }

    /** 表头 → indicator_id / model_id 匹配 + 警告提示 */
    private void resolveHeader(String header, int colIdx, ImportResult result) {
        // 先查 indicator.code（大小写不敏感）
        ApmsIndicator ind = indicatorMapper.selectByCode(header);
        if (ind != null) {
            result.headerToIndicatorId.put(header, ind.getId());
            result.headerToType.put(header, "indicator");
            return;
        }
        // 再查 model.code
        ApmsTestModel model = modelMapper.selectByCode(header);
        if (model != null) {
            result.headerToModelId.put(header, model.getId());
            result.headerToType.put(header, "model");
            return;
        }
        // 都没找到 → 警告并忽略
        result.warnings.add("列名 '" + header + "' 未匹配到任何 indicator.code 或 model.code，已忽略");
    }

    private int indexOfHeader(String[] header, String name) {
        for (int i = 0; i < header.length; i++) {
            if (name.equalsIgnoreCase(header[i].trim())) return i;
        }
        return -1;
    }

    private String get(String[] cols, int idx) {
        if (idx < 0 || idx >= cols.length) return null;
        String v = cols[idx];
        return v != null ? v.trim() : null;
    }

    /** athlete_id 可以是数字 ID 也可以是名字 → 先数字解析，失败当名字查库 */
    private Long resolveAthleteId(String raw) {
        if (raw == null || raw.trim().isEmpty()) return null;
        // 尝试直接转 Long
        try {
            long id = Long.parseLong(raw.trim());
            ApmsAthlete a = athleteMapper.selectApmsAthleteByAthleteId(id);
            if (a != null) return a.getAthleteId();
        } catch (NumberFormatException ignored) {}

        // 当名字查
        ApmsAthlete query = new ApmsAthlete();
        query.setName(raw.trim());
        List<ApmsAthlete> list = athleteMapper.selectApmsAthleteList(query);
        if (list.size() == 1) return list.get(0).getAthleteId();
        if (list.size() > 1) return list.get(0).getAthleteId(); // 重名取第一个
        return null;
    }

    // ============== 持久化阶段 ==============

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int persist(ImportResult parsed) {
        int written = 0;
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd");

        for (ImportResult.Row row : parsed.rows) {
            Date measureDate;
            try {
                measureDate = fmt.parse(row.measureDate);
            } catch (ParseException e) {
                throw new ServiceException("第 " + row.lineNo + " 行 measure_date 格式错误：" + row.measureDate);
            }

            // 每个指标列 → 一条 ApmsTestResult + ApmsTestResultValue
            for (Map.Entry<String, String> valEntry : row.values.entrySet()) {
                String headerName = valEntry.getKey();
                String rawValue = valEntry.getValue();

                Long indicatorId = parsed.headerToIndicatorId.get(headerName);
                Long modelId     = parsed.headerToModelId.get(headerName);

                ApmsTestResult result = new ApmsTestResult();
                result.setAthleteId(row.athleteId);
                result.setMeasureDate(measureDate);
                result.setSessionKey(row.sessionKey);
                result.setIsValid("1");
                result.setIsSelected("0"); // 先不选，由 autoSelectBest 决定

                if (indicatorId != null) {
                    result.setItemType("INDICATOR");
                    result.setIndicatorId(indicatorId);
                } else if (modelId != null) {
                    result.setItemType("MODEL");
                    result.setModelId(modelId);
                }

                // 组装 values
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

                // 委托 Service.add() — 触发完整链式：autoSelectBest + TaskProgress + BodyMeasureSync + RSA
                testResultService.add(result, Collections.singletonList(rv));

                written++;
            }
        }

        parsed.writtenResultCount = written;
        return written;
    }

    // ============== CSV 解析 ==============

    /**
     * 简易 CSV 解析 — 支持引号包裹（引号内逗号不分割）、双引号转义
     *
     * <p>不用 OpenCSV / Commons CSV，够用。每行 → 一个 String[]。
     */
    private List<String[]> parseCsvLines(InputStream is) {
        List<String[]> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                result.add(parseOneLine(line));
            }
        } catch (Exception e) {
            throw new ServiceException("CSV 解析失败：" + e.getMessage());
        }
        return result;
    }

    /**
     * 解析单行 CSV
     */
    private String[] parseOneLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuote = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuote) {
                if (c == '"') {
                    // 检查是不是双引号转义
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++; // 跳过第二个引号
                    } else {
                        inQuote = false;
                    }
                } else {
                    cur.append(c);
                }
            } else {
                if (c == '"') {
                    inQuote = true;
                } else if (c == ',') {
                    fields.add(cur.toString());
                    cur.setLength(0);
                } else {
                    cur.append(c);
                }
            }
        }
        // 最后一个字段
        fields.add(cur.toString());

        // 去掉 BOM（如果有）
        if (!fields.isEmpty() && fields.get(0).length() > 0 && fields.get(0).charAt(0) == 0xFEFF) {
            String first = fields.get(0);
            fields.set(0, first.substring(1));
        }
        return fields.toArray(new String[0]);
    }
}
