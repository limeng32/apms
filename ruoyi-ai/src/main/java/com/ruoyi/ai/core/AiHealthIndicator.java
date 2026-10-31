package com.ruoyi.ai.core;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * 向管理端口 /health 贡献 {@code ai} 组件：上报运行线别与已加载插件清单。
 *
 * <p>仅 ai 线注册本 Bean；standard 线 /health 中不存在 ai 块。
 * 部署脚本据此做免 token 的线别双向校验。
 *
 * @author apms
 */
@AiEnabled
@Component("ai")
public class AiHealthIndicator implements HealthIndicator
{
    @Autowired
    private AiPluginRegistry pluginRegistry;

    @Override
    public Health health()
    {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("edition", "ai");
        details.put("plugins", pluginRegistry.keys());
        return Health.up().withDetails(details).build();
    }
}
