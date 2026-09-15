package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;

/**
 * 测试结果 REP 评价 apms_test_result_rep
 *
 * 一条 result 下可多个 field_key 各对应一个 rep
 * rep_no 参照 indicator_ref_level 表：
 *   1 = Excellent
 *   2 = Good
 *   3 = Normal
 *   4 = Poor
 */
public class ApmsTestResultRep {
    private Long id;
    private Long resultId;
    private String fieldKey;
    /** 1-4 对应 Excellent/Good/Normal/Poor */
    private Integer repNo;
    private BigDecimal value;
    private String unit;

    // LEFT JOIN 解析
    private String repLevel;   // Excellent/Good/Normal/Poor
    private String direction;  // HIGHER_BETTER/LOWER_BETTER

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getResultId() { return resultId; }
    public void setResultId(Long resultId) { this.resultId = resultId; }
    public String getFieldKey() { return fieldKey; }
    public void setFieldKey(String fieldKey) { this.fieldKey = fieldKey; }
    public Integer getRepNo() { return repNo; }
    public void setRepNo(Integer repNo) { this.repNo = repNo; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getRepLevel() { return repLevel; }
    public void setRepLevel(String l) { this.repLevel = l; }
    public String getDirection() { return direction; }
    public void setDirection(String d) { this.direction = d; }
}
