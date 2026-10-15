package com.ruoyi.framework.sms;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.alibaba.fastjson2.JSON;
import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.dysmsapi20170525.models.SendSmsResponseBody;
import com.aliyun.teaopenapi.models.Config;
import com.ruoyi.common.exception.ServiceException;

/**
 * 阿里云短信发送器（dysmsapi20170525 4.x SDK）
 *
 * <p>Client 单例懒加载：AK/SK 为空时不初始化；调用 {@link #sendVerificationCode}
 * 直接抛「短信登录未配置」，应用启动不受影响。
 *
 * @author apms
 */
@Component
public class AliyunSmsSender
{
    private static final Logger log = LoggerFactory.getLogger(AliyunSmsSender.class);

    /** 阿里云 SendSms 业务成功码 */
    private static final String CODE_OK = "OK";

    @Autowired
    private SmsProperties properties;

    /** 单例客户端，首次发送时构建；volatile + 双检保证并发安全 */
    private volatile Client client;

    private Client getClient()
    {
        if (!properties.isConfigured())
        {
            throw new ServiceException("短信登录未配置，请联系管理员在服务端配置短信凭证");
        }
        Client c = client;
        if (c == null)
        {
            synchronized (this)
            {
                c = client;
                if (c == null)
                {
                    try
                    {
                        Config config = new Config()
                                .setAccessKeyId(properties.getAccessKeyId())
                                .setAccessKeySecret(properties.getAccessKeySecret())
                                .setEndpoint(properties.getEndpoint());
                        c = new Client(config);
                    }
                    catch (Exception e)
                    {
                        // 初始化失败不缓存半成品，下一次请求可重试
                        throw new ServiceException("短信服务初始化失败，请联系管理员");
                    }
                    client = c;
                }
            }
        }
        return c;
    }

    /**
     * 发送验证码短信。
     *
     * @param phone 接收手机号
     * @param code  6 位验证码
     * @throws ServiceException 业务/网络/配置错误（已转用户可读文案，详情写日志）
     */
    public void sendVerificationCode(String phone, String code)
    {
        Client c = getClient();
        // 模板参数：只带一个验证码变量，变量名可配置（默认 code）
        String templateParam = JSON.toJSONString(Map.of(properties.getCodeParam(), code));

        SendSmsRequest request = new SendSmsRequest()
                .setPhoneNumbers(phone)
                .setSignName(properties.getSignName())
                .setTemplateCode(properties.getTemplateCode())
                .setTemplateParam(templateParam);

        SendSmsResponseBody body;
        try
        {
            SendSmsResponse response = c.sendSms(request);
            body = response == null ? null : response.getBody();
        }
        catch (Exception e)
        {
            // TeaException/网络异常：不下发原始错误给前端
            log.error("阿里云短信发送异常 phone={} template={}", phone, properties.getTemplateCode(), e);
            throw new ServiceException("短信发送失败，请稍后再试");
        }

        if (body == null || !CODE_OK.equals(body.getCode()))
        {
            String errCode = body == null ? "null" : body.getCode();
            String errMsg = body == null ? "empty response" : body.getMessage();
            log.error("阿里云短信发送失败 phone={} code={} message={}", phone, errCode, errMsg);
            throw new ServiceException(translate(errCode));
        }
        log.info("阿里云短信发送成功 phone={} bizId={}", phone, body.getBizId());
    }

    /**
     * 阿里云错误码 → 用户可读文案（避免把 isv.xxx 原始码抛给用户）
     */
    private String translate(String errCode)
    {
        if (errCode == null)
        {
            return "短信发送失败，请稍后再试";
        }
        return switch (errCode)
        {
            case "isv.BUSINESS_LIMIT_CONTROL" -> "短信发送频率超限，请稍后再试";
            case "isv.AMOUNT_NOT_ENOUGH", "isv.OUT_OF_SERVICE" -> "短信服务暂不可用，请联系管理员";
            // 签名/模板/审批/权限类一律为配置问题
            case "isv.SMS_SIGNATURE_SCENE_ILLEGAL",
                 "isv.SMS_SIGN_ILLEGAL",
                 "isv.SIGN_NAME_ILLEGAL",
                 "isv.SIGN_NOT_EXISTS",
                 "isv.TEMPLATE_MISSING_PARAMETERS",
                 "isv.TEMPLATE_NOT_EXISTS",
                 "isv.TEMPLATE_PARAM_ILLEGAL",
                 "InvalidTemplateParameter" -> "短信服务配置异常，请联系管理员";
            case "isv.MOBILE_NUMBER_ILLEGAL" -> "手机号格式不正确";
            default -> "短信发送失败，请稍后再试";
        };
    }
}
