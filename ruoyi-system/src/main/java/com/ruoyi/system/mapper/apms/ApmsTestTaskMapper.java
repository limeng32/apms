package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestTask;

public interface ApmsTestTaskMapper {
    public List<ApmsTestTask> selectList(ApmsTestTask task);
    public ApmsTestTask selectById(Long id);

    /** 批量导入：按 id 查询 + @DataScope 数据权限（params.dataScope，别名 t） */
    public ApmsTestTask selectScopedById(ApmsTestTask query);
    public int insert(ApmsTestTask task);
    public int update(ApmsTestTask task);
    public int deleteByIds(Long[] ids);
}
