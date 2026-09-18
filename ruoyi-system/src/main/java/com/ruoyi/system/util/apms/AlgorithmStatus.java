package com.ruoyi.system.util.apms;

/**
 * 算法状态枚举
 *
 * <p>
 * READY — 参数已确认，可正式计算
 * NOT_CONFIGURED — 参数未确认，calculate() 必须抛出 {@link com.ruoyi.common.exception.AlgorithmNotConfiguredException}
 */
public enum AlgorithmStatus {
    READY,
    NOT_CONFIGURED
}
