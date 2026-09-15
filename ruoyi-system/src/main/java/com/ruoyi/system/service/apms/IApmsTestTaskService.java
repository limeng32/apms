package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestTask;
import com.ruoyi.system.domain.apms.ApmsTaskItem;
import com.ruoyi.system.domain.apms.ApmsTaskMember;

public interface IApmsTestTaskService {
    List<ApmsTestTask> selectList(ApmsTestTask task);
    ApmsTestTask getDetail(Long id);
    int insert(ApmsTestTask task);
    int update(ApmsTestTask task);
    int deleteByIds(Long[] ids);

    // task item
    List<ApmsTaskItem> selectItems(Long taskId);
    int insertItem(ApmsTaskItem item);
    int updateItem(ApmsTaskItem item);
    int deleteItem(Long itemId);

    // task member
    List<ApmsTaskMember> selectMembers(Long taskId);
    int enrollMember(Long taskId, Long athleteId);
    int batchEnroll(Long taskId, List<Long> athleteIds);
    int updateMemberStatus(Long taskId, Long athleteId, String status);
    int removeMember(Long taskId, Long athleteId);

    /** 重算 task_member 状态（供 P3 测试结果写入后调用） */
    void recalculateMemberStatus(Long taskId, Long athleteId);

    /** 填充进度派生字段到 task 对象上 */
    void fillProgress(ApmsTestTask task);
}
