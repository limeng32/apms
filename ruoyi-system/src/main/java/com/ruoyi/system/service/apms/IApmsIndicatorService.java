package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsIndicatorRef;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;

/**
 * 指标库 Service
 */
public interface IApmsIndicatorService {

    /** 列表查询（扁平，不含 refs） */
    List<ApmsIndicator> selectList(ApmsIndicator indicator);

    /** 聚合详情：indicator + refs[] + 每个 ref 的 levels[] */
    ApmsIndicator getDetail(Long id);

    ApmsIndicator selectById(Long id);

    /** indicator */
    int insert(ApmsIndicator indicator);
    int update(ApmsIndicator indicator);
    int deleteByIds(Long[] ids);

    /** ref */
    List<ApmsIndicatorRef> selectRefByIndicatorId(Long indicatorId);
    int insertRef(ApmsIndicatorRef ref);
    int updateRef(ApmsIndicatorRef ref);
    int deleteRef(Long refId);
    int deleteRefsByIndicatorId(Long indicatorId);

    /** ref_level */
    List<ApmsIndicatorRefLevel> selectLevelsByRefId(Long refId);
    int insertLevel(ApmsIndicatorRefLevel level);
    int updateLevel(ApmsIndicatorRefLevel level);
    int deleteLevel(Long levelId);
    int deleteLevelsByRefId(Long refId);
}
