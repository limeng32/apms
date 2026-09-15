package com.ruoyi.system.domain.apms;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 运动员档案对象 apms_athlete
 *
 * @author apms
 */
public class ApmsAthlete extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 运动员ID（一人一档主键） */
    private Long athleteId;

    /** 关联的系统登录账号ID（可空，仅运动员需要登录时才建立） */
    private Long userId;

    /** 姓名 */
    private String name;

    /** 性别（M/F） */
    private String gender;

    /** 出生日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date birthday;

    /** 联系电话 */
    private String phone;

    /** 主属队伍ID（sys_dept.dept_id，必须是 dept_type=20 的队伍节点） */
    private Long primaryTeamId;

    /** 球衣号码 */
    private String jerseyNo;

    /** 场上位置（字典 apms_position：GK/DF/MF/FW） */
    private String position;

    /** 状态（0=在队 1=离队 2=退役） */
    private String status;

    /** 队伍名称（关联查询，非数据库字段） */
    private String teamName;

    /** 年龄（计算字段，非数据库字段） */
    private Integer age;

    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public Date getBirthday() { return birthday; }
    public void setBirthday(Date birthday) { this.birthday = birthday; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Long getPrimaryTeamId() { return primaryTeamId; }
    public void setPrimaryTeamId(Long primaryTeamId) { this.primaryTeamId = primaryTeamId; }
    public String getJerseyNo() { return jerseyNo; }
    public void setJerseyNo(String jerseyNo) { this.jerseyNo = jerseyNo; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
}
