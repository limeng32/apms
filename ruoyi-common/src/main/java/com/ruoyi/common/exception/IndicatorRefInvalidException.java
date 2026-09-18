package com.ruoyi.common.exception;

/**
 * IndicatorRefLevel 区间校验失败
 *
 * <p>
 * 规则（按 DESIGN.md）：
 *   同一 indicator_ref 下的多个 ref_level（GOOD / NORMAL / ATTENTION / 自定义 level）
 *   必须满足：
 *   1. 互不重叠（两个 level 的区间没有交集）
 *   2. 无空洞（所有 range 从全局 min 到全局 max 连续覆盖）
 *   3. direction 一致（HIGHER_BETTER 时 level 边界单调递增，LOWER_BETTER 时单调递减）
 */
public class IndicatorRefInvalidException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public IndicatorRefInvalidException(String message) {
        super(message);
    }
}
