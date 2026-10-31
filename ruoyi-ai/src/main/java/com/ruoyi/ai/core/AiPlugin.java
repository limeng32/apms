package com.ruoyi.ai.core;

/**
 * AI 插件 SPI（自描述契约）。
 *
 * <p>每个插件提供一个实现并注册为 Spring Bean（标注 {@link AiEnabled}），
 * {@code key} 贯穿：包名、URL 前缀 {@code /apms/ai/&lt;key&gt;}、flag 键、资源目录。
 * plugin key 一经发布不可更改。
 *
 * @author apms
 */
public interface AiPlugin
{
    /** 插件唯一键，如 rpa / rag / data / coach */
    String key();

    /** 展示名称（features 接口、参数/管理界面使用） */
    String name();

    /** 无配置行或值无法识别时是否启用；缺省 true（漏配种子不丢能力） */
    default boolean defaultEnabled()
    {
        return true;
    }

    /** 能力简介 */
    default String description()
    {
        return "";
    }

    /** 热开关参数键：sys.ai.&lt;key&gt;.enabled */
    default String flagKey()
    {
        return "sys.ai." + key() + ".enabled";
    }
}
