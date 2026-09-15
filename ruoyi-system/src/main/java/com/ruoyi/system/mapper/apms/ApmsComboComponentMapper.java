package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsComboComponent;

public interface ApmsComboComponentMapper {
    /** 按 combo_model_id 查询，LEFT JOIN apms_indicator 解析 name/code/unit */
    public List<ApmsComboComponent> selectByComboModelId(Long comboModelId);
    public ApmsComboComponent selectById(Long id);
    public int insert(ApmsComboComponent component);
    public int update(ApmsComboComponent component);
    public int deleteById(Long id);
    public int deleteByComboModelId(Long comboModelId);
}
