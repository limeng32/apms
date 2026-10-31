package com.ruoyi.ai.core;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * AI 插件统一门控：按 {@link RequireAiPlugin} 校验插件安装状态与热开关。
 * 未安装/已关闭一律抛 404（不返回 403，不对外暴露功能存在性）。
 *
 * @author apms
 */
@AiEnabled
@Component
public class AiPluginInterceptor implements HandlerInterceptor
{
    @Autowired
    private AiPluginRegistry pluginRegistry;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
    {
        if (!(handler instanceof HandlerMethod))
        {
            return true;
        }
        HandlerMethod handlerMethod = (HandlerMethod) handler;
        RequireAiPlugin annotation = AnnotatedElementUtils
                .findMergedAnnotation(handlerMethod.getMethod(), RequireAiPlugin.class);
        if (annotation == null)
        {
            annotation = AnnotatedElementUtils
                    .findMergedAnnotation(handlerMethod.getBeanType(), RequireAiPlugin.class);
        }
        if (annotation == null)
        {
            return true;
        }
        if (!pluginRegistry.isEnabled(annotation.value()))
        {
            // 功能未安装或已热关闭：统一 404
            throw new AiRequestException(404, "功能未开通");
        }
        return true;
    }
}
