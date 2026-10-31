package com.ruoyi.system.domain.apms.assistant;

/**
 * 一次伪 RPA 回答：文本 + 命中意图 + 可选动作。
 */
public class AssistantReply
{
    private final String intent;
    private final String answer;
    private final AssistantAction action;

    public AssistantReply(String intent, String answer, AssistantAction action)
    {
        this.intent = intent;
        this.answer = answer;
        this.action = action;
    }

    public String getIntent() { return intent; }
    public String getAnswer() { return answer; }
    public AssistantAction getAction() { return action; }
}
