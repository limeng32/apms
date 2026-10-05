package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;
import com.ruoyi.system.domain.apms.dto.RiskFactor;

/**
 * RTP 风险预警每日快照对象 apms_rtp_risk_snapshot
 *
 * 状态机：ACTIVE（当日待处理）
 *        → ACKED（INFO 已知悉）/ ACCEPTED（ATTENTION/WARNING 已采纳并更新 RTP）
 *        / DISMISSED（已忽略）；次日扫描开始时未处理的昨日 ACTIVE 置 EXPIRED。
 *
 * 继承 BaseEntity：createBy/createTime/updateTime 复用基类字段，
 * params Map 供 @DataScope 注入数据权限 SQL。
 *
 * @author apms
 */
public class ApmsRtpRiskSnapshot extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private Long id;

    private Long athleteId;

    /** 扫描时主属队伍 */
    private Long deptId;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date snapshotDate;

    /** 健康分 = 仅 HEALTH 因子 severity×weight 加权和；纯流程待办为 0 */
    private BigDecimal riskScore;

    /** 待办优先级 = max(所有因子 urgency)，仅排序用 */
    private Integer todoPriority;

    /** 1=纯流程待办（无健康因子，不计 RTP 建议） */
    private String processOnly;

    /** 命中的流程因子码 JSON，如 ["REVIEW_OVERDUE"] */
    private String processFlags;

    /** NONE / INFO / ATTENTION / WARNING */
    private String suggestedLevel;

    /** 因子明细 JSON（落库原文） */
    private String factors;

    /** ACTIVE / ACKED / ACCEPTED / DISMISSED / EXPIRED */
    private String status;

    private String handledBy;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date handledTime;

    private String handleRemark;

    /** 采纳时写入的 RTP 状态（y/r） */
    private String acceptedStatus;

    // ============ 非持久化字段 ============

    /** 因子明细（factors JSON 解析后，供前端直接渲染） */
    private List<RiskFactor> factorList = new ArrayList<>();

    /** 流程因子码（process_flags JSON 解析后） */
    private List<String> processFlagList = new ArrayList<>();

    /** 列表查询参数：状态集合（默认 ACTIVE） */
    private List<String> statusList;

    /** 列表查询参数：级别集合 */
    private List<String> levelList;

    /** 列表查询参数：姓名模糊 */
    private String keyword;

    /** 列表查询参数：命中指定流程因子码（如 REVIEW_OVERDUE，JSON_CONTAINS） */
    private String processFlag;

    // JOIN 解析
    private String athleteName;
    private String athleteTeam;
    private String athleteGender;
    private Integer athleteAge;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getDeptId() { return deptId; }
    public void setDeptId(Long deptId) { this.deptId = deptId; }
    public Date getSnapshotDate() { return snapshotDate; }
    public void setSnapshotDate(Date snapshotDate) { this.snapshotDate = snapshotDate; }
    public BigDecimal getRiskScore() { return riskScore; }
    public void setRiskScore(BigDecimal riskScore) { this.riskScore = riskScore; }
    public Integer getTodoPriority() { return todoPriority; }
    public void setTodoPriority(Integer todoPriority) { this.todoPriority = todoPriority; }
    public String getProcessOnly() { return processOnly; }
    public void setProcessOnly(String processOnly) { this.processOnly = processOnly; }
    public String getProcessFlags() { return processFlags; }
    public void setProcessFlags(String processFlags) { this.processFlags = processFlags; }
    public String getSuggestedLevel() { return suggestedLevel; }
    public void setSuggestedLevel(String suggestedLevel) { this.suggestedLevel = suggestedLevel; }
    public String getFactors() { return factors; }
    public void setFactors(String factors) { this.factors = factors; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getHandledBy() { return handledBy; }
    public void setHandledBy(String handledBy) { this.handledBy = handledBy; }
    public Date getHandledTime() { return handledTime; }
    public void setHandledTime(Date handledTime) { this.handledTime = handledTime; }
    public String getHandleRemark() { return handleRemark; }
    public void setHandleRemark(String handleRemark) { this.handleRemark = handleRemark; }
    public String getAcceptedStatus() { return acceptedStatus; }
    public void setAcceptedStatus(String acceptedStatus) { this.acceptedStatus = acceptedStatus; }
    public List<RiskFactor> getFactorList() { return factorList; }
    public void setFactorList(List<RiskFactor> factorList) { this.factorList = factorList; }
    public List<String> getProcessFlagList() { return processFlagList; }
    public void setProcessFlagList(List<String> processFlagList) { this.processFlagList = processFlagList; }
    public List<String> getStatusList() { return statusList; }
    public void setStatusList(List<String> statusList) { this.statusList = statusList; }
    public List<String> getLevelList() { return levelList; }
    public void setLevelList(List<String> levelList) { this.levelList = levelList; }
    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword; }
    public String getProcessFlag() { return processFlag; }
    public void setProcessFlag(String processFlag) { this.processFlag = processFlag; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
    public String getAthleteTeam() { return athleteTeam; }
    public void setAthleteTeam(String athleteTeam) { this.athleteTeam = athleteTeam; }
    public String getAthleteGender() { return athleteGender; }
    public void setAthleteGender(String athleteGender) { this.athleteGender = athleteGender; }
    public Integer getAthleteAge() { return athleteAge; }
    public void setAthleteAge(Integer athleteAge) { this.athleteAge = athleteAge; }
}
