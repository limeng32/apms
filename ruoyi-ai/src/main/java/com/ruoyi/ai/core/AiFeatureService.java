package com.ruoyi.ai.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.system.service.ISysConfigService;

/**
 * 插件功能开关读取：复用 sys_config 参数体系（带缓存、参数设置保存即热生效，
 * 与 sys.account.smsLoginEnabled 同一机制）。
 *
 * <p>规则：仅当参数值显式为 {@code "false"}（忽略大小写）时关闭；
 * 显式 {@code "true"} 开启；无配置行/空值/其他值取插件 {@link AiPlugin#defaultEnabled()}。
 *
 * @author apms
 */
@AiEnabled
@Service
public class AiFeatureService
{
    @Autowired
    private ISysConfigService configService;

    public boolean isEnabled(AiPlugin plugin)
    {
        if (plugin == null)
        {
            return false;
        }
        String raw = configService.selectConfigByKey(plugin.flagKey());
        String value = raw == null ? "" : raw.trim();
        if ("false".equalsIgnoreCase(value))
        {
            return false;
        }
        if ("true".equalsIgnoreCase(value))
        {
            return true;
        }
        return plugin.defaultEnabled();
    }
}
