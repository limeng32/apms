package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsComboScore;

public interface ApmsComboScoreMapper {
    /** 全局列表（JOIN athlete + combo_model + dept） */
    List<ApmsComboScore> selectList(ApmsComboScore query);

    /** 按运动员 + 模型 + 触发结果查唯一一条 */
    ApmsComboScore selectUnique(Long athleteId, Long comboModelId, Long triggerResultId);

    ApmsComboScore selectById(Long id);

    int insert(ApmsComboScore score);

    /** 删除同 athleteId + comboModelId + triggerResultId 的旧记录（批量计算前清理） */
    int deleteByUnique(Long athleteId, Long comboModelId, Long triggerResultId);

    int deleteById(Long id);
}
