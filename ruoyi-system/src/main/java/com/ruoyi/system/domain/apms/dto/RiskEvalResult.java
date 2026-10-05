package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * 风险评估汇总结果（纯计算，无 Spring/DB 依赖，可独立断言验证）。
 *
 * 定级规则（阈值由调用方传入，一期常量见 RtpRiskEvaluator）：
 *   存在 HEALTH 且 forceWarning        → WARNING（建议红）
 *   healthScore ≥ scoreWarning        → WARNING
 *   healthScore ≥ scoreAttention      → ATTENTION（建议黄）
 *   healthScore ≥ scoreInfo，或有 HEALTH 因子 → INFO（健康关注）
 *   healthScore=0 且仅 PROCESS 因子    → INFO + processOnly=true（纯流程待办）
 *   无任何因子                         → NONE（不生成待办）
 *
 * @author apms
 */
public class RiskEvalResult implements Serializable {

    private static final long serialVersionUID = 1L;

    public static final String NONE = "NONE";
    public static final String INFO = "INFO";
    public static final String ATTENTION = "ATTENTION";
    public static final String WARNING = "WARNING";

    public static final String KIND_HEALTH = "HEALTH";
    public static final String KIND_PROCESS = "PROCESS";

    private List<RiskFactor> factors = new ArrayList<>();
    private BigDecimal riskScore = BigDecimal.ZERO;
    private int todoPriority;
    private boolean processOnly;
    private List<String> processFlags = new ArrayList<>();
    private String suggestedLevel = NONE;

    public List<RiskFactor> getFactors() { return factors; }
    public void setFactors(List<RiskFactor> factors) { this.factors = factors; }
    public BigDecimal getRiskScore() { return riskScore; }
    public void setRiskScore(BigDecimal riskScore) { this.riskScore = riskScore; }
    public int getTodoPriority() { return todoPriority; }
    public void setTodoPriority(int todoPriority) { this.todoPriority = todoPriority; }
    public boolean isProcessOnly() { return processOnly; }
    public void setProcessOnly(boolean processOnly) { this.processOnly = processOnly; }
    public List<String> getProcessFlags() { return processFlags; }
    public void setProcessFlags(List<String> processFlags) { this.processFlags = processFlags; }
    public String getSuggestedLevel() { return suggestedLevel; }
    public void setSuggestedLevel(String suggestedLevel) { this.suggestedLevel = suggestedLevel; }

    /**
     * 纯计算汇总：PROCESS 因子在计分入口直接排除，urgency 再高也不影响黄/红建议。
     */
    public static RiskEvalResult summarize(List<RiskFactor> input,
                                           int scoreInfo, int scoreAttention, int scoreWarning) {
        RiskEvalResult out = new RiskEvalResult();
        if (input != null) {
            out.factors = new ArrayList<>(input);
        }

        BigDecimal healthScore = BigDecimal.ZERO;
        boolean forceWarningHit = false;
        int healthCount = 0;

        for (RiskFactor f : out.factors) {
            int urgency = f.getUrgency() == null ? 0 : f.getUrgency();
            if (urgency > out.todoPriority) {
                out.todoPriority = urgency;
            }
            if (KIND_PROCESS.equals(f.getKind())) {
                out.processFlags.add(f.getCode());
                continue;
            }
            if (!KIND_HEALTH.equals(f.getKind())) {
                continue;
            }
            healthCount++;
            int severity = f.getSeverity() == null ? 0 : f.getSeverity();
            BigDecimal weight = f.getWeight() == null ? BigDecimal.ONE : f.getWeight();
            healthScore = healthScore.add(new BigDecimal(severity).multiply(weight));
            if (f.isForceWarning()) {
                forceWarningHit = true;
            }
        }

        out.riskScore = healthScore.setScale(2, RoundingMode.HALF_UP);

        if (forceWarningHit || out.riskScore.compareTo(BigDecimal.valueOf(scoreWarning)) >= 0) {
            out.suggestedLevel = WARNING;
        } else if (out.riskScore.compareTo(BigDecimal.valueOf(scoreAttention)) >= 0) {
            out.suggestedLevel = ATTENTION;
        } else if (out.riskScore.compareTo(BigDecimal.valueOf(scoreInfo)) >= 0 || healthCount > 0) {
            out.suggestedLevel = INFO;
        } else if (!out.processFlags.isEmpty()) {
            out.suggestedLevel = INFO;
            out.processOnly = true;
            out.riskScore = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        } else {
            out.suggestedLevel = NONE;
        }
        return out;
    }
}
