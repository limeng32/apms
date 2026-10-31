package com.ruoyi.ai.core;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * AI 插件门控注解：标注在 Controller 类或方法上。
 * 插件未安装或热开关关闭时，由 {@link AiPluginInterceptor} 统一拦截并返回 404。
 *
 * @author apms
 */
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequireAiPlugin
{
    /** 插件 key，如 "rpa" */
    String value();
}
