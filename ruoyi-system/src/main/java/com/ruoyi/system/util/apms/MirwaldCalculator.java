package com.ruoyi.system.util.apms;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Mirwald 成熟度偏移 (Maturity Offset) 计算工具
 *
 * <p>
 * 算法来源：Mirwald 公式（青少年运动员发育评估）
 * 版本：2014.1（文档标注版本）
 *
 * <p>
 * 男性公式：
 * <pre>
 * 成熟度偏移 =
 * -9.236
 * + 0.0002708 × (腿长 × 坐高)
 * - 0.001663 × (年龄 × 腿长)
 * + 0.007216 × (年龄 × 坐高)
 * + 0.02292 × (体重 / 身高 × 100)
 * </pre>
 *
 * <p>
 * 女性公式：
 * <pre>
 * 成熟度偏移 =
 * -9.376
 * + 0.0001882 × (腿长 × 坐高)
 * + 0.0022 × (年龄 × 腿长)
 * + 0.005841 × (年龄 × 坐高)
 * - 0.002658 × (年龄 × 体重)
 * + 0.07693 × (体重 / 身高 × 100)
 * </pre>
 *
 * <p>
 * 结果解释：
 * <ul>
 *   <li>偏移值为负：预计尚未到达 PHV</li>
 *   <li>偏移值为正：表示已越过 PHV</li>
 *   <li>预测 PHV 年龄 = 当前年龄 - 成熟度偏移值</li>
 * </ul>
 *
 * @author apms
 */
public class MirwaldCalculator {

    public static final String VERSION = "2014.1";

    private static final int SCALE_OFFSET = 4;    // maturity_offset 保留4位
    private static final int SCALE_AGE = 4;       // decimal_age / predicted_phv_age 保留4位
    private static final int SCALE_HEIGHT = 1;     // cm 保留1位
    private static final RoundingMode RM = RoundingMode.HALF_UP;

    /**
     * Mirwald 计算输入参数
     */
    public static class Input {
        /** 性别："0"=男，"1"=女 */
        public String gender;
        /** 精确年龄（岁） */
        public BigDecimal decimalAge;
        /** 站立身高 cm */
        public BigDecimal height;
        /** 坐高 cm */
        public BigDecimal sitHeight;
        /** 体重 kg */
        public BigDecimal weight;

        /** 计算腿长 = height - sitHeight */
        public BigDecimal getLegLength() {
            return height.subtract(sitHeight);
        }
    }

    /**
     * Mirwald 计算结果
     */
    public static class Result {
        /** 腿长 cm（计算值） */
        public BigDecimal legLength;
        /** 成熟度偏移（小数，保留4位） */
        public BigDecimal maturityOffset;
        /** 预测 PHV 年龄 = decimalAge - maturityOffset */
        public BigDecimal predictedPhvAge;
        /** 算法版本 */
        public String version;
    }

    /**
     * 计算 Mirwald 成熟度偏移
     *
     * @param input 输入参数
     * @return 计算结果
     */
    public static Result calculate(Input input) {
        BigDecimal age = input.decimalAge;
        BigDecimal height = input.height;
        BigDecimal weight = input.weight;
        BigDecimal sitHeight = input.sitHeight;
        BigDecimal legLength = input.getLegLength();

        // 统一性别：现网值为 M/F，schema 为 0/1 都支持
        String g = input.gender != null ? input.gender.trim().toUpperCase() : "";
        boolean isMale = "M".equals(g) || "0".equals(g) || "男".equals(g);

        BigDecimal offset;
        if (isMale) {
            // 男性公式
            BigDecimal term1 = new BigDecimal("-9.236");
            BigDecimal term2 = new BigDecimal("0.0002708").multiply(legLength).multiply(sitHeight);
            BigDecimal term3 = new BigDecimal("-0.001663").multiply(age).multiply(legLength);
            BigDecimal term4 = new BigDecimal("0.007216").multiply(age).multiply(sitHeight);
            BigDecimal bmiLike = weight.divide(height, 8, RM).multiply(new BigDecimal("100"));
            BigDecimal term5 = new BigDecimal("0.02292").multiply(bmiLike);

            offset = term1.add(term2).add(term3).add(term4).add(term5);
        } else {
            // 女性公式
            BigDecimal term1 = new BigDecimal("-9.376");
            BigDecimal term2 = new BigDecimal("0.0001882").multiply(legLength).multiply(sitHeight);
            BigDecimal term3 = new BigDecimal("0.0022").multiply(age).multiply(legLength);
            BigDecimal term4 = new BigDecimal("0.005841").multiply(age).multiply(sitHeight);
            BigDecimal term5 = new BigDecimal("-0.002658").multiply(age).multiply(weight);
            BigDecimal bmiLike = weight.divide(height, 8, RM).multiply(new BigDecimal("100"));
            BigDecimal term6 = new BigDecimal("0.07693").multiply(bmiLike);

            offset = term1.add(term2).add(term3).add(term4).add(term5).add(term6);
        }

        Result result = new Result();
        result.legLength = legLength.setScale(SCALE_HEIGHT, RM);
        result.maturityOffset = offset.setScale(SCALE_OFFSET, RM);
        result.predictedPhvAge = age.subtract(offset).setScale(SCALE_AGE, RM);
        result.version = VERSION;
        return result;
    }
}
