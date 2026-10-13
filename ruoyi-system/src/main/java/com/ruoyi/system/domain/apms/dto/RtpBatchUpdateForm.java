package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * RTP 批量评估入参
 * 逐人一条结论，服务端逐人独立事务落库（部分成功），并按 athleteId 去重。
 *
 * @author apms
 */
public class RtpBatchUpdateForm implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 单次批量上限（服务端硬校验） */
    public static final int MAX_ITEMS = 200;

    private List<Item> items;

    public List<Item> getItems() { return items; }
    public void setItems(List<Item> items) { this.items = items; }

    /**
     * 单个队员的评估结论（字段口径与 /apms/rtp/update 一致）
     */
    public static class Item implements Serializable {

        private static final long serialVersionUID = 1L;

        /** 运动员ID */
        private Long athleteId;

        /** 目标状态（g=正常 y=限制 r=不建议） */
        private String status;

        /** 标记原因 */
        private String reason;

        /** 训练限制说明（status=g 时传 null 清空旧限制） */
        private String trainingLimit;

        /** 下次复检日期 */
        @JsonFormat(pattern = "yyyy-MM-dd")
        private Date nextReviewDate;

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
    }
}
