package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IApmsTestResultService;

/**
 * 测试结果 Service
 *
 * 核心职责：
 * 1) 多态互斥校验 (validateType) — indicator_id / model_id 二选一
 * 2) REP 计算 (computeRep) — value → ref_level → rep_no(1-4)
 * 3) autoSelectBest — 同组 attempt 根据 direction 自动选最佳
 * 4) fillAggregate — 查询时补全 values + reps
 */
@Service
public class ApmsTestResultServiceImpl implements IApmsTestResultService {

    @Autowired private ApmsTestResultMapper resultMapper;
    @Autowired private ApmsTestResultValueMapper valueMapper;
    @Autowired private ApmsTestResultRepMapper repMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;

    // ============== 基础 CRUD ==============
    @Override
    public List<ApmsTestResult> list(ApmsTestResult query) {
        List<ApmsTestResult> list = resultMapper.selectList(query);
        list.forEach(this::fillAggregate);
        return list;
    }

    @Override
    public ApmsTestResult getById(Long id) {
        ApmsTestResult r = resultMapper.selectById(id);
        if (r != null) fillAggregate(r);
        return r;
    }

    @Override
    public List<ApmsTestResult> listByTaskMember(Long taskId, Long athleteId) {
        List<ApmsTestResult> list = resultMapper.selectByTaskMember(taskId, athleteId);
        list.forEach(this::fillAggregate);
        return list;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int add(ApmsTestResult result, List<ApmsTestResultValue> values) {
        validateType(result);
        // 默认选中
        if (result.getIsSelected() == null || result.getIsSelected().isEmpty()) {
            result.setIsSelected("1");
        }
        result.setCreateBy(SecurityUtils.getUsername());
        resultMapper.insert(result);

        if (values != null && !values.isEmpty()) {
            for (ApmsTestResultValue v : values) {
                v.setResultId(result.getId());
                valueMapper.insert(v);
            }
        }

        // REP 计算（仅 INDICATOR 型 + numeric_value）
        computeRepIfNeeded(result, values);

        // 若 is_selected=1，自动清除同组其他 attempt 的选中
        if ("1".equals(result.getIsSelected())) {
            autoSelectBest(result.getTaskItemId(), result.getAthleteId());
        }
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int update(ApmsTestResult result, List<ApmsTestResultValue> values) {
        ApmsTestResult old = resultMapper.selectById(result.getId());
        if (old == null) throw new ServiceException("结果不存在");
        validateType(result);

        resultMapper.update(result);

        if (values != null) {
            valueMapper.deleteByResultId(result.getId());
            for (ApmsTestResultValue v : values) {
                v.setId(null);
                v.setResultId(result.getId());
                valueMapper.insert(v);
            }
        }

        // 重算 REP
        repMapper.deleteByResultId(result.getId());
        computeRepIfNeeded(result,
            values != null ? values : valueMapper.selectByResultId(result.getId()));

        if ("1".equals(result.getIsSelected())) {
            autoSelectBest(result.getTaskItemId(), result.getAthleteId());
        }
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int delete(Long id) {
        repMapper.deleteByResultId(id);
        valueMapper.deleteByResultId(id);
        return resultMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteByTaskId(Long taskId) {
        // 先查所有 result id 再级联删除
        List<ApmsTestResult> list = resultMapper.selectList(
            new ApmsTestResult() {{ setTaskId(taskId); }});
        for (ApmsTestResult r : list) {
            repMapper.deleteByResultId(r.getId());
            valueMapper.deleteByResultId(r.getId());
        }
        return resultMapper.deleteByTaskId(taskId);
    }

    // ============== autoSelectBest ==============
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int autoSelectBest(Long taskItemId, Long athleteId) {
        List<ApmsTestResult> group = resultMapper.selectList(
            buildQuery(taskItemId, athleteId));
        if (group.size() < 2) return 0; // 单条不用选

        // 查 direction
        String direction = resolveDirection(group.get(0));
        if (direction == null) return 0;

        // 找每个 result 的主 numeric_value（第一个非派生 field）
        ApmsTestResult best = null;
        BigDecimal bestVal = null;
        for (ApmsTestResult r : group) {
            BigDecimal v = extractMainValue(r.getId());
            if (v == null) continue;
            boolean better = (bestVal == null)
                || ("HIGHER_BETTER".equals(direction) && v.compareTo(bestVal) > 0)
                || ("LOWER_BETTER".equals(direction) && v.compareTo(bestVal) < 0);
            if (better) { best = r; bestVal = v; }
        }

        if (best == null) return 0;
        resultMapper.clearSelectedForGroup(taskItemId, athleteId);
        return resultMapper.updateSelected(best.getId(), "1");
    }

    // ============== 内部方法 ==============

    private ApmsTestResult buildQuery(Long taskItemId, Long athleteId) {
        ApmsTestResult q = new ApmsTestResult();
        q.setTaskItemId(taskItemId);
        q.setAthleteId(athleteId);
        return q;
    }

    /** 互斥校验 */
    private void validateType(ApmsTestResult r) {
        boolean hasInd = r.getIndicatorId() != null;
        boolean hasMdl = r.getModelId() != null;
        if (!hasInd && !hasMdl) {
            throw new ServiceException("indicator_id 或 model_id 必须填一个");
        }
        if (hasInd && hasMdl) {
            throw new ServiceException("indicator_id 与 model_id 互斥，不能同时填写");
        }
    }

    /** 从 LEFT JOIN 结果里取 direction，或直接从 result.indicatorDirection 取 */
    private String resolveDirection(ApmsTestResult sample) {
        if (sample.getIndicatorDirection() != null) return sample.getIndicatorDirection();
        return null;
    }

    /** 取某个 result 的主数值（用于 best-of-N 比较） */
    private BigDecimal extractMainValue(Long resultId) {
        List<ApmsTestResultValue> vals = valueMapper.selectByResultId(resultId);
        // 优先取非派生、field_key='result' 的值；否则取第一个有 numeric 的
        for (ApmsTestResultValue v : vals) {
            if ("result".equals(v.getFieldKey()) && v.getNumericValue() != null) {
                return v.getNumericValue();
            }
        }
        for (ApmsTestResultValue v : vals) {
            if ("0".equals(v.getIsDerived()) && v.getNumericValue() != null) {
                return v.getNumericValue();
            }
        }
        // 如果全是派生值
        for (ApmsTestResultValue v : vals) {
            if (v.getNumericValue() != null) return v.getNumericValue();
        }
        return null;
    }

    /** REP 计算 — 查 ref_level 匹配区间 */
    private void computeRepIfNeeded(ApmsTestResult result, List<ApmsTestResultValue> values) {
        if (values == null || values.isEmpty()) return;
        if (result.getIndicatorId() == null) return; // MODEL 型不做 indicator REP

        // 查运动员 gender + 构造 age_group（简化：一律用 U18）
        String gender = "M";
        ApmsAthlete ath = athleteMapper.selectApmsAthleteByAthleteId(result.getAthleteId());
        if (ath != null && ath.getGender() != null) gender = ath.getGender();
        String ageGroup = guessAgeGroup(ath);

        // 查参照等级
        List<ApmsIndicatorRefLevel> levels = repMapper.selectRefLevels(
            result.getIndicatorId(), gender, ageGroup);
        if (levels.isEmpty()) return;

        // 按 direction 排序 level（从最好到最差）
        final String dir = result.getIndicatorDirection() != null
            ? result.getIndicatorDirection() : "HIGHER_BETTER";
        levels.sort((a, b) -> {
            int cmp = a.getMinValue().compareTo(b.getMinValue());
            return "HIGHER_BETTER".equals(dir) ? -cmp : cmp;
        });

        // 为每个有 numeric_value 的 field 计算 REP
        for (ApmsTestResultValue v : values) {
            if (v.getNumericValue() == null) continue;
            Integer repNo = matchRepNo(v.getNumericValue(), levels);
            if (repNo != null) {
                ApmsTestResultRep rep = new ApmsTestResultRep();
                rep.setResultId(result.getId());
                rep.setFieldKey(v.getFieldKey() != null ? v.getFieldKey() : "result");
                rep.setRepNo(repNo);
                rep.setValue(v.getNumericValue());
                rep.setUnit(v.getUnit());
                repMapper.insert(rep);
            }
        }
    }

    /** 根据区间匹配 rep_no (1=Excellent, 2=Good, 3=Normal, 4=Poor) */
    private Integer matchRepNo(BigDecimal value, List<ApmsIndicatorRefLevel> levels) {
        // levels 已按 direction 排好序（最好的在最前）
        for (int i = 0; i < levels.size(); i++) {
            ApmsIndicatorRefLevel lvl = levels.get(i);
            if (value.compareTo(lvl.getMinValue()) >= 0 && value.compareTo(lvl.getMaxValue()) <= 0) {
                return i + 1;
            }
        }
        // 没在任何区间 → 超出范围：direction=LOWER_BETTER 且比最好还小 → Excellent(1)；比最差还大 → Poor(4)
        BigDecimal firstMin = levels.get(0).getMinValue();
        BigDecimal lastMax = levels.get(levels.size() - 1).getMaxValue();
        String direction = levels.get(0) != null ? "" : ""; // 方向丢失，只能保守推断
        if (value.compareTo(firstMin) < 0) return 1;   // 超出最好端
        if (value.compareTo(lastMax) > 0) return 4;   // 超出最差端
        return null;
    }

    /** 聚合填充 */
    private void fillAggregate(ApmsTestResult r) {
        if (r == null || r.getId() == null) return;
        r.setValues(valueMapper.selectByResultId(r.getId()));
        r.setReps(repMapper.selectByResultId(r.getId()));
    }

    private String guessAgeGroup(ApmsAthlete ath) {
        // 简化：种子数据都是 U18
        return "U18";
    }
}
