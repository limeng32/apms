package com.ruoyi.framework.sms;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 阿里云短信配置（前缀 apms.sms）
 *
 * <p>AK/SK 只允许由部署服务器 env.conf 注入到外部 application.yml，源码仓库内保持空串；
 * AK/SK 为空时不创建客户端，发短信接口直接返回「短信登录未配置」，不影响应用启动。
 *
 * @author apms
 */
@Component
@ConfigurationProperties(prefix = "apms.sms")
public class SmsProperties
{
    /** AccessKey Id（敏感，外部注入） */
    private String accessKeyId = "";

    /** AccessKey Secret（敏感，外部注入） */
    private String accessKeySecret = "";

    /** 短信签名名称 */
    private String signName = "北京康耐特体育";

    /** 短信模板 CODE */
    private String templateCode = "";

    /** 阿里云短信服务接入点 */
    private String endpoint = "dysmsapi.aliyuncs.com";

    /** 模板验证码变量名（模板中 ${code} 的 code） */
    private String codeParam = "code";

    public boolean isConfigured()
    {
        return accessKeyId != null && !accessKeyId.isBlank()
                && accessKeySecret != null && !accessKeySecret.isBlank()
                && templateCode != null && !templateCode.isBlank();
    }

    public String getAccessKeyId()
    {
        return accessKeyId;
    }

    public void setAccessKeyId(String accessKeyId)
    {
        this.accessKeyId = accessKeyId;
    }

    public String getAccessKeySecret()
    {
        return accessKeySecret;
    }

    public void setAccessKeySecret(String accessKeySecret)
    {
        this.accessKeySecret = accessKeySecret;
    }

    public String getSignName()
    {
        return signName;
    }

    public void setSignName(String signName)
    {
        this.signName = signName;
    }

    public String getTemplateCode()
    {
        return templateCode;
    }

    public void setTemplateCode(String templateCode)
    {
        this.templateCode = templateCode;
    }

    public String getEndpoint()
    {
        return endpoint;
    }

    public void setEndpoint(String endpoint)
    {
        this.endpoint = endpoint;
    }

    public String getCodeParam()
    {
        return codeParam;
    }

    public void setCodeParam(String codeParam)
    {
        this.codeParam = codeParam;
    }
}
