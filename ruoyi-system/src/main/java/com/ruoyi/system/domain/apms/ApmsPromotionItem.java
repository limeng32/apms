package com.ruoyi.system.domain.apms;

import java.util.Date;

/**
 * 赛季晋升预览/执行结果中的单个运动员行
 *
 * @author apms
 */
public class ApmsPromotionItem {

    /** 动作：晋升到上一档梯队 */
    public static final String ACTION_PROMOTE = "PROMOTE";
    /** 动作：未超龄，留在本梯队 */
    public static final String ACTION_STAY_YOUNG = "STAY_YOUNG";
    /** 动作：已超龄但没有更高档梯队，留在原队（需人工处理） */
    public static final String ACTION_STAY_OVERAGE = "STAY_OVERAGE";
    /** 动作：生日缺失，无法判定，留队 */
    public static final String ACTION_NO_BIRTHDAY = "NO_BIRTHDAY";
    /** 动作：所属部门不是 U 档梯队（或已停用/删除），不参与晋升 */
    public static final String ACTION_INVALID_TEAM = "INVALID_TEAM";

    private Long athleteId;
    private String name;
    private String gender;
    private Date birthday;
    /** cut-off 日当天的周岁 */
    private Integer ageAtCutoff;
    private String jerseyNo;

    private Long fromTeamId;
    private String fromTeamName;
    /** 原梯队档位数字，如 U16 → 16 */
    private Integer fromBracket;

    private Long toTeamId;
    private String toTeamName;
    private Integer toBracket;

    /** PROMOTE / STAY_YOUNG / STAY_OVERAGE / NO_BIRTHDAY */
    private String action;
    private String reason;

    /** 晋升后球衣号与目标队现有成员冲突预警（不拦截） */
    private boolean jerseyConflict;

    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public Date getBirthday() { return birthday; }
    public void setBirthday(Date birthday) { this.birthday = birthday; }
    public Integer getAgeAtCutoff() { return ageAtCutoff; }
    public void setAgeAtCutoff(Integer ageAtCutoff) { this.ageAtCutoff = ageAtCutoff; }
    public String getJerseyNo() { return jerseyNo; }
    public void setJerseyNo(String jerseyNo) { this.jerseyNo = jerseyNo; }
    public Long getFromTeamId() { return fromTeamId; }
    public void setFromTeamId(Long fromTeamId) { this.fromTeamId = fromTeamId; }
    public String getFromTeamName() { return fromTeamName; }
    public void setFromTeamName(String fromTeamName) { this.fromTeamName = fromTeamName; }
    public Integer getFromBracket() { return fromBracket; }
    public void setFromBracket(Integer fromBracket) { this.fromBracket = fromBracket; }
    public Long getToTeamId() { return toTeamId; }
    public void setToTeamId(Long toTeamId) { this.toTeamId = toTeamId; }
    public String getToTeamName() { return toTeamName; }
    public void setToTeamName(String toTeamName) { this.toTeamName = toTeamName; }
    public Integer getToBracket() { return toBracket; }
    public void setToBracket(Integer toBracket) { this.toBracket = toBracket; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public boolean isJerseyConflict() { return jerseyConflict; }
    public void setJerseyConflict(boolean jerseyConflict) { this.jerseyConflict = jerseyConflict; }
}
