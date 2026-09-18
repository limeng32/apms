package com.ruoyi.system.service.apms.impl;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.ITaskProgressService;

/**
 * 测试任务进度服务实现
 *
 * <p>
 * 核心逻辑：遍历 task_item → 判定每个必测项是否完成 → 汇总为 member.status。
 * 直接依赖 Mapper 层以避免与 ApmsTestResultService 的循环依赖。
 *
 * @author apms
 */
@Service
public class TaskProgressServiceImpl implements ITaskProgressService {

    // member.status 常量
    public static final String STATUS_PENDING   = "pending";
    public static final String STATUS_PARTIAL   = "partial";
    public static final String STATUS_COMPLETED = "completed";

    @Autowired private ApmsTaskItemMapper          taskItemMapper;
    @Autowired private ApmsTestResultMapper        resultMapper;
    @Autowired private ApmsTestResultValueMapper    valueMapper;
    @Autowired private ApmsTestModelFieldMapper     modelFieldMapper;
    @Autowired private ApmsTaskMemberMapper         taskMemberMapper;

    /** 缓存：modelId → List<ModelField>（避免重复查同 model 的多 athlete 场景，线程安全） */
    private final Map<Long, List<ApmsTestModelField>> modelFieldCache = new ConcurrentHashMap<>();

    // ============== 公开接口 ==============

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String recalculate(Long taskId, Long athleteId) {
        if (taskId == null || athleteId == null) {
            throw new ServiceException("taskId 和 athleteId 不能为 null");
        }

        // 1. 该任务的所有 task_item
        List<ApmsTaskItem> items = taskItemMapper.selectByTaskId(taskId);
        if (items == null || items.isEmpty()) {
            // 任务没配任何 item → 视为无必测项，直接 completed
            upsertMemberStatus(taskId, athleteId, STATUS_COMPLETED);
            return STATUS_COMPLETED;
        }

        // 2. 该运动员在该任务的所有 result（含多 attempt）
        List<ApmsTestResult> allResults = resultMapper.selectByTaskMember(taskId, athleteId);

        // 3. 按 task_item_id 分组，便于逐个 item 判定
        Map<Long, List<ApmsTestResult>> resultsByItem = new HashMap<>();
        for (ApmsTestResult r : allResults) {
            if (r.getTaskItemId() != null) {
                resultsByItem.computeIfAbsent(r.getTaskItemId(), k -> new ArrayList<>()).add(r);
            }
        }

        // 4. 遍历必测 item，逐一判定完成
        int requiredTotal = 0;
        int requiredDone = 0;
        boolean hasOptionalDone = false;

        for (ApmsTaskItem item : items) {
            boolean done = isItemDone(item, resultsByItem.get(item.getId()));

            if ("1".equals(item.getIsRequired())) {
                requiredTotal++;
                if (done) requiredDone++;
            } else {
                // 选测项：只要做过就算
                if (done) hasOptionalDone = true;
            }
        }

        // 5. 汇总 status
        String status;
        if (requiredTotal == 0) {
            // 没有必测项 → 看选测
            status = hasOptionalDone ? STATUS_COMPLETED : STATUS_PENDING;
        } else if (requiredDone == requiredTotal) {
            status = STATUS_COMPLETED;
        } else if (requiredDone > 0) {
            status = STATUS_PARTIAL;
        } else {
            status = STATUS_PENDING;
        }

        // 6. 写回 apms_task_member
        upsertMemberStatus(taskId, athleteId, status);
        return status;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void recalculateAll(Long taskId) {
        List<ApmsTaskMember> members = taskMemberMapper.selectByTaskId(taskId);
        if (members == null) return;
        for (ApmsTaskMember m : members) {
            recalculate(taskId, m.getAthleteId());
        }
    }

    // ============== 核心判定 ==============

    /**
     * 判定单个 task_item 是否被该运动员完成
     */
    private boolean isItemDone(ApmsTaskItem item, List<ApmsTestResult> resultsForItem) {
        if (resultsForItem == null || resultsForItem.isEmpty()) {
            return false;
        }

        if ("INDICATOR".equals(item.getItemType())) {
            return isIndicatorDone(resultsForItem);
        } else if ("MODEL".equals(item.getItemType())) {
            return isModelDone(item.getModelId(), resultsForItem);
        }
        return false;
    }

    /**
     * INDICATOR 完成判定：至少一条 is_valid=1 的 result 且其 values 有 numeric 或 text
     */
    private boolean isIndicatorDone(List<ApmsTestResult> results) {
        for (ApmsTestResult r : results) {
            if (!"1".equals(r.getIsValid())) continue;
            // 查这条 result 的所有 value
            List<ApmsTestResultValue> vals = valueMapper.selectByResultId(r.getId());
            for (ApmsTestResultValue v : vals) {
                if (v.getNumericValue() != null || v.getTextValue() != null) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * MODEL 完成判定：至少一条 is_valid=1 AND is_selected=1 的 result，
     *                  且该 result 下所有 is_required=1 的 model field 均有值
     */
    private boolean isModelDone(Long modelId, List<ApmsTestResult> results) {
        if (modelId == null) return false;

        // 取该 model 的所有必填 field_key（从缓存）
        List<ApmsTestModelField> requiredFields = getRequiredFields(modelId);
        Set<String> requiredKeys = requiredFields.stream()
            .map(ApmsTestModelField::getFieldKey)
            .collect(Collectors.toSet());
        if (requiredKeys.isEmpty()) {
            // 模型未配置必填字段 → 只要有选中的有效 result 就算完成
            for (ApmsTestResult r : results) {
                if ("1".equals(r.getIsValid()) && "1".equals(r.getIsSelected())) {
                    return true;
                }
            }
            return false;
        }

        // 找 is_valid=1 AND is_selected=1 的 result，然后检查其 values 是否覆盖所有必填 field_key
        for (ApmsTestResult r : results) {
            if (!"1".equals(r.getIsValid())) continue;
            if (!"1".equals(r.getIsSelected())) continue;

            List<ApmsTestResultValue> vals = valueMapper.selectByResultId(r.getId());
            // 把有值的 field_key 收集起来
            Set<String> filledKeys = new HashSet<>();
            for (ApmsTestResultValue v : vals) {
                if (v.getNumericValue() != null || v.getTextValue() != null) {
                    filledKeys.add(v.getFieldKey());
                }
            }
            // 所有必填 field_key 都在 filledKeys 里
            if (filledKeys.containsAll(requiredKeys)) {
                return true;
            }
        }
        return false;
    }

    // ============== 辅助方法 ==============

    /**
     * 带缓存地获取某 model 的必填字段列表
     */
    private List<ApmsTestModelField> getRequiredFields(Long modelId) {
        return modelFieldCache.computeIfAbsent(modelId, id -> {
            List<ApmsTestModelField> all = modelFieldMapper.selectByModelId(id);
            if (all == null) return Collections.emptyList();
            return all.stream()
                .filter(f -> "1".equals(f.getIsRequired()))
                .collect(Collectors.toList());
        });
    }

    /**
     * 清空 modelField 缓存（任务项 model field 变更时调用）
     */
    public void clearModelFieldCache(Long modelId) {
        modelFieldCache.remove(modelId);
    }

    /**
     * 写回 member status — 先精确查，存在则 update，不存在则 insert
     */
    private void upsertMemberStatus(Long taskId, Long athleteId, String status) {
        ApmsTaskMember existing = taskMemberMapper.selectByTaskAndAthlete(taskId, athleteId);
        if (existing != null) {
            if (!status.equals(existing.getStatus())) {
                taskMemberMapper.update(new ApmsTaskMember() {{
                    setTaskId(taskId);
                    setAthleteId(athleteId);
                    setStatus(status);
                }});
            }
        } else {
            taskMemberMapper.insert(new ApmsTaskMember() {{
                setTaskId(taskId);
                setAthleteId(athleteId);
                setStatus(status);
            }});
        }
    }
}
