package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;

/**
 * RTP 预警规则配置对象 apms_rtp_risk_rule
 *
 * kind 双维度隔离：
 *   HEALTH  —— 健康因子，severity×weight 计入 riskScore，可决定黄/红建议；
 *   PROCESS —— 流程因子，健康分贡献恒为 0，只产生待办与 todoPriority。
 *
 * @author apms
 */
public class ApmsRtpRiskRule {

    private Long id;

    /** 规则编码（REVIEW_OVERDUE / REVIEW_SOON / INJURY_OPEN / PHV_PEAK） */
    private String ruleCode;

    /** 规则名称 */
    private String ruleName;

    /** 1=启用 0=停用 */
    private String enabled;

    /** HEALTH / PROCESS */
    private String kind;

    /** 健康严重度 1低 2中 3高（仅 HEALTH 计分；PROCESS 固定 0） */
    private Integer severity;

    /** 紧迫度 1低 2中 3高（仅待办排序） */
    private Integer urgency;

    /** HEALTH 因子是否可直接建议红色（0/1）；PROCESS 恒为 0 */
    private String forceWarning;

    /** 权重（仅 HEALTH 计分使用） */
    private BigDecimal weight;

    /** 阈值参数 JSON（窗口天数 / 带宽 / 新鲜天数等） */
    private String params;

    private String updateBy;

    private Date updateTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRuleCode() { return ruleCode; }
    public void setRuleCode(String ruleCode) { this.ruleCode = ruleCode; }
    public String getRuleName() { return ruleName; }
    public void setRuleName(String ruleName) { this.ruleName = ruleName; }
    public String getEnabled() { return enabled; }
    public void setEnabled(String enabled) { this.enabled = enabled; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public Integer getSeverity() { return severity; }
    public void setSeverity(Integer severity) { this.severity = severity; }
    public Integer getUrgency() { return urgency; }
    public void setUrgency(Integer urgency) { this.urgency = urgency; }
    public String getForceWarning() { return forceWarning; }
    public void setForceWarning(String forceWarning) { this.forceWarning = forceWarning; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public String getParams() { return params; }
    public void setParams(String params) { this.params = params; }
    public String getUpdateBy() { return updateBy; }
    public void setUpdateBy(String updateBy) { this.updateBy = updateBy; }
    public Date getUpdateTime() { return updateTime; }
    public void setUpdateTime(Date updateTime) { this.updateTime = updateTime; }
}
