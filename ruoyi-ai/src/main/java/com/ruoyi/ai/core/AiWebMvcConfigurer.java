package com.ruoyi.ai.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * AI 容器 MVC 装配（仅 ai 线）：注册插件门控拦截器。
 * 容器自身的 /apms/ai/features 不拦截（它是门控状态查询入口）。
 *
 * @author apms
 */
@AiEnabled
@Configuration
public class AiWebMvcConfigurer implements WebMvcConfigurer
{
    @Autowired
    private AiPluginInterceptor aiPluginInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry)
    {
        registry.addInterceptor(aiPluginInterceptor)
                .addPathPatterns("/apms/ai/**")
                .excludePathPatterns("/apms/ai/features");
    }
}
