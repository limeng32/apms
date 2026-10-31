package com.ruoyi.web.controller.apms;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.exception.AssistantRequestException;

/**
 * 助手请求前置错误 → 真实 4xx（不进入全局 HTTP 200 + code 500 分支）。
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class AssistantExceptionHandler
{
    @ExceptionHandler(AssistantRequestException.class)
    public ResponseEntity<AjaxResult> handleAssistantRequestException(AssistantRequestException e)
    {
        return ResponseEntity.status(e.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(AjaxResult.error(e.getStatus(), e.getMessage()));
    }
}
