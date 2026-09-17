package com.ruoyi.web.controller.apms;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * APMS 版本信息端点
 * 用于 deploy.sh 健康检查和前端展示当前运行版本
 */
@RestController
@RequestMapping("/apms/version")
public class VersionController {

    @Value("${app.version:0.0.0}")
    private String version;

    @Value("${app.name:APMS}")
    private String appName;

    @Value("${app.framework:ruoyi}")
    private String framework;

    @Value("${app.build.timestamp:unknown}")
    private String buildTimestamp;

    @GetMapping
    public Map<String, Object> info() {
        Map<String, Object> info = new HashMap<>();
        info.put("name", appName);
        info.put("version", version);
        info.put("framework", framework);
        info.put("buildAt", buildTimestamp);
        info.put("java", System.getProperty("java.version"));
        info.put("status", "UP");
        return info;
    }
}
