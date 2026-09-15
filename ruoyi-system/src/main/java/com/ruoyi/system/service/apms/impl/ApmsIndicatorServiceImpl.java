package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsIndicatorRef;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorRefMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorRefLevelMapper;
import com.ruoyi.system.service.apms.IApmsIndicatorService;

/**
 * 指标库 Service 实现
 */
@Service
public class ApmsIndicatorServiceImpl implements IApmsIndicatorService {

    @Autowired
    private ApmsIndicatorMapper indicatorMapper;

    @Autowired
    private ApmsIndicatorRefMapper refMapper;

    @Autowired
    private ApmsIndicatorRefLevelMapper levelMapper;

    // ===================== Indicator =====================

    @Override
    public List<ApmsIndicator> selectList(ApmsIndicator indicator) {
        return indicatorMapper.selectList(indicator);
    }

    @Override
    public ApmsIndicator selectById(Long id) {
        return indicatorMapper.selectById(id);
    }

    @Override
    public int insert(ApmsIndicator indicator) {
        return indicatorMapper.insert(indicator);
    }

    @Override
    public int update(ApmsIndicator indicator) {
        return indicatorMapper.update(indicator);
    }

    @Override
    @Transactional
    public int deleteByIds(Long[] ids) {
        for (Long id : ids) {
            // 先删 refs 下的 levels
            List<ApmsIndicatorRef> refs = refMapper.selectByIndicatorId(id);
            for (ApmsIndicatorRef r : refs) {
                levelMapper.deleteByRefId(r.getId());
            }
            // 再删 refs
            refMapper.deleteByIndicatorId(id);
            // 最后删 indicator
            indicatorMapper.deleteById(id);
        }
        return ids.length;
    }

    // ===================== 聚合 Detail =====================

    @Override
    public ApmsIndicator getDetail(Long id) {
        ApmsIndicator indicator = indicatorMapper.selectById(id);
        if (indicator == null) return null;

        List<ApmsIndicatorRef> refs = refMapper.selectByIndicatorId(id);
        for (ApmsIndicatorRef ref : refs) {
            ref.setLevels(levelMapper.selectByRefId(ref.getId()));
        }
        indicator.setRefs(refs);
        return indicator;
    }

    // ===================== Ref =====================

    @Override
    public List<ApmsIndicatorRef> selectRefByIndicatorId(Long indicatorId) {
        return refMapper.selectByIndicatorId(indicatorId);
    }

    @Override
    public int insertRef(ApmsIndicatorRef ref) {
        return refMapper.insert(ref);
    }

    @Override
    public int updateRef(ApmsIndicatorRef ref) {
        return refMapper.update(ref);
    }

    @Override
    @Transactional
    public int deleteRef(Long refId) {
        levelMapper.deleteByRefId(refId);
        return refMapper.deleteById(refId);
    }

    @Override
    @Transactional
    public int deleteRefsByIndicatorId(Long indicatorId) {
        for (ApmsIndicatorRef ref : refMapper.selectByIndicatorId(indicatorId)) {
            levelMapper.deleteByRefId(ref.getId());
        }
        return refMapper.deleteByIndicatorId(indicatorId);
    }

    // ===================== Level =====================

    @Override
    public List<ApmsIndicatorRefLevel> selectLevelsByRefId(Long refId) {
        return levelMapper.selectByRefId(refId);
    }

    @Override
    public int insertLevel(ApmsIndicatorRefLevel level) {
        return levelMapper.insert(level);
    }

    @Override
    public int updateLevel(ApmsIndicatorRefLevel level) {
        return levelMapper.update(level);
    }

    @Override
    public int deleteLevel(Long levelId) {
        return levelMapper.deleteById(levelId);
    }

    @Override
    public int deleteLevelsByRefId(Long refId) {
        return levelMapper.deleteByRefId(refId);
    }
}
