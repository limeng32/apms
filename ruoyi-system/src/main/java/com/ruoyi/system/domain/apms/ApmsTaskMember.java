package com.ruoyi.system.domain.apms;

/**
 * 任务成员 apms_task_member
 *
 * 注意：复合主键 (task_id, athlete_id)，非自增 id
 */
public class ApmsTaskMember {
    private Long taskId;
    private Long athleteId;
    /** pending=未测 / partial=部分完成 / completed=全部完成 */
    private String status;

    // LEFT JOIN 解析字段
    private String athleteName;
    private String athleteGender;
    private String athleteTeam;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long v) { this.taskId = v; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long v) { this.athleteId = v; }
    public String getStatus() { return status; }
    public void setStatus(String s) { this.status = s; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String n) { this.athleteName = n; }
    public String getAthleteGender() { return athleteGender; }
    public void setAthleteGender(String g) { this.athleteGender = g; }
    public String getAthleteTeam() { return athleteTeam; }
    public void setAthleteTeam(String t) { this.athleteTeam = t; }
}
