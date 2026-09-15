package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestModel;

public interface ApmsTestModelMapper {
    public List<ApmsTestModel> selectList(ApmsTestModel model);
    public ApmsTestModel selectById(Long id);
    public int insert(ApmsTestModel model);
    public int update(ApmsTestModel model);
    public int deleteByIds(Long[] ids);
}
