package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.List;

/**
 * 组合模型主表 apms_combo_model
 */
public class ApmsComboModel {
    private Long id;
    private Long modelId;
    private String normalizationMethod;
    private String formula;
    private String refVersion;
    private String algoVersion;

    // 关联聚合
    /** 关联 test_model 的 code */
    private String testModelCode;
    /** 关联 test_model 的 name */
    private String testModelName;
    /** 组成项列表 */
    private List<ApmsComboComponent> components;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getModelId() { return modelId; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public String getNormalizationMethod() { return normalizationMethod; }
    public void setNormalizationMethod(String normalizationMethod) { this.normalizationMethod = normalizationMethod; }
    public String getFormula() { return formula; }
    public void setFormula(String formula) { this.formula = formula; }
    public String getRefVersion() { return refVersion; }
    public void setRefVersion(String refVersion) { this.refVersion = refVersion; }
    public String getAlgoVersion() { return algoVersion; }
    public void setAlgoVersion(String algoVersion) { this.algoVersion = algoVersion; }
    public String getTestModelCode() { return testModelCode; }
    public void setTestModelCode(String testModelCode) { this.testModelCode = testModelCode; }
    public String getTestModelName() { return testModelName; }
    public void setTestModelName(String testModelName) { this.testModelName = testModelName; }
    public List<ApmsComboComponent> getComponents() { return components; }
    public void setComponents(List<ApmsComboComponent> components) { this.components = components; }
}
