package com.ruoyi.system.service.apms.impl;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsTestModel;
import com.ruoyi.system.domain.apms.ApmsTestModelField;
import com.ruoyi.system.mapper.apms.ApmsComboModelMapper;
import com.ruoyi.system.mapper.apms.ApmsTaskItemMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelMapper;
import com.ruoyi.system.mapper.apms.ApmsTestModelFieldMapper;
import com.ruoyi.system.mapper.apms.ApmsTestResultMapper;
import com.ruoyi.system.service.apms.IApmsTestModelService;

@Service
public class ApmsTestModelServiceImpl implements IApmsTestModelService {

    @Autowired
    private ApmsTestModelMapper modelMapper;
    @Autowired
    private ApmsTestModelFieldMapper fieldMapper;
    @Autowired
    private ApmsComboModelMapper comboModelMapper;
    @Autowired
    private ApmsTaskItemMapper taskItemMapper;
    @Autowired
    private ApmsTestResultMapper testResultMapper;

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
    @Transactional(rollbackFor = Exception.class)
    public int deleteByIds(Long[] ids) {
        // 删除前引用完整性校验：任一模型被引用即整批拒绝（一个都不删），避免产生孤儿数据
        for (Long id : ids) {
            List<String> refs = new ArrayList<>();
            int comboCnt = comboModelMapper.countByModelId(id);
            if (comboCnt > 0) refs.add(comboCnt + " 个组合评分方案");
            int itemCnt = taskItemMapper.countByModelId(id);
            if (itemCnt > 0) refs.add(itemCnt + " 个测试任务测试项");
            int resultCnt = testResultMapper.countByModelId(id);
            if (resultCnt > 0) refs.add(resultCnt + " 条历史测试成绩");
            if (!refs.isEmpty()) {
                ApmsTestModel m = modelMapper.selectById(id);
                String label = m != null && m.getCode() != null
                        ? m.getCode() + "（" + m.getName() + "）" : String.valueOf(id);
                throw new ServiceException("测试模型「" + label + "」正被 "
                        + String.join("、", refs) + " 引用，请先移除引用后再删除");
            }
        }
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
