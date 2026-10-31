package com.ruoyi.ai.core;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/**
 * AI 插件基础设施装配（仅 ai 线注册）。
 *
 * <p>插件 Mapper 接口统一放在 {@code com.ruoyi.ai.plugin.**.persistence} 包，
 * 刻意避开框架全局 {@code @MapperScan("com.ruoyi.**.mapper")} 通配，
 * 使 standard 部署连 Mapper 代理都不会注册。
 *
 * @author apms
 */
@AiEnabled
@Configuration
@MapperScan("com.ruoyi.ai.**.persistence")
public class AiAutoConfiguration
{
}
