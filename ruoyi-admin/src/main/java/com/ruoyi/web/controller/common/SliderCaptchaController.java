package com.ruoyi.web.controller.common;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.RateLimiter;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.enums.LimitType;
import com.ruoyi.framework.captcha.SliderCaptchaService;
import com.ruoyi.framework.captcha.SliderCheckBody;
import com.ruoyi.system.service.ISysConfigService;

/**
 * 滑块拼图验证码（真人拖拽）
 *
 * @author apms
 */
@RestController
public class SliderCaptchaController {

    @Autowired
    private SliderCaptchaService sliderCaptchaService;

    @Autowired
    private ISysConfigService configService;

    /**
     * 生成滑块拼图挑战
     */
    @GetMapping("/captcha/slider")
    public AjaxResult slider() {
        AjaxResult ajax = AjaxResult.success();
        boolean enabled = configService.selectSliderCaptchaEnabled();
        ajax.put("sliderEnabled", enabled);
        if (!enabled) {
            return ajax;
        }
        SliderCaptchaService.Challenge c = sliderCaptchaService.createChallenge();
        ajax.put("uuid", c.getUuid());
        ajax.put("img", c.getBgImg());
        ajax.put("sliderImg", c.getPieceImg());
        ajax.put("pieceY", c.getPieceY());
        ajax.put("width", c.getWidth());
        ajax.put("height", c.getHeight());
        return ajax;
    }

    /**
     * 校验拖拽结果（按 IP 限流，防止暴力枚举缺口位置）
     */
    @RateLimiter(time = 60, count = 20, limitType = LimitType.IP)
    @PostMapping("/captcha/slider/check")
    public AjaxResult check(@RequestBody SliderCheckBody body) {
        if (!configService.selectSliderCaptchaEnabled()) {
            return AjaxResult.error("滑块验证未开启");
        }
        sliderCaptchaService.verify(body.getUuid(), body.getX(), body.getDuration(), body.getPoints());
        AjaxResult ajax = AjaxResult.success("验证通过");
        // 前端持 uuid 在紧接着的登录请求中换取校验
        ajax.put("uuid", body.getUuid());
        return ajax;
    }
}
