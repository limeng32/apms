package com.ruoyi.system.domain.apms;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 运动员-小组归属历史对象 apms_athlete_group
 *
 * @author apms
 */
public class ApmsAthleteGroup extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 自增主键 */
    private Long id;

    /** 运动员ID */
    private Long athleteId;

    /** 小组ID（sys_dept，dept_type=30/40/50） */
    private Long deptId;

    /** 加入日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date joinDate;

    /** 离开日期（NULL=当前在组） */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date leaveDate;

    /** 状态（0=在组 1=已离组） */
    private String status;

    /** 小组名称（关联查询） */
    private String deptName;

    /** 部门类型名称（关联查询） */
    private String deptTypeName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getDeptId() { return deptId; }
    public void setDeptId(Long deptId) { this.deptId = deptId; }
    public Date getJoinDate() { return joinDate; }
    public void setJoinDate(Date joinDate) { this.joinDate = joinDate; }
    public Date getLeaveDate() { return leaveDate; }
    public void setLeaveDate(Date leaveDate) { this.leaveDate = leaveDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDeptName() { return deptName; }
    public void setDeptName(String deptName) { this.deptName = deptName; }
    public String getDeptTypeName() { return deptTypeName; }
    public void setDeptTypeName(String deptTypeName) { this.deptTypeName = deptTypeName; }
}
