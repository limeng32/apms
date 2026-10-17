package com.ruoyi.web.controller.common;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.RateLimiter;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.enums.LimitType;
import com.ruoyi.framework.captcha.ClickCaptchaService;
import com.ruoyi.framework.captcha.ClickCheckBody;
import com.ruoyi.system.service.ISysConfigService;

/**
 * 彩色图形点选验证码（无动画，点击完成人机校验）
 *
 * <p>复用原滑块验证码的开关（sys.account.sliderCaptchaEnabled）与一次性通过标记链路，
 * 登录/发短信侧消费逻辑无感知。
 *
 * @author apms
 */
@RestController
public class ClickCaptchaController
{
    @Autowired
    private ClickCaptchaService clickCaptchaService;

    @Autowired
    private ISysConfigService configService;

    /**
     * 生成图形点选挑战
     */
    @GetMapping("/captcha/click")
    public AjaxResult click()
    {
        AjaxResult ajax = AjaxResult.success();
        boolean enabled = configService.selectSliderCaptchaEnabled();
        ajax.put("enabled", enabled);
        if (!enabled)
        {
            return ajax;
        }
        ClickCaptchaService.Challenge c = clickCaptchaService.createChallenge();
        ajax.put("uuid", c.getUuid());
        ajax.put("img", c.getImg());
        ajax.put("width", c.getWidth());
        ajax.put("height", c.getHeight());
        // 仅下发形状/颜色文案，坐标不出服务端
        ajax.put("targets", c.getPrompts());
        return ajax;
    }

    /**
     * 校验点选结果（按 IP 限流，防止暴力枚举坐标）
     */
    @RateLimiter(time = 60, count = 20, limitType = LimitType.IP)
    @PostMapping("/captcha/click/check")
    public AjaxResult check(@RequestBody ClickCheckBody body)
    {
        if (!configService.selectSliderCaptchaEnabled())
        {
            return AjaxResult.error("图形验证未开启");
        }
        List<int[]> points = new ArrayList<>();
        if (body.getPoints() != null)
        {
            for (ClickCheckBody.Point p : body.getPoints())
            {
                points.add(new int[] { p.getX() == null ? -1 : p.getX(), p.getY() == null ? -1 : p.getY() });
            }
        }
        clickCaptchaService.verify(body.getUuid(), points);
        AjaxResult ajax = AjaxResult.success("验证通过");
        // 前端持 uuid 在紧接着的登录/发码请求中换取校验
        ajax.put("uuid", body.getUuid());
        return ajax;
    }
}
