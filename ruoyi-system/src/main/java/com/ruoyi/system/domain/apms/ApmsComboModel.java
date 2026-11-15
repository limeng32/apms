package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.List;

/**
 * 组合模型主表 apms_combo_model
 */
public class ApmsComboModel {
    private Long id;
    private Long modelId;
    /** 方案业务名称（同载体下多套评分方案的可辨识标识）；Service 层必填 */
    private String versionLabel;
    /** 0=启用 1=停用；停用方案不可再用于组合分计算 */
    private String status;
    /** 同 model_id 下唯一默认方案：1=是 0=否；互斥由 Service 单事务保证 */
    private String isDefault;
    private String normalizationMethod;
    private String formula;
    private String refVersion;
    private String algoVersion;

    /**
     * 新建组合体系（is_combo=1 的测试模型）时使用，与 modelId 二选一：
     * 两字段非空表示在同一事务内先创建测试模型载体，再创建组合模型。
     */
    private String newModelCode;
    private String newModelName;

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
    public String getVersionLabel() { return versionLabel; }
    public void setVersionLabel(String versionLabel) { this.versionLabel = versionLabel; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getIsDefault() { return isDefault; }
    public void setIsDefault(String isDefault) { this.isDefault = isDefault; }
    public String getNormalizationMethod() { return normalizationMethod; }
    public void setNormalizationMethod(String normalizationMethod) { this.normalizationMethod = normalizationMethod; }
    public String getFormula() { return formula; }
    public void setFormula(String formula) { this.formula = formula; }
    public String getRefVersion() { return refVersion; }
    public void setRefVersion(String refVersion) { this.refVersion = refVersion; }
    public String getAlgoVersion() { return algoVersion; }
    public void setAlgoVersion(String algoVersion) { this.algoVersion = algoVersion; }
    public String getNewModelCode() { return newModelCode; }
    public void setNewModelCode(String newModelCode) { this.newModelCode = newModelCode; }
    public String getNewModelName() { return newModelName; }
    public void setNewModelName(String newModelName) { this.newModelName = newModelName; }
    public String getTestModelCode() { return testModelCode; }
    public void setTestModelCode(String testModelCode) { this.testModelCode = testModelCode; }
    public String getTestModelName() { return testModelName; }
    public void setTestModelName(String testModelName) { this.testModelName = testModelName; }
    public List<ApmsComboComponent> getComponents() { return components; }
    public void setComponents(List<ApmsComboComponent> components) { this.components = components; }
}
