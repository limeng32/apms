package com.ruoyi.system.service.apms.batchimport;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsTaskItem;
import com.ruoyi.system.domain.apms.ApmsTaskMember;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskMemberMapper;
import com.ruoyi.system.mapper.apms.ApmsTestResultMapper;
import com.ruoyi.system.mapper.apms.ApmsTestResultValueMapper;

/**
 * 两阶段批量导入模板生成（成绩 / 体态）。
 *
 * <p>当前批量导入入口仅下发 .xlsx 模板（csv 分支仅保留给历史兼容端点）。
 * 结构：第 1 行中文说明（首列以 # 开头，解析跳过）；第 2 行机器表头；
 * 第 3 行起预填在训队员（编号+姓名），日期与数值留空。
 * 成绩模板<b>仅含启用 INDICATOR 列</b>（MODEL 一期不支持批量导入）。
 *
 * @author apms
 */
@Component
public class ImportTemplates {

    @Autowired private ApmsIndicatorMapper indicatorMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsTaskItemMapper taskItemMapper;
    @Autowired private ApmsTaskMemberMapper taskMemberMapper;
    @Autowired private ApmsTestResultMapper resultMapper;
    @Autowired private ApmsTestResultValueMapper resultValueMapper;

    /**
     * 成绩模板。
     * @param taskId 非空 = 任务模式：只预填该任务参测队员、只列该任务 INDICATOR 指标（按测试项排序）；
     *               为空 = 散录：全部在训队员 + 全部启用指标
     */
    public byte[] buildResult(String format, Long taskId) {
        List<String> header = new ArrayList<>(List.of(
                "athlete_id", "athlete_name", "measure_date", "session_key"));
        List<String> guide = new ArrayList<>(List.of(
                "#运动员编号（优先填写；留空则按姓名精确匹配，重名必须填编号）",
                "运动员姓名（与系统一致，用于核对）",
                "测试日期(YYYY-MM-DD)",
                "场次（选填，如S1）"));

        List<String[]> athleteRows;
        if (taskId != null) {
            // 任务模式：成员 + 指标列均按任务配置，模板与预览/提交校验口径一致
            List<ApmsTaskItem> items = taskItemMapper.selectByTaskId(taskId);
            items.stream()
                    .filter(it -> "INDICATOR".equals(it.getItemType()) && it.getIndicatorId() != null)
                    .sorted(Comparator.comparingInt(it -> it.getSortOrder() == null ? 0 : it.getSortOrder()))
                    .forEach(it -> {
                        ApmsIndicator ind = indicatorMapper.selectById(it.getIndicatorId());
                        if (ind == null || ind.getCode() == null || ind.getCode().isEmpty()) return;
                        header.add(ind.getCode());
                        String g = ind.getName() != null ? ind.getName() : ind.getCode();
                        if (ind.getUnit() != null && !ind.getUnit().isEmpty()) g += "(" + ind.getUnit() + ")";
                        guide.add(g);
                    });
            // 含已录数据：有当前结果的成员按「人+日期+场次」展开数据行，无记录成员保留空白行
            athleteRows = taskRowsWithData(taskId, header);
        } else {
            ApmsIndicator iq = new ApmsIndicator();
            iq.setStatus("0");
            for (ApmsIndicator ind : indicatorMapper.selectList(iq)) {
                if (ind.getCode() == null || ind.getCode().isEmpty()) continue;
                header.add(ind.getCode());
                String g = ind.getName() != null ? ind.getName() : ind.getCode();
                if (ind.getUnit() != null && !ind.getUnit().isEmpty()) g += "(" + ind.getUnit() + ")";
                guide.add(g);
            }
            athleteRows = athleteNameRows(activeAthletes());
        }
        return build(format, "test-result-template", guide, header, athleteRows, true);
    }

    /**
     * 任务模式行构造（含已录数据）。
     * <p>口径：只取 is_selected=1 的当前结果（与台账「最新一次」展示口径一致），
     * 仅 INDICATOR（MODEL 不支持批量导入）；按 队员+测试日期+场次 分组，每组一行，
     * 各指标列填当前结果的 numericValue。有数据的成员不再出空白行；无任何记录的成员
     * 保留仅编号+姓名的空白行，等待补录。成员顺序沿用任务成员表，数据行按日期/场次稳定排序。
     */
    private List<String[]> taskRowsWithData(Long taskId, List<String> header) {
        // 指标 code → 列索引（前 4 列固定为编号/姓名/日期/场次）
        Map<String, Integer> codeToCol = new LinkedHashMap<>();
        for (int i = 4; i < header.size(); i++) codeToCol.put(header.get(i), i);

        ApmsTestResult q = new ApmsTestResult();
        q.setTaskId(taskId);
        q.setItemType("INDICATOR");
        q.setIsSelected("1");
        List<ApmsTestResult> results = resultMapper.selectList(q);

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
        // 分组 key = athleteId|date|session，保持插入有序：先按成员出现顺序，组内按日期/场次
        Map<String, String[]> dataRows = new LinkedHashMap<>();
        java.util.Set<Long> athletesWithData = new java.util.HashSet<>();

        for (ApmsTestResult r : results) {
            if (r.getAthleteId() == null || r.getIndicatorCode() == null) continue;
            Integer col = codeToCol.get(r.getIndicatorCode());
            if (col == null) continue; // 指标已被移出任务等历史脏数据，忽略
            String date = r.getMeasureDate() != null ? sdf.format(r.getMeasureDate()) : "";
            String session = r.getSessionKey() != null ? r.getSessionKey() : "";
            String key = r.getAthleteId() + "|" + date + "|" + session;
            String[] row = dataRows.computeIfAbsent(key, k -> {
                String[] nr = new String[header.size()];
                nr[0] = String.valueOf(r.getAthleteId());
                nr[1] = r.getAthleteName() != null ? r.getAthleteName() : "";
                nr[2] = date;
                nr[3] = session;
                return nr;
            });
            List<ApmsTestResultValue> values = resultValueMapper.selectByResultId(r.getId());
            if (values != null) {
                for (ApmsTestResultValue v : values) {
                    if (v.getNumericValue() == null) continue;
                    // 双保险：值行自带 indicatorCode 时以它为准，否则用结果主表的 code
                    String vc = v.getIndicatorCode() != null ? v.getIndicatorCode() : r.getIndicatorCode();
                    Integer vcCol = codeToCol.get(vc);
                    if (vcCol != null) row[vcCol] = v.getNumericValue().stripTrailingZeros().toPlainString();
                }
            }
            athletesWithData.add(r.getAthleteId());
        }

        List<String[]> out = new ArrayList<>(dataRows.values());
        // 无记录成员补空白行（沿用任务成员顺序），让每名参测队员都在模板里有落点
        for (ApmsTaskMember m : taskMemberMapper.selectByTaskId(taskId)) {
            if (m.getAthleteId() == null || athletesWithData.contains(m.getAthleteId())) continue;
            out.add(new String[]{
                    String.valueOf(m.getAthleteId()),
                    m.getAthleteName() != null ? m.getAthleteName() : ""});
        }
        return out;
    }

    public byte[] buildBody(String format) {
        List<String> guide = new ArrayList<>(List.of(
                "#运动员编号（优先填写；留空则按姓名精确匹配，重名必须填编号）",
                "运动员姓名（与系统一致，用于核对）",
                "测量日期(YYYY-MM-DD)",
                "身高(cm)", "体重(kg)", "坐高(cm)", "体脂率(%)", "腰围(cm)"));
        List<String> header = new ArrayList<>(List.of(
                "athlete_id", "athlete_name", "measure_date",
                "height", "weight", "sit_height", "body_fat_rate", "waist"));
        return build(format, "body-measure-template", guide, header, athleteNameRows(activeAthletes()), false);
    }

    // ================= 内部 =================

    /** @param athleteRows 宽度可为 2（仅编号/姓名，其余留空）或与 header 等宽（含已录数据）；
     *  @param hasSession 是否含 session_key 列（成绩有，体态无） */
    private byte[] build(String format, String fileBaseName, List<String> guide,
                         List<String> header, List<String[]> athleteRows, boolean hasSession) {
        if ("csv".equalsIgnoreCase(format)) {
            return buildCsv(guide, header, athleteRows, hasSession);
        }
        return buildXlsx(fileBaseName, guide, header, athleteRows, hasSession);
    }

    /** 在训队员（编号列表） */
    private List<long[]> activeAthletes() {
        List<long[]> rows = new ArrayList<>();
        ApmsAthlete q = new ApmsAthlete();
        q.setStatus("0");
        for (ApmsAthlete a : athleteMapper.selectApmsAthleteList(q)) {
            if (a.getAthleteId() != null) rows.add(new long[]{a.getAthleteId()});
        }
        return rows;
    }

    private List<String[]> athleteNameRows(List<long[]> athletes) {
        // 编号 → 姓名（单查；模板生成是低频操作）
        List<String[]> rows = new ArrayList<>();
        for (long[] r : athletes) {
            long id = r[0];
            ApmsAthlete a = athleteMapper.selectApmsAthleteByAthleteId(id);
            rows.add(new String[]{String.valueOf(id), a != null && a.getName() != null ? a.getName() : ""});
        }
        return rows;
    }

    private byte[] buildCsv(List<String> guide, List<String> header,
                            List<String[]> athleteRows, boolean hasSession) {
        StringBuilder sb = new StringBuilder();
        sb.append(guide.stream().map(this::csv).reduce((a, b) -> a + "," + b).orElse("")).append("\r\n");
        sb.append(String.join(",", header)).append("\r\n");
        for (String[] r : athleteRows) {
            sb.append(csv(r[0])).append(',').append(csv(r[1]));
            // 宽行（含已录数据）逐列输出；窄行（仅编号/姓名）剩余列留空
            for (int i = 2; i < header.size(); i++) {
                sb.append(',');
                if (r.length > i && r[i] != null) sb.append(csv(r[i]));
            }
            sb.append("\r\n");
        }
        // UTF-8 BOM
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] bom = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return out;
    }

    /** measure_date 列固定为第 3 列（成绩/体态模板同构：编号、姓名、日期…） */
    private static final int DATE_COL_IDX = 2;

    private byte[] buildXlsx(String sheetName, List<String> guide, List<String> header,
                             List<String[]> athleteRows, boolean hasSession) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("import");
            CellStyle headStyle = wb.createCellStyle();
            Font bold = wb.createFont();
            bold.setBold(true);
            headStyle.setFont(bold);
            // 日期列强制文本格式（@）：用户在 Excel/WPS 录入或编辑日期时不会被自动转成
            // 本地化日期型单元格（如 2024/12/12、2024年12月12日），保证回填仍是 yyyy-MM-dd 文本
            CellStyle textStyle = wb.createCellStyle();
            textStyle.setDataFormat(wb.createDataFormat().getFormat("@"));
            sheet.setDefaultColumnStyle(DATE_COL_IDX, textStyle);

            Row g = sheet.createRow(0);
            for (int i = 0; i < guide.size(); i++) {
                org.apache.poi.ss.usermodel.Cell c = g.createCell(i);
                c.setCellValue(guide.get(i));
                if (i == DATE_COL_IDX) c.setCellStyle(textStyle);
            }
            Row h = sheet.createRow(1);
            for (int i = 0; i < header.size(); i++) {
                org.apache.poi.ss.usermodel.Cell c = h.createCell(i);
                c.setCellValue(header.get(i));
                if (i == DATE_COL_IDX) {
                    CellStyle dateHeadStyle = wb.createCellStyle();
                    dateHeadStyle.cloneStyleFrom(headStyle);
                    dateHeadStyle.setDataFormat(wb.createDataFormat().getFormat("@"));
                    c.setCellStyle(dateHeadStyle);
                } else {
                    c.setCellStyle(headStyle);
                }
            }
            int rowIdx = 2;
            for (String[] r : athleteRows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(r[0]);
                row.createCell(1).setCellValue(r[1]);
                // 宽行（含已录数据）把日期/场次/数值一并写入；窄行只有前两列
                for (int i = 2; i < header.size() && i < r.length; i++) {
                    org.apache.poi.ss.usermodel.Cell cell = row.createCell(i);
                    if (i == DATE_COL_IDX) cell.setCellStyle(textStyle);
                    if (r[i] != null && !r[i].isEmpty()) cell.setCellValue(r[i]);
                }
            }
            sheet.createFreezePane(0, 2);
            for (int i = 0; i < header.size(); i++) sheet.setColumnWidth(i, 16 * 256);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ServiceException("模板生成失败：" + e.getMessage());
        }
    }

    private String csv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
