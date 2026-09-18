package com.ruoyi.system.service.apms;

/**
 * 体态数据同步服务 — 测试结果 → body_measure 自动聚合
 *
 * <p>
 * 职责：当测试任务中录入 HEIGHT / WEIGHT / SIT_HEIGHT / BODY_FAT_RATE / WAIST
 * 等体态类指标的测试结果后，自动将同一次测量会话（session_key）下的多个 result
 * 聚合 upsert 到 apms_body_measure 表。
 *
 * <p>
 * 聚合规则（按 DESIGN.md）：
 * - 任务流程录入：按 athlete_id + measure_date + source_task_id + source_session_key 唯一键 upsert
 * - 非任务手工录入（task_id=NULL）：按 athlete_id + measure_date upsert，同日多次以最后一次为准
 *
 * <p>
 * 识别方式：通过 indicator.code 常量集匹配（HEIGHT / WEIGHT / SIT_HEIGHT / BODY_FAT_RATE / WAIST）。
 *
 * <p>
 * 被谁调用：ApmsTestResultServiceImpl 在 add/update/delete 时触发。
 */
public interface IBodyMeasureSyncService {

    /**
     * 从某个 test_result 出发，同步其关联的体态数据到 body_measure
     *
     * @param resultId 刚写入/更新/删除的 test_result.id
     */
    void syncFromResult(Long resultId);

    /**
     * 批量重同步 — 运动员 + 任务全部 result 重新聚合
     *
     * @param taskId    任务ID
     * @param athleteId 运动员ID
     */
    void resyncTaskMember(Long taskId, Long athleteId);
}
