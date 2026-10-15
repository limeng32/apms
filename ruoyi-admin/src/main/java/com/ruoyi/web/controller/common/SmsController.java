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
import com.ruoyi.framework.sms.SmsCodeService;
import com.ruoyi.framework.sms.SmsLoginOutcome;
import com.ruoyi.framework.web.service.SysLoginService;

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

    /**
     * 发送短信验证码。
     * 注意：limitType 必须显式 IP——DEFAULT 模式下限流 key 不带 IP，会退化为全站合计限额。
     */
    @RateLimiter(time = 60, count = 10, limitType = LimitType.IP)
    @PostMapping("/sms/code")
    public AjaxResult sendCode(@RequestBody SmsSendBody body)
    {
        Long userId = null;
        if (SmsCodeService.SCENE_BIND.equals(body.getScene()))
        {
            // 路径匿名放行，但 JWT 过滤器仍会解析有效 token；无登录态时 getUserId 抛 401 语义异常
            userId = SecurityUtils.getUserId();
        }
        smsCodeService.sendCode(body.getPhonenumber(), body.getScene(), userId,
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
