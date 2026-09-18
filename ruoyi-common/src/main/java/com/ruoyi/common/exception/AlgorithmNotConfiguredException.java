package com.ruoyi.common.exception;

/**
 * 算法参数未配置，拒绝计算
 *
 * <p>
 * 用于 Khamis-Roche 成年身高预测等"参数待业务方确认"的算法。
 * 业务界面捕获后应显示友好提示（如"成年身高预测算法待业务方确认参数后启用"）。
 */
public class AlgorithmNotConfiguredException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 算法标识，如 "khamis-roche-v1-pending" */
    private final String algorithmId;

    public AlgorithmNotConfiguredException(String algorithmId, String message) {
        super(message);
        this.algorithmId = algorithmId;
    }

    public AlgorithmNotConfiguredException(String algorithmId) {
        super("算法参数未配置，暂不可用：" + algorithmId);
        this.algorithmId = algorithmId;
    }

    public String getAlgorithmId() {
        return algorithmId;
    }
}
