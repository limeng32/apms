package com.ruoyi.ai.core;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * AI 能力总闸门：仅部署级属性 {@code app.edition=ai} 时，被标注的组件才会注册。
 *
 * <p>standard 部署下，被标注类在组件扫描期即被 Condition 过滤：
 * 无 Controller / Service / Advice / HealthIndicator / Mapper，AI 端点全部 404。
 *
 * @author apms
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ConditionalOnProperty(name = "app.edition", havingValue = "ai")
public @interface AiEnabled
{
}
