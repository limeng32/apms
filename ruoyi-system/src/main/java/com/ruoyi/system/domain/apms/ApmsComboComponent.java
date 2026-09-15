package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;

/**
 * 组合模型组成项 apms_combo_component
 *
 * 注意：indicatorName / indicatorCode / indicatorUnit / indicatorDirection
 *       通过 LEFT JOIN apms_indicator 解析，前端无需二次查询。
 */
public class ApmsComboComponent {
    private Long id;
    private Long comboModelId;
    private Long indicatorId;
    private BigDecimal weight;
    /** NULL=继承indicator方向；0=越大越好；1=越小越好 */
    private String directionOverride;
    private Integer sortOrder;

    // ====== 通过 JOIN 解析的关联字段 ======
    private String indicatorCode;
    private String indicatorName;
    private String indicatorUnit;
    private String indicatorDirection; // 原indicator的evaluation_direction

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getComboModelId() { return comboModelId; }
    public void setComboModelId(Long comboModelId) { this.comboModelId = comboModelId; }
    public Long getIndicatorId() { return indicatorId; }
    public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public String getDirectionOverride() { return directionOverride; }
    public void setDirectionOverride(String directionOverride) { this.directionOverride = directionOverride; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getIndicatorCode() { return indicatorCode; }
    public void setIndicatorCode(String indicatorCode) { this.indicatorCode = indicatorCode; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String indicatorName) { this.indicatorName = indicatorName; }
    public String getIndicatorUnit() { return indicatorUnit; }
    public void setIndicatorUnit(String indicatorUnit) { this.indicatorUnit = indicatorUnit; }
    public String getIndicatorDirection() { return indicatorDirection; }
    public void setIndicatorDirection(String indicatorDirection) { this.indicatorDirection = indicatorDirection; }
}
