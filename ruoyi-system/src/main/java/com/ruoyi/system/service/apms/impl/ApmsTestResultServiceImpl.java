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
import com.ruoyi.system.service.apms.ITaskProgressService;
import com.ruoyi.system.service.apms.IBodyMeasureSyncService;
import com.ruoyi.system.util.apms.RsaDecayCalculator;

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
    @Autowired private ApmsTestModelMapper testModelMapper;
    @Autowired private ITaskProgressService taskProgressService;
    @Autowired private IBodyMeasureSyncService bodyMeasureSyncService;

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

        // 结果写入后，重算任务成员完成状态
        if (result.getTaskId() != null && result.getAthleteId() != null) {
            taskProgressService.recalculate(result.getTaskId(), result.getAthleteId());
        }

        // 如果是体态类指标（HEIGHT/WEIGHT/SIT_HEIGHT等），同步到 body_measure
        bodyMeasureSyncService.syncFromResult(result.getId());

        // MODEL 型：自动尝试 RSA 衰减率计算（需要 ≥2 趟 sprint 数据）
        computeRsaDecayIfNeeded(result);
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int update(ApmsTestResult result, List<ApmsTestResultValue> values) {
        ApmsTestResult old = resultMapper.selectById(result.getId());
        if (old == null) throw new ServiceException("结果不存在");
        validateType(result);

        // 如果 is_valid 从 1 变为 0，强制取消 is_selected 并自动选下一个最优
        handleInvalidateAttempt(old, result);

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

        // 结果更新后，重算任务成员完成状态
        if (result.getTaskId() != null && result.getAthleteId() != null) {
            taskProgressService.recalculate(result.getTaskId(), result.getAthleteId());
        }

        // 如果是体态类指标，同步到 body_measure
        bodyMeasureSyncService.syncFromResult(result.getId());

        // MODEL 型：自动尝试 RSA 衰减率计算
        computeRsaDecayIfNeeded(result);
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int delete(Long id) {
        // 先查旧记录，拿到 taskId + athleteId 用于删完后重算进度
        ApmsTestResult old = resultMapper.selectById(id);
        repMapper.deleteByResultId(id);
        valueMapper.deleteByResultId(id);
        int rows = resultMapper.deleteById(id);

        // 删除后，重算该运动员的任务进度（如果这条 result 是某个 task_item 的唯一来源）
        if (old != null && old.getTaskId() != null && old.getAthleteId() != null) {
            taskProgressService.recalculate(old.getTaskId(), old.getAthleteId());
        }
        return rows;
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
        int rows = resultMapper.deleteByTaskId(taskId);

        // 批量删除后，任务所有 member 的进度归零
        taskProgressService.recalculateAll(taskId);
        return rows;
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void selectAttempt(Long resultId) {
        ApmsTestResult target = resultMapper.selectById(resultId);
        if (target == null) throw new ServiceException("测试结果不存在：id=" + resultId);
        if ("0".equals(target.getIsValid())) {
            throw new ServiceException("无效 attempt 不能被选中（is_valid=0）");
        }
        if (target.getTaskItemId() == null || target.getAthleteId() == null) {
            throw new ServiceException("result 缺少 task_item_id 或 athlete_id，无法确定选择范围");
        }

        // 清同组其他 + 选中目标
        resultMapper.clearSelectedForGroup(target.getTaskItemId(), target.getAthleteId());
        resultMapper.updateSelected(resultId, "1");

        // 重算进度
        if (target.getTaskId() != null && target.getAthleteId() != null) {
            taskProgressService.recalculate(target.getTaskId(), target.getAthleteId());
        }
    }

    // ============== update() 中的 is_valid 强制取消选中 ==============
    /**
     * 在 update() 被调时，如果 is_valid 从 1 变到 0，强制取消 is_selected 并尝试自动选下一个最优
     * 必须在事务内执行，保证状态一致性
     */
    private void handleInvalidateAttempt(ApmsTestResult old, ApmsTestResult incoming) {
        // 只处理"从有效变为无效"的场景
        if (!"0".equals(incoming.getIsValid())) return;
        if ("0".equals(old.getIsValid())) return; // 本来就无效

        // 如果旧状态是选中的，必须先取消
        if ("1".equals(old.getIsSelected())) {
            incoming.setIsSelected("0");

            // 取消选中后，尝试让 autoSelectBest 从剩余有效 attempt 中选一个最优
            if (old.getTaskItemId() != null && old.getAthleteId() != null) {
                autoSelectBest(old.getTaskItemId(), old.getAthleteId());
            }
        }
    }

    // ============== RSA 衰减率自动计算 ==============
    /**
     * MODEL 型 result 存完后，尝试自动计算 RSA 衰减率 Sdec
     *
     * 触发条件：result.model_id != null + result.values 中能收集到 ≥2 趟 sprint 时间
     * 结果：Sdec 作为 is_derived=1, algorithm_id='rsa-decay' 的 result_value 存回
     *
     * 设计选择：
     *   - 只对 is_selected=1 的 attempt 计算（Sdec 是模型整体派生值，不随 attempt 变）
     *   - 不依赖 model.code 判断是不是 RSA（任何有 ≥2 个 sprint 类数值的模型都算）
     *   - 读原始输入时排除 is_derived=1 的派生值（避免把旧 Sdec 当输入）
     */
    private void computeRsaDecayIfNeeded(ApmsTestResult result) {
        if (result.getModelId() == null) return;
        if (!"1".equals(result.getIsSelected())) return; // 只给选中 attempt 算

        List<ApmsTestResultValue> vals = valueMapper.selectByResultId(result.getId());
        if (vals.size() < 2) return;

        // 收集所有"非派生 + 有 numeric_value"的数值，按 field_key 排序取前 N 个
        List<BigDecimal> sprintTimes = new ArrayList<>();
        for (ApmsTestResultValue v : vals) {
            if ("1".equals(v.getIsDerived())) continue;  // 跳过已有派生值
            if (v.getNumericValue() == null) continue;
            // 排除明显的"汇总"类 field_key（如 result, total_time 等）
            String fk = v.getFieldKey() != null ? v.getFieldKey().toLowerCase() : "";
            if (fk.startsWith("result") || fk.startsWith("total")
                    || fk.startsWith("average") || fk.startsWith("best")
                    || fk.contains("sdec") || fk.contains("decay")) {
                continue;
            }
            sprintTimes.add(v.getNumericValue());
        }

        if (sprintTimes.size() < 2) return; // 至少 2 趟

        // 计算
        RsaDecayCalculator.Result calc;
        try {
            calc = RsaDecayCalculator.calculate(sprintTimes);
        } catch (IllegalArgumentException e) {
            return; // 参数不合法（比如有 0 或负数），静默跳过
        }

        // 先删旧的 rsa-decay 派生值
        for (ApmsTestResultValue v : vals) {
            if (RsaDecayCalculator.ALGORITHM_ID.equals(v.getAlgorithmId())) {
                valueMapper.deleteById(v.getId());
            }
        }

        // 插入 Sdec 派生值
        ApmsTestResultValue derived = new ApmsTestResultValue();
        derived.setResultId(result.getId());
        derived.setModelId(result.getModelId());
        derived.setFieldKey("rsa_sdec");
        derived.setFieldName("Sdec 衰减率");
        derived.setNumericValue(calc.sdecPercent);
        derived.setUnit("%");
        derived.setIsDerived("1");
        derived.setAlgorithmId(RsaDecayCalculator.ALGORITHM_ID);
        derived.setAlgorithmVersion(RsaDecayCalculator.ALGO_VERSION);
        valueMapper.insert(derived);

        // 额外：best_time / avg_time 也作为派生值存（前面清理循环已删干净，这里纯 insert）
        ApmsTestResultValue derived2 = new ApmsTestResultValue();
        derived2.setResultId(result.getId());
        derived2.setModelId(result.getModelId());
        derived2.setFieldKey("rsa_best_time");
        derived2.setFieldName("最佳成绩");
        derived2.setNumericValue(calc.bestTime);
        derived2.setUnit("s");
        derived2.setIsDerived("1");
        derived2.setAlgorithmId(RsaDecayCalculator.ALGORITHM_ID);
        derived2.setAlgorithmVersion(RsaDecayCalculator.ALGO_VERSION);
        valueMapper.insert(derived2);

        ApmsTestResultValue derived3 = new ApmsTestResultValue();
        derived3.setResultId(result.getId());
        derived3.setModelId(result.getModelId());
        derived3.setFieldKey("rsa_avg_time");
        derived3.setFieldName("平均成绩");
        derived3.setNumericValue(calc.avgTime);
        derived3.setUnit("s");
        derived3.setIsDerived("1");
        derived3.setAlgorithmId(RsaDecayCalculator.ALGORITHM_ID);
        derived3.setAlgorithmVersion(RsaDecayCalculator.ALGO_VERSION);
        valueMapper.insert(derived3);
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

    /**
     * 按 birthday 精确推断年龄段
     *
     * <p>分档（足球青训常规）：
     *   U14  < 14 岁
     *   U16  14 ~ 15 岁
     *   U18  16 ~ 17 岁
     *   U21  18 ~ 20 岁
     *   SENIOR ≥ 21 岁
     *
     * <p>birthday 为空时返回 "SENIOR"（兜底）
     */
    private String guessAgeGroup(ApmsAthlete ath) {
        if (ath == null || ath.getBirthday() == null) return "SENIOR";

        // 两个独立 Calendar —— 不能共用实例
        java.util.Calendar birth = java.util.Calendar.getInstance();
        birth.setTime(ath.getBirthday());
        java.util.Calendar today = java.util.Calendar.getInstance();

        int yearDiff = today.get(java.util.Calendar.YEAR) - birth.get(java.util.Calendar.YEAR);
        // 今年生日还没到 → 减 1
        int mBirth = birth.get(java.util.Calendar.MONTH);
        int dBirth = birth.get(java.util.Calendar.DAY_OF_MONTH);
        int mToday = today.get(java.util.Calendar.MONTH);
        int dToday = today.get(java.util.Calendar.DAY_OF_MONTH);
        if (mToday < mBirth || (mToday == mBirth && dToday < dBirth)) {
            yearDiff--;
        }

        if (yearDiff < 14) return "U14";
        if (yearDiff < 16) return "U16";
        if (yearDiff < 18) return "U18";
        if (yearDiff < 21) return "U21";
        return "SENIOR";
    }
}
