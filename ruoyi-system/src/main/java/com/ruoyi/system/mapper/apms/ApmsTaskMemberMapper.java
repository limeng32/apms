package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTaskMember;

public interface ApmsTaskMemberMapper {
    /** 按 task_id 查询，LEFT JOIN apms_athlete 解析 */
    public List<ApmsTaskMember> selectByTaskId(Long taskId);
    public int insert(ApmsTaskMember m);
    public int update(ApmsTaskMember m);
    public int delete(Long taskId, Long athleteId);
    public int deleteByTaskId(Long taskId);

    /** 进度统计 */
    public int countByTaskAndStatus(Long taskId, String status);
}
