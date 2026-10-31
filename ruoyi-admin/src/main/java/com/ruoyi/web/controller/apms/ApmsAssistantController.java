package com.ruoyi.web.controller.apms;

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
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.model.LoginUser;
import com.ruoyi.common.exception.AssistantRequestException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.framework.aspectj.AssistantRateLimiter;
import com.ruoyi.framework.assistant.AssistantStreamService;
import com.ruoyi.system.domain.apms.assistant.AssistantChatRequest;
import com.ruoyi.system.domain.apms.assistant.AssistantPrincipal;
import com.ruoyi.system.service.apms.assistant.IAssistantService;

/**
 * RPA 助手（伪 RPA）接口。
 *
 * <p>POST /apms/assistant/chat：SSE 流式回答，登录鉴权 + 按 userId 限流。
 * GET  /apms/assistant/capabilities：当前用户可访问路由与建议问题。
 */
@RestController
@RequestMapping("/apms/assistant")
public class ApmsAssistantController extends BaseController
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
            throw new AssistantRequestException(413, "请求体不能超过 16KB");
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
