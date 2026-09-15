package com.ruoyi.system.domain.apms;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * PDF 报告主表 apms_report
 *
 * content_snapshot 存生成时刻的完整 JSON 快照 — 确保报告可复现、历史不漂移
 * report_type:
 *   INDIVIDUAL  — 单人综合报告
 *   TASK        — 单次测试任务报告
 *   TEAM        — 队伍汇总报告
 */
public class ApmsReport extends BaseEntity {
    private Long id;
    private String reportType;
    private Long athleteId;
    private Long deptId;
    private Long taskId;
    private String templateVersion;
    /** JSON 快照 — 生成时刻的完整数据 */
    private String contentSnapshot;
    private String filePath;
    private String generateBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date generateTime;

    // LEFT JOIN 解析
    private String athleteName;
    private String athleteGender;
    private String athleteTeam;
    private String taskName;
    private String deptName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getDeptId() { return deptId; }
    public void setDeptId(Long deptId) { this.deptId = deptId; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public String getTemplateVersion() { return templateVersion; }
    public void setTemplateVersion(String v) { this.templateVersion = v; }
    public String getContentSnapshot() { return contentSnapshot; }
    public void setContentSnapshot(String s) { this.contentSnapshot = s; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String p) { this.filePath = p; }
    public String getGenerateBy() { return generateBy; }
    public void setGenerateBy(String b) { this.generateBy = b; }
    public Date getGenerateTime() { return generateTime; }
    public void setGenerateTime(Date t) { this.generateTime = t; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String n) { this.athleteName = n; }
    public String getAthleteGender() { return athleteGender; }
    public void setAthleteGender(String g) { this.athleteGender = g; }
    public String getAthleteTeam() { return athleteTeam; }
    public void setAthleteTeam(String t) { this.athleteTeam = t; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String n) { this.taskName = n; }
    public String getDeptName() { return deptName; }
    public void setDeptName(String n) { this.deptName = n; }
}
