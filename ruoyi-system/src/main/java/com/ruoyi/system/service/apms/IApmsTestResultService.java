package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;

/**
 * 测试结果 Service 接口
 */
public interface IApmsTestResultService {
    List<ApmsTestResult> list(ApmsTestResult query);
    ApmsTestResult getById(Long id);
    List<ApmsTestResult> listByTaskMember(Long taskId, Long athleteId);

    int add(ApmsTestResult result, List<ApmsTestResultValue> values);
    int update(ApmsTestResult result, List<ApmsTestResultValue> values);
    int delete(Long id);
    int deleteByTaskId(Long taskId);

    /** 同组 attempt 根据 indicator evaluation_direction 自动选最佳 (is_selected) */
    int autoSelectBest(Long taskItemId, Long athleteId);
}
