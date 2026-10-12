package com.ruoyi.system.service.apms.batchimport;

import java.text.ParseException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsTestModel;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelMapper;
import com.ruoyi.system.service.apms.ITestResultImportProvider.ImportResult;

/**
 * 测试成绩表格解析（CSV/Excel 共用）：字符串矩阵 → ImportResult 草稿。
 *
 * <p><b>纯解析，不做人员匹配</b>：行只保留 athleteIdRaw/athleteNameRaw 原始串。
 * 旧 CSV 链路在此之后走 legacy 人员解析；新两阶段导入走 AthleteImportResolver。
 *
 * @author apms
 */
@Component
public class ResultTabularParser {

    @Autowired
    private ApmsIndicatorMapper indicatorMapper;

    @Autowired
    private ApmsTestModelMapper modelMapper;

    /**
     * @param lines  含表头的字符串矩阵
     * @param taskId 接口参数任务（散录为 null）
     */
    public ImportResult parseRows(List<String[]> lines, Long taskId) {
        ImportResult result = new ImportResult();
        result.headerToIndicatorId = new LinkedHashMap<>();
        result.headerToModelId = new LinkedHashMap<>();
        result.headerToType = new LinkedHashMap<>();
        result.headerMultiValues = new LinkedHashMap<>();

        if (lines.isEmpty()) {
            result.errorRows.add("文件为空");
            return result;
        }

        // 跳过 # 说明行与空行定位机器表头
        int headerLineIdx = -1;
        for (int i = 0; i < lines.size(); i++) {
            String[] l = lines.get(i);
            if (isAllBlank(l)) continue;
            if (l[0].trim().startsWith("#")) continue;
            headerLineIdx = i;
            break;
        }
        if (headerLineIdx < 0) {
            result.errorRows.add("缺少表头行（需包含 athlete_id、measure_date 列）");
            return result;
        }
        String[] header = lines.get(headerLineIdx);

        int athleteIdx = -1, dateIdx = -1, sessionIdx = -1, taskIdx = -1, nameIdx = -1;
        for (int i = 0; i < header.length; i++) {
            String h = header[i].trim().toLowerCase();
            if ("athlete_id".equals(h)) athleteIdx = i;
            else if ("athlete_name".equals(h)) nameIdx = i;
            else if ("measure_date".equals(h)) dateIdx = i;
            else if ("session_key".equals(h)) sessionIdx = i;
            else if ("task_id".equals(h)) taskIdx = i;
            else resolveHeader(h, result);
        }

        if (athleteIdx < 0 || dateIdx < 0) {
            result.errorRows.add("缺少必须列：athlete_id、measure_date");
            return result;
        }
        if (result.headerToIndicatorId.isEmpty() && result.headerToModelId.isEmpty()) {
            result.warnings.add("没有任何可识别的指标列（请检查列名是否匹配 indicator.code 或 model.code）");
        }

        for (int lineNo = headerLineIdx + 1; lineNo < lines.size(); lineNo++) {
            String[] cols = lines.get(lineNo);
            if (isAllBlank(cols)) continue;
            if (cols[0].trim().startsWith("#")) continue;

            ImportResult.Row row = new ImportResult.Row();
            row.lineNo = lineNo + 1;
            row.measureDate = get(cols, dateIdx);
            row.sessionKey = sessionIdx >= 0 ? get(cols, sessionIdx) : null;
            row.athleteIdRaw = get(cols, athleteIdx);
            row.athleteNameRaw = nameIdx >= 0 ? get(cols, nameIdx) : null;

            String rowTaskRaw = taskIdx >= 0 ? get(cols, taskIdx) : null;
            if (rowTaskRaw != null && !rowTaskRaw.isEmpty()) {
                try {
                    row.taskId = Long.parseLong(rowTaskRaw);
                } catch (NumberFormatException e) {
                    result.errorRows.add("第 " + row.lineNo + " 行：task_id='" + rowTaskRaw + "' 不是数字");
                    continue;
                }
            } else {
                row.taskId = taskId;
            }

            for (String headerName : result.headerToIndicatorId.keySet()) {
                String val = valueAt(header, cols, headerName);
                if (val != null && !val.trim().isEmpty()) row.values.put(headerName, val.trim());
            }
            for (String headerName : result.headerToModelId.keySet()) {
                String val = valueAt(header, cols, headerName);
                if (val != null && !val.trim().isEmpty()) row.values.put(headerName, val.trim());
            }

            if (row.values.isEmpty() && (row.athleteIdRaw != null || row.athleteNameRaw != null)) {
                result.warnings.add("第 " + row.lineNo + " 行：没有任何指标值，跳过");
            }
            // 行保留（人员/值合法性由后续链路判定）
            result.rows.add(row);
        }
        return result;
    }

    private void resolveHeader(String header, ImportResult result) {
        ApmsIndicator ind = indicatorMapper.selectByCode(header);
        if (ind != null) {
            result.headerToIndicatorId.put(header, ind.getId());
            result.headerToType.put(header, "indicator");
            return;
        }
        ApmsTestModel model = modelMapper.selectByCode(header);
        if (model != null) {
            result.headerToModelId.put(header, model.getId());
            result.headerToType.put(header, "model");
            return;
        }
        result.warnings.add("列名 '" + header + "' 未匹配到任何 indicator.code 或 model.code，已忽略");
    }

    private String valueAt(String[] header, String[] cols, String name) {
        int idx = -1;
        for (int i = 0; i < header.length; i++) {
            if (name.equalsIgnoreCase(header[i].trim())) { idx = i; break; }
        }
        return idx >= 0 && idx < cols.length ? cols[idx] : null;
    }

    private String get(String[] cols, int idx) {
        if (idx < 0 || idx >= cols.length) return null;
        return cols[idx] != null ? cols[idx].trim() : null;
    }

    private boolean isAllBlank(String[] cols) {
        if (cols == null || cols.length == 0) return true;
        return Arrays.stream(cols).allMatch(c -> c == null || c.trim().isEmpty());
    }

    /**
     * 日期解析（与历史 CSV 导入同口径白名单）：YYYY-MM-DD / YYYY/M.D / YYYY.M.D，
     * 尾部时间截断；非法抛 ParseException。
     */
    public static Date parseMeasureDate(String raw) throws ParseException {
        if (raw == null || raw.trim().isEmpty()) throw new ParseException("日期为空", 0);
        String s = raw.trim();
        int cut = s.length();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == ' ' || c == 'T' || c == '\t') { cut = i; break; }
        }
        s = s.substring(0, cut).replace('/', '-').replace('.', '-');
        if (!s.matches("\\d{4}-\\d{1,2}-\\d{1,2}")) {
            throw new ParseException("不支持的日期格式: " + raw, 0);
        }
        try {
            LocalDate ld = LocalDate.parse(s, DateTimeFormatter.ofPattern("yyyy-M-d"));
            return java.sql.Date.valueOf(ld);
        } catch (DateTimeParseException e) {
            throw new ParseException("非法日期: " + raw, 0);
        }
    }
}
