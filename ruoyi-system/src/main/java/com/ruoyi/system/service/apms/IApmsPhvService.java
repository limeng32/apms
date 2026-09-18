package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsPhvRecord;

/**
 * PHV测量与计算记录 Service 接口
 *
 * @author apms
 */
public interface IApmsPhvService {

    /** 全局列表 */
    List<ApmsPhvRecord> list(ApmsPhvRecord query);

    /** 按ID查询 */
    ApmsPhvRecord selectById(Long id);

    /** 按运动员查询所有PHV记录 */
    List<ApmsPhvRecord> selectByAthleteId(Long athleteId);

    /** 按运动员查询最新PHV记录 */
    ApmsPhvRecord selectLatestByAthleteId(Long athleteId);

    /**
     * 根据体态测量记录计算并保存 PHV
     * 使用 Mirwald 公式
     *
     * @param athleteId  运动员ID
     * @param measureId  apms_body_measure.id（原始测量事实来源）
     * @return 保存后的 PHV 记录
     */
    ApmsPhvRecord calculateAndSave(Long athleteId, Long measureId);

    /**
     * 直接用给定参数计算并保存 PHV（不依赖 body_measure 表，支持手动录入）
     */
    ApmsPhvRecord calculateAndSave(ApmsPhvRecord input);

    /** 删除 */
    int deleteById(Long id);

    /**
     * 自动尝试 PHV 计算 — 查该运动员最新 body_measure 是否齐了 Mirwald 需要的三个指标
     * （height + sitHeight + weight），齐了就自动算并落库。
     * <p>
     * 幂等：如果该最新 body_measure 已经触发过 PHV 计算，返回 null。
     * <p>
     * 触发时机：任何可能让 body_measure 变完整的地方（test result 同步、手动编辑 body_measure）
     *
     * @return 新计算的 PHV 记录，或 null（条件不齐 / 已算过 / athlete 没 birthday）
     */
    ApmsPhvRecord tryAutoCalculate(Long athleteId);
}
