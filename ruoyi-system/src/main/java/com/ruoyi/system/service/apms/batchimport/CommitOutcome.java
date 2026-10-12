package com.ruoyi.system.service.apms.batchimport;

/**
 * commit 在草稿已不存在时的状态判定。
 *
 * @author apms
 */
public enum CommitOutcome {
    /** 另一请求正在处理（防双击/重试） */
    PROCESSING,
    /** 已提交过：返回首次结果快照（幂等） */
    DONE,
    /** 草稿不存在/已过期/归属不符 */
    EXPIRED
}
