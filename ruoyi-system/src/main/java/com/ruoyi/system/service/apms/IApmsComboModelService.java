package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsComboModel;
import com.ruoyi.system.domain.apms.ApmsComboComponent;

public interface IApmsComboModelService {
    List<ApmsComboModel> selectList(ApmsComboModel model);
    ApmsComboModel getDetail(Long id);
    int insert(ApmsComboModel model);
    int update(ApmsComboModel model);
    int deleteByIds(Long[] ids);

    // component
    List<ApmsComboComponent> selectComponents(Long comboModelId);
    int insertComponent(ApmsComboComponent c);
    int updateComponent(ApmsComboComponent c);
    int deleteComponent(Long componentId);
}
