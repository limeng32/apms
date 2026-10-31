package com.ruoyi.ai.plugin.rpa.web;

import java.util.LinkedHashMap;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.ruoyi.ai.core.AiEnabled;
import com.ruoyi.ai.core.AiRequestException;
import com.ruoyi.ai.core.RequireAiPlugin;
import com.ruoyi.ai.plugin.rpa.RpaPlugin;
import com.ruoyi.ai.plugin.rpa.domain.assistant.AssistantChatRequest;
import com.ruoyi.ai.plugin.rpa.domain.assistant.AssistantPrincipal;
import com.ruoyi.ai.plugin.rpa.ratelimit.AssistantRateLimiter;
import com.ruoyi.ai.plugin.rpa.service.IAssistantService;
import com.ruoyi.ai.plugin.rpa.stream.AssistantStreamService;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.model.LoginUser;
import com.ruoyi.common.utils.SecurityUtils;

/**
 * RPA 助手（伪 RPA）接口 —— ruoyi-ai 的 rpa 插件。
 *
 * <p>POST /apms/ai/rpa/chat：SSE 流式回答，登录鉴权 + 按 userId 限流。
 * GET  /apms/ai/rpa/capabilities：当前用户可访问路由与建议问题。
 *
 * <p>门控：{@link AiEnabled}（仅 ai 线装配）+ {@link RequireAiPlugin}（热开关关闭统一 404）。
 */
@AiEnabled
@RestController
@RequestMapping("/apms/ai/rpa")
@RequireAiPlugin(RpaPlugin.KEY)
public class RpaAssistantController extends BaseController
{
    private static final long MAX_BODY_BYTES = 16L * 1024L;

    @Autowired
    private IAssistantService assistantService;

    @Autowired
    private AssistantRateLimiter assistantRateLimiter;

    @Autowired
    private AssistantStreamService assistantStreamService;

    @PostMapping(value = "/chat", consumes = MediaType.APPLICATION_JSON_VALUE)
    public SseEmitter chat(@RequestBody AssistantChatRequest request, HttpServletRequest httpRequest,
                           HttpServletResponse response)
    {
        if (httpRequest.getContentLengthLong() > MAX_BODY_BYTES)
        {
            throw new AiRequestException(413, "请求体不能超过 16KB");
        }
        assistantService.validate(request);

        LoginUser loginUser = SecurityUtils.getLoginUser();
        // 按 userId 限流，避免 DEFAULT 全局额度
        assistantRateLimiter.check(loginUser.getUserId(), 20, 60);

        AssistantPrincipal principal = assistantService.buildPrincipal(loginUser);
        // 让 nginx 对该响应关闭缓冲（等价于 location 级 proxy_buffering off），
        // 这样生产/UAT 均无需为 SSE 增加任何 location 配置。
        response.setHeader("X-Accel-Buffering", "no");
        SseEmitter emitter = new SseEmitter(180_000L);
        assistantStreamService.streamChat(request, principal, emitter);
        return emitter;
    }

    @GetMapping("/capabilities")
    public AjaxResult capabilities()
    {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("version", "v1");
        data.put("provider", "pseudo");
        data.put("paths", assistantService.capabilityPaths(loginUser.getUserId()));
        data.put("suggestions", assistantService.suggestions());
        return AjaxResult.success(data);
    }
}
