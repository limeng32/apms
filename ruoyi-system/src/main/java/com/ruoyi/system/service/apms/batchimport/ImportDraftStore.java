package com.ruoyi.system.service.apms.batchimport;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import com.alibaba.fastjson2.JSON;
import com.ruoyi.common.utils.uuid.IdUtils;

/**
 * 导入草稿存储 + commit 一次性消费状态机。
 *
 * <p>Redis 键（domain 隔离）：
 * <ul>
 *   <li>import:{domain}:draft:{token}      预览草稿（TTL 10 分钟）</li>
 *   <li>import:{domain}:processing:{token} 已占用、入库进行中（TTL 10 分钟）</li>
 *   <li>import:{domain}:done:{token}       首次提交结果快照（TTL 10 分钟，幂等返回）</li>
 * </ul>
 *
 * <p>原子性：acquire 用 Redis DEL（原子）抢占草稿——双击/重试并发时只有一个请求
 * 删除成功并继续；占用前先做归属（userId/domain）校验，校验不通过不删除草稿。
 *
 * @author apms
 */
@Component
public class ImportDraftStore {

    /** 草稿/处理标记/结果快照统一 10 分钟有效 */
    private static final Duration TTL = Duration.ofMinutes(10);

    private static final String DRAFT = "draft:";
    private static final String PROCESSING = "processing:";
    private static final String DONE = "done:";

    @Autowired
    private RedisTemplate<Object, Object> redisTemplate;

    private String key(String domain, String suffix) {
        return "import:" + domain + ":" + suffix;
    }

    /** 保存草稿，返回一次性 token */
    public String saveDraft(String domain, ImportDraft draft) {
        String token = IdUtils.fastUUID();
        draft.setDomain(domain);
        redisTemplate.opsForValue().set(key(domain, DRAFT + token), draft, TTL);
        return token;
    }

    /**
     * 原子占用草稿：归属校验通过后原子删除草稿并置 processing。
     *
     * @return 草稿；null 表示草稿不存在/已被占用/归属不符（调用方应再用 {@link #committedState} 区分）
     */
    public <T extends ImportDraft> T acquire(String domain, String token, Long userId, Class<T> type) {
        Object raw = redisTemplate.opsForValue().get(key(domain, DRAFT + token));
        if (raw == null) return null;
        T draft = JSON.parseObject(JSON.toJSONString(raw), type);
        if (draft == null || draft.getUserId() == null || !draft.getUserId().equals(userId)
                || !domain.equals(draft.getDomain())) {
            // 归属不符：不删除他人草稿
            return null;
        }
        // Redis DEL 原子：并发提交只有一个返回 true
        Boolean removed = redisTemplate.delete(key(domain, DRAFT + token));
        if (!Boolean.TRUE.equals(removed)) return null;
        redisTemplate.opsForValue().setIfAbsent(key(domain, PROCESSING + token), "1", TTL);
        return draft;
    }

    /** 草稿不存在时查询提交状态（处理中/已完成/已过期），已完成时 resultHolder 填结果 */
    public CommitOutcome committedState(String domain, String token, Object[] resultHolder) {
        Object done = redisTemplate.opsForValue().get(key(domain, DONE + token));
        if (done != null) {
            if (resultHolder != null && resultHolder.length > 0) resultHolder[0] = done;
            return CommitOutcome.DONE;
        }
        Object processing = redisTemplate.opsForValue().get(key(domain, PROCESSING + token));
        if (processing != null) return CommitOutcome.PROCESSING;
        return CommitOutcome.EXPIRED;
    }

    /** 入库完成：写结果快照并清除处理标记（第二次 commit 幂等拿到此结果） */
    public void complete(String domain, String token, Object result) {
        redisTemplate.opsForValue().set(key(domain, DONE + token), result, TTL);
        redisTemplate.delete(key(domain, PROCESSING + token));
    }
}
