package com.ruoyi.system.util.apms;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 组合模型评分计算器
 *
 * <p>归一化方法：z_score，使用 apms_indicator_ref.ref_min/ref_max 做代理：
 * <pre>
 *   μ = (ref_min + ref_max) / 2
 *   σ = (ref_max - ref_min) / 4
 *   normalized = (value - μ) / σ
 * </pre>
 *
 * <p>方向处理：
 *   - HIGHER_BETTER → normalized 直接用
 *   - LOWER_BETTER  → normalized 乘以 -1（值越小分越高）
 *   - REFERENCE_ONLY → 跳过（不计入加权）
 *   - direction_override 优先于 indicator.evaluation_direction
 *
 * <p>缺失指标：跳过该 component，剩余 component 权重归一化后再加权求和。
 *
 * <p>参考：combo_model.normalization_method = "z_score"
 */
public class ComboScoreCalculator {

    public static final String ALGO_VERSION = "composite-fitness-v1";
    public static final String NORMALIZATION = "z_score";

    private static final int SCALE_SCORE = 3;
    private static final int SCALE_NORM  = 4;
    private static final RoundingMode RM = RoundingMode.HALF_UP;

    /** 单个 component 的输入 */
    public static class ComponentInput {
        public Long componentId;
        public Long indicatorId;
        public String indicatorCode;
        public String indicatorName;
        public BigDecimal weight;
        /** 'HIGHER_BETTER' / 'LOWER_BETTER' / 'REFERENCE_ONLY' */
        public String direction;
        /** 实际测量值 */
        public BigDecimal value;
        /** ref 表 min/max */
        public BigDecimal refMin;
        public BigDecimal refMax;
        /** 计算得到的 μ 和 σ（写进 breakdown） */
        public BigDecimal mu;
        public BigDecimal sigma;
        /** z_score 归一化后的值 */
        public BigDecimal normalized;
        /** 加权得分 = weight * normalized */
        public BigDecimal weightedScore;
        /** 是否有效（有值且能算出 normalized） */
        public boolean valid;
        /** 跳过原因 */
        public String skipReason;
    }

    /** 计算结果 */
    public static class Result {
        public BigDecimal comboScore;
        public List<ComponentInput> breakdown = new ArrayList<>();
        /** 实际参与加权的总权重（跳过的 component 不计） */
        public BigDecimal effectiveWeightSum;
        /** 是否所有 component 都有效 */
        public boolean complete;
        /** 覆盖的 component 数 */
        public int coveredCount;
        public String algoVersion = ALGO_VERSION;
        public String normalization = NORMALIZATION;

        /** 构建 ref_snapshot JSON（快照，保证可复现） */
        public String buildRefSnapshot() {
            StringBuilder sb = new StringBuilder();
            sb.append("{\"normalization\":\"").append(normalization).append("\"");
            sb.append(",\"algoVersion\":\"").append(algoVersion).append("\"");
            sb.append(",\"effectiveWeightSum\":").append(effectiveWeightSum);
            sb.append(",\"components\":[");
            for (int i = 0; i < breakdown.size(); i++) {
                ComponentInput c = breakdown.get(i);
                sb.append("{");
                sb.append("\"indicatorId\":").append(c.indicatorId);
                sb.append(",\"indicatorCode\":\"").append(c.indicatorCode).append("\"");
                sb.append(",\"weight\":").append(c.weight);
                sb.append(",\"direction\":\"").append(c.direction == null ? "" : c.direction).append("\"");
                sb.append(",\"value\":").append(c.value == null ? "null" : c.value);
                sb.append(",\"refMin\":").append(c.refMin == null ? "null" : c.refMin);
                sb.append(",\"refMax\":").append(c.refMax == null ? "null" : c.refMax);
                sb.append(",\"mu\":").append(c.mu == null ? "null" : c.mu);
                sb.append(",\"sigma\":").append(c.sigma == null ? "null" : c.sigma);
                sb.append(",\"normalized\":").append(c.normalized == null ? "null" : c.normalized);
                sb.append(",\"weightedScore\":").append(c.weightedScore == null ? "null" : c.weightedScore);
                sb.append(",\"valid\":").append(c.valid);
                if (c.skipReason != null) sb.append(",\"skipReason\":\"").append(c.skipReason).append("\"");
                sb.append("}");
                if (i < breakdown.size() - 1) sb.append(",");
            }
            sb.append("]}");
            return sb.toString();
        }
    }

    /**
     * 主计算入口
     *
     * @param inputs 所有 component 的输入（可能含有 value=null 的项）
     * @return 计算结果
     */
    public static Result calculate(List<ComponentInput> inputs) {
        Result result = new Result();
        result.breakdown = inputs;

        BigDecimal sumWeighted = BigDecimal.ZERO;
        BigDecimal sumWeight = BigDecimal.ZERO;
        int covered = 0;

        for (ComponentInput c : inputs) {
            BigDecimal weighted = processComponent(c);
            if (weighted != null) {
                sumWeighted = sumWeighted.add(weighted);
                sumWeight = sumWeight.add(c.weight);
                covered++;
            }
        }

        // 重新归一化：让有效 component 权重之和为 1.0
        result.effectiveWeightSum = sumWeight;
        result.coveredCount = covered;
        result.complete = (covered == inputs.size());

        if (sumWeight.compareTo(BigDecimal.ZERO) > 0) {
            // comboScore = Σ(weight_i × normalized_i)，权重本身已来自模型权重，sumWeighted 就是最终分
            result.comboScore = sumWeighted.setScale(SCALE_SCORE, RM);
        } else {
            result.comboScore = null;
        }

        return result;
    }

    /**
     * 处理单个 component：算 normalized + weightedScore
     * @return weightedScore 或 null 表示跳过
     */
    private static BigDecimal processComponent(ComponentInput c) {
        if (c.weight == null) { markSkip(c, "weight is null"); return null; }
        if (c.value == null) { markSkip(c, "no value"); return null; }
        if (c.direction == null || "REFERENCE_ONLY".equals(c.direction)) {
            markSkip(c, "direction=REFERENCE_ONLY"); return null;
        }
        if (c.refMin == null || c.refMax == null) { markSkip(c, "no ref threshold"); return null; }
        BigDecimal range = c.refMax.subtract(c.refMin);
        if (range.compareTo(BigDecimal.ZERO) <= 0) { markSkip(c, "ref_min==ref_max"); return null; }

        // μ = (min+max)/2, σ = range/4
        c.mu = c.refMin.add(c.refMax).divide(new BigDecimal("2"), 8, RM);
        c.sigma = range.divide(new BigDecimal("4"), 8, RM);

        // z_score
        BigDecimal z = c.value.subtract(c.mu).divide(c.sigma, SCALE_NORM, RM);

        // 方向翻转
        if ("LOWER_BETTER".equals(c.direction)) {
            z = z.negate();
        }
        c.normalized = z;

        c.weightedScore = c.weight.multiply(z).setScale(SCALE_SCORE, RM);
        c.valid = true;
        c.skipReason = null;
        return c.weight.multiply(z);
    }

    private static void markSkip(ComponentInput c, String reason) {
        c.valid = false;
        c.skipReason = reason;
    }
}
