package com.ruoyi.system.service.apms.batchimport;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.system.domain.apms.ApmsTestTask;
import com.ruoyi.system.mapper.apms.ApmsTestTaskMapper;

/**
 * 批量导入：带数据权限的测试任务查询（独立 bean 保证 @DataScope 代理生效）。
 *
 * @author apms
 */
@Component
public class TaskScopeQuery {

    @Autowired
    private ApmsTestTaskMapper taskMapper;

    /** 任务 id 在当前用户数据权限内时返回任务，否则 null */
    @DataScope(deptAlias = "t", deptField = "target_dept_id")
    public ApmsTestTask findScopedById(ApmsTestTask query) {
        return taskMapper.selectScopedById(query);
    }
}
