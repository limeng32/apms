package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 测试结果主表 apms_test_result
 *
 * 业务约束（Service 层校验）：
 *   INDICATOR 型 → indicator_id 必填, model_id 应为 NULL
 *   MODEL 型     → model_id 必填, indicator_id 应为 NULL
 *   同一 athlete + task_item 可有多 attempt, 但 is_selected='1' 最多一条
 */
public class ApmsTestResult extends BaseEntity {
    private Long id;
    private Long taskId;
    private Long taskItemId;
    private Long athleteId;
    private Long indicatorId;
    private Long modelId;
    private String sessionKey;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date measureDate;
    private Integer attemptNo;
    /** 1=有效 0=无效 */
    private String isValid;
    /** 1=选中 0=未选中（同组 attempt 里只一条为1） */
    private String isSelected;
    private String invalidReason;
    private String dataSource;
    private String rawPayload;

    // LEFT JOIN 解析字段
    private String taskName;
    private String athleteName;
    private String athleteGender;
    private String athleteTeam;
    private String indicatorCode;
    private String indicatorName;
    private String indicatorDirection;
    private String indicatorUnit;
    private String modelCode;
    private String modelName;
    private String itemType;
    private Integer itemSortOrder;

    // 聚合
    private List<ApmsTestResultValue> values;
    private List<ApmsTestResultRep> reps;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getTaskItemId() { return taskItemId; }
    public void setTaskItemId(Long taskItemId) { this.taskItemId = taskItemId; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getIndicatorId() { return indicatorId; }
    public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
    public Long getModelId() { return modelId; }
    public void setModelId(Long modelId) { this.modelId = modelId; }
    public String getSessionKey() { return sessionKey; }
    public void setSessionKey(String sessionKey) { this.sessionKey = sessionKey; }
    public Date getMeasureDate() { return measureDate; }
    public void setMeasureDate(Date measureDate) { this.measureDate = measureDate; }
    public Integer getAttemptNo() { return attemptNo; }
    public void setAttemptNo(Integer attemptNo) { this.attemptNo = attemptNo; }
    public String getIsValid() { return isValid; }
    public void setIsValid(String isValid) { this.isValid = isValid; }
    public String getIsSelected() { return isSelected; }
    public void setIsSelected(String isSelected) { this.isSelected = isSelected; }
    public String getInvalidReason() { return invalidReason; }
    public void setInvalidReason(String invalidReason) { this.invalidReason = invalidReason; }
    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }
    public String getRawPayload() { return rawPayload; }
    public void setRawPayload(String rawPayload) { this.rawPayload = rawPayload; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String n) { this.taskName = n; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String n) { this.athleteName = n; }
    public String getAthleteGender() { return athleteGender; }
    public void setAthleteGender(String g) { this.athleteGender = g; }
    public String getAthleteTeam() { return athleteTeam; }
    public void setAthleteTeam(String t) { this.athleteTeam = t; }
    public String getIndicatorCode() { return indicatorCode; }
    public void setIndicatorCode(String c) { this.indicatorCode = c; }
    public String getIndicatorName() { return indicatorName; }
    public void setIndicatorName(String n) { this.indicatorName = n; }
    public String getIndicatorDirection() { return indicatorDirection; }
    public void setIndicatorDirection(String d) { this.indicatorDirection = d; }
    public String getIndicatorUnit() { return indicatorUnit; }
    public void setIndicatorUnit(String u) { this.indicatorUnit = u; }
    public String getModelCode() { return modelCode; }
    public void setModelCode(String c) { this.modelCode = c; }
    public String getModelName() { return modelName; }
    public void setModelName(String n) { this.modelName = n; }
    public String getItemType() { return itemType; }
    public void setItemType(String t) { this.itemType = t; }
    public Integer getItemSortOrder() { return itemSortOrder; }
    public void setItemSortOrder(Integer o) { this.itemSortOrder = o; }
    public List<ApmsTestResultValue> getValues() { return values; }
    public void setValues(List<ApmsTestResultValue> values) { this.values = values; }
    public List<ApmsTestResultRep> getReps() { return reps; }
    public void setReps(List<ApmsTestResultRep> reps) { this.reps = reps; }
}
