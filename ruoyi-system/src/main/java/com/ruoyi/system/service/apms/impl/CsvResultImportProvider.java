package com.ruoyi.system.service.apms.impl;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelMapper;
import com.ruoyi.system.service.apms.IApmsTestResultService;
import com.ruoyi.system.service.apms.ITestResultImportProvider;

/**
 * CSV 测试结果导入实现
 *
 * <p>
 * 格式约定（UTF-8）：
 * <pre>
 *   #运动员ID,运动员姓名,测试日期,场次,身高(cm),体重(kg),RSA(10×40)
 *   athlete_id,athlete_name,measure_date,session_key,HEIGHT,WEIGHT,RSA_10X40
 *   1001,张志远,2026-09-18,S1,178.5,72.3,"5.21,5.34,5.19,5.28,5.31,5.22,5.30,5.26,5.24,5.27"
 * </pre>
 * 首行以 # 开头为中文说明行（整行忽略）；无说明行的旧格式同样兼容。
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
    @Autowired private ApmsTaskItemMapper        taskItemMapper;
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

        // 跳过以 # 开头的中文说明行与空行，定位机器表头（兼容无说明行的旧模板）
        int headerLineIdx = -1;
        for (int i = 0; i < lines.size(); i++) {
            String[] l = lines.get(i);
            if (isAllBlank(l)) continue;
            if (l[0].trim().startsWith("#")) continue;
            headerLineIdx = i;
            break;
        }
        if (headerLineIdx < 0) {
            result.errorRows.add("CSV 缺少表头行（需包含 athlete_id、measure_date 列）");
            return result;
        }
        String[] header = lines.get(headerLineIdx);

        // 1. 校验必须列 + 解析指标/模型列
        int athleteIdx = -1, dateIdx = -1, sessionIdx = -1, taskIdx = -1, nameIdx = -1;
        for (int i = 0; i < header.length; i++) {
            String h = header[i].trim().toLowerCase();
            if ("athlete_id".equals(h)) athleteIdx = i;
            else if ("athlete_name".equals(h)) nameIdx = i; // 模板保留列：仅核对/兜底，不作成绩列
            else if ("measure_date".equals(h)) dateIdx = i;
            else if ("session_key".equals(h)) sessionIdx = i;
            else if ("task_id".equals(h)) taskIdx = i;
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
        for (int lineNo = headerLineIdx + 1; lineNo < lines.size(); lineNo++) {
            String[] cols = lines.get(lineNo);
            if (isAllBlank(cols)) continue;  // 跳过整行空白
            if (cols[0].trim().startsWith("#")) continue; // 跳过说明/注释行（任务模板注释行首列 task_id 位置为 #...）

            ImportResult.Row row = new ImportResult.Row();
            row.lineNo = lineNo + 1; // CSV 从 1 计数
            row.measureDate = get(cols, dateIdx);
            row.sessionKey  = sessionIdx >= 0 ? get(cols, sessionIdx) : null;
            // 任务绑定：优先 CSV 行内 task_id 列，缺省用接口参数 taskId
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

            // athlete_id 可能是纯数字也可能是名字；ID 列留空时回退用 athlete_name 列解析
            String athleteRaw = get(cols, athleteIdx);
            if ((athleteRaw == null || athleteRaw.isEmpty()) && nameIdx >= 0) {
                athleteRaw = get(cols, nameIdx);
            }
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

    /** 整行所有单元格都为空白（含首列留空、仅靠 athlete_name 列识别队员的行不能误跳） */
    private boolean isAllBlank(String[] cols) {
        if (cols == null || cols.length == 0) return true;
        for (String c : cols) {
            if (c != null && !c.trim().isEmpty()) return false;
        }
        return true;
    }

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

    /**
     * 解析测试日期。
     *
     * <p>兼容 WPS/Excel 编辑后保存的不同写法：
     * <ul>
     *   <li>YYYY-MM-DD（模板默认，如 2026-10-03）</li>
     *   <li>YYYY/MM/DD（Excel/WPS 常见，如 2026/10/03、2026/10/3，月日可不补零）</li>
     *   <li>YYYY.M.D 点号分隔也一并兼容</li>
     *   <li>尾部带时间（如 "2026/10/3 0:00"）时只取日期部分</li>
     * </ul>
     * 用正则白名单严格校验，避免 SimpleDateFormat 宽松解析产生歧义日期。
     */
    private Date parseMeasureDate(String raw) throws ParseException {
        if (raw == null || raw.trim().isEmpty()) throw new ParseException("日期为空", 0);
        String s = raw.trim();
        // 截掉时间部分：空格或 T 之后（2026/10/3 0:00、2026-10-03T08:00）
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int persist(ImportResult parsed) {
        int written = 0;
        // 任务测试项缓存：taskId → (指标/模型 → taskItemId)，用于把导入结果挂到任务进度上
        Map<Long, Map<String, Long>> taskItemCache = new HashMap<>();

        for (ImportResult.Row row : parsed.rows) {
            Date measureDate;
            try {
                measureDate = parseMeasureDate(row.measureDate);
            } catch (ParseException e) {
                throw new ServiceException("第 " + row.lineNo + " 行 measure_date 格式错误："
                        + row.measureDate + "（支持 YYYY-MM-DD 或 YYYY/MM/DD）");
            }
            Map<String, Long> itemIndex = row.taskId == null ? null
                    : taskItemCache.computeIfAbsent(row.taskId, this::loadTaskItemIndex);

            // 每个指标列 → 一条 ApmsTestResult + ApmsTestResultValue
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
                // 不显式置 is_selected：add() 默认选中并自动重算同组最佳
                // （任务内按 task_item 分组；无任务按 同队员+同指标 散录分组）
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
