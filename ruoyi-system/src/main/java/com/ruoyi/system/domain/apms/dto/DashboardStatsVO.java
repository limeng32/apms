package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;

/**
 * APMS 管理员看板统计 VO
 *
 * @author apms
 */
public class DashboardStatsVO implements Serializable {

    private static final long serialVersionUID = 1L;

    private Integer athleteCount;
    private Integer taskInProgressCount;
    private Integer taskPendingCount;
    private Integer taskCompletedCount;
    private Integer rtpYellowCount;
    private Integer rtpRedCount;
    private Integer rtpGreenCount;
    private Integer bodyMeasureWeekCount;
    private Integer phvWeekCount;
    private String teamList;

    public Integer getAthleteCount() { return athleteCount; }
    public void setAthleteCount(Integer athleteCount) { this.athleteCount = athleteCount; }
    public Integer getTaskInProgressCount() { return taskInProgressCount; }
    public void setTaskInProgressCount(Integer taskInProgressCount) { this.taskInProgressCount = taskInProgressCount; }
    public Integer getTaskPendingCount() { return taskPendingCount; }
    public void setTaskPendingCount(Integer taskPendingCount) { this.taskPendingCount = taskPendingCount; }
    public Integer getTaskCompletedCount() { return taskCompletedCount; }
    public void setTaskCompletedCount(Integer taskCompletedCount) { this.taskCompletedCount = taskCompletedCount; }
    public Integer getRtpYellowCount() { return rtpYellowCount; }
    public void setRtpYellowCount(Integer rtpYellowCount) { this.rtpYellowCount = rtpYellowCount; }
    public Integer getRtpRedCount() { return rtpRedCount; }
    public void setRtpRedCount(Integer rtpRedCount) { this.rtpRedCount = rtpRedCount; }
    public Integer getRtpGreenCount() { return rtpGreenCount; }
    public void setRtpGreenCount(Integer rtpGreenCount) { this.rtpGreenCount = rtpGreenCount; }
    public Integer getBodyMeasureWeekCount() { return bodyMeasureWeekCount; }
    public void setBodyMeasureWeekCount(Integer bodyMeasureWeekCount) { this.bodyMeasureWeekCount = bodyMeasureWeekCount; }
    public Integer getPhvWeekCount() { return phvWeekCount; }
    public void setPhvWeekCount(Integer phvWeekCount) { this.phvWeekCount = phvWeekCount; }
    public String getTeamList() { return teamList; }
    public void setTeamList(String teamList) { this.teamList = teamList; }
}
