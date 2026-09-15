package com.ruoyi.system.domain.apms;

/**
 * 任务测试项 apms_task_item
 *
 * 业务约束（Service 层校验）：
 *   item_type='INDICATOR' → indicator_id 必填, model_id 应为 NULL
 *   item_type='MODEL'     → model_id 必填, indicator_id 应为 NULL
 */
public class ApmsTaskItem {
    private Long id;
    private Long taskId;
    /** INDICATOR / MODEL */
    private String itemType;
    private Long indicatorId;
    private Long modelId;
    /** 1=必测 0=选测 */
    private String isRequired;
    private Integer sortOrder;

    // LEFT JOIN 解析字段
    private String indicatorCode;
    private String indicatorName;
    private String indicatorDirection;
    private String modelCode;
    private String modelName;
    private String modelCategory;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public String getItemType() { return itemType; }
    public void setItemType(String itemType) { this.itemType = itemType; }
    public Long getIndicatorId() { return indicatorId; }
    public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
    public Long getModelId() { return modelId; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public String getIsRequired() { return isRequired; }
    public void setIsRequired(String isRequired) { this.isRequired = isRequired; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getIndicatorCode() { return indicatorCode; }
    public void setIndicatorCode(String n) { this.indicatorCode = n; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String n) { this.indicatorName = n; }
    public String getIndicatorDirection() { return indicatorDirection; }
    public void setIndicatorDirection(String d) { this.indicatorDirection = d; }
    public String getModelCode() { return modelCode; }
    public void setModelCode(String n) { this.modelCode = n; }
    public String getModelName() { return modelName; }
    public void setModelName(String n) { this.modelName = n; }
    public String getModelCategory() { return modelCategory; }
    public void setModelCategory(String c) { this.modelCategory = c; }
}
