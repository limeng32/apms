package com.ruoyi.system.domain.apms;

import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 测试任务主表 apms_test_task
 */
public class ApmsTestTask extends BaseEntity {
    private Long id;
    private String taskName;
    private Long targetDeptId;
    private Long testerId;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date startDate;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date endDate;
    /** pending/in_progress/completed */
    private String status;

    // LEFT JOIN 解析字段
    private String targetDeptName;
    private String testerName;

    // 进度派生字段
    private Integer memberTotal;
    private Integer memberCompleted;
    private Integer memberPending;
    private Integer memberPartial;
    /** 0-100 百分比 */
    private Integer progressPercent;

    // 聚合
    private List<ApmsTaskItem> items;
    private List<ApmsTaskMember> members;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTaskName() { return taskName; }
    public void setTaskName(String taskName) { this.taskName = taskName; }
    public Long getTargetDeptId() { return targetDeptId; }
    public void setTargetDeptId(Long targetDeptId) { this.targetDeptId = targetDeptId; }
    public Long getTesterId() { return testerId; }
    public void setTesterId(Long testerId) { this.testerId = testerId; }
    public Date getStartDate() { return startDate; }
    public void setStartDate(Date startDate) { this.startDate = startDate; }
    public Date getEndDate() { return endDate; }
    public void setEndDate(Date endDate) { this.endDate = endDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTargetDeptName() { return targetDeptName; }
    public void setTargetDeptName(String n) { this.targetDeptName = n; }
    public String getTesterName() { return testerName; }
    public void setTesterName(String n) { this.testerName = n; }
    public Integer getMemberTotal() { return memberTotal; }
    public void setMemberTotal(Integer v) { this.memberTotal = v; }
    public Integer getMemberCompleted() { return memberCompleted; }
    public void setMemberCompleted(Integer v) { this.memberCompleted = v; }
    public Integer getMemberPending() { return memberPending; }
    public void setMemberPending(Integer v) { this.memberPending = v; }
    public Integer getMemberPartial() { return memberPartial; }
    public void setMemberPartial(Integer v) { this.memberPartial = v; }
    public Integer getProgressPercent() { return progressPercent; }
    public void setProgressPercent(Integer v) { this.progressPercent = v; }
    public List<ApmsTaskItem> getItems() { return items; }
    public void setItems(List<ApmsTaskItem> items) { this.items = items; }
    public List<ApmsTaskMember> getMembers() { return members; }
    public void setMembers(List<ApmsTaskMember> members) { this.members = members; }
}
