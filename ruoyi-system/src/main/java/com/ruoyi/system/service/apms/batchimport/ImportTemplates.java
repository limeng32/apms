package com.ruoyi.system.service.apms.batchimport;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
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
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;

/**
 * 两阶段批量导入模板生成（成绩 / 体态；xlsx + csv）。
 *
 * <p>结构：第 1 行中文说明（首列以 # 开头，解析跳过）；第 2 行机器表头；
 * 第 3 行起预填在训队员（编号+姓名），日期与数值留空。
 * 成绩模板<b>仅含启用 INDICATOR 列</b>（MODEL 一期不支持批量导入）。
 *
 * @author apms
 */
@Component
public class ImportTemplates {

    @Autowired private ApmsIndicatorMapper indicatorMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;

    public byte[] buildResult(String format) {
        List<String> header = new ArrayList<>(List.of(
                "athlete_id", "athlete_name", "measure_date", "session_key"));
        List<String> guide = new ArrayList<>(List.of(
                "#运动员编号（优先填写；留空则按姓名精确匹配，重名必须填编号）",
                "运动员姓名（与系统一致，用于核对）",
                "测试日期(YYYY-MM-DD)",
                "场次（选填，如S1）"));

        ApmsIndicator iq = new ApmsIndicator();
        iq.setStatus("0");
        for (ApmsIndicator ind : indicatorMapper.selectList(iq)) {
            if (ind.getCode() == null || ind.getCode().isEmpty()) continue;
            header.add(ind.getCode());
            String g = ind.getName() != null ? ind.getName() : ind.getCode();
            if (ind.getUnit() != null && !ind.getUnit().isEmpty()) g += "(" + ind.getUnit() + ")";
            guide.add(g);
        }
        return build(format, "test-result-template", guide, header, true);
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
        return build(format, "body-measure-template", guide, header, false);
    }

    // ================= 内部 =================

    /** @param hasSession 是否含 session_key 列（成绩有，体态无） */
    private byte[] build(String format, String fileBaseName, List<String> guide,
                         List<String> header, boolean hasSession) {
        List<long[]> athletes = activeAthletes();
        if ("csv".equalsIgnoreCase(format)) {
            return buildCsv(guide, header, athletes, hasSession);
        }
        return buildXlsx(fileBaseName, guide, header, athletes, hasSession);
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
                            List<long[]> athletes, boolean hasSession) {
        StringBuilder sb = new StringBuilder();
        sb.append(guide.stream().map(this::csv).reduce((a, b) -> a + "," + b).orElse("")).append("\r\n");
        sb.append(String.join(",", header)).append("\r\n");
        for (String[] r : athleteNameRows(athletes)) {
            sb.append(csv(r[0])).append(',').append(csv(r[1]));
            // 剩余列（日期/场次/数值）全部留空
            for (int i = 2; i < header.size(); i++) sb.append(',');
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

    private byte[] buildXlsx(String sheetName, List<String> guide, List<String> header,
                             List<long[]> athletes, boolean hasSession) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("import");
            CellStyle headStyle = wb.createCellStyle();
            Font bold = wb.createFont();
            bold.setBold(true);
            headStyle.setFont(bold);

            Row g = sheet.createRow(0);
            for (int i = 0; i < guide.size(); i++) {
                org.apache.poi.ss.usermodel.Cell c = g.createCell(i);
                c.setCellValue(guide.get(i));
            }
            Row h = sheet.createRow(1);
            for (int i = 0; i < header.size(); i++) {
                org.apache.poi.ss.usermodel.Cell c = h.createCell(i);
                c.setCellValue(header.get(i));
                c.setCellStyle(headStyle);
            }
            int rowIdx = 2;
            for (String[] r : athleteNameRows(athletes)) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(r[0]);
                row.createCell(1).setCellValue(r[1]);
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
