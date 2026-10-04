package com.ruoyi.system.service.apms.algorithm;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;

/**
 * 模型派生算法扩展点。
 *
 * <p>每个实现是一个 Spring Bean，自动进入算法注册表；模型通过 {@code apms_test_model.algo_id}
 * 声明绑定哪个算法，新增模型/算法时无需改动录入与评分主链路。
 *
 * <p>约定：实现只处理「采集字段 → 派生字段」的计算与持久化，
 * 原始采集值（collect_mode=INPUT）由主链路保证已落库并按字段 sortOrder 排序后传入；
 * 实现需自行清理旧派生值后再写入新值。
 */
public interface ModelDeriveAlgorithm {

    /** 算法唯一标识，对应 apms_test_model.algo_id，如 rsa-sdec */
    String algoId();

    /** 展示名（管理页下拉用） */
    String displayName();

    /**
     * 计算并持久化派生值。
     *
     * @param result    已落库的模型测试结果（id 已回填）
     * @param rawValues 本次提交的非派生采集值，已按模型字段 sortOrder 升序排列
     */
    void derive(ApmsTestResult result, List<ApmsTestResultValue> rawValues);
}
