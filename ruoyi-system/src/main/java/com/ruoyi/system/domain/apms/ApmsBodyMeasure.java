package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 体态测量对象 apms_body_measure
 *
 * @author apms
 */
public class ApmsBodyMeasure extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 自增主键 */
    private Long id;

    /** 运动员ID */
    private Long athleteId;

    /** 测量日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date measureDate;

    /** 站立身高 cm */
    private BigDecimal height;

    /** 体重 kg */
    private BigDecimal weight;

    /** 坐高 cm */
    private BigDecimal sitHeight;

    /** 体脂率 % */
    private BigDecimal bodyFatRate;

    /** 腰围 cm */
    private BigDecimal waist;

    /** 来源（manual/csv/import/task） */
    private String dataSource;

    /** 来源任务ID */
    private Long sourceTaskId;

    /** 来源测量会话Key */
    private String sourceSessionKey;

    /** 腿高（非数据库字段，计算用：height - sitHeight） */
    private BigDecimal legLength;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getAthleteId() { return athleteId; }
    public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
    public Date getMeasureDate() { return measureDate; }
    public void setMeasureDate(Date measureDate) { this.measureDate = measureDate; }
    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public BigDecimal getSitHeight() { return sitHeight; }
    public void setSitHeight(BigDecimal sitHeight) { this.sitHeight = sitHeight; }
    public BigDecimal getBodyFatRate() { return bodyFatRate; }
    public void setBodyFatRate(BigDecimal bodyFatRate) { this.bodyFatRate = bodyFatRate; }
    public BigDecimal getWaist() { return waist; }
    public void setWaist(BigDecimal waist) { this.waist = waist; }
    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }
    public Long getSourceTaskId() { return sourceTaskId; }
    public void setSourceTaskId(Long sourceTaskId) { this.sourceTaskId = sourceTaskId; }
    public String getSourceSessionKey() { return sourceSessionKey; }
    public void setSourceSessionKey(String sourceSessionKey) { this.sourceSessionKey = sourceSessionKey; }
    public BigDecimal getLegLength() {
        if (height != null && sitHeight != null) {
            return height.subtract(sitHeight);
        }
        return legLength;
    }
    public void setLegLength(BigDecimal legLength) { this.legLength = legLength; }
}
