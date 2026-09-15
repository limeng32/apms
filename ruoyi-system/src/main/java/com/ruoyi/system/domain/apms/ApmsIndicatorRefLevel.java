package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;

/**
 * 指标评价等级（REF level）— 只用于 Service 层 REP 计算
 */
public class ApmsIndicatorRefLevel {
    private Long id;
    private Long refId;
    private String level;
    private BigDecimal minValue;
    private BigDecimal maxValue;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRefId() { return refId; }
    public void setRefId(Long refId) { this.refId = refId; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
    public BigDecimal getMinValue() { return minValue; }
    public void setMinValue(BigDecimal v) { this.minValue = v; }
    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal v) { this.maxValue = v; }
}
