package com.ruoyi.system.util.apms;

import java.math.BigDecimal;
import com.ruoyi.common.exception.AlgorithmNotConfiguredException;

/**
 * Khamis-Roche 成年身高预测
 *
 * <p>
 * 根据 DESIGN.md，一期算法状态为 NOT_CONFIGURED：业务方尚未确认完整系数表。
 * 本类提供完整的 Input/Result 结构，但 calculate() 拒绝执行并抛出
 * {@link AlgorithmNotConfiguredException}，界面应显示"成年身高预测算法待业务方确认参数后启用"。
 *
 * <p>
 * 参数确认后：
 *   1. 填入系数表到 calculate() 方法
 *   2. 版本号从 "khamis-roche-v1-pending" 升级为 "khamis-roche-v1"
 *   3. getStatus() 改为 READY
 *
 * @author apms
 */
public class KhamisRocheCalculator implements AlgorithmCalculator<KhamisRocheCalculator.Input, KhamisRocheCalculator.Result> {

    public static final String ALGORITHM_ID = "khamis-roche";
    public static final String VERSION_PENDING = "khamis-roche-v1-pending";

    @Override
    public String getAlgorithmId() {
        return ALGORITHM_ID;
    }

    @Override
    public String getVersion() {
        return VERSION_PENDING;
    }

    @Override
    public AlgorithmStatus getStatus() {
        return AlgorithmStatus.NOT_CONFIGURED;
    }

    /**
     * Khamis-Roche 输入参数
     */
    public static class Input {
        /** 性别："0"=男，"1"=女 */
        public String gender;
        /** 精确年龄（岁） */
        public BigDecimal decimalAge;
        /** 当前身高 cm */
        public BigDecimal currentHeight;
        /** 当前体重 kg */
        public BigDecimal weight;
        /** 父亲身高 cm */
        public BigDecimal fatherHeight;
        /** 母亲身高 cm */
        public BigDecimal motherHeight;
    }

    /**
     * Khamis-Roche 计算结果
     */
    public static class Result {
        /** 预测成年身高 cm */
        public BigDecimal predictedAdultHeight;
        /** 算法版本 */
        public String version;
    }

    /**
     * 拒绝计算 — 参数未确认
     *
     * @throws AlgorithmNotConfiguredException 始终抛出
     */
    @Override
    public Result calculate(Input input) {
        throw new AlgorithmNotConfiguredException(ALGORITHM_ID,
            "成年身高预测算法（Khamis-Roche）待业务方确认参数后启用");
    }
}
