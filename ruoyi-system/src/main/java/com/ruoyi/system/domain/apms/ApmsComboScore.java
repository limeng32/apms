package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;
import java.util.Map;
import java.util.HashMap;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * 组合得分计算记录 apms_combo_score
 */
public class ApmsComboScore {
    private Long id;
    private Long comboModelId;
    private Long athleteId;
    private Long triggerResultId;
    private BigDecimal comboScore;
    /** 计算快照 JSON */
    private String refSnapshot;
    private String algoVersion;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date calculatedAt;

    /** 关联字段（SELECT 时 JOIN 解析） */
    private String athleteName;
    private String athleteTeam;
    private String comboModelName;

    /** DataScope 注入（非持久化） */
    private Map<String, Object> params = new HashMap<>();
    public Map<String, Object> getParams() { return params; }
    public void setParams(Map<String, Object> params) { this.params = params; }

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
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
    public String getAthleteTeam() { return athleteTeam; }
    public void setAthleteTeam(String athleteTeam) { this.athleteTeam = athleteTeam; }
    public String getComboModelName() { return comboModelName; }
    public void setComboModelName(String comboModelName) { this.comboModelName = comboModelName; }
}
