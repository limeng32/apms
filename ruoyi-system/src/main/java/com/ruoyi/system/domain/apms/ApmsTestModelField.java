package com.ruoyi.system.domain.apms;

/**
 * 测试模型字段定义对象 apms_test_model_field
 */
public class ApmsTestModelField {
    private Long id;
    private Long modelId;
    private String fieldKey;
    private String fieldName;
    private String unit;
    private String dataType;
    /** 1=必填 0=选填 */
    private String isRequired;
    /** 采集方式：INPUT=人工/设备采集 DERIVED=系统计算 */
    private String collectMode;
    private Integer sortOrder;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getModelId() { return modelId; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public String getFieldKey() { return fieldKey; }
    public void setFieldKey(String fieldKey) { this.fieldKey = fieldKey; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getDataType() { return dataType; }
    public void setDataType(String dataType) { this.dataType = dataType; }
    public String getIsRequired() { return isRequired; }
    public void setIsRequired(String isRequired) { this.isRequired = isRequired; }
    public String getCollectMode() { return collectMode; }
    public void setCollectMode(String collectMode) { this.collectMode = collectMode; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
