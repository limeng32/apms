package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsComboModel;
import com.ruoyi.system.domain.apms.ApmsComboComponent;
import com.ruoyi.system.mapper.apms.ApmsComboModelMapper;
import com.ruoyi.system.mapper.apms.ApmsComboComponentMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelMapper;
import com.ruoyi.system.service.apms.IApmsComboModelService;

@Service
public class ApmsComboModelServiceImpl implements IApmsComboModelService {

    @Autowired
    private ApmsComboModelMapper comboMapper;
    @Autowired
    private ApmsComboComponentMapper componentMapper;
    @Autowired
    private ApmsTestModelMapper testModelMapper;

    @Override
    public List<ApmsComboModel> selectList(ApmsComboModel model) {
        return comboMapper.selectList(model);
    }

    @Override
    public ApmsComboModel getDetail(Long id) {
        ApmsComboModel m = comboMapper.selectById(id);
        if (m != null) {
            m.setComponents(componentMapper.selectByComboModelId(id));
        }
        return m;
    }

    @Override
    public int insert(ApmsComboModel model) {
        validateComboEligibility(model.getModelId());
        return comboMapper.insert(model);
    }

    @Override
    public int update(ApmsComboModel model) {
        validateComboEligibility(model.getModelId());
        return comboMapper.update(model);
    }

    @Override
    @Transactional
    public int deleteByIds(Long[] ids) {
        for (Long id : ids) {
            componentMapper.deleteByComboModelId(id);
            comboMapper.deleteByIds(new Long[]{id});
        }
        return ids.length;
    }

    private void validateComboEligibility(Long modelId) {
        if (modelId == null) return;
        ApmsComboModel check = new ApmsComboModel();
        check.setModelId(modelId);
        // 简单验证：test_model 必须存在
        if (testModelMapper.selectById(modelId) == null) {
            throw new ServiceException("关联的测试模型不存在");
        }
    }

    // ====== Component ======

    @Override
    public List<ApmsComboComponent> selectComponents(Long comboModelId) {
        return componentMapper.selectByComboModelId(comboModelId);
    }

    @Override
    public int insertComponent(ApmsComboComponent c) {
        return componentMapper.insert(c);
    }

    @Override
    public int updateComponent(ApmsComboComponent c) {
        return componentMapper.update(c);
    }

    @Override
    public int deleteComponent(Long componentId) {
        return componentMapper.deleteById(componentId);
    }
}
