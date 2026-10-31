package com.ruoyi.system.service.apms.assistant.impl;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.common.core.domain.model.LoginUser;
import com.ruoyi.common.exception.AssistantRequestException;
import com.ruoyi.system.domain.apms.assistant.AssistantChatRequest;
import com.ruoyi.system.domain.apms.assistant.AssistantContext;
import com.ruoyi.system.domain.apms.assistant.AssistantPrincipal;
import com.ruoyi.system.service.apms.assistant.AssistantCapabilityResolver;
import com.ruoyi.system.service.apms.assistant.IAssistantService;

/**
 * 请求侧助手服务：身份快照、能力路由、输入校验。
 */
@Service
public class AssistantServiceImpl implements IAssistantService
{
    private static final Pattern UUID_V4 = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

    @Autowired
    private AssistantCapabilityResolver capabilityResolver;

    @Override
    public AssistantPrincipal buildPrincipal(LoginUser loginUser)
    {
        Set<String> permissions = loginUser == null ? null : loginUser.getPermissions();
        Long userId = loginUser == null ? null : loginUser.getUserId();
        String userName = loginUser == null ? null : loginUser.getUsername();
        return new AssistantPrincipal(userId, userName, permissions,
                capabilityResolver.resolvePaths(userId), capabilityResolver.suggestions());
    }

    @Override
    public List<String> capabilityPaths(Long userId)
    {
        return capabilityResolver.resolvePathList(userId);
    }

    @Override
    public List<String> suggestions()
    {
        return capabilityResolver.suggestions();
    }

    @Override
    public void validate(AssistantChatRequest request)
    {
        if (request == null)
        {
            throw new AssistantRequestException(400, "请求体不能为空");
        }
        String sessionId = request.getSessionId();
        if (sessionId == null || !UUID_V4.matcher(sessionId.trim()).matches())
        {
            throw new AssistantRequestException(400, "sessionId 必须是 UUID v4");
        }
        String message = request.getMessage();
        if (message == null || message.trim().isEmpty())
        {
            throw new AssistantRequestException(400, "message 不能为空");
        }
        if (message.trim().length() > 1000)
        {
            throw new AssistantRequestException(400, "message 长度不能超过 1000 字符");
        }
        request.setMessage(message.trim());
        request.setSessionId(sessionId.trim());

        AssistantContext context = request.getContext();
        if (context != null)
        {
            String route = context.getRoute();
            if (route != null)
            {
                route = route.trim();
                if (route.length() > 200 || !route.startsWith("/") || route.contains("//")
                        || route.contains("://") || containsControl(route))
                {
                    throw new AssistantRequestException(400, "context.route 非法");
                }
                context.setRoute(route);
            }
            String pageTitle = context.getPageTitle();
            if (pageTitle != null)
            {
                pageTitle = pageTitle.trim();
                if (pageTitle.length() > 100 || containsControl(pageTitle))
                {
                    throw new AssistantRequestException(400, "context.pageTitle 非法");
                }
                context.setPageTitle(pageTitle);
            }
            if (context.getEntityId() != null && context.getEntityId() <= 0)
            {
                throw new AssistantRequestException(400, "context.entityId 必须为正整数");
            }
        }
    }

    private boolean containsControl(String value)
    {
        for (int i = 0; i < value.length(); i++)
        {
            if (Character.isISOControl(value.charAt(i)))
            {
                return true;
            }
        }
        return false;
    }
}
