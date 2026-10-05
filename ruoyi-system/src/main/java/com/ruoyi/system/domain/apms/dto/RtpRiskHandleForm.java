package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * RTP 风险快照处置入参
 *
 * ack/dismiss：仅用 remark（dismiss 必填）；
 * accept：使用 status/reason/trainingLimit/nextReviewDate，与 RTP 更新同事务落库。
 *
 * @author apms
 */
public class RtpRiskHandleForm implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 处理备注 / 忽略理由 */
    private String remark;

    /** 采纳写入的 RTP 状态（ATTENTION→y / WARNING→r，拒绝 g） */
    private String status;

    /** RTP 标记原因 */
    private String reason;

    /** 训练限制说明 */
    private String trainingLimit;

    /** 下次复检日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date nextReviewDate;

    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getTrainingLimit() { return trainingLimit; }
    public void setTrainingLimit(String trainingLimit) { this.trainingLimit = trainingLimit; }
    public Date getNextReviewDate() { return nextReviewDate; }
    public void setNextReviewDate(Date nextReviewDate) { this.nextReviewDate = nextReviewDate; }
}
