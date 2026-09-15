package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsTestModel;
import com.ruoyi.system.domain.apms.ApmsTestModelField;

/**
 * 测试模型库 Service
 */
public interface IApmsTestModelService {

    List<ApmsTestModel> selectList(ApmsTestModel model);

    /** 聚合详情：model + fields[] */
    ApmsTestModel getDetail(Long id);

    int insert(ApmsTestModel model);
    int update(ApmsTestModel model);
    int deleteByIds(Long[] ids);

    // field
    List<ApmsTestModelField> selectFieldsByModelId(Long modelId);
    int insertField(ApmsTestModelField field);
    int updateField(ApmsTestModelField field);
    int deleteField(Long fieldId);
}
