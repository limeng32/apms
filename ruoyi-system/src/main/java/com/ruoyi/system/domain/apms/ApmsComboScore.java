package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 组合得分计算记录 apms_combo_score
 * 暂不做 CRUD UI，仅定义供未来计算引擎写入。
 */
public class ApmsComboScore {
    private Long id;
    private Long comboModelId;
    private Long athleteId;
    private Long triggerResultId;
    private BigDecimal comboScore;
    private String refSnapshot; // JSON
    private String algoVersion;
    private Date calculatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getComboModelId() { return comboModelId; }
    public void setComboModelId(Long comboModelId) { this.comboModelId = comboModelId; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getTriggerResultId() { return triggerResultId; }
    public void setTriggerResultId(Long triggerResultId) { this.triggerResultId = triggerResultId; }
    public BigDecimal getComboScore() { return comboScore; }
    public void setComboScore(BigDecimal comboScore) { this.comboScore = comboScore; }
    public String getRefSnapshot() { return refSnapshot; }
    public void setRefSnapshot(String refSnapshot) { this.refSnapshot = refSnapshot; }
    public String getAlgoVersion() { return algoVersion; }
    public void setAlgoVersion(String algoVersion) { this.algoVersion = algoVersion; }
    public Date getCalculatedAt() { return calculatedAt; }
    public void setCalculatedAt(Date calculatedAt) { this.calculatedAt = calculatedAt; }
}
