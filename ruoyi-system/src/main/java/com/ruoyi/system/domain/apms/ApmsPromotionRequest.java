package com.ruoyi.system.domain.apms;

/**
 * 赛季晋升请求（cutoffDate 可空：空则默认取下一个 1 月 1 日）
 *
 * @author apms
 */
public class ApmsPromotionRequest {

    /** 赛季 cut-off 日期，格式 yyyy-MM-dd */
    private String cutoffDate;

    public String getCutoffDate() { return cutoffDate; }
    public void setCutoffDate(String cutoffDate) { this.cutoffDate = cutoffDate; }
}
