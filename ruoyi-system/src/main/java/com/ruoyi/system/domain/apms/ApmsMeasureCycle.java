package com.ruoyi.system.domain.apms;

import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * 体态测量周期 apms_measure_cycle
 */
public class ApmsMeasureCycle {
    private Long id;
    private String name;
    /** 目标队伍ID；null=全部在训队员 */
    private Long targetDeptId;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date planStartDate;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date planEndDate;
    /** 0=进行中 1=已关闭 */
    private String status;
    private String remark;
    private String createBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createTime;
    private String updateBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date updateTime;

    // 聚合展示字段
    private String targetDeptName;
    private Integer memberTotal;
    private Integer measuredCount;

    // 批量录入入参（非持久化）：cycle/{id}/batch
    private transient List<ApmsBodyMeasure> batchMeasures;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getTargetDeptId() { return targetDeptId; }
    public void setTargetDeptId(Long targetDeptId) { this.targetDeptId = targetDeptId; }
    public Date getPlanStartDate() { return planStartDate; }
    public void setPlanStartDate(Date planStartDate) { this.planStartDate = planStartDate; }
    public Date getPlanEndDate() { return planEndDate; }
    public void setPlanEndDate(Date planEndDate) { this.planEndDate = planEndDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public String getUpdateBy() { return updateBy; }
    public void setUpdateBy(String updateBy) { this.updateBy = updateBy; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
    public String getTargetDeptName() { return targetDeptName; }
    public void setTargetDeptName(String targetDeptName) { this.targetDeptName = targetDeptName; }
    public Integer getMemberTotal() { return memberTotal; }
    public void setMemberTotal(Integer memberTotal) { this.memberTotal = memberTotal; }
    public Integer getMeasuredCount() { return measuredCount; }
    public void setMeasuredCount(Integer measuredCount) { this.measuredCount = measuredCount; }
    public List<ApmsBodyMeasure> getBatchMeasures() { return batchMeasures; }
    public void setBatchMeasures(List<ApmsBodyMeasure> batchMeasures) { this.batchMeasures = batchMeasures; }
}
