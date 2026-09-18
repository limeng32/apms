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
 * <p>归一化方法：T-Score（Z-Score → T-Score 转换）
 * <pre>
 *   Z = (value - μ) / σ
 *   T = 50 + 10 × Z
 * </pre>
 *
 * <p>μ/σ 来源优先级：
 *   1. 外部注入（真实参考组实时聚合）→ sampleSize 字段标注样本量
 *   2. ref 代理：μ = (ref_min + ref_max)/2, σ = (ref_max - ref_min)/4
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

    public static final String ALGO_VERSION = "composite-fitness-v2";
    public static final String NORMALIZATION = "t_score";

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
        /** ref 表 min/max（代理参考） */
        public BigDecimal refMin;
        public BigDecimal refMax;
        /** 参考组样本量（≥5 才可靠；null 表示未用实时聚合） */
        public Integer sampleSize;
        /** 是否使用了实时聚合的 μ/σ（false 表示用 ref 代理） */
        public boolean useRealStats;
        /** 最终使用的 μ 和 σ（由 Service 注入 或 由 ref 代理算出） */
        public BigDecimal mu;
        public BigDecimal sigma;
        /** Z-Score 归一化后的值 */
        public BigDecimal zScore;
        /** T-Score = 50 + 10 × Z */
        public BigDecimal tScore;
        /** 方向翻转后的 normalized 分（用于加权） */
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
                sb.append(",\"indicatorCode\":\"").append(c.indicatorCode == null ? "" : c.indicatorCode).append("\"");
                sb.append(",\"indicatorName\":\"").append(c.indicatorName == null ? "" : c.indicatorName).append("\"");
                sb.append(",\"weight\":").append(c.weight == null ? "null" : c.weight);
                sb.append(",\"direction\":\"").append(c.direction == null ? "" : c.direction).append("\"");
                sb.append(",\"value\":").append(c.value == null ? "null" : c.value);
                sb.append(",\"refMin\":").append(c.refMin == null ? "null" : c.refMin);
                sb.append(",\"refMax\":").append(c.refMax == null ? "null" : c.refMax);
                sb.append(",\"sampleSize\":").append(c.sampleSize == null ? "null" : c.sampleSize);
                sb.append(",\"useRealStats\":").append(c.useRealStats);
                sb.append(",\"mu\":").append(c.mu == null ? "null" : c.mu);
                sb.append(",\"sigma\":").append(c.sigma == null ? "null" : c.sigma);
                sb.append(",\"zScore\":").append(c.zScore == null ? "null" : c.zScore);
                sb.append(",\"tScore\":").append(c.tScore == null ? "null" : c.tScore);
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

    // ============== 主入口 ==============

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

        result.effectiveWeightSum = sumWeight;
        result.coveredCount = covered;
        result.complete = (covered == inputs.size());

        if (sumWeight.compareTo(BigDecimal.ZERO) > 0) {
            result.comboScore = sumWeighted.setScale(SCALE_SCORE, RM);
        } else {
            result.comboScore = null;
        }

        return result;
    }

    // ============== 单 component 处理 ==============

    /**
     * 处理单个 component：算 mu/sigma → Z-Score → T-Score → 方向翻转 → 加权
     *
     * <p>优先使用外部注入的 mu/sigma（真实参考组），否则用 ref 代理。
     *
     * @return weightedScore 或 null 表示跳过
     */
    private static BigDecimal processComponent(ComponentInput c) {
        if (c.weight == null) { markSkip(c, "weight is null"); return null; }
        if (c.value == null) { markSkip(c, "no value"); return null; }
        if (c.direction == null || "REFERENCE_ONLY".equals(c.direction)) {
            markSkip(c, "direction=REFERENCE_ONLY"); return null;
        }

        // 1. 确定 μ 和 σ — 外部注入优先
        if (c.mu != null && c.sigma != null) {
            // 外部已注入真实参考组统计量
            c.useRealStats = (c.sampleSize != null);
        } else if (c.refMin != null && c.refMax != null
                && c.refMax.subtract(c.refMin).compareTo(BigDecimal.ZERO) > 0) {
            // 用 ref 代理：μ = (min+max)/2, σ = range/4
            c.mu = c.refMin.add(c.refMax).divide(new BigDecimal("2"), 8, RM);
            c.sigma = c.refMax.subtract(c.refMin).divide(new BigDecimal("4"), 8, RM);
            c.useRealStats = false;
        } else {
            markSkip(c, "no ref threshold"); return null;
        }

        if (c.sigma.compareTo(BigDecimal.ZERO) <= 0) {
            markSkip(c, "sigma is zero"); return null;
        }

        // 2. Z-Score = (value - μ) / σ
        BigDecimal z = c.value.subtract(c.mu).divide(c.sigma, SCALE_NORM, RM);
        c.zScore = z;

        // 3. T-Score = 50 + 10 × Z
        c.tScore = new BigDecimal("50").add(z.multiply(new BigDecimal("10"))).setScale(SCALE_NORM, RM);

        // 4. 方向翻转（normalized 用于加权，T-Score 本身不翻）
        BigDecimal normalized = z;
        if ("LOWER_BETTER".equals(c.direction)) {
            normalized = z.negate();
        }
        c.normalized = normalized;

        // 5. 加权得分
        c.weightedScore = c.weight.multiply(normalized).setScale(SCALE_SCORE, RM);
        c.valid = true;
        c.skipReason = null;
        return c.weight.multiply(normalized);
    }

    private static void markSkip(ComponentInput c, String reason) {
        c.valid = false;
        c.skipReason = reason;
    }
}
