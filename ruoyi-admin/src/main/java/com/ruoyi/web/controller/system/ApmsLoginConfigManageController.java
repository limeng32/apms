package com.ruoyi.web.controller.system;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.system.service.apms.IApmsLoginConfigService;

/**
 * 登录页配置（设计器管理端，需鉴权）
 *
 * 与匿名读取端 ApmsLoginConfigController（GET /login/config）区分：
 * - GET    /system/login/config 设计器回显，需 system:loginconfig:query
 * - PUT    /system/login/config 保存/导入，需 system:loginconfig:edit，服务端做完整形态与安全校验
 *
 * @author apms
 */
@RestController
@RequestMapping("/system/login/config")
public class ApmsLoginConfigManageController extends BaseController {

    @Autowired
    private IApmsLoginConfigService apmsLoginConfigService;

    /**
     * 设计器回显：原样返回库中配置（无行返回 {}），由前端与默认值合并后填表
     */
    @PreAuthorize("@ss.hasPermi('system:loginconfig:query')")
    @GetMapping
    public AjaxResult getConfig()
    {
        return success(apmsLoginConfigService.getConfigMap());
    }

    /**
     * 保存配置（JSON 导入复用本接口，校验同一套）
     */
    @PreAuthorize("@ss.hasPermi('system:loginconfig:edit')")
    @Log(title = "登录页配置", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult save(@RequestBody Map<String, Object> config)
    {
        apmsLoginConfigService.saveConfig(config, getUsername());
        return AjaxResult.success();
    }
}
