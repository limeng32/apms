package com.ruoyi.system.domain.apms;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * RTP状态变更日志对象 apms_rtp_log
 *
 * @author apms
 */
public class ApmsRtpLog {

    private Long id;

    /** 运动员ID */
    private Long athleteId;

    /** 变更前状态（首次评估时为 NULL） */
    private String fromStatus;

    /** 变更后状态 */
    private String toStatus;

    /** 变更原因 */
    private String reason;

    /** 训练限制 */
    private String trainingLimit;

    /** 当时计划的下次复核日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date nextReviewDate;

    /** 操作人ID */
    private Long operatorId;

    /** 操作人姓名 */
    private String operatorName;

    /** 操作时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date operateTime;

    /** 运动员姓名（关联查询） */
    private String athleteName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public String getFromStatus() { return fromStatus; }
    public void setFromStatus(String fromStatus) { this.fromStatus = fromStatus; }
    public String getToStatus() { return toStatus; }
    public void setToStatus(String toStatus) { this.toStatus = toStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getTrainingLimit() { return trainingLimit; }
    public void setTrainingLimit(String trainingLimit) { this.trainingLimit = trainingLimit; }
    public Date getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(Date nextReviewDate) { this.nextReviewDate = nextReviewDate; }
    public Long getOperatorId() { return operatorId; }
    public void setOperatorId(Long operatorId) { this.operatorId = operatorId; }
    public String getOperatorName() { return operatorName; }
    public void setOperatorName(String operatorName) { this.operatorName = operatorName; }
    public Date getOperateTime() { return operateTime; }
    public void setOperateTime(Date operateTime) { this.operateTime = operateTime; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
}
