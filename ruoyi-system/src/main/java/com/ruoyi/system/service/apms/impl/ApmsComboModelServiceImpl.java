package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.system.domain.apms.ApmsComboModel;
import com.ruoyi.system.domain.apms.ApmsComboComponent;
import com.ruoyi.system.domain.apms.ApmsTestModel;
import com.ruoyi.system.mapper.apms.ApmsComboModelMapper;
import com.ruoyi.system.mapper.apms.ApmsComboComponentMapper;
import com.ruoyi.system.mapper.apms.ApmsComboScoreMapper;
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
    @Autowired
    private ApmsComboScoreMapper comboScoreMapper;

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
    @Transactional(rollbackFor = Exception.class)
    public int insert(ApmsComboModel model) {
        // 新建组合体系模式：同事务先创建 is_combo=1 的测试模型载体，再创建组合模型
        if (StringUtils.isNotEmpty(model.getNewModelCode()) || StringUtils.isNotEmpty(model.getNewModelName())) {
            String code = model.getNewModelCode() == null ? null : model.getNewModelCode().trim();
            String name = model.getNewModelName() == null ? null : model.getNewModelName().trim();
            if (StringUtils.isEmpty(code) || StringUtils.isEmpty(name)) {
                throw new ServiceException("组合体系的编码和名称均不能为空");
            }
            if (testModelMapper.selectByCode(code) != null) {
                throw new ServiceException("模型编码已存在：" + code);
            }
            ApmsTestModel carrier = new ApmsTestModel();
            carrier.setCategory("组合");
            carrier.setCode(code);
            carrier.setName(name);
            carrier.setIsCombo("1");
            carrier.setStatus("0");
            testModelMapper.insert(carrier);
            model.setModelId(carrier.getId());
            // 载体字段不入库 apms_combo_model，避免 MyBatis 未知列风险（XML 未引用即忽略，显式置空更清晰）
            model.setNewModelCode(null);
            model.setNewModelName(null);
        } else {
            validateComboEligibility(model.getModelId());
        }
        normalizeLabel(model);
        normalizeStatus(model);
        applyDefaultOnInsert(model);
        return comboMapper.insert(model);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int update(ApmsComboModel model) {
        // 编辑不支持新建载体，忽略新建字段，只校验已关联模型
        model.setNewModelCode(null);
        model.setNewModelName(null);
        validateComboEligibility(model.getModelId());
        ApmsComboModel old = comboMapper.selectById(model.getId());
        if (old == null) {
            throw new ServiceException("组合模型不存在");
        }
        normalizeLabel(model);
        // 停用保护：默认方案不允许直接停用，须先把同体系其他方案设为默认
        if ("1".equals(model.getStatus()) && "1".equals(old.getIsDefault())) {
            throw new ServiceException("默认方案不能停用，请先将同体系下其他方案设为默认");
        }
        normalizeStatus(model);
        // 默认标记：置 1 先清同载体其他行；置 0 时若本行原是默认则拒绝（每个体系必须保留一个默认）
        if ("1".equals(model.getIsDefault())) {
            comboMapper.clearDefaultByModelId(model.getModelId(), model.getId());
            model.setIsDefault("1");
        } else {
            if ("1".equals(old.getIsDefault())) {
                throw new ServiceException("该体系下必须保留一个默认方案，请先将其他方案设为默认");
            }
            model.setIsDefault("0");
        }
        return comboMapper.update(model);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteByIds(Long[] ids) {
        // 删除前引用校验：已有历史评分的方案拒绝物理删除，避免产生孤儿评分；请改用「停用」保留可追溯
        for (Long id : ids) {
            int scoreCnt = comboScoreMapper.countByComboModelId(id);
            if (scoreCnt > 0) {
                ApmsComboModel m = comboMapper.selectById(id);
                String label = m != null && m.getVersionLabel() != null
                        ? m.getVersionLabel() : String.valueOf(id);
                throw new ServiceException("评分方案「" + label + "」已产生 " + scoreCnt
                        + " 条历史评分记录，不能删除；如不再使用请改为「停用」，历史评分将保留可追溯");
            }
        }
        for (Long id : ids) {
            componentMapper.deleteByComboModelId(id);
            comboMapper.deleteByIds(new Long[]{id});
        }
        return ids.length;
    }

    /** 方案名称必填并去首尾空白（物理列可空，业务层强校验） */
    private void normalizeLabel(ApmsComboModel model) {
        String label = model.getVersionLabel() == null ? "" : model.getVersionLabel().trim();
        if (label.isEmpty()) {
            throw new ServiceException("请输入方案名称");
        }
        model.setVersionLabel(label);
    }

    /** 状态归一：仅接受 '1'（停用），其余一律按 '0'（启用）处理 */
    private void normalizeStatus(ApmsComboModel model) {
        model.setStatus("1".equals(model.getStatus()) ? "1" : "0");
    }

    /**
     * 新增时的默认标记规则：
     * 显式要求默认、或该载体下尚无任何默认方案时，本行置默认并清同载体其他行；
     * 新建载体场景载体全新，必然走到置默认分支。
     */
    private void applyDefaultOnInsert(ApmsComboModel model) {
        boolean wantDefault = "1".equals(model.getIsDefault());
        if (wantDefault || !existsDefault(model.getModelId())) {
            comboMapper.clearDefaultByModelId(model.getModelId(), null);
            model.setIsDefault("1");
        } else {
            model.setIsDefault("0");
        }
    }

    /** 该载体下是否已存在默认方案 */
    private boolean existsDefault(Long modelId) {
        ApmsComboModel query = new ApmsComboModel();
        query.setModelId(modelId);
        return comboMapper.selectList(query).stream()
                .anyMatch(m -> "1".equals(m.getIsDefault()));
    }

    private void validateComboEligibility(Long modelId) {
        if (modelId == null) {
            throw new ServiceException("请选择关联的测试模型");
        }
        ApmsTestModel testModel = testModelMapper.selectById(modelId);
        if (testModel == null) {
            throw new ServiceException("关联的测试模型不存在");
        }
        // 后端资格强校验：只有 is_combo=1 的测试模型可作为组合体系，前端过滤可被直调绕过
        if (!"1".equals(testModel.getIsCombo())) {
            throw new ServiceException("所选测试模型不是组合类模型（is_combo=1），无法关联");
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
