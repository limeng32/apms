package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.domain.apms.dto.ResultGridForm;
import com.ruoyi.system.service.apms.batchimport.ImportCommitResult;

/**
 * 测试结果 Service 接口
 */
public interface IApmsTestResultService {
    List<ApmsTestResult> list(ApmsTestResult query);
    ApmsTestResult getById(Long id);
    List<ApmsTestResult> listByTaskMember(Long taskId, Long athleteId);

    /**
     * 散录（不绑任务）成绩的同组尝试：同队员 + 同指标/模型，且 task_item_id IS NULL。
     * indicatorId/modelId 二选一。
     */
    List<ApmsTestResult> listFreeGroup(Long athleteId, Long indicatorId, Long modelId);

    int add(ApmsTestResult result, List<ApmsTestResultValue> values);
    int update(ApmsTestResult result, List<ApmsTestResultValue> values);

    /**
     * 在线网格批量录入（行=队员，格=直接指标）：
     * 逐人行级事务，一人失败只回滚该人；任务模式权威解析 task_item 归属并校验成员/指标归属。
     */
    ImportCommitResult batchGridAdd(ResultGridForm form);
    int delete(Long id);
    int deleteByTaskId(Long taskId);

    /** 同组 attempt 根据 indicator evaluation_direction 自动选最佳 (is_selected) */
    int autoSelectBest(Long taskItemId, Long athleteId);

    /**
     * 手动指定选中某条 attempt（事务内：清同组其他 + 选中目标 + 重算进度）
     *
     * @param resultId 要选中的 test_result.id
     * @throws ServiceException 如果 result 不存在 或 is_valid=0（无效 attempt 不能被选中）
     */
    void selectAttempt(Long resultId);
}
