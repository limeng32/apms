package com.ruoyi.framework.assistant;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.alibaba.fastjson2.JSON;
import com.ruoyi.system.domain.apms.ApmsAssistantLog;
import com.ruoyi.system.domain.apms.assistant.AssistantAction;
import com.ruoyi.system.domain.apms.assistant.AssistantChatRequest;
import com.ruoyi.system.domain.apms.assistant.AssistantPrincipal;
import com.ruoyi.system.domain.apms.assistant.AssistantReply;
import com.ruoyi.system.mapper.apms.ApmsAssistantLogMapper;
import com.ruoyi.system.service.apms.assistant.AssistantProvider;

/**
 * 助手 SSE 流式编排（放在 framework：system 模块不依赖 spring-webmvc）。
 *
 * <p>M1 不在后端 sleep：规则回答一次发送后立即 done；逐字效果由前端打字机负责。
 * 每个请求终态只允许 success/error/aborted 之一，由 CAS 保证审计只落一条。
 */
@Service
public class AssistantStreamService
{
    private static final Logger log = LoggerFactory.getLogger(AssistantStreamService.class);

    private static final String PROVIDER = "pseudo";
    private static final String VERSION = "v1";
    private static final int HEARTBEAT_SECONDS = 15;

    @Autowired
    private AssistantProvider assistantProvider;

    @Autowired
    private ApmsAssistantLogMapper assistantLogMapper;

    @Autowired
    @Qualifier("threadPoolTaskExecutor")
    private ThreadPoolTaskExecutor streamExecutor;

    @Autowired
    @Qualifier("scheduledExecutorService")
    private ScheduledExecutorService scheduler;

    public void streamChat(AssistantChatRequest request, AssistantPrincipal principal, SseEmitter emitter)
    {
        String messageId = UUID.randomUUID().toString();
        StreamContext ctx = new StreamContext(request, principal, messageId);
        AtomicReference<Terminal> state = new AtomicReference<>(Terminal.PENDING);
        AtomicBoolean doneSent = new AtomicBoolean(false);

        ScheduledFuture<?> heartbeat = scheduler.scheduleAtFixedRate(() -> {
            try
            {
                emitter.send(SseEmitter.event().comment("heartbeat"));
            }
            catch (Throwable ignored)
            {
                // 客户端断开或流已结束，交给 onCompletion/终态处理
            }
        }, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);

        emitter.onCompletion(() -> {
            if (!doneSent.get())
            {
                finishOnce(ctx, state, Terminal.ABORTED, "client-closed");
            }
        });
        emitter.onError(ex -> finishOnce(ctx, state, Terminal.ABORTED, "client-error"));
        emitter.onTimeout(() -> finishOnce(ctx, state, Terminal.ERROR, "TIMEOUT"));

        streamExecutor.execute(() -> {
            try
            {
                send(emitter, "meta", meta(messageId));
                AssistantReply reply = assistantProvider.reply(request, principal);
                ctx.answer.set(reply.getAnswer());
                ctx.intent.set(reply.getIntent());

                if (reply.getAnswer() != null && !reply.getAnswer().isEmpty())
                {
                    // M1 一次性发送完整回答，不 sleep；前端负责打字机
                    send(emitter, "delta", single("text", reply.getAnswer()));
                }
                AssistantAction action = reply.getAction();
                if (action != null)
                {
                    ctx.actionJson.set(JSON.toJSONString(action));
                    send(emitter, "action", action);
                }
                send(emitter, "done", single("finishReason", "stop"));
                doneSent.set(true);
                finishOnce(ctx, state, Terminal.SUCCESS, null);
                emitter.complete();
            }
            catch (IOException | IllegalStateException e)
            {
                finishOnce(ctx, state, Terminal.ABORTED, "client-disconnected");
            }
            catch (Throwable e)
            {
                log.error("[assistant] stream failed, messageId={}", messageId, e);
                // 先定终态，避免 emitter.complete() 触发的 onCompletion 把终态误置为 aborted
                finishOnce(ctx, state, Terminal.ERROR, e.getMessage());
                try
                {
                    send(emitter, "error", error("INTERNAL_ERROR", "助手暂时不可用，请稍后重试", true));
                    emitter.complete();
                }
                catch (Throwable ignored)
                {
                    // 客户端可能已断开
                }
            }
            finally
            {
                heartbeat.cancel(false);
            }
        });
    }

    private Map<String, Object> meta(String messageId)
    {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("messageId", messageId);
        map.put("provider", PROVIDER);
        map.put("version", VERSION);
        return map;
    }

    private Map<String, Object> single(String key, Object value)
    {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put(key, value);
        return map;
    }

    private Map<String, Object> error(String code, String msg, boolean retryable)
    {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("code", code);
        map.put("msg", msg);
        map.put("retryable", retryable);
        return map;
    }

    private void send(SseEmitter emitter, String event, Object data) throws IOException
    {
        emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
    }

    private void finishOnce(StreamContext ctx, AtomicReference<Terminal> state,
                            Terminal next, String errorMsg)
    {
        if (!state.compareAndSet(Terminal.PENDING, next))
        {
            return;
        }
        ApmsAssistantLog row = new ApmsAssistantLog();
        row.setSessionId(ctx.request.getSessionId());
        row.setMessageId(ctx.messageId);
        row.setUserId(ctx.principal.getUserId());
        row.setUserName(ctx.principal.getUserName());
        row.setQuestion(ctx.request.getMessage());
        row.setAnswer(ctx.answer.get());
        row.setIntent(ctx.intent.get());
        row.setActionJson(ctx.actionJson.get());
        row.setProvider(PROVIDER);
        row.setStatus(next.name().toLowerCase());
        row.setErrorMsg(truncate(errorMsg, 500));
        try
        {
            assistantLogMapper.insert(row);
        }
        catch (Throwable e)
        {
            log.error("[assistant] audit insert failed, messageId={}", ctx.messageId, e);
        }
    }

    private String truncate(String value, int max)
    {
        if (value == null)
        {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private enum Terminal
    {
        PENDING, SUCCESS, ERROR, ABORTED
    }

    private static class StreamContext
    {
        private final AssistantChatRequest request;
        private final AssistantPrincipal principal;
        private final String messageId;
        private final AtomicReference<String> answer = new AtomicReference<>();
        private final AtomicReference<String> intent = new AtomicReference<>();
        private final AtomicReference<String> actionJson = new AtomicReference<>();

        StreamContext(AssistantChatRequest request, AssistantPrincipal principal, String messageId)
        {
            this.request = request;
            this.principal = principal;
            this.messageId = messageId;
        }
    }
}
