package com.ruoyi.ai.core;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.ruoyi.common.core.domain.AjaxResult;

/**
 * AI 请求前置错误 → 真实 4xx（不进入全局 HTTP 200 + code 500 分支）。
 * 仅 ai 线注册。
 *
 * @author apms
 */
@AiEnabled
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class AiExceptionHandler
{
    @ExceptionHandler(AiRequestException.class)
    public ResponseEntity<AjaxResult> handleAiRequestException(AiRequestException e)
    {
        return ResponseEntity.status(e.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(AjaxResult.error(e.getStatus(), e.getMessage()));
    }
}
