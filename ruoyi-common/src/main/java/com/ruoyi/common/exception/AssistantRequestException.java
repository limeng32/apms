package com.ruoyi.common.exception;

/**
 * RPA 助手请求前置错误（校验失败 / 限流）。
 *
 * <p>与 {@link ServiceException} 区分：本异常由助手专用 ExceptionHandler 转成
 * 4xx HTTP 响应，不进入全局“HTTP 200 + code 500”的分支。
 */
public class AssistantRequestException extends RuntimeException
{
    private static final long serialVersionUID = 1L;

    /** HTTP 状态码，如 400 / 413 / 429 */
    private final int status;

    public AssistantRequestException(int status, String message)
    {
        super(message);
        this.status = status;
    }

    public int getStatus()
    {
        return status;
    }
}
