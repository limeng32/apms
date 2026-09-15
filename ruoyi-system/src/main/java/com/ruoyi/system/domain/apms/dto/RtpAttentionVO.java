package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;

/**
 * RTP 关注名单 VO
 *
 * @author apms
 */
public class RtpAttentionVO implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long athleteId;
    private String athleteName;
    private String jerseyNo;
    private String position;
    private String status;
    private String reason;
    private String trainingLimit;
    private String nextReviewDate;

    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
    public String getJerseyNo() { return jerseyNo; }
    public void setJerseyNo(String jerseyNo) { this.jerseyNo = jerseyNo; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getTrainingLimit() { return trainingLimit; }
    public void setTrainingLimit(String trainingLimit) { this.trainingLimit = trainingLimit; }
    public String getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(String nextReviewDate) { this.nextReviewDate = nextReviewDate; }
}
