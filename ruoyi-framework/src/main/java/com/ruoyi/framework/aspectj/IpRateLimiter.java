package com.ruoyi.framework.aspectj;

import java.util.Collections;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import com.ruoyi.common.constant.CacheConstants;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.ip.IpUtils;

/**
 * 编程式 IP 限流：与 {@link RateLimiter} + {@link RateLimiterAspect} 同一套
 * Redis key 规则与 Lua 计数脚本，用于「注解无法按请求内容（如手机号白名单）
 * 决定是否放行」的场景——在解析出业务参数后手动调用。
 *
 * <p>key 构成必须与切面保持一致：
 * {@code rate_limit: + IP + "-" + 类全名 + "-" + 方法名}，
 * 保证同一接口从注解迁移到本组件后，滑动窗口计数连续、Redis 中不产生双份 key。
 *
 * @author apms
 */
@Component
public class IpRateLimiter
{
    @Autowired
    private RedisTemplate<Object, Object> redisTemplate;

    @Autowired
    private RedisScript<Long> limitScript;

    /**
     * 按当前请求 IP 在 {@code time} 秒窗口内最多放行 {@code count} 次，超出即抛业务异常。
     *
     * @param resourceClass 原注解所在类（与切面 targetClass.getName() 对齐）
     * @param resourceMethod 原注解所在方法名
     * @param time 窗口秒数
     * @param count 窗口内最大次数
     */
    public void checkByIp(Class<?> resourceClass, String resourceMethod, int time, int count)
    {
        String combineKey = CacheConstants.RATE_LIMIT_KEY + IpUtils.getIpAddr() + "-"
                + resourceClass.getName() + "-" + resourceMethod;
        List<Object> keys = Collections.singletonList(combineKey);
        Long number = redisTemplate.execute(limitScript, keys, count, time);
        if (number == null || number.intValue() > count)
        {
            throw new ServiceException("访问过于频繁，请稍候再试");
        }
    }
}
