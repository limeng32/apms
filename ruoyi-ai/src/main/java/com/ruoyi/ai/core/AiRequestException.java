package com.ruoyi.ai.core;

/**
 * AI 请求侧异常：携带真实 HTTP 状态码（400 校验失败 / 404 功能未开通 /
 * 413 请求过大 / 429 限流），由 {@link AiExceptionHandler} 转真实 4xx 响应。
 *
 * @author apms
 */
public class AiRequestException extends RuntimeException
{
    private static final long serialVersionUID = 1L;

    private final int status;

    public AiRequestException(int status, String message)
    {
        super(message);
        this.status = status;
    }

    public int getStatus()
    {
        return status;
    }
}
