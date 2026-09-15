package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;

/**
 * 测试结果值 apms_test_result_value
 */
public class ApmsTestResultValue {
    private Long id;
    private Long resultId;
    private Long indicatorId;
    private Long modelId;
    private Long fieldId;
    private String fieldKey;
    private String fieldName;
    private BigDecimal numericValue;
    private String textValue;
    private String unit;
    /** 1=派生值（如Sdec、best_time由算法计算） 0=原始输入 */
    private String isDerived;
    private String algorithmId;
    private String algorithmVersion;

    // LEFT JOIN 解析
    private String indicatorCode;
    private String indicatorName;
    private String modelFieldKey;
    private String modelFieldName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getResultId() { return resultId; }
    public void setResultId(Long resultId) { this.resultId = resultId; }
    public Long getIndicatorId() { return indicatorId; }
    public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
    public Long getModelId() { return modelId; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public Long getFieldId() { return fieldId; }
    public void setFieldId(Long fieldId) { this.fieldId = fieldId; }
    public String getFieldKey() { return fieldKey; }
    public void setFieldKey(String fieldKey) { this.fieldKey = fieldKey; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public BigDecimal getNumericValue() { return numericValue; }
    public void setNumericValue(BigDecimal numericValue) { this.numericValue = numericValue; }
    public String getTextValue() { return textValue; }
    public void setTextValue(String textValue) { this.textValue = textValue; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getIsDerived() { return isDerived; }
    public void setIsDerived(String isDerived) { this.isDerived = isDerived; }
    public String getAlgorithmId() { return algorithmId; }
    public void setAlgorithmId(String algorithmId) { this.algorithmId = algorithmId; }
    public String getAlgorithmVersion() { return algorithmVersion; }
    public void setAlgorithmVersion(String algorithmVersion) { this.algorithmVersion = algorithmVersion; }
    public String getIndicatorCode() { return indicatorCode; }
    public void setIndicatorCode(String c) { this.indicatorCode = c; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String n) { this.indicatorName = n; }
    public String getModelFieldKey() { return modelFieldKey; }
    public void setModelFieldKey(String k) { this.modelFieldKey = k; }
    public String getModelFieldName() { return modelFieldName; }
    public void setModelFieldName(String n) { this.modelFieldName = n; }
}
