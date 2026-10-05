package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * RTP 风险因子（评估引擎输出，落库到 snapshot.factors JSON，前端直接渲染）
 *
 * @author apms
 */
public class RiskFactor implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 规则编码 */
    private String code;

    /** HEALTH / PROCESS */
    private String kind;

    /** 健康严重度（PROCESS 恒为 0） */
    private Integer severity;

    /** 紧迫度 1/2/3 */
    private Integer urgency;

    /** 是否可直接建议红色（仅 HEALTH 可能为 true） */
    private boolean forceWarning;

    /** 计分权重 */
    private BigDecimal weight;

    /** 因子标题 */
    private String title;

    /** 人话原因（含"建议/供参考"措辞与人工核实提示） */
    private String detail;

    /** 参考数据（复检日/逾期天数/记录类型等，供前端展示） */
    private Map<String, Object> refData = new LinkedHashMap<>();

    public RiskFactor() {}

    public RiskFactor(String code, String kind) {
        this.code = code;
        this.kind = kind;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public Integer getSeverity() { return severity; }
    public void setSeverity(Integer severity) { this.severity = severity; }
    public Integer getUrgency() { return urgency; }
    public void setUrgency(Integer urgency) { this.urgency = urgency; }
    public boolean isForceWarning() { return forceWarning; }
    public void setForceWarning(boolean forceWarning) { this.forceWarning = forceWarning; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Map<String, Object> getRefData() { return refData; }
    public void setRefData(Map<String, Object> refData) { this.refData = refData; }
}
