package com.ruoyi.system.service.apms.batchimport;

import java.io.Serializable;

/**
 * 导入草稿基类（Redis 暂存，FastJson2 序列化）。
 *
 * @author apms
 */
public class ImportDraft implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 业务域：result（成绩）/ body（体态） */
    private String domain;

    /** 创建人 userId（commit 时强校验一致） */
    private Long userId;

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
}
