package com.ruoyi.system.service.apms.algorithm;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.mapper.apms.ApmsTestResultValueMapper;
import com.ruoyi.system.util.apms.RsaDecayCalculator;

/**
 * RSA 10×20m 重复冲刺派生算法（algo_id = rsa-sdec）。
 *
 * <p>输入：模型字段中 collect_mode=INPUT 的各趟冲刺时间（已按字段 sortOrder 排序传入）。
 * 输出：Sdec 衰减率、最佳时间、平均时间三条 is_derived=1 的派生值。
 * 至少 2 趟有效值才计算，参数不合法时静默跳过（不阻断主流程）。
 */
@Component
public class RsaDecayAlgorithm implements ModelDeriveAlgorithm {

    @Autowired
    private ApmsTestResultValueMapper valueMapper;

    @Override
    public String algoId() { return "rsa-sdec"; }

    @Override
    public String displayName() { return "RSA 重复冲刺衰减率（Sdec/最佳/平均）"; }

    @Override
    public void derive(ApmsTestResult result, List<ApmsTestResultValue> rawValues) {
        List<BigDecimal> sprintTimes = new ArrayList<>();
        for (ApmsTestResultValue v : rawValues) {
            if (v.getNumericValue() != null) sprintTimes.add(v.getNumericValue());
        }
        if (sprintTimes.size() < 2) return;

        final RsaDecayCalculator.Result calc;
        try {
            calc = RsaDecayCalculator.calculate(sprintTimes);
        } catch (IllegalArgumentException e) {
            return; // 存在 0/负数等非法值，静默跳过
        }

        // 清理旧派生值（重新计算/更新场景）
        for (ApmsTestResultValue v : valueMapper.selectByResultId(result.getId())) {
            if (RsaDecayCalculator.ALGORITHM_ID.equals(v.getAlgorithmId())) {
                valueMapper.deleteById(v.getId());
            }
        }

        insertDerived(result, "rsa_sdec", "Sdec 衰减率", calc.sdecPercent, "%");
        insertDerived(result, "rsa_best_time", "最佳成绩", calc.bestTime, "s");
        insertDerived(result, "rsa_avg_time", "平均成绩", calc.avgTime, "s");
    }

    private void insertDerived(ApmsTestResult result, String key, String name, BigDecimal value, String unit) {
        ApmsTestResultValue d = new ApmsTestResultValue();
        d.setResultId(result.getId());
        d.setModelId(result.getModelId());
        d.setFieldKey(key);
        d.setFieldName(name);
        d.setNumericValue(value);
        d.setUnit(unit);
        d.setIsDerived("1");
        d.setAlgorithmId(RsaDecayCalculator.ALGORITHM_ID);
        d.setAlgorithmVersion(RsaDecayCalculator.ALGO_VERSION);
        valueMapper.insert(d);
    }
}
