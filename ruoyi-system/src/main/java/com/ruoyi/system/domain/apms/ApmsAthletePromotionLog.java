package com.ruoyi.system.domain.apms;

import java.util.Date;

/**
 * 赛季晋升记录 apms_athlete_promotion_log
 *
 * @author apms
 */
public class ApmsAthletePromotionLog {

    private Long id;
    /** 批次号，如 P20270101-171300 */
    private String batchNo;
    /** 赛季 cut-off 日期 */
    private Date cutoffDate;
    private Long athleteId;
    private String athleteName;
    private Long fromTeamId;
    private Long toTeamId;
    /** cut-off 日周岁 */
    private Integer seasonAge;
    private String createBy;
    private Date createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public Date getCutoffDate() { return cutoffDate; }
    public void setCutoffDate(Date cutoffDate) { this.cutoffDate = cutoffDate; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
    public Long getFromTeamId() { return fromTeamId; }
    public void setFromTeamId(Long fromTeamId) { this.fromTeamId = fromTeamId; }
    public Long getToTeamId() { return toTeamId; }
    public void setToTeamId(Long toTeamId) { this.toTeamId = toTeamId; }
    public Integer getSeasonAge() { return seasonAge; }
    public void setSeasonAge(Integer seasonAge) { this.seasonAge = seasonAge; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
}
