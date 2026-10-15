package com.ruoyi.web.controller.apms;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.service.ISysConfigService;
import com.ruoyi.system.service.apms.IApmsLoginConfigService;

/**
 * 登录页配置（公开读取）
 *
 * 仅提供匿名 GET：登录页预登录态拉取视觉配置。
 * 安全配置中按 HttpMethod.GET 精确放行 /login/config；
 * 本 Controller 不提供写接口（设计器写接口在 M2 于 /system/login/config 提供，需鉴权）。
 *
 * @author apms
 */
@RestController
public class ApmsLoginConfigController {

    @Autowired
    private IApmsLoginConfigService apmsLoginConfigService;

    @Autowired
    private ISysConfigService configService;

    /**
     * 匿名获取登录页配置
     * 无配置行时 data 为 {}，前端与内置默认值深度合并。
     * smsEnabled：手机短信登录开关，登录页据此决定是否渲染短信登录 tab（默认 false，
     * 无后端的演示站请求失败回退默认，tab 自动隐藏）。
     */
    @GetMapping("/login/config")
    public AjaxResult getPublicConfig()
    {
        AjaxResult ajax = AjaxResult.success(apmsLoginConfigService.getConfigMap());
        ajax.put("smsEnabled", configService.selectSmsLoginEnabled());
        return ajax;
    }
}
