package com.ruoyi.system.service.apms.impl;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsIndicatorRef;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorRefMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorRefLevelMapper;
import com.ruoyi.system.service.apms.IApmsIndicatorService;
import com.ruoyi.system.service.apms.impl.IndicatorRefLevelValidator;
import java.util.ArrayList;

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

    @Autowired
    private IndicatorRefLevelValidator levelValidator;

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
        normalizeIndicator(indicator);
        if (indicatorMapper.selectByCode(indicator.getCode()) != null) {
            throw new ServiceException("指标编码 [" + indicator.getCode() + "] 已存在");
        }
        return indicatorMapper.insert(indicator);
    }

    @Override
    public int update(ApmsIndicator indicator) {
        if (indicator.getId() == null || indicatorMapper.selectById(indicator.getId()) == null) {
            throw new ServiceException("指标不存在或已被删除");
        }
        normalizeIndicator(indicator);
        return indicatorMapper.update(indicator);
    }

    /** 指标必填字段规范化与校验（code 仅新增可设，update SQL 本身也不改 code 列） */
    private void normalizeIndicator(ApmsIndicator indicator) {
        if (indicator == null) throw new ServiceException("参数为空");
        if (StringUtils.isBlank(indicator.getCode())) throw new ServiceException("指标编码不能为空");
        if (StringUtils.isBlank(indicator.getName())) throw new ServiceException("指标名称不能为空");
        if (StringUtils.isBlank(indicator.getEvaluationDirection())) {
            throw new ServiceException("评价方向不能为空");
        }
        indicator.setCode(indicator.getCode().trim().toUpperCase(Locale.ROOT));
        indicator.setName(indicator.getName().trim());
        if (indicator.getStatus() == null) indicator.setStatus("0");
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
        normalizeRef(ref);
        if (indicatorMapper.selectById(ref.getIndicatorId()) == null) {
            throw new ServiceException("所属指标不存在或已被删除");
        }
        checkRefDuplicate(ref, null);
        return refMapper.insert(ref);
    }

    @Override
    public int updateRef(ApmsIndicatorRef ref) {
        if (ref.getId() == null || refMapper.selectById(ref.getId()) == null) {
            throw new ServiceException("参考范围不存在或已被删除");
        }
        normalizeRef(ref);
        checkRefDuplicate(ref, ref.getId());
        return refMapper.update(ref);
    }

    /** 规范化：空串性别/年龄组/版本统一为 null，避免同口径多条数据 */
    private void normalizeRef(ApmsIndicatorRef ref) {
        if (ref == null || ref.getIndicatorId() == null) {
            throw new ServiceException("参考范围必须归属一个指标");
        }
        if (ref.getGender() != null && ref.getGender().trim().isEmpty()) ref.setGender(null);
        if (ref.getGender() != null) ref.setGender(ref.getGender().trim().toUpperCase(Locale.ROOT));
        if (ref.getAgeGroup() != null) {
            String ageGroup = ref.getAgeGroup().trim();
            ref.setAgeGroup(ageGroup.isEmpty() ? null : ageGroup.toUpperCase(Locale.ROOT));
        }
        if (ref.getModelVersion() != null && ref.getModelVersion().trim().isEmpty()) {
            ref.setModelVersion(null);
        }
        if (ref.getRefMin() != null && ref.getRefMax() != null
            && ref.getRefMin().compareTo(ref.getRefMax()) > 0) {
            throw new ServiceException("参考下限不能大于参考上限");
        }
    }

    /** 同一指标下 性别 + 年龄组 口径不得重复（NULL 视为通用，大小写不敏感逐条比较） */
    private void checkRefDuplicate(ApmsIndicatorRef ref, Long excludeId) {
        for (ApmsIndicatorRef existing : refMapper.selectByIndicatorId(ref.getIndicatorId())) {
            if (excludeId != null && existing.getId().equals(excludeId)) continue;
            if (Objects.equals(normKey(existing.getGender()), normKey(ref.getGender()))
                && Objects.equals(normKey(existing.getAgeGroup()), normKey(ref.getAgeGroup()))) {
                throw new ServiceException("该指标下已存在相同性别/年龄组口径的参考范围");
            }
        }
    }

    private static String trimToNull(String s) {
        return (s == null || s.trim().isEmpty()) ? null : s.trim();
    }

    /** 口径比较键：trim + 大写，避免 M/m、u18/U18 被当成不同口径 */
    private static String normKey(String s) {
        String t = trimToNull(s);
        return t == null ? null : t.toUpperCase(Locale.ROOT);
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
        normalizeLevel(level);
        // 校验：同 refId 下所有 levels + 新 level
        List<ApmsIndicatorRefLevel> all = levelMapper.selectByRefId(level.getRefId());
        List<ApmsIndicatorRefLevel> toValidate = new ArrayList<>(all);
        toValidate.add(level);
        levelValidator.validate(toValidate);
        return levelMapper.insert(level);
    }

    @Override
    public int updateLevel(ApmsIndicatorRefLevel level) {
        if (level.getId() == null) throw new ServiceException("评级条目 ID 不能为空");
        ApmsIndicatorRefLevel existing = levelMapper.selectById(level.getId());
        if (existing == null) throw new ServiceException("评级条目不存在或已被删除");
        normalizeLevel(level);
        // refId 以库中既有值为准，防止跨参考范围挪动
        level.setRefId(existing.getRefId());
        // 校验：同 refId 下所有 levels，替换当前 level
        List<ApmsIndicatorRefLevel> all = levelMapper.selectByRefId(existing.getRefId());
        List<ApmsIndicatorRefLevel> toValidate = new ArrayList<>();
        for (ApmsIndicatorRefLevel l : all) {
            if (l.getId().equals(level.getId())) {
                toValidate.add(level); // 替换为新版本
            } else {
                toValidate.add(l);
            }
        }
        levelValidator.validate(toValidate);
        return levelMapper.update(level);
    }

    /** 评级名称统一去空白、大写（GOOD/EXCELLENT 等枚举码约定） */
    private void normalizeLevel(ApmsIndicatorRefLevel level) {
        if (level == null || level.getRefId() == null) {
            throw new ServiceException("评级必须归属一个参考范围");
        }
        if (StringUtils.isBlank(level.getLevel())) {
            throw new ServiceException("评级名称不能为空");
        }
        level.setLevel(level.getLevel().trim().toUpperCase(Locale.ROOT));
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
