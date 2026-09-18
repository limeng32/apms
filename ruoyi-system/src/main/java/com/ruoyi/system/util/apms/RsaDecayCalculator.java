package com.ruoyi.system.util.apms;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * RSA 多次冲刺衰减率 (Sdec) 计算
 *
 * <p>
 * 算法来源：用户需求（足球专项体能与敏捷测试模型库）
 * 版本：rsa-decay-v1
 *
 * <p>
 * 输入：每趟冲刺时间 t_1 ... t_n
 * <pre>
 *   总时间    = Σ t_i
 *   最佳成绩  = min(t_i)
 *   平均成绩  = Σ t_i / n
 *   衰减率 Sdec = (总时间 - 最佳 × n) / (最佳 × n) × 100%
 * </pre>
 *
 * <p>
 * 评价方向：越小越好。Sdec 反映疲劳耐受与无氧恢复能力。
 *
 * <p>
 * 业务约束：必须保存所有单趟原始时间，不允许只保存最终 Sdec 而丢弃原始数据。
 * 原始单趟成绩通过 apms_test_result_rep 持久化。
 *
 * @author apms
 */
public class RsaDecayCalculator implements AlgorithmCalculator<RsaDecayCalculator.Input, RsaDecayCalculator.Result> {

    public static final String ALGORITHM_ID = "rsa-decay";
    public static final String ALGO_VERSION = "rsa-decay-v1";

    private static final int SCALE = 4;
    private static final RoundingMode RM = RoundingMode.HALF_UP;

    @Override
    public String getAlgorithmId() {
        return ALGORITHM_ID;
    }

    @Override
    public String getVersion() {
        return ALGO_VERSION;
    }

    @Override
    public AlgorithmStatus getStatus() {
        return AlgorithmStatus.READY;
    }

    /**
     * RSA 衰减率输入
     */
    public static class Input {
        /** 每趟冲刺时间列表（秒），必须至少 2 趟 */
        public List<BigDecimal> sprintTimes;
    }

    /**
     * RSA 衰减率计算结果
     */
    public static class Result {
        /** 总时间 = Σ t_i */
        public BigDecimal totalTime;
        /** 最佳成绩 = min(t_i) */
        public BigDecimal bestTime;
        /** 平均成绩 = totalTime / n */
        public BigDecimal avgTime;
        /** 衰减率 Sdec (%)，越小越好 */
        public BigDecimal sdecPercent;
        /** 趟数 n */
        public int repCount;
        /** 算法版本 */
        public String version;
        /** 所有输入原始值快照（防止外部修改后结果失真） */
        public List<BigDecimal> rawInputs;
    }

    /**
     * 静态便捷入口
     */
    public static Result calculate(List<BigDecimal> sprintTimes) {
        return new RsaDecayCalculator().calculate(new Input() {{ this.sprintTimes = sprintTimes; }});
    }

    /**
     * 执行 RSA 衰减率计算
     */
    @Override
    public Result calculate(Input input) {
        List<BigDecimal> times = input.sprintTimes;
        if (times == null || times.size() < 2) {
            throw new IllegalArgumentException("RSA 至少需要 2 趟冲刺时间，实际："
                + (times == null ? "null" : times.size() + " 趟"));
        }

        // 防御性拷贝，防止外部修改
        List<BigDecimal> snapshot = new ArrayList<>(times);

        // Σ t_i
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal t : times) {
            if (t == null) throw new IllegalArgumentException("冲刺时间不能为 null");
            if (t.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("冲刺时间必须为正数：" + t);
            }
            total = total.add(t);
        }

        // min(t_i)
        BigDecimal best = Collections.min(times);

        // n
        int n = times.size();
        BigDecimal nDecimal = new BigDecimal(n);

        // 平均 = total / n
        BigDecimal avg = total.divide(nDecimal, SCALE, RM);

        // Sdec = (total - best × n) / (best × n) × 100%
        BigDecimal bestTimesN = best.multiply(nDecimal);
        BigDecimal numerator = total.subtract(bestTimesN);
        BigDecimal denominator = bestTimesN;
        BigDecimal ratio = numerator.divide(denominator, SCALE + 2, RM);
        BigDecimal sdecPercent = ratio.multiply(new BigDecimal("100")).setScale(SCALE, RM);

        Result result = new Result();
        result.totalTime = total.setScale(SCALE, RM);
        result.bestTime = best.setScale(SCALE, RM);
        result.avgTime = avg;
        result.sdecPercent = sdecPercent;
        result.repCount = n;
        result.version = ALGO_VERSION;
        result.rawInputs = snapshot;
        return result;
    }
}
