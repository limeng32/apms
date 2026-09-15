package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTaskItem;

public interface ApmsTaskItemMapper {
    /** 按 task_id 查询，LEFT JOIN indicator + test_model 解析 */
    public List<ApmsTaskItem> selectByTaskId(Long taskId);
    public ApmsTaskItem selectById(Long id);
    public int insert(ApmsTaskItem item);
    public int update(ApmsTaskItem item);
    public int deleteById(Long id);
    public int deleteByTaskId(Long taskId);
}
