package com.ruoyi.system.domain.apms.assistant;

import java.util.Collections;
import java.util.List;
import java.util.Set;

/**
 * 请求线程内捕获的登录身份与能力快照。
 *
 * <p>SSE 异步线程只读此对象，禁止访问 SecurityContext。
 */
public class AssistantPrincipal
{
    private final Long userId;
    private final String userName;
    private final Set<String> permissions;
    private final Set<String> allowedPaths;
    private final List<String> suggestions;

    public AssistantPrincipal(Long userId, String userName,
                              Set<String> permissions, Set<String> allowedPaths,
                              List<String> suggestions)
    {
        this.userId = userId;
        this.userName = userName;
        this.permissions = permissions == null ? Collections.emptySet() : permissions;
        this.allowedPaths = allowedPaths == null ? Collections.emptySet() : allowedPaths;
        this.suggestions = suggestions == null ? Collections.emptyList() : suggestions;
    }

    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public Set<String> getPermissions() { return permissions; }
    public Set<String> getAllowedPaths() { return allowedPaths; }
    public List<String> getSuggestions() { return suggestions; }

    public boolean hasPermission(String perm)
    {
        return permissions.contains("*:*:*") || permissions.contains(perm);
    }
}
