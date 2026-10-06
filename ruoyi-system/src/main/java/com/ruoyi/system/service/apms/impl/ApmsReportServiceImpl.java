package com.ruoyi.system.service.apms.impl;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.text.Chunk;
import com.itextpdf.text.Document;
import com.itextpdf.text.Element;
import com.itextpdf.text.Font;
import com.itextpdf.text.PageSize;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.Phrase;
import com.itextpdf.text.pdf.BaseFont;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsMedicalRecord;
import com.ruoyi.system.domain.apms.ApmsReport;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.domain.apms.ApmsTaskMember;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestTask;
import com.ruoyi.system.mapper.SysDeptMapper;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsMedicalRecordMapper;
import com.ruoyi.system.mapper.apms.ApmsReportMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpStatusMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskMemberMapper;
import com.ruoyi.system.mapper.apms.ApmsTestResultMapper;
import com.ruoyi.system.mapper.apms.ApmsTestTaskMapper;
import com.ruoyi.system.service.apms.IApmsReportService;

/**
 * 报告生成 Service
 *
 * 核心流程：
 *   1) 聚合上游数据（athlete + results 含 REP + medical + rtp）
 *   2) 序列化为 JSON → content_snapshot（保证历史报告不漂移）
 *   3) OpenPDF 2.2.2 渲染中文 PDF（内嵌 classpath:/fonts/NotoSansSC.ttf，
 *      IDENTITY_H + EMBEDDED，iText 自动子集化；种子报告的 file_path 是 mock）
 *   4) 存 DB + 磁盘
 */
@Service
public class ApmsReportServiceImpl implements IApmsReportService {

    @Autowired private ApmsReportMapper reportMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsTestResultMapper resultMapper;
    @Autowired private ApmsMedicalRecordMapper medicalMapper;
    @Autowired private ApmsRtpStatusMapper rtpStatusMapper;
    @Autowired private ApmsTestTaskMapper testTaskMapper;
    @Autowired private ApmsTaskMemberMapper taskMemberMapper;
    @Autowired private SysDeptMapper deptMapper;

    @Value("${ruoyi.profile}")
    private String profilePath;

    private final ObjectMapper om = new ObjectMapper();
    private final SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    private final SimpleDateFormat fmtDate = new SimpleDateFormat("yyyy-MM-dd");
    private final SimpleDateFormat fmtFile = new SimpleDateFormat("yyyyMMdd_HHmmss");

    /** 中文章节序号（报告最多四节） */
    private static final String[] CN_NUMS = {"一", "二", "三", "四"};

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
        // 1~4) 聚合快照 + 渲染 PDF
        Map<String, Object> snapshot = buildSnapshot(reportType, athleteId, deptId, taskId);
        String jsonSnapshot = toJsonSnapshot(snapshot);
        String relativePath = renderToDisk(reportType, snapshot);

        // 5) 存 DB
        ApmsReport r = new ApmsReport();
        r.setReportType(reportType);
        r.setAthleteId(athleteId);
        r.setDeptId(deptId);
        r.setTaskId(taskId);
        r.setTemplateVersion(TEMPLATE_VERSION);
        r.setContentSnapshot(jsonSnapshot);
        r.setFilePath(relativePath);
        r.setGenerateBy(SecurityUtils.getUsername());
        r.setGenerateTime(new Date());
        reportMapper.insert(r);
        return r;
    }

    // ========= 覆盖式重新生成（ID 不变） =========
    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApmsReport regenerate(Long id) {
        ApmsReport old = reportMapper.selectById(id);
        if (old == null) throw new ServiceException("报告不存在");

        // 1~4) 用原报告参数重新聚合 + 渲染
        Map<String, Object> snapshot = buildSnapshot(
                old.getReportType(), old.getAthleteId(), old.getDeptId(), old.getTaskId());
        String jsonSnapshot = toJsonSnapshot(snapshot);
        String relativePath = renderToDisk(old.getReportType(), snapshot);

        // 5) 覆盖原记录（ID 不变）
        ApmsReport upd = new ApmsReport();
        upd.setId(id);
        upd.setTemplateVersion(TEMPLATE_VERSION);
        upd.setContentSnapshot(jsonSnapshot);
        upd.setFilePath(relativePath);
        upd.setGenerateBy(SecurityUtils.getUsername());
        upd.setGenerateTime(new Date());
        reportMapper.update(upd);

        // 6) 清理旧 PDF 物理文件（新文件已成功落盘后再删，失败不影响主流程）
        String oldPath = old.getFilePath();
        if (oldPath != null && !oldPath.equals(relativePath)) {
            File oldFile = new File(profilePath + "/" + oldPath);
            if (oldFile.exists()) {
                if (!oldFile.delete()) oldFile.deleteOnExit();
            }
        }

        return reportMapper.selectById(id);
    }

    private static final String TEMPLATE_VERSION = "v1.0";

    private String toJsonSnapshot(Map<String, Object> snapshot) {
        try { return om.writerWithDefaultPrettyPrinter().writeValueAsString(snapshot); }
        catch (Exception e) { throw new ServiceException("快照序列化失败: " + e.getMessage()); }
    }

    /** 渲染 PDF 到磁盘，返回相对 ruoyi.profile 的存储路径 */
    private String renderToDisk(String reportType, Map<String, Object> snapshot) {
        String fileName = buildFileName(reportType, snapshot);
        String relativePath = "report/" + fmtFile.format(new Date()) + "_" + fileName;
        File pdfFile = new File(profilePath + "/" + relativePath);
        pdfFile.getParentFile().mkdirs();
        try { renderPdf(pdfFile, snapshot); }
        catch (Exception e) { throw new ServiceException("PDF 生成失败: " + e.getMessage()); }
        return relativePath;
    }

    // ========= 聚合 =========

    private Map<String, Object> buildSnapshot(String reportType, Long athleteId, Long deptId, Long taskId) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("reportType", reportType);
        snap.put("generateTime", fmt.format(new Date()));
        snap.put("generateBy", SecurityUtils.getUsername());
        snap.put("templateVersion", TEMPLATE_VERSION);

        if ("TASK".equals(reportType) && taskId != null) {
            buildTaskSnapshot(snap, taskId);
        } else if ("TEAM".equals(reportType) && deptId != null) {
            buildTeamSnapshot(snap, deptId);
        } else {
            buildAthleteSnapshot(snap, athleteId, taskId);
        }

        return snap;
    }

    /** 单人综合报告：档案 + RTP + 已选成绩 + 医疗 */
    private void buildAthleteSnapshot(Map<String, Object> snap, Long athleteId, Long taskId) {
        // 运动员基础信息
        if (athleteId != null) {
            ApmsAthlete ath = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
            if (ath != null) snap.put("athlete", ath);
        }

        // 已选测试成绩
        if (athleteId != null) {
            ApmsTestResult q = new ApmsTestResult();
            q.setAthleteId(athleteId);
            if (taskId != null) q.setTaskId(taskId);
            q.setIsSelected("1");
            List<ApmsTestResult> results = resultMapper.selectList(q);
            List<Map<String, Object>> summaries = new ArrayList<>();
            for (ApmsTestResult r : results) summaries.add(resultSummary(r, false));
            snap.put("results", summaries);
            snap.put("resultCount", results.size());
        }

        // RTP 状态
        if (athleteId != null) {
            snap.put("rtpStatus", rtpStatusMapper.selectByAthleteId(athleteId));
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
    }

    /** 测试任务报告：任务概览 + 成员完成情况 + 全部已选成绩 */
    private void buildTaskSnapshot(Map<String, Object> snap, Long taskId) {
        ApmsTestTask task = testTaskMapper.selectById(taskId);
        if (task == null) throw new ServiceException("测试任务不存在");

        // 一、任务概览
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("taskName", task.getTaskName());
        info.put("targetDeptName", task.getTargetDeptName());
        info.put("testerName", task.getTesterName());
        info.put("startDate", task.getStartDate());
        info.put("endDate", task.getEndDate());
        info.put("status", task.getStatus());
        snap.put("task", info);

        // 任务下全部已选成绩
        ApmsTestResult rq = new ApmsTestResult();
        rq.setTaskId(taskId);
        rq.setIsSelected("1");
        List<ApmsTestResult> selected = resultMapper.selectList(rq);

        // 二、成员完成情况
        List<ApmsTaskMember> members = taskMemberMapper.selectByTaskId(taskId);
        members.sort(Comparator.comparing(
                (ApmsTaskMember m) -> "completed".equals(m.getStatus()) ? 0
                        : "partial".equals(m.getStatus()) ? 1 : 2));
        List<Map<String, Object>> memberRows = new ArrayList<>();
        int completed = 0, partial = 0, pending = 0;
        for (ApmsTaskMember mb : members) {
            long cnt = selected.stream()
                    .filter(r -> Objects.equals(r.getAthleteId(), mb.getAthleteId())).count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", mb.getAthleteId());
            row.put("athleteName", mb.getAthleteName());
            row.put("gender", mb.getAthleteGender());
            row.put("status", mb.getStatus());
            row.put("selectedCount", cnt);
            memberRows.add(row);
            if ("completed".equals(mb.getStatus())) completed++;
            else if ("partial".equals(mb.getStatus())) partial++;
            else pending++;
        }
        snap.put("taskMembers", memberRows);
        snap.put("memberTotal", members.size());
        snap.put("memberCompleted", completed);
        snap.put("memberPartial", partial);
        snap.put("memberPending", pending);

        // 三、已选测试成绩（按队员、测试日期排序）
        List<Map<String, Object>> resultRows = new ArrayList<>();
        for (ApmsTestResult r : selected) resultRows.add(resultSummary(r, true));
        snap.put("taskResults", resultRows);
        snap.put("taskResultCount", selected.size());
    }

    /** 队伍汇总报告：队伍概览 + 花名册 + 近期已选成绩 + 最近医疗 */
    private void buildTeamSnapshot(Map<String, Object> snap, Long deptId) {
        SysDept dept = deptMapper.selectDeptById(deptId);
        if (dept == null) throw new ServiceException("队伍不存在");

        // 在训花名册
        ApmsAthlete aq = new ApmsAthlete();
        aq.setPrimaryTeamId(deptId);
        aq.setStatus("0");
        List<ApmsAthlete> roster = athleteMapper.selectApmsAthleteList(aq);

        // 一、队伍概览（RTP 分布）
        int male = 0, female = 0, g = 0, y = 0, r = 0, unassessed = 0;
        List<Map<String, Object>> rosterRows = new ArrayList<>();
        for (ApmsAthlete a : roster) {
            String gender = a.getGender();
            if ("0".equals(gender) || "M".equalsIgnoreCase(gender)) male++;
            else if ("1".equals(gender) || "F".equalsIgnoreCase(gender)) female++;
            String st = a.getRtpStatus();
            if ("g".equals(st)) g++;
            else if ("y".equals(st)) y++;
            else if ("r".equals(st)) r++;
            else unassessed++;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", a.getAthleteId());
            row.put("jerseyNo", a.getJerseyNo());
            row.put("name", a.getName());
            row.put("gender", gender);
            row.put("position", a.getPosition());
            row.put("rtpStatus", st);
            rosterRows.add(row);
        }
        rosterRows.sort(Comparator.comparing(
                (Map<String, Object> m) -> m.get("jerseyNo") == null ? "9999" : String.valueOf(m.get("jerseyNo"))));

        Map<String, Object> info = new LinkedHashMap<>();
        info.put("deptName", dept.getDeptName());
        info.put("rosterTotal", roster.size());
        info.put("male", male);
        info.put("female", female);
        info.put("rtpG", g);
        info.put("rtpY", y);
        info.put("rtpR", r);
        info.put("rtpNone", unassessed);
        snap.put("team", info);

        // 二、花名册
        snap.put("roster", rosterRows);

        // 三、近期已选成绩（全队汇总，取最近 30 条）
        List<ApmsTestResult> allSelected = new ArrayList<>();
        for (ApmsAthlete a : roster) {
            ApmsTestResult rq = new ApmsTestResult();
            rq.setAthleteId(a.getAthleteId());
            rq.setIsSelected("1");
            allSelected.addAll(resultMapper.selectList(rq));
        }
        allSelected.sort(Comparator.comparing(ApmsTestResult::getMeasureDate,
                Comparator.nullsLast(Comparator.reverseOrder())));
        List<ApmsTestResult> recent = allSelected.size() > 30
                ? allSelected.subList(0, 30) : allSelected;
        List<Map<String, Object>> resultRows = new ArrayList<>();
        for (ApmsTestResult rr : recent) resultRows.add(resultSummary(rr, true));
        snap.put("teamResults", resultRows);
        snap.put("teamResultTotal", allSelected.size());

        // 四、最近医疗记录（全队汇总，取最近 5 条，附队员姓名）
        List<Map<String, Object>> medRows = new ArrayList<>();
        for (ApmsAthlete a : roster) {
            ApmsMedicalRecord mq = new ApmsMedicalRecord();
            mq.setAthleteId(a.getAthleteId());
            for (ApmsMedicalRecord mr : medicalMapper.selectList(mq)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("recordDate", mr.getRecordDate());
                row.put("athleteName", a.getName());
                row.put("recordType", mr.getRecordType());
                row.put("title", mr.getTitle());
                medRows.add(row);
            }
        }
        medRows.sort((x, z) -> {
            Date dx = (Date) x.get("recordDate"), dz = (Date) z.get("recordDate");
            if (dx == null && dz == null) return 0;
            if (dx == null) return 1;
            if (dz == null) return -1;
            return dz.compareTo(dx);
        });
        if (medRows.size() > 5) medRows = medRows.subList(0, 5);
        snap.put("teamMedical", medRows);
    }

    /** 测试结果 → 快照行；withAthlete=true 时带队员姓名（任务/队伍报告用） */
    private Map<String, Object> resultSummary(ApmsTestResult r, boolean withAthlete) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (withAthlete) m.put("athleteName", na(r.getAthleteName()));
        m.put("itemType", r.getItemType());
        m.put("itemName", r.getIndicatorName() != null ? r.getIndicatorName() : r.getModelName());
        m.put("itemCode", r.getIndicatorCode() != null ? r.getIndicatorCode() : r.getModelCode());
        m.put("direction", r.getIndicatorDirection());
        m.put("measureDate", r.getMeasureDate());
        m.put("attemptNo", r.getAttemptNo());
        m.put("isSelected", r.getIsSelected());
        return m;
    }

    // ========= PDF 渲染（中文，内嵌 NotoSansSC 子集） =========

    /** 字体字节只加载一次；每份报告新建 BaseFont 以便 iText 按文档子集化嵌入 */
    private static volatile byte[] cjkFontBytes;

    private static byte[] cjkFontBytes() throws IOException {
        if (cjkFontBytes == null) {
            synchronized (ApmsReportServiceImpl.class) {
                if (cjkFontBytes == null) {
                    try (InputStream is = ApmsReportServiceImpl.class.getResourceAsStream("/fonts/NotoSansSC.ttf")) {
                        if (is == null) throw new ServiceException("中文字体资源缺失：/fonts/NotoSansSC.ttf");
                        cjkFontBytes = is.readAllBytes();
                    }
                }
            }
        }
        return cjkFontBytes;
    }

    private void renderPdf(File out, Map<String, Object> snap) throws Exception {
        Document doc = new Document(PageSize.A4, 36, 36, 54, 54);
        PdfWriter.getInstance(doc, new FileOutputStream(out));
        doc.open();

        BaseFont bf = BaseFont.createFont("NotoSansSC.ttf", BaseFont.IDENTITY_H,
                BaseFont.EMBEDDED, BaseFont.NOT_CACHED, cjkFontBytes(), null);
        Font titleFont = new Font(bf, 20, Font.BOLD);
        Font h2Font    = new Font(bf, 14, Font.BOLD);
        Font bodyFont  = new Font(bf, 11, Font.NORMAL);
        Font labelFont = new Font(bf, 10, Font.BOLD);
        Font smallFont = new Font(bf, 9, Font.NORMAL);

        // 标题
        String typeName = reportTypeName(String.valueOf(snap.get("reportType")));
        Paragraph titleP = new Paragraph("APMS " + typeName, titleFont);
        titleP.setAlignment(Element.ALIGN_CENTER);
        doc.add(titleP);
        Paragraph genP = new Paragraph("生成时间：" + snap.get("generateTime")
                + "　生成人：" + snap.get("generateBy"), smallFont);
        genP.setAlignment(Element.ALIGN_CENTER);
        doc.add(genP);
        doc.add(Chunk.NEWLINE);

        // 运动员信息
        int[] secNo = {0};
        Object ath = snap.get("athlete");
        if (ath instanceof ApmsAthlete a) {
            doc.add(h2(sectionTitle(secNo, "运动员档案"), h2Font));
            PdfPTable info = new PdfPTable(2);
            info.setWidthPercentage(100);
            info.addCell(cell("姓名", labelFont));
            info.addCell(cell(na(a.getName()), bodyFont));
            info.addCell(cell("编号", labelFont));
            info.addCell(cell(a.getAthleteId() != null ? String.valueOf(a.getAthleteId()) : "—", bodyFont));
            info.addCell(cell("性别", labelFont));
            info.addCell(cell(genderText(a.getGender()), bodyFont));
            info.addCell(cell("出生日期", labelFont));
            info.addCell(cell(a.getBirthday() != null ? fmtDate.format(a.getBirthday()) : "—", bodyFont));
            info.addCell(cell("所属队伍", labelFont));
            info.addCell(cell(na(a.getTeamName()), bodyFont));
            doc.add(info);
            doc.add(Chunk.NEWLINE);
        }

        // RTP 状态
        Object rtp = snap.get("rtpStatus");
        if (rtp instanceof ApmsRtpStatus rs) {
            doc.add(h2(sectionTitle(secNo, "参训状态（RTP）"), h2Font));
            PdfPTable t = new PdfPTable(2);
            t.setWidthPercentage(100);
            t.addCell(cell("当前状态", labelFont));
            t.addCell(cell(rtpStatusText(rs.getStatus()), bodyFont));
            if (rs.getReason() != null) { t.addCell(cell("状态说明", labelFont)); t.addCell(cell(rs.getReason(), bodyFont)); }
            if (rs.getTrainingLimit() != null) { t.addCell(cell("训练限制", labelFont)); t.addCell(cell(rs.getTrainingLimit(), bodyFont)); }
            if (rs.getNextReviewDate() != null) {
                t.addCell(cell("下次复检", labelFont));
                t.addCell(cell(fmtDate.format(rs.getNextReviewDate()), bodyFont));
            }
            doc.add(t);
            doc.add(Chunk.NEWLINE);
        }

        // 测试结果（简表）
        Object results = snap.get("results");
        if (results instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "已选测试成绩"), h2Font));
            PdfPTable table = new PdfPTable(5);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{3f, 2.2f, 1.6f, 1.8f, 1.4f});
            for (String h : new String[]{"项目", "编码", "方向", "测试日期", "次号"}) {
                table.addCell(cell(h, labelFont));
            }
            for (Object obj : list) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) obj;
                table.addCell(cell(String.valueOf(m.getOrDefault("itemName", "")), bodyFont));
                table.addCell(cell(String.valueOf(m.getOrDefault("itemCode", "")), bodyFont));
                table.addCell(cell(directionText(m.get("direction")), bodyFont));
                table.addCell(cell(dateText(m.get("measureDate")), bodyFont));
                Object attemptNo = m.get("attemptNo");
                table.addCell(cell(attemptNo != null ? "第 " + attemptNo + " 次" : "—", bodyFont));
            }
            doc.add(table);
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("已选成绩合计：" + snap.get("resultCount") + " 条", smallFont));
            doc.add(Chunk.NEWLINE);
        }

        // 医疗摘要
        Object med = snap.get("medicalRecent");
        if (med instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "最近医疗记录（" + snap.get("medicalCount") + " 条）"), h2Font));
            for (Object obj : list) {
                if (obj instanceof ApmsMedicalRecord mr) {
                    doc.add(new Paragraph("【" + medicalTypeText(mr.getRecordType()) + "】"
                            + (mr.getRecordDate() != null ? fmtDate.format(mr.getRecordDate()) : "")
                            + "　" + na(mr.getTitle()), bodyFont));
                    if (mr.getRemark() != null) doc.add(new Paragraph("　　" + mr.getRemark(), smallFont));
                }
            }
            doc.add(Chunk.NEWLINE);
        }

        // ===== 测试任务报告 =====
        if (snap.get("task") instanceof Map<?, ?>) {
            renderTaskSections(doc, secNo, snap, h2Font, bodyFont, labelFont, smallFont);
        }

        // ===== 队伍汇总报告 =====
        if (snap.get("team") instanceof Map<?, ?>) {
            renderTeamSections(doc, secNo, snap, h2Font, bodyFont, labelFont, smallFont);
        }

        // 页脚
        Paragraph footerP = new Paragraph("—— 本报告由 APMS 自动生成 · 模板 "
                + snap.get("templateVersion") + " · 数据快照已归档 ——", smallFont);
        footerP.setAlignment(Element.ALIGN_CENTER);
        doc.add(footerP);

        doc.close();
    }

    // ========= TASK / TEAM 章节渲染 =========

    @SuppressWarnings("unchecked")
    private void renderTaskSections(Document doc, int[] secNo, Map<String, Object> snap,
                                    Font h2Font, Font bodyFont, Font labelFont, Font smallFont) throws Exception {
        Map<String, Object> task = (Map<String, Object>) snap.get("task");

        // 一、任务概览
        doc.add(h2(sectionTitle(secNo, "任务概览"), h2Font));
        PdfPTable info = new PdfPTable(2);
        info.setWidthPercentage(100);
        info.addCell(cell("任务名称", labelFont));
        info.addCell(cell(objText(task.get("taskName")), bodyFont));
        info.addCell(cell("目标队伍", labelFont));
        info.addCell(cell(objText(task.get("targetDeptName")), bodyFont));
        info.addCell(cell("测试人", labelFont));
        info.addCell(cell(objText(task.get("testerName")), bodyFont));
        info.addCell(cell("测试周期", labelFont));
        info.addCell(cell(dateText(task.get("startDate")) + " 至 " + dateText(task.get("endDate")), bodyFont));
        info.addCell(cell("任务状态", labelFont));
        info.addCell(cell(taskStatusText(String.valueOf(task.get("status"))), bodyFont));
        info.addCell(cell("成员进度", labelFont));
        info.addCell(cell("共 " + snap.get("memberTotal") + " 人 · 已完成 " + snap.get("memberCompleted")
                + " · 部分完成 " + snap.get("memberPartial") + " · 未测 " + snap.get("memberPending"), bodyFont));
        doc.add(info);
        doc.add(Chunk.NEWLINE);

        // 二、成员完成情况
        Object members = snap.get("taskMembers");
        if (members instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "成员完成情况"), h2Font));
            PdfPTable t = new PdfPTable(4);
            t.setWidthPercentage(100);
            t.setWidths(new float[]{3f, 1.2f, 1.8f, 1.8f});
            for (String h : new String[]{"姓名", "性别", "完成状态", "已选成绩"}) t.addCell(cell(h, labelFont));
            for (Object obj : list) {
                Map<String, Object> m = (Map<String, Object>) obj;
                t.addCell(cell(objText(m.get("athleteName")), bodyFont));
                t.addCell(cell(genderText((String) m.get("gender")), bodyFont));
                t.addCell(cell(taskMemberStatusText(String.valueOf(m.get("status"))), bodyFont));
                t.addCell(cell(m.get("selectedCount") + " 条", bodyFont));
            }
            doc.add(t);
            doc.add(Chunk.NEWLINE);
        }

        // 三、已选测试成绩
        Object results = snap.get("taskResults");
        if (results instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "已选测试成绩"), h2Font));
            renderResultTable(doc, list, true, bodyFont, labelFont);
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("已选成绩合计：" + snap.get("taskResultCount") + " 条", smallFont));
            doc.add(Chunk.NEWLINE);
        }
    }

    @SuppressWarnings("unchecked")
    private void renderTeamSections(Document doc, int[] secNo, Map<String, Object> snap,
                                    Font h2Font, Font bodyFont, Font labelFont, Font smallFont) throws Exception {
        Map<String, Object> team = (Map<String, Object>) snap.get("team");

        // 一、队伍概览
        doc.add(h2(sectionTitle(secNo, "队伍概览"), h2Font));
        PdfPTable info = new PdfPTable(2);
        info.setWidthPercentage(100);
        info.addCell(cell("队伍名称", labelFont));
        info.addCell(cell(objText(team.get("deptName")), bodyFont));
        info.addCell(cell("在训人数", labelFont));
        info.addCell(cell(team.get("rosterTotal") + " 人（男 " + team.get("male") + " / 女 " + team.get("female") + "）", bodyFont));
        info.addCell(cell("参训状态分布", labelFont));
        info.addCell(cell("绿 " + team.get("rtpG") + " 人 · 黄 " + team.get("rtpY")
                + " 人 · 红 " + team.get("rtpR") + " 人 · 未评估 " + team.get("rtpNone") + " 人", bodyFont));
        doc.add(info);
        doc.add(Chunk.NEWLINE);

        // 二、队员花名册
        Object roster = snap.get("roster");
        if (roster instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "队员花名册"), h2Font));
            PdfPTable t = new PdfPTable(5);
            t.setWidthPercentage(100);
            t.setWidths(new float[]{1.2f, 2.4f, 1.2f, 2f, 2.4f});
            for (String h : new String[]{"球衣号", "姓名", "性别", "位置", "参训状态"}) t.addCell(cell(h, labelFont));
            for (Object obj : list) {
                Map<String, Object> m = (Map<String, Object>) obj;
                t.addCell(cell(objText(m.get("jerseyNo")), bodyFont));
                t.addCell(cell(objText(m.get("name")), bodyFont));
                t.addCell(cell(genderText((String) m.get("gender")), bodyFont));
                t.addCell(cell(positionText((String) m.get("position")), bodyFont));
                t.addCell(cell(rtpStatusText((String) m.get("rtpStatus")), bodyFont));
            }
            doc.add(t);
            doc.add(Chunk.NEWLINE);
        }

        // 三、近期已选测试成绩
        Object results = snap.get("teamResults");
        if (results instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "近期已选测试成绩（最近 30 条）"), h2Font));
            renderResultTable(doc, list, true, bodyFont, labelFont);
            doc.add(Chunk.NEWLINE);
            doc.add(new Paragraph("全队已选成绩合计：" + snap.get("teamResultTotal")
                    + " 条，本表仅展示最近 30 条。", smallFont));
            doc.add(Chunk.NEWLINE);
        }

        // 四、最近医疗记录
        Object meds = snap.get("teamMedical");
        if (meds instanceof List<?> list && !list.isEmpty()) {
            doc.add(h2(sectionTitle(secNo, "最近医疗记录（全队最近 5 条）"), h2Font));
            PdfPTable t = new PdfPTable(4);
            t.setWidthPercentage(100);
            t.setWidths(new float[]{1.6f, 1.6f, 1.2f, 4f});
            for (String h : new String[]{"日期", "队员", "类型", "摘要"}) t.addCell(cell(h, labelFont));
            for (Object obj : list) {
                Map<String, Object> m = (Map<String, Object>) obj;
                t.addCell(cell(dateText(m.get("recordDate")), bodyFont));
                t.addCell(cell(objText(m.get("athleteName")), bodyFont));
                t.addCell(cell(medicalTypeText((String) m.get("recordType")), bodyFont));
                t.addCell(cell(objText(m.get("title")), bodyFont));
            }
            doc.add(t);
            doc.add(Chunk.NEWLINE);
        }
    }

    @SuppressWarnings("unchecked")
    private void renderResultTable(Document doc, List<?> list, boolean withAthlete,
                                   Font bodyFont, Font labelFont) throws Exception {
        int cols = withAthlete ? 6 : 5;
        PdfPTable table = new PdfPTable(cols);
        table.setWidthPercentage(100);
        if (withAthlete) {
            table.setWidths(new float[]{2f, 2.6f, 2f, 1.3f, 1.7f, 1.1f});
            for (String h : new String[]{"队员", "项目", "编码", "方向", "测试日期", "次号"}) table.addCell(cell(h, labelFont));
        } else {
            table.setWidths(new float[]{3f, 2.2f, 1.6f, 1.8f, 1.4f});
            for (String h : new String[]{"项目", "编码", "方向", "测试日期", "次号"}) table.addCell(cell(h, labelFont));
        }
        for (Object obj : list) {
            Map<String, Object> m = (Map<String, Object>) obj;
            if (withAthlete) table.addCell(cell(objText(m.get("athleteName")), bodyFont));
            table.addCell(cell(objText(m.get("itemName")), bodyFont));
            table.addCell(cell(objText(m.get("itemCode")), bodyFont));
            table.addCell(cell(directionText(m.get("direction")), bodyFont));
            table.addCell(cell(dateText(m.get("measureDate")), bodyFont));
            Object attemptNo = m.get("attemptNo");
            table.addCell(cell(attemptNo != null ? "第 " + attemptNo + " 次" : "—", bodyFont));
        }
        doc.add(table);
    }

    private String reportTypeName(String type) {
        return switch (type) {
            case "INDIVIDUAL" -> "个人综合报告";
            case "TASK"       -> "测试任务报告";
            case "TEAM"       -> "队伍汇总报告";
            default           -> "运动员表现报告";
        };
    }

    /** 兼容 0/1（现约定）与 M/F（历史数据） */
    private String genderText(String g) {
        if (g == null) return "—";
        return switch (g) {
            case "0", "M", "m" -> "男";
            case "1", "F", "f" -> "女";
            default -> g;
        };
    }

    private String rtpStatusText(String s) {
        if (s == null) return "未评估";
        return switch (s) {
            case "g" -> "绿 · 可正常参训";
            case "y" -> "黄 · 限制参训";
            case "r" -> "红 · 暂停参训";
            default  -> s;
        };
    }

    private String medicalTypeText(String t) {
        if (t == null) return "其他";
        return switch (t) {
            case "injury"         -> "损伤";
            case "illness"        -> "疾病";
            case "surgery"        -> "手术";
            case "rehabilitation" -> "康复";
            case "checkup"        -> "复查";
            default               -> t;
        };
    }

    /** 章节标题段落：上 12pt 与上一区块拉开、下 8pt 避免压住表格顶边框 */
    private Paragraph h2(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setSpacingBefore(12f);
        p.setSpacingAfter(8f);
        return p;
    }

    /** 动态中文章节标题：一、二、三、四 随实际存在的章节顺延 */
    private String sectionTitle(int[] secNo, String name) {
        int i = secNo[0]++;
        return CN_NUMS[Math.min(i, CN_NUMS.length - 1)] + "、" + name;
    }

    /** 快照中的日期：渲染前是 Date，历史快照反序列化后可能是字符串/数字，统一成 yyyy-MM-dd */
    private String dateText(Object d) {
        if (d == null) return "—";
        if (d instanceof Date date) return fmtDate.format(date);
        String s = String.valueOf(d);
        return s.isEmpty() ? "—" : s.length() > 10 ? s.substring(0, 10) : s;
    }

    /** 指标方向：高优（值越大越好）/ 低优（值越小越好），兼容历史 1/-1 取值 */
    private String directionText(Object d) {
        if (d == null) return "—";
        String s = String.valueOf(d);
        return switch (s) {
            case "HIGHER_BETTER", "1"  -> "高优";
            case "LOWER_BETTER", "-1"  -> "低优";
            case "RANGE_BEST"          -> "区间最优";
            case "REFERENCE_ONLY"      -> "仅供参考";
            default                    -> s;
        };
    }

    private String na(String s) { return s != null && !s.isEmpty() ? s : "—"; }

    /** Map 快照取值：null / "null" 文本统一显示为 — */
    private String objText(Object o) {
        if (o == null) return "—";
        String s = String.valueOf(o);
        return (s.isEmpty() || "null".equals(s)) ? "—" : s;
    }

    /** 任务整体状态 */
    private String taskStatusText(String s) {
        if (s == null || "null".equals(s)) return "—";
        return switch (s) {
            case "pending"     -> "待开始";
            case "in_progress" -> "进行中";
            case "completed"   -> "已完成";
            default            -> s;
        };
    }

    /** 任务成员完成状态 */
    private String taskMemberStatusText(String s) {
        if (s == null || "null".equals(s)) return "—";
        return switch (s) {
            case "pending"   -> "未测";
            case "partial"   -> "部分完成";
            case "completed" -> "已完成";
            default          -> s;
        };
    }

    /** 场上位置（字典 apms_position：GK/DF/MF/FW） */
    private String positionText(String p) {
        if (p == null || p.isEmpty()) return "—";
        return switch (p) {
            case "GK" -> "门将";
            case "DF" -> "后卫";
            case "MF" -> "中场";
            case "FW" -> "前锋";
            default   -> p;
        };
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
        if (ath instanceof ApmsAthlete a && a.getName() != null) name = a.getName();
        if (snap.get("task") instanceof Map<?, ?> task && task.get("taskName") != null) {
            name = String.valueOf(task.get("taskName"));
        }
        if (snap.get("team") instanceof Map<?, ?> team && team.get("deptName") != null) {
            name = String.valueOf(team.get("deptName"));
        }
        String typeSuffix = switch (type) {
            case "INDIVIDUAL" -> "_个人综合报告";
            case "TASK"       -> "_测试任务报告";
            case "TEAM"       -> "_队伍汇总报告";
            default           -> "_运动员表现报告";
        };
        // 仅剔除文件系统非法字符，保留中文
        String safeName = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        return (safeName.isEmpty() ? "APMS" : safeName) + typeSuffix + ".pdf";
    }
}
