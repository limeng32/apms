package com.ruoyi.system.domain.apms;

import java.util.Date;

/**
 * RPA 助手审计日志 apms_assistant_log
 *
 * <p>每轮问答一条；status 只能是 success / error / aborted。
 */
public class ApmsAssistantLog
{
    private Long id;
    private String sessionId;
    private String messageId;
    private Long userId;
    private String userName;
    private String question;
    private String answer;
    private String intent;
    private String actionJson;
    private String provider;
    private String status;
    private String errorMsg;
    private Date createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public String getIntent() { return intent; }
    public void setIntent(String intent) { this.intent = intent; }
    public String getActionJson() { return actionJson; }
    public void setActionJson(String actionJson) { this.actionJson = actionJson; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getErrorMsg() { return errorMsg; }
    public void setErrorMsg(String errorMsg) { this.errorMsg = errorMsg; }
    public Date getCreateTime() { return createTime; }
    public void setCreateTime(Date createTime) { this.createTime = createTime; }
}
