package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.List;

/**
 * 指标参考范围（按性别/年龄组/队伍）apms_indicator_ref
 *
 * @author apms
 */
public class ApmsIndicatorRef {

    private Long id;
    private Long indicatorId;
    private String gender;
    private String ageGroup;
    private Long deptId;
    private BigDecimal refMin;
    private BigDecimal refMax;
    private String modelVersion;

    // ========= 关联子对象 =========
    /** 该参考范围下的三级判定 */
    private List<ApmsIndicatorRefLevel> levels;

    // ========= getter/setter =========
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getIndicatorId() { return indicatorId; }
    public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getAgeGroup() { return ageGroup; }
    public void setAgeGroup(String ageGroup) { this.ageGroup = ageGroup; }
    public Long getDeptId() { return deptId; }
    public void setDeptId(Long deptId) { this.deptId = deptId; }
    public BigDecimal getRefMin() { return refMin; }
    public void setRefMin(BigDecimal refMin) { this.refMin = refMin; }
    public BigDecimal getRefMax() { return refMax; }
    public void setRefMax(BigDecimal refMax) { this.refMax = refMax; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public List<ApmsIndicatorRefLevel> getLevels() { return levels; }
    public void setLevels(List<ApmsIndicatorRefLevel> levels) { this.levels = levels; }
}
