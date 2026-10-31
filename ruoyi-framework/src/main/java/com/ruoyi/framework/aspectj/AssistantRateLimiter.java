package com.ruoyi.framework.aspectj;

import java.util.Collections;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.common.constant.CacheConstants;
import com.ruoyi.common.exception.AssistantRequestException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

/**
 * RPA 助手按 userId 限流。
 *
 * <p>不扩展 LimitType（当前只有 DEFAULT/IP）；复用项目已有的 Redis Lua limitScript，
 * key 独立到 assistant:user:{userId}，避免所有用户共享全局额度。
 */
@Component
public class AssistantRateLimiter
{
    @Autowired
    private RedisTemplate<Object, Object> redisTemplate;

    @Autowired
    private RedisScript<Long> limitScript;

    public void check(Long userId, int count, int timeSeconds)
    {
        String key = CacheConstants.RATE_LIMIT_KEY + "assistant:user:" + userId;
        List<Object> keys = Collections.singletonList((Object) key);
        Long number = redisTemplate.execute(limitScript, keys, count, timeSeconds);
        if (number == null || number.intValue() > count)
        {
            throw new AssistantRequestException(429, "请求过于频繁，请稍后再试");
        }
    }
}
