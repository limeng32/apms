package com.ruoyi.system.domain.apms;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * 当前RTP状态对象 apms_rtp_status
 * （新建运动员不自动插入，无记录=未评估 NOT_ASSESSED）
 *
 * @author apms
 */
public class ApmsRtpStatus {

    private Long id;

    /** 运动员ID（唯一） */
    private Long athleteId;

    /** 状态（g=正常 y=限制 r=不建议） */
    private String status;

    /** 标记原因 */
    private String reason;

    /** 训练限制说明 */
    private String trainingLimit;

    /** 下次复核日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date nextReviewDate;

    /** 操作人 */
    private String updatedBy;

    /** 操作时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date updatedTime;

    /** 运动员姓名（关联查询） */
    private String athleteName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getTrainingLimit() { return trainingLimit; }
    public void setTrainingLimit(String trainingLimit) { this.trainingLimit = trainingLimit; }
    public Date getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(Date nextReviewDate) { this.nextReviewDate = nextReviewDate; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public Date getUpdatedTime() { return updatedTime; }
    public void setUpdatedTime(Date updatedTime) { this.updatedTime = updatedTime; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
}
