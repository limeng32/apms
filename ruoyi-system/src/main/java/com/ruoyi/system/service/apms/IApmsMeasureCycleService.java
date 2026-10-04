package com.ruoyi.system.service.apms;

import java.util.List;
import java.util.Map;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.domain.apms.ApmsMeasureCycle;

/**
 * 体态测量周期 Service
 */
public interface IApmsMeasureCycleService {

    List<ApmsMeasureCycle> list(ApmsMeasureCycle query);

    ApmsMeasureCycle getById(Long id);

    int insert(ApmsMeasureCycle cycle);

    int update(ApmsMeasureCycle cycle);

    int deleteById(Long id);

    /**
     * 周期完成情况：目标队员、已测、未测。
     * 返回 {cycle, memberTotal, measured, pending, percent}
     */
    Map<String, Object> progress(Long cycleId);

    /**
     * 周期内批量录入/更新：每队员一条（同周期同队员覆盖）。
     * @return 实际保存条数（全空字段的行跳过）
     */
    int batchSave(Long cycleId, List<ApmsBodyMeasure> measures);
}
