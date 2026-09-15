package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;

/**
 * APMS 任务进度 VO（看板卡片用）
 *
 * @author apms
 */
public class TaskProgressVO implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long taskId;
    private String taskName;
    private String status;
    private Integer totalCount;
    private Integer completedCount;
    private String teamName;
    private String startDate;
    private String endDate;
    private Integer progress;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getTotalCount() { return totalCount; }
    public void setTotalCount(Integer totalCount) { this.totalCount = totalCount; }
    public Integer getCompletedCount() { return completedCount; }
    public void setCompletedCount(Integer completedCount) { this.completedCount = completedCount; }
    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }
    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public String getEndDate() { return endDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }
}
