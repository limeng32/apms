package com.ruoyi.system.domain.apms;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 指标库对象 apms_indicator
 *
 * @author apms
 */
public class ApmsIndicator extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 自增主键 */
    private Long id;

    /** 稳定业务编码（HEIGHT/WEIGHT/SPRINT_30M等） */
    private String code;

    /** 分类（形态/机能/素质/筛查） */
    private String category;

    /** 指标名称（可改） */
    private String name;

    /** 单位 */
    private String unit;

    /** 数据类型（number/decimal/text/select） */
    private String dataType;

    /** 评价方向：HIGHER_BETTER/LOWER_BETTER/RANGE_BEST/REFERENCE_ONLY */
    private String evaluationDirection;

    /** 采集方式（manual/device/csv） */
    private String collectionMethod;

    /** 0=启用 1=停用 */
    private String status;

    /** 有效版本 */
    private String version;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createTime;

    // ========= 关联子对象（聚合 DTO） =========
    /** 该指标下的参考范围列表 */
    private List<ApmsIndicatorRef> refs;

    // ========= getter/setter =========
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public String getDataType() { return dataType; }
    public void setDataType(String dataType) { this.dataType = dataType; }
    public String getEvaluationDirection() { return evaluationDirection; }
    public void setEvaluationDirection(String evaluationDirection) { this.evaluationDirection = evaluationDirection; }
    public String getCollectionMethod() { return collectionMethod; }
    public void setCollectionMethod(String collectionMethod) { this.collectionMethod = collectionMethod; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public List<ApmsIndicatorRef> getRefs() { return refs; }
    public void setRefs(List<ApmsIndicatorRef> refs) { this.refs = refs; }
}
