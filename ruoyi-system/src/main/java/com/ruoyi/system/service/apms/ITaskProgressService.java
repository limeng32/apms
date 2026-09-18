package com.ruoyi.system.service.apms;

/**
 * 测试任务进度服务 — 派生 member.status
 *
 * <p>
 * 核心职责：根据 apms_test_result + apms_test_result_value + apms_test_model_field
 * 实时判定 apms_task_member.status（pending / partial / completed）并写回数据库。
 *
 * <p>
 * 完成判定规则（按 DESIGN.md）：
 *   INDICATOR 项：至少存在一个 is_valid=1 的 result 且其 value 有 numeric_value 或 text_value → 完成
 *   MODEL 项：    至少存在一个 is_valid=1 AND is_selected=1 的 result，
 *                 且该 result 下 is_required=1 的 model field 均有值 → 完成
 *   member.status：所有 is_required=1 的 task_item 均完成 → completed
 *                 部分完成 → partial
 *                 无 → pending
 *
 * <p>
 * 本服务直接依赖 Mapper 层，不依赖其他 Service，避免循环依赖。
 * 所有测试结果写操作（新增、修改、删除、CSV 导入、重选 attempt）
 * 必须在同一事务内调用 recalculate()。
 */
public interface ITaskProgressService {

    /**
     * 重算单个运动员在单个任务的完成状态，并写回 apms_task_member
     *
     * @param taskId    任务ID
     * @param athleteId 运动员ID
     * @return 新的 status 值（pending / partial / completed）
     */
    String recalculate(Long taskId, Long athleteId);

    /**
     * 任务级批量重算 — 遍历所有 member 逐一 recalculate
     *
     * @param taskId 任务ID
     */
    void recalculateAll(Long taskId);
}
