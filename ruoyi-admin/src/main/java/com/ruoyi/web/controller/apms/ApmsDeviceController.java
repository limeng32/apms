package com.ruoyi.web.controller.apms;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.service.apms.IApmsDeviceIngestService;

/**
 * 测试设备接入（一期：内存假实现）
 *
 * <p>register 注册设备颁发 apiKey；push 供设备/网关回传成绩（真实写入测试结果）。
 * 重启后设备注册信息清空，需要重新 register；已推送成绩不丢。
 */
@RestController
@RequestMapping("/apms/device")
public class ApmsDeviceController extends BaseController {

    @Autowired
    private IApmsDeviceIngestService deviceIngestService;

    /** 注册设备（已存在同 deviceCode 时更新档案、原 apiKey 不变） */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping("/register")
    public AjaxResult register(@RequestBody Map<String, String> body) {
        return AjaxResult.success(deviceIngestService.register(
                body.get("deviceCode"), body.get("deviceName"),
                body.get("deviceType"), body.get("vendor")));
    }

    /** 已注册设备列表 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:list')")
    @GetMapping("/list")
    public AjaxResult list() {
        return AjaxResult.success(deviceIngestService.listDevices());
    }

    /**
     * 设备推送成绩。apiKey 可放请求体，也可用请求头 X-Device-Key。
     *
     * <p>机器对接时可由服务端账号换取 token 后调用；一期仅校验 apiKey 合法性。
     */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping("/push")
    public AjaxResult push(@RequestHeader(value = "X-Device-Key", required = false) String headerKey,
                           @RequestBody Map<String, Object> body) {
        String apiKey = headerKey != null ? headerKey : (String) body.get("apiKey");
        Long athleteId = body.get("athleteId") == null ? null
                : Long.valueOf(String.valueOf(body.get("athleteId")));
        Map<String, Object> out = deviceIngestService.push(
                apiKey,
                athleteId,
                (String) body.get("athleteName"),
                (String) body.get("indicatorCode"),
                body.get("value") == null ? null : String.valueOf(body.get("value")),
                (String) body.get("measureDate"),
                (String) body.get("sessionKey"));
        return AjaxResult.success(out);
    }

    /**
     * 设备推送模型结构化数据 —— 假门禁（二期接入前一律拒绝）。
     *
     * <p>界面提供密钥输入入口，但无论密钥是什么都返回「密钥错误或已失效」，
     * 不写任何数据；真实设备对接开通后再实现校验与落库。
     */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping("/model-push")
    public AjaxResult modelPush(@RequestHeader(value = "X-Device-Key", required = false) String headerKey,
                                @RequestBody(required = false) Map<String, Object> body) {
        return AjaxResult.error(401, "设备密钥错误或已失效，模型数据自动采集暂未开通，请联系管理员");
    }
}
