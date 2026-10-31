package com.ruoyi.ai.plugin.rpa.service;

import com.ruoyi.ai.plugin.rpa.domain.assistant.AssistantChatRequest;
import com.ruoyi.ai.plugin.rpa.domain.assistant.AssistantPrincipal;
import com.ruoyi.ai.plugin.rpa.domain.assistant.AssistantReply;

/**
 * 助手回答 Provider。M1 为确定性规则实现，M4 可替换为真实 Agent。
 */
public interface AssistantProvider
{
    AssistantReply reply(AssistantChatRequest request, AssistantPrincipal principal);
}
