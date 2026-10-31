package com.ruoyi.ai.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * AI 插件注册表：Spring 自动收集全部 {@link AiPlugin} Bean，聚合元数据与实时启用状态。
 *
 * @author apms
 */
@AiEnabled
@Component
public class AiPluginRegistry
{
    private static final Logger log = LoggerFactory.getLogger(AiPluginRegistry.class);

    private final Map<String, AiPlugin> plugins = new LinkedHashMap<>();

    private final AiFeatureService featureService;

    @Autowired
    public AiPluginRegistry(List<AiPlugin> pluginList, AiFeatureService featureService)
    {
        this.featureService = featureService;
        if (pluginList != null)
        {
            for (AiPlugin plugin : pluginList)
            {
                if (plugins.put(plugin.key(), plugin) != null)
                {
                    log.warn("[ai] 插件 key 重复，后注册者覆盖: {}", plugin.key());
                }
            }
        }
        log.info("[ai] plugins loaded: {}", plugins.keySet());
    }

    /** 插件是否已安装且开关开启；未知 key 返回 false */
    public boolean isEnabled(String key)
    {
        AiPlugin plugin = plugins.get(key);
        return plugin != null && featureService.isEnabled(plugin);
    }

    /** GET /apms/ai/features 返回体的 plugins 节点 */
    public Map<String, Object> states()
    {
        Map<String, Object> result = new LinkedHashMap<>();
        for (AiPlugin plugin : plugins.values())
        {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("enabled", featureService.isEnabled(plugin));
            item.put("name", plugin.name());
            item.put("description", plugin.description());
            result.put(plugin.key(), item);
        }
        return result;
    }

    public List<String> keys()
    {
        return new ArrayList<>(plugins.keySet());
    }
}
