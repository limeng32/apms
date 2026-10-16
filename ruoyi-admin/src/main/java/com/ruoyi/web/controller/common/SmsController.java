package com.ruoyi.web.controller.common;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.RateLimiter;
import com.ruoyi.common.constant.Constants;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.model.SmsLoginBody;
import com.ruoyi.common.core.domain.model.SmsSelectBody;
import com.ruoyi.common.core.domain.model.SmsSendBody;
import com.ruoyi.common.enums.LimitType;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.common.utils.ip.IpUtils;
import com.ruoyi.framework.aspectj.IpRateLimiter;
import com.ruoyi.framework.sms.SmsCodeService;
import com.ruoyi.framework.sms.SmsLoginOutcome;
import com.ruoyi.framework.web.service.SysLoginService;
import com.ruoyi.system.service.ISysConfigService;

/**
 * 短信验证码（匿名接口）
 *
 * <p>{@code POST /sms/code} 同时服务登录发码（scene=login）与绑定新号发码（scene=bind，
 * 必须携带有效登录 token）；{@code POST /login/sms} 校验码并颁发 token。
 * 两个路径均在 SecurityConfig 匿名放行，频控/人机/场景校验全部在服务端完成。
 *
 * @author apms
 */
@RestController
public class SmsController
{
    @Autowired
    private SmsCodeService smsCodeService;

    @Autowired
    private SysLoginService loginService;

    @Autowired
    private ISysConfigService configService;

    @Autowired
    private IpRateLimiter ipRateLimiter;

    /** 发码接口 IP 窗口限流参数：与原 @RateLimiter(time=60,count=10,IP) 完全一致 */
    private static final int SEND_LIMIT_SECONDS = 60;
    private static final int SEND_LIMIT_COUNT = 10;

    /**
     * 发送短信验证码。
     *
     * <p>接口级 IP 限流原为方法注解 {@code @RateLimiter(time=60,count=10,IP)}，
     * 因 AOP 先于方法体执行、无法读取请求体内手机号，下沉为编程式调用
     * {@link IpRateLimiter}（Redis key 与注解时代完全一致，计数连续）：
     * sys.sms.whitelistPhones 白名单手机号豁免本道限流，其余号码照常 60 秒 10 次。
     */
    @PostMapping("/sms/code")
    public AjaxResult sendCode(@RequestBody SmsSendBody body)
    {
        String scene = body.getScene();
        String phone = body.getPhonenumber();

        // 白名单手机豁免接口 IP 限流；非白名单保持与原注解一致的 60s/IP/10 次
        if (!configService.isSmsWhitelistPhone(phone))
        {
            ipRateLimiter.checkByIp(SmsController.class, "sendCode",
                    SEND_LIMIT_SECONDS, SEND_LIMIT_COUNT);
        }

        if (SmsCodeService.SCENE_ADMIN_BIND.equals(scene))
        {
            // 管理员给目标用户代绑发码：必须登录、必须指定目标用户；平台管理员免码不走这里
            // （admin 用免码绑定接口），故此分支实际服务 super 等部门管理员。
            if (body.getTargetUserId() == null)
            {
                return AjaxResult.error("未指定目标用户");
            }
            SecurityUtils.getUserId();
            smsCodeService.sendCodeForAdminBind(body.getTargetUserId(), phone,
                    IpUtils.getIpAddr(), body.getSliderUuid());
            return AjaxResult.success("验证码已发送");
        }

        Long userId = null;
        if (SmsCodeService.SCENE_BIND.equals(scene))
        {
            // 路径匿名放行，但 JWT 过滤器仍会解析有效 token；无登录态时 getUserId 抛 401 语义异常
            userId = SecurityUtils.getUserId();
        }
        smsCodeService.sendCode(phone, scene, userId,
                IpUtils.getIpAddr(), body.getSliderUuid());
        return AjaxResult.success("验证码已发送");
    }

    /**
     * 短信验证码登录（IP 维度宽松限流，防止对 6 位码做暴力枚举）。
     * 返回两种形态：
     *   单账号 {token}；多账号 {selectToken, accounts:[{userId,userName,nickName,deptName}]}
     */
    @RateLimiter(time = 60, count = 20, limitType = LimitType.IP)
    @PostMapping("/login/sms")
    public AjaxResult loginBySms(@RequestBody SmsLoginBody body)
    {
        SmsLoginOutcome outcome = loginService.loginBySms(body.getPhonenumber(), body.getCode());
        AjaxResult ajax = AjaxResult.success();
        if (outcome.getToken() != null)
        {
            ajax.put(Constants.TOKEN, outcome.getToken());
        }
        else
        {
            ajax.put("selectToken", outcome.getSelectToken());
            ajax.put("accounts", outcome.getAccounts());
        }
        return ajax;
    }

    /**
     * 多账号短信登录：选择账号后凭一次性选择令牌兑换 token。
     */
    @RateLimiter(time = 60, count = 20, limitType = LimitType.IP)
    @PostMapping("/login/sms/select")
    public AjaxResult selectAccount(@RequestBody SmsSelectBody body)
    {
        String token = loginService.loginBySmsSelect(body.getSelectToken(), body.getUserId());
        AjaxResult ajax = AjaxResult.success();
        ajax.put(Constants.TOKEN, token);
        return ajax;
    }
}
