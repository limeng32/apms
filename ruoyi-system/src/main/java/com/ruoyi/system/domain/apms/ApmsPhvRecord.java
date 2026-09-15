package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * PHV测量与计算记录对象 apms_phv_record
 *
 * @author apms
 */
public class ApmsPhvRecord {

    private Long id;

    /** 运动员ID */
    private Long athleteId;

    /** 关联apms_body_measure.id */
    private Long sourceMeasureId;

    /** 性别（0男 1女） */
    private String gender;

    /** 测量日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date measureDate;

    /** 精确年龄（0.0001岁精度） */
    private BigDecimal decimalAge;

    /** 站立身高 cm（快照副本） */
    private BigDecimal height;

    /** 坐高 cm（快照副本） */
    private BigDecimal sitHeight;

    /** 体重 kg（快照副本） */
    private BigDecimal weight;

    /** 父亲身高 cm */
    private BigDecimal fatherHeight;

    /** 母亲身高 cm */
    private BigDecimal motherHeight;

    /** 腿长（身高-坐高） */
    private BigDecimal legLength;

    /** 成熟度偏移（8,4） */
    private BigDecimal maturityOffset;

    /** 预计PHV年龄（6,4） */
    private BigDecimal predictedPhvAge;

    /** 预测成年身高 cm */
    private BigDecimal predictedAdultHeight;

    /** Mirwald 公式版本 */
    private String mirwaldVersion;

    /** Khamis-Roche 公式版本 */
    private String khamisVersion;

    /** 完整输入快照（JSON） */
    private String inputSnapshot;

    /** 操作人 */
    private String createBy;

    /** 计算时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createTime;

    /** 运动员姓名（关联查询） */
    private String athleteName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Long getSourceMeasureId() { return sourceMeasureId; }
    public void setSourceMeasureId(Long sourceMeasureId) { this.sourceMeasureId = sourceMeasureId; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public Date getMeasureDate() { return measureDate; }
    public void setMeasureDate(Date measureDate) { this.measureDate = measureDate; }
    public BigDecimal getDecimalAge() { return decimalAge; }
    public void setDecimalAge(BigDecimal decimalAge) { this.decimalAge = decimalAge; }
    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }
    public BigDecimal getSitHeight() { return sitHeight; }
    public void setSitHeight(BigDecimal sitHeight) { this.sitHeight = sitHeight; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public BigDecimal getFatherHeight() { return fatherHeight; }
    public void setFatherHeight(BigDecimal fatherHeight) { this.fatherHeight = fatherHeight; }
    public BigDecimal getMotherHeight() { return motherHeight; }
    public void setMotherHeight(BigDecimal motherHeight) { this.motherHeight = motherHeight; }
    public BigDecimal getLegLength() { return legLength; }
    public void setLegLength(BigDecimal legLength) { this.legLength = legLength; }
    public BigDecimal getMaturityOffset() { return maturityOffset; }
    public void setMaturityOffset(BigDecimal maturityOffset) { this.maturityOffset = maturityOffset; }
    public BigDecimal getPredictedPhvAge() { return predictedPhvAge; }
    public void setPredictedPhvAge(BigDecimal predictedPhvAge) { this.predictedPhvAge = predictedPhvAge; }
    public BigDecimal getPredictedAdultHeight() { return predictedAdultHeight; }
    public void setPredictedAdultHeight(BigDecimal predictedAdultHeight) { this.predictedAdultHeight = predictedAdultHeight; }
    public String getMirwaldVersion() { return mirwaldVersion; }
    public void setMirwaldVersion(String mirwaldVersion) { this.mirwaldVersion = mirwaldVersion; }
    public String getKhamisVersion() { return khamisVersion; }
    public void setKhamisVersion(String khamisVersion) { this.khamisVersion = khamisVersion; }
    public String getInputSnapshot() { return inputSnapshot; }
    public void setInputSnapshot(String inputSnapshot) { this.inputSnapshot = inputSnapshot; }
    public String getCreateBy() { return createBy; }
    public void setCreateBy(String createBy) { this.createBy = createBy; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public String getAthleteName() { return athleteName; }
    public void setAthleteName(String athleteName) { this.athleteName = athleteName; }
}
