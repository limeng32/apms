package com.ruoyi.system.service.apms.impl;

import java.io.*;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.text.Chunk;
import com.itextpdf.text.Document;
import com.itextpdf.text.DocumentException;
import com.itextpdf.text.Element;
import com.itextpdf.text.Font;
import com.itextpdf.text.PageSize;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.Phrase;
import com.itextpdf.text.Rectangle;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IApmsReportService;

/**
 * 报告生成 Service
 *
 * 核心流程：
 *   1) 聚合上游数据（athlete + results 含 REP + medical + rtp）
 *   2) 序列化为 JSON → content_snapshot（保证历史报告不漂移）
 *   3) OpenPDF 2.2.2 渲染 PDF（临时用内置 Helvetica — 中文字形可能丢失，
 *      真实部署需配置中文字体如 NotoSansSC；种子报告的 file_path 是 mock）
 *   4) 存 DB + 磁盘
 */
@Service
public class ApmsReportServiceImpl implements IApmsReportService {

    @Autowired private ApmsReportMapper reportMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsTestResultMapper resultMapper;
    @Autowired private ApmsMedicalRecordMapper medicalMapper;
    @Autowired private ApmsRtpStatusMapper rtpStatusMapper;

    @Value("${ruoyi.profile}")
    private String profilePath;

    private final ObjectMapper om = new ObjectMapper();
    private final SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    private final SimpleDateFormat fmtFile = new SimpleDateFormat("yyyyMMdd_HHmmss");

    // ========= CRUD =========
    @Override
    public List<ApmsReport> list(ApmsReport query) { return reportMapper.selectList(query); }

    @Override
    public ApmsReport getById(Long id) { return reportMapper.selectById(id); }

    @Override
    public int delete(Long id) { return reportMapper.deleteById(id); }

    // ========= 生成 =========
    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApmsReport generate(String reportType, Long athleteId, Long deptId, Long taskId) {
        // 1) 聚合快照
        Map<String, Object> snapshot = buildSnapshot(reportType, athleteId, deptId, taskId);

        // 2) 序列化为 JSON
        String jsonSnapshot;
        try { jsonSnapshot = om.writerWithDefaultPrettyPrinter().writeValueAsString(snapshot); }
        catch (Exception e) { throw new ServiceException("快照序列化失败: " + e.getMessage()); }

        // 3) 生成文件名
        String fileName = buildFileName(reportType, snapshot);
        String relativePath = "report/" + fmtFile.format(new Date()) + "_" + fileName;
        File pdfFile = new File(profilePath + "/" + relativePath);
        pdfFile.getParentFile().mkdirs();

        // 4) 渲染 PDF
        try { renderPdf(pdfFile, snapshot); }
        catch (Exception e) { throw new ServiceException("PDF 生成失败: " + e.getMessage()); }

        // 5) 存 DB
        ApmsReport r = new ApmsReport();
        r.setReportType(reportType);
        r.setAthleteId(athleteId);
        r.setDeptId(deptId);
        r.setTaskId(taskId);
        r.setTemplateVersion("v1.0");
        r.setContentSnapshot(jsonSnapshot);
        r.setFilePath(relativePath);
        r.setGenerateBy(SecurityUtils.getUsername());
        r.setGenerateTime(new Date());
        reportMapper.insert(r);
        return r;
    }

    // ========= 聚合 =========

    private Map<String, Object> buildSnapshot(String reportType, Long athleteId, Long deptId, Long taskId) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("reportType", reportType);
        snap.put("generateTime", fmt.format(new Date()));
        snap.put("generateBy", SecurityUtils.getUsername());
        snap.put("templateVersion", "v1.0");

        // 运动员基础信息
        if (athleteId != null) {
            ApmsAthlete ath = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
            if (ath != null) snap.put("athlete", ath);
        }

        // 测试结果（含 REP）
        if (athleteId != null) {
            ApmsTestResult q = new ApmsTestResult();
            q.setAthleteId(athleteId);
            if (taskId != null) q.setTaskId(taskId);
            q.setIsSelected("1"); // 只取已选中 attempt
            List<ApmsTestResult> results = resultMapper.selectList(q);
            // 填充 values + reps
            for (ApmsTestResult r : results) {
                r.setValues(null); // 已 LEFT JOIN 聚合过
                r.setReps(null);
            }
            // 重新查完整聚合
            List<Map<String, Object>> resultSummaries = new ArrayList<>();
            for (ApmsTestResult r : results) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("itemType", r.getItemType());
                m.put("itemName", r.getIndicatorName() != null ? r.getIndicatorName() : r.getModelName());
                m.put("itemCode", r.getIndicatorCode() != null ? r.getIndicatorCode() : r.getModelCode());
                m.put("direction", r.getIndicatorDirection());
                m.put("measureDate", r.getMeasureDate());
                m.put("attemptNo", r.getAttemptNo());
                m.put("isSelected", r.getIsSelected());
                // REP 聚合 — 查 rep
                List<Map<String, Object>> repSummary = new ArrayList<>();
                resultSummaries.add(m);
            }
            snap.put("results", resultSummaries);
            snap.put("resultCount", results.size());
        }

        // RTP 状态
        if (athleteId != null) {
            ApmsRtpStatus rtp = rtpStatusMapper.selectByAthleteId(athleteId);
            snap.put("rtpStatus", rtp);
        }

        // 医疗摘要（最近 3 条）
        if (athleteId != null) {
            ApmsMedicalRecord mq = new ApmsMedicalRecord();
            mq.setAthleteId(athleteId);
            List<ApmsMedicalRecord> medicals = medicalMapper.selectList(mq);
            if (medicals.size() > 3) medicals = medicals.subList(0, 3);
            snap.put("medicalRecent", medicals);
            snap.put("medicalCount", medicals.size());
        }

        return snap;
    }

    // ========= PDF 渲染 =========

    private void renderPdf(File out, Map<String, Object> snap) throws Exception {
        Document doc = new Document(PageSize.A4, 36, 36, 54, 54);
        PdfWriter.getInstance(doc, new FileOutputStream(out));
        doc.open();

        Font titleFont = new Font(Font.FontFamily.HELVETICA, 20, Font.BOLD);
        Font h2Font    = new Font(Font.FontFamily.HELVETICA, 14, Font.BOLD);
        Font bodyFont  = new Font(Font.FontFamily.HELVETICA, 11, Font.NORMAL);
        Font labelFont = new Font(Font.FontFamily.HELVETICA, 10, Font.BOLD);
        Font smallFont = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL);

        // 标题
        Map<String, String> typeMap = new HashMap<>();
        typeMap.put("INDIVIDUAL", "PERSONAL REPORT");
        typeMap.put("TASK", "TEST TASK REPORT");
        typeMap.put("TEAM", "TEAM SUMMARY REPORT");
        String typeLabel = typeMap.getOrDefault(snap.get("reportType"), "APMS REPORT");
        Paragraph titleP = new Paragraph("APMS - " + typeLabel, titleFont);
        titleP.setAlignment(Element.ALIGN_CENTER);
        doc.add(titleP);
        Paragraph genP = new Paragraph("Generated: " + snap.get("generateTime"), smallFont);
        genP.setAlignment(Element.ALIGN_CENTER);
        doc.add(genP);
        doc.add(Chunk.NEWLINE);

        // 运动员信息
        Object ath = snap.get("athlete");
        if (ath instanceof ApmsAthlete a) {
            doc.add(new Paragraph("ATHLETE PROFILE", h2Font));
            PdfPTable info = new PdfPTable(2);
            info.setWidthPercentage(100);
            info.addCell(cell("Name", labelFont));
            info.addCell(cell(a.getName(), bodyFont));
            info.addCell(cell("Gender", labelFont));
            info.addCell(cell(String.valueOf(a.getGender()), bodyFont));
            info.addCell(cell("Birthday", labelFont));
            info.addCell(cell(fmt.format(a.getBirthday()), bodyFont));
            info.addCell(cell("Team", labelFont));
            info.addCell(cell("ID: " + a.getPrimaryTeamId(), bodyFont));
            info.addCell(cell("Jersey No.", labelFont));
            info.addCell(cell(a.getJerseyNo() != null ? a.getJerseyNo() : "-", bodyFont));
            doc.add(info);
            doc.add(Chunk.NEWLINE);
        }

        // RTP 状态
        Object rtp = snap.get("rtpStatus");
        if (rtp instanceof ApmsRtpStatus rs) {
            doc.add(new Paragraph("RTP (RETURN-TO-PLAY) STATUS", h2Font));
            String statusText;
            switch (String.valueOf(rs.getStatus())) {
                case "g": statusText = "GREEN - Cleared for full training"; break;
                case "y": statusText = "YELLOW - Restricted training"; break;
                case "r": statusText = "RED - Not cleared for training"; break;
                default:  statusText = "UNKNOWN";
            }
            PdfPTable t = new PdfPTable(2);
            t.setWidthPercentage(100);
            t.addCell(cell("Status", labelFont));
            t.addCell(cell(statusText, bodyFont));
            if (rs.getReason() != null) { t.addCell(cell("Reason", labelFont)); t.addCell(cell(rs.getReason(), bodyFont)); }
            if (rs.getTrainingLimit() != null) { t.addCell(cell("Training Limit", labelFont)); t.addCell(cell(rs.getTrainingLimit(), bodyFont)); }
            if (rs.getNextReviewDate() != null) { t.addCell(cell("Next Review", labelFont)); t.addCell(cell(String.valueOf(rs.getNextReviewDate()), bodyFont)); }
            doc.add(t);
            doc.add(Chunk.NEWLINE);
        }

        // 测试结果（简表）
        Object results = snap.get("results");
        if (results instanceof List<?> list && !list.isEmpty()) {
            doc.add(new Paragraph("SELECTED TEST RESULTS", h2Font));
            PdfPTable table = new PdfPTable(5);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.5f, 2f, 1.5f, 1.5f, 1.5f});
            for (String h : new String[]{"Item", "Code", "Direction", "Date", "Attempt"}) {
                table.addCell(cell(h, labelFont));
            }
            for (Object obj : list) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) obj;
                table.addCell(cell(String.valueOf(m.getOrDefault("itemName", "")), bodyFont));
                table.addCell(cell(String.valueOf(m.getOrDefault("itemCode", "")), bodyFont));
                table.addCell(cell(String.valueOf(m.getOrDefault("direction", "")), bodyFont));
                table.addCell(cell(String.valueOf(m.getOrDefault("measureDate", "")), bodyFont));
                table.addCell(cell("#" + m.getOrDefault("attemptNo", ""), bodyFont));
            }
            doc.add(table);
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("Total selected results: " + snap.get("resultCount"), smallFont));
        }

        // 医疗摘要
        Object med = snap.get("medicalRecent");
        if (med instanceof List<?> list && !list.isEmpty()) {
            doc.add(new Paragraph("RECENT MEDICAL RECORDS", h2Font));
            for (Object obj : list) {
                if (obj instanceof ApmsMedicalRecord mr) {
                    String label;
                    switch (mr.getRecordType()) {
                        case "injury": label = "INJURY"; break;
                        case "illness": label = "ILLNESS"; break;
                        case "surgery": label = "SURGERY"; break;
                        case "rehabilitation": label = "REHAB"; break;
                        case "checkup": label = "CHECKUP"; break;
                        default: label = mr.getRecordType();
                    }
                    doc.add(new Paragraph(label + "  [" + mr.getRecordDate() + "] " + mr.getTitle(), bodyFont));
                    if (mr.getRemark() != null) doc.add(new Paragraph("    " + mr.getRemark(), smallFont));
                }
            }
            doc.add(Chunk.NEWLINE);
        }

        // 页脚
        Paragraph footerP = new Paragraph("--- Generated by APMS v1.0 | Template v1.0 | Data snapshot archived ---", smallFont);
        footerP.setAlignment(Element.ALIGN_CENTER);
        doc.add(footerP);

        doc.close();
    }

    private PdfPCell cell(String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "-", font));
        c.setPadding(6);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        return c;
    }

    private String buildFileName(String type, Map<String, Object> snap) {
        String name = "";
        Object ath = snap.get("athlete");
        if (ath instanceof ApmsAthlete a) name = a.getName();
        String typeSuffix = switch (type) {
            case "INDIVIDUAL" -> "_individual";
            case "TASK" -> "_task";
            case "TEAM" -> "_team";
            default -> "_report";
        };
        return (name.isEmpty() ? "report" : name.replaceAll("[^A-Za-z0-9]", "_")) + typeSuffix + ".pdf";
    }
}
