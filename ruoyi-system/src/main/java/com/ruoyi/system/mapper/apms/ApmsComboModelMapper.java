package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsComboModel;

public interface ApmsComboModelMapper {
    public List<ApmsComboModel> selectList(ApmsComboModel model);
    public ApmsComboModel selectById(Long id);
    public int insert(ApmsComboModel model);
    public int update(ApmsComboModel model);
    public int deleteByIds(Long[] ids);
}
