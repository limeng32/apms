package com.ruoyi.system.domain.apms;

import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 登录页页面配置对象 apms_login_config
 *
 * 单例配置：config_key='default' 一行；config_json 存完整配置 JSON。
 * 视觉默认值不在后端维护——无配置行时接口返回 {}，由前端 login.defaults.js 合并。
 *
 * @author apms
 */
public class ApmsLoginConfig extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 主键 */
    private Long id;

    /** 配置标识（单例=default，预留多主题） */
    private String configKey;

    /** 配置名称 */
    private String configName;

    /** 登录页配置 JSON（完整配置对象） */
    private String configJson;

    /** 配置结构版本号（用于字段迁移，非历史版本） */
    private Integer schemaVer;

    /** 状态（0正常 1停用） */
    private String status;

    public Long getId()
    {
        return id;
    }

    public void setId(Long id)
    {
        this.id = id;
    }

    public String getConfigKey()
    {
        return configKey;
    }

    public void setConfigKey(String configKey)
    {
        this.configKey = configKey;
    }

    public String getConfigName()
    {
        return configName;
    }

    public void setConfigName(String configName)
    {
        this.configName = configName;
    }

    public String getConfigJson()
    {
        return configJson;
    }

    public void setConfigJson(String configJson)
    {
        this.configJson = configJson;
    }

    public Integer getSchemaVer()
    {
        return schemaVer;
    }

    public void setSchemaVer(Integer schemaVer)
    {
        this.schemaVer = schemaVer;
    }

    public String getStatus()
    {
        return status;
    }

    public void setStatus(String status)
    {
        this.status = status;
    }
}
