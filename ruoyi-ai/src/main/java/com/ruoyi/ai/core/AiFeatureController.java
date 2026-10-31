package com.ruoyi.ai.core;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.core.domain.AjaxResult;

/**
 * AI 容器能力表：返回当前运行线别与各插件实时启用状态（登录态）。
 * standard 部署无本 Bean，URI 天然 404。
 *
 * @author apms
 */
@AiEnabled
@RestController
@RequestMapping("/apms/ai")
public class AiFeatureController
{
    @Autowired
    private AiPluginRegistry pluginRegistry;

    @Value("${app.edition:standard}")
    private String edition;

    @GetMapping("/features")
    public AjaxResult features()
    {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("edition", edition);
        data.put("plugins", pluginRegistry.states());
        return AjaxResult.success(data);
    }
}
