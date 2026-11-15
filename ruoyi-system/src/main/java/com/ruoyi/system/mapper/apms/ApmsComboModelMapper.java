package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsComboModel;

public interface ApmsComboModelMapper {
    public List<ApmsComboModel> selectList(ApmsComboModel model);
    public ApmsComboModel selectById(Long id);
    public int insert(ApmsComboModel model);
    public int update(ApmsComboModel model);
    public int deleteByIds(Long[] ids);

    /**
     * 默认互斥：把同 model_id 下除 excludeId 外的方案 is_default 置 0。
     * @param modelId   组合体系载体 id
     * @param excludeId 保留默认的组合模型 id（可为 null，表示全部清零）
     */
    public int clearDefaultByModelId(@org.apache.ibatis.annotations.Param("modelId") Long modelId,
                                     @org.apache.ibatis.annotations.Param("excludeId") Long excludeId);

    /** 统计某测试模型（载体）被多少个组合评分方案引用（删除前引用校验） */
    public int countByModelId(Long modelId);
}
