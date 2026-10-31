package com.ruoyi.system.service.apms.assistant;

import java.util.List;
import com.ruoyi.common.core.domain.model.LoginUser;
import com.ruoyi.system.domain.apms.assistant.AssistantChatRequest;
import com.ruoyi.system.domain.apms.assistant.AssistantPrincipal;

/**
 * RPA 助手请求侧服务（身份快照、能力路由、输入校验）。
 * SSE 流式编排位于 ruoyi-framework（AssistantStreamService），避免 system 模块依赖 webmvc。
 */
public interface IAssistantService
{
    AssistantPrincipal buildPrincipal(LoginUser loginUser);

    List<String> capabilityPaths(Long userId);

    List<String> suggestions();

    void validate(AssistantChatRequest request);
}
