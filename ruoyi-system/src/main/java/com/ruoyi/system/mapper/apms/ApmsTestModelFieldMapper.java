package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestModelField;

public interface ApmsTestModelFieldMapper {
    public List<ApmsTestModelField> selectByModelId(Long modelId);
    public ApmsTestModelField selectById(Long id);
    public int insert(ApmsTestModelField field);
    public int update(ApmsTestModelField field);
    public int deleteById(Long id);
    public int deleteByModelId(Long modelId);
}
