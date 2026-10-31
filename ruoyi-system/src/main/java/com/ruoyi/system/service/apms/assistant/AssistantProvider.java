package com.ruoyi.system.service.apms.assistant;

import com.ruoyi.system.domain.apms.assistant.AssistantChatRequest;
import com.ruoyi.system.domain.apms.assistant.AssistantPrincipal;
import com.ruoyi.system.domain.apms.assistant.AssistantReply;

/**
 * 助手回答 Provider。M1 为确定性规则实现，M4 可替换为真实 Agent。
 */
public interface AssistantProvider
{
    AssistantReply reply(AssistantChatRequest request, AssistantPrincipal principal);
}
