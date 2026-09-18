package com.ruoyi.system.util.apms;

import com.ruoyi.common.exception.AlgorithmNotConfiguredException;

/**
 * 算法计算器统一接口
 *
 * <p>
 * 所有 APMS 领域算法（Mirwald、Khamis-Roche、RSA 衰减率、组合分等）实现此接口。
 * 实现类应通过静态 calculate() 暴露给 Service 层直接调用，同时实现本接口
 * 用于未来通过工厂/注册表统一调度。
 *
 * <p>
 * NOT_CONFIGURED 状态的算法在 {@link #calculate(Object)} 中必须抛出
 * {@link AlgorithmNotConfiguredException}，禁止返回假数据。
 *
 * @param <I> 输入类型
 * @param <O> 输出类型
 */
public interface AlgorithmCalculator<I, O> {

    /** 算法唯一标识，如 "mirwald", "khamis-roche", "rsa-decay" */
    String getAlgorithmId();

    /** 算法版本号，如 "mirwald-v1", "khamis-roche-v1-pending" */
    String getVersion();

    /** 当前算法状态 */
    AlgorithmStatus getStatus();

    /**
     * 执行计算
     *
     * @throws AlgorithmNotConfiguredException 当 status=NOT_CONFIGURED 时
     */
    O calculate(I input);
}
