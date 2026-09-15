package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestTask;

public interface ApmsTestTaskMapper {
    public List<ApmsTestTask> selectList(ApmsTestTask task);
    public ApmsTestTask selectById(Long id);
    public int insert(ApmsTestTask task);
    public int update(ApmsTestTask task);
    public int deleteByIds(Long[] ids);
}
