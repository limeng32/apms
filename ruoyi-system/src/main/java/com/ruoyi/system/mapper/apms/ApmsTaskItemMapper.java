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

    /** 统计某测试模型被多少个 MODEL 型任务测试项引用（删除前引用校验） */
    public int countByModelId(Long modelId);
}
