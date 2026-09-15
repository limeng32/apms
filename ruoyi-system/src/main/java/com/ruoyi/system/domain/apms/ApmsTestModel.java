package com.ruoyi.system.domain.apms;

import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * 测试模型库对象 apms_test_model
 */
public class ApmsTestModel {
    private Long id;
    private String category;
    private String name;
    private String code;
    private String protocol;
    /** 1=组合模型 0=否 */
    private String isCombo;
    private String algoVersion;
    private String status;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createTime;

    // 聚合 DTO：模型下的字段定义列表
    private List<ApmsTestModelField> fields;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getProtocol() { return protocol; }
    public void setProtocol(String protocol) { this.protocol = protocol; }
    public String getIsCombo() { return isCombo; }
    public void setIsCombo(String isCombo) { this.isCombo = isCombo; }
    public String getAlgoVersion() { return algoVersion; }
    public void setAlgoVersion(String algoVersion) { this.algoVersion = algoVersion; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
    public List<ApmsTestModelField> getFields() { return fields; }
    public void setFields(List<ApmsTestModelField> fields) { this.fields = fields; }
}
