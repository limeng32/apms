package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsTestResult;

/**
 * 测试结果主表 Mapper
 */
public interface ApmsTestResultMapper {
    ApmsTestResult selectById(Long id);
    List<ApmsTestResult> selectList(ApmsTestResult query);

    /** 查某 task_member 的所有 result（含多 attempt） */
    List<ApmsTestResult> selectByTaskMember(@Param("taskId") Long taskId, @Param("athleteId") Long athleteId);

    /** 查某 task_item 下所有已选中的 result（is_selected=1） */
    List<ApmsTestResult> selectSelectedByTaskItem(Long taskItemId);

    int insert(ApmsTestResult result);
    int update(ApmsTestResult result);

    /** 取消同组 attempt 的选中（为 autoSelectBest 做准备） */
    int clearSelectedForGroup(@Param("taskItemId") Long taskItemId, @Param("athleteId") Long athleteId);

    /** 更新 attempt 的 is_selected */
    int updateSelected(@Param("id") Long id, @Param("isSelected") String isSelected);

    int deleteById(Long id);
    int deleteByTaskId(Long taskId);
}
