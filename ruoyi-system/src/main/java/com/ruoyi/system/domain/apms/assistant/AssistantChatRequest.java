package com.ruoyi.system.domain.apms.assistant;

/**
 * RPA 助手会话请求体。
 */
public class AssistantChatRequest
{
    private String sessionId;
    private String message;
    private AssistantContext context;

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public AssistantContext getContext() { return context; }
    public void setContext(AssistantContext context) { this.context = context; }
}
