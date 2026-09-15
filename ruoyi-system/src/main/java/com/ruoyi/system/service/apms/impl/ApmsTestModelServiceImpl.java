package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.system.domain.apms.ApmsTestModel;
import com.ruoyi.system.domain.apms.ApmsTestModelField;
import com.ruoyi.system.mapper.apms.ApmsTestModelMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelFieldMapper;
import com.ruoyi.system.service.apms.IApmsTestModelService;

@Service
public class ApmsTestModelServiceImpl implements IApmsTestModelService {

    @Autowired
    private ApmsTestModelMapper modelMapper;
    @Autowired
    private ApmsTestModelFieldMapper fieldMapper;

    @Override
    public List<ApmsTestModel> selectList(ApmsTestModel model) {
        return modelMapper.selectList(model);
    }

    @Override
    public ApmsTestModel getDetail(Long id) {
        ApmsTestModel m = modelMapper.selectById(id);
        if (m != null) {
            m.setFields(fieldMapper.selectByModelId(id));
        }
        return m;
    }

    @Override
    public int insert(ApmsTestModel model) { return modelMapper.insert(model); }

    @Override
    public int update(ApmsTestModel model) { return modelMapper.update(model); }

    @Override
    @Transactional
    public int deleteByIds(Long[] ids) {
        for (Long id : ids) {
            fieldMapper.deleteByModelId(id);
            modelMapper.deleteByIds(new Long[]{id});
        }
        return ids.length;
    }

    @Override
    public List<ApmsTestModelField> selectFieldsByModelId(Long modelId) {
        return fieldMapper.selectByModelId(modelId);
    }

    @Override
    public int insertField(ApmsTestModelField field) { return fieldMapper.insert(field); }

    @Override
    public int updateField(ApmsTestModelField field) { return fieldMapper.update(field); }

    @Override
    public int deleteField(Long fieldId) { return fieldMapper.deleteById(fieldId); }
}
