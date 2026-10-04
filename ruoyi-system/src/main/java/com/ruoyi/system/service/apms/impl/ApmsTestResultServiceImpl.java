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
import com.ruoyi.system.service.apms.IApmsPhvService;

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
    @Autowired private ApmsTestModelFieldMapper testModelFieldMapper;
    @Autowired private com.ruoyi.system.service.apms.algorithm.ModelAlgorithmRegistry algorithmRegistry;
    @Autowired private ITaskProgressService taskProgressService;
    @Autowired private IBodyMeasureSyncService bodyMeasureSyncService;
    @Autowired private IApmsPhvService phvService;

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
    public List<ApmsTestResult> listFreeGroup(Long athleteId, Long indicatorId, Long modelId) {
        List<ApmsTestResult> list = resultMapper.selectFreeGroup(athleteId, indicatorId, modelId);
        list.forEach(this::fillAggregate);
        return list;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int add(ApmsTestResult result, List<ApmsTestResultValue> values) {
        validateType(result);
        // MODEL 型：按模型字段配置校验/归一采集值（字段角色、必填、类型、单位）
        if ("MODEL".equals(result.getItemType())) prepareModelValues(result, values);
        // 默认选中
        if (result.getIsSelected() == null || result.getIsSelected().isEmpty()) {
            result.setIsSelected("1");
        }
        // 尝试序号：同组（任务项 或 散录同队员+同指标/模型）内递增
        if (result.getAttemptNo() == null) {
            result.setAttemptNo(nextAttemptNo(result));
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

        // 若 is_selected=1，自动重算同组最佳：
        // 任务内成绩按 task_item+队员分组；无任务散录（CSV 不绑任务/设备推送/手动散录）
        // 按 同队员+同指标/模型 且 task_item_id IS NULL 独立分组，禁止跨任务/跨指标串组
        if ("1".equals(result.getIsSelected())) {
            if (result.getTaskItemId() != null) {
                autoSelectBest(result.getTaskItemId(), result.getAthleteId());
            } else {
                autoSelectBestFree(result);
            }
        }

        // 结果写入后，重算任务成员完成状态
        if (result.getTaskId() != null && result.getAthleteId() != null) {
            taskProgressService.recalculate(result.getTaskId(), result.getAthleteId());
        }

        // 如果是体态类指标（HEIGHT/WEIGHT/SIT_HEIGHT等），同步到 body_measure
        bodyMeasureSyncService.syncFromResult(result.getId());

        // 🟢 PHV 自动触发：同步完体态后，尝试 Mirwald 计算
        try { phvService.tryAutoCalculate(result.getAthleteId()); } catch (Exception ignored) {}

        // MODEL 型：按模型绑定的派生算法（algo_id）计算派生字段；无绑定则纯采集
        deriveModelResult(result, values);
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
            if (result.getTaskItemId() != null) {
                autoSelectBest(result.getTaskItemId(), result.getAthleteId());
            } else {
                autoSelectBestFree(result);
            }
        }

        // 结果更新后，重算任务成员完成状态
        if (result.getTaskId() != null && result.getAthleteId() != null) {
            taskProgressService.recalculate(result.getTaskId(), result.getAthleteId());
        }

        // 如果是体态类指标，同步到 body_measure
        bodyMeasureSyncService.syncFromResult(result.getId());

        // 🟢 PHV 自动触发
        try { phvService.tryAutoCalculate(result.getAthleteId()); } catch (Exception ignored) {}

        // MODEL 型：按模型绑定的派生算法重算派生字段
        if ("MODEL".equals(result.getItemType())) {
            deriveModelResult(result, values != null ? values : valueMapper.selectByResultId(result.getId()));
        }
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
        if (group.size() < 2) return 0; // 单条保持已选中

        // 有评价方向（指标）→ 按方向取最优；无方向（模型）→ 最新有效测量自动当选
        ApmsTestResult target = pickRepresentative(group);
        if (target == null) return 0;
        resultMapper.clearSelectedForGroup(taskItemId, athleteId);
        return resultMapper.updateSelected(target.getId(), "1");
    }

    /**
     * 无任务散录成绩的自动选最佳。
     *
     * <p>分组范围：同队员 + 同指标（或同模型）且 task_item_id IS NULL 的记录，
     * 与任务内成绩互不影响。
     */
    private int autoSelectBestFree(ApmsTestResult justAdded) {
        Long athleteId = justAdded.getAthleteId();
        Long indicatorId = "INDICATOR".equals(justAdded.getItemType()) ? justAdded.getIndicatorId() : null;
        Long modelId = indicatorId == null ? justAdded.getModelId() : null;

        List<ApmsTestResult> group = resultMapper.selectFreeGroup(athleteId, indicatorId, modelId);
        if (group.size() < 2) return 0; // 单条保持已选中

        ApmsTestResult target = pickRepresentative(group);
        if (target == null) return 0;
        resultMapper.clearSelectedFreeGroup(athleteId, indicatorId, modelId);
        return resultMapper.updateSelected(target.getId(), "1");
    }

    /**
     * 在同组尝试中选「代表记录」。这与「有没有评价方向」是两件事：
     * <ul>
     *   <li>组内记录有方向（指标）：按方向比主数值，取最优；</li>
     *   <li>组内无方向（模型，系统不知道多少算好）：不做优劣判断，
     *       取最新一次有效测量（measure_date 最大，同日取 id 最大）自动当选，
     *       教练仍可在测试结果页手动改选任意一次。</li>
     * </ul>
     */
    private ApmsTestResult pickRepresentative(List<ApmsTestResult> group) {
        String direction = resolveDirection(group.get(0));
        if (direction == null) {
            return pickLatestValid(group);
        }
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
        return best;
    }

    /** 最新一次有效测量；measure_date 相同取 id 最大（最后录入） */
    private ApmsTestResult pickLatestValid(List<ApmsTestResult> group) {
        ApmsTestResult latest = null;
        for (ApmsTestResult r : group) {
            if ("0".equals(r.getIsValid())) continue;
            if (latest == null) { latest = r; continue; }
            Date d1 = r.getMeasureDate();
            Date d0 = latest.getMeasureDate();
            if (d1 != null && (d0 == null || d1.after(d0) || (d1.equals(d0) && r.getId() > latest.getId()))) {
                latest = r;
            }
        }
        return latest;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void selectAttempt(Long resultId) {
        ApmsTestResult target = resultMapper.selectById(resultId);
        if (target == null) throw new ServiceException("测试结果不存在：id=" + resultId);
        if ("0".equals(target.getIsValid())) {
            throw new ServiceException("无效 attempt 不能被选中（is_valid=0）");
        }
        if (target.getAthleteId() == null) {
            throw new ServiceException("result 缺少 athlete_id，无法确定选择范围");
        }

        if (target.getTaskItemId() == null) {
            // 无任务散录：在 同队员+同指标/模型 且 task_item_id IS NULL 的范围内选择
            Long indicatorId = target.getIndicatorId();
            Long modelId = indicatorId == null ? target.getModelId() : null;
            resultMapper.clearSelectedFreeGroup(target.getAthleteId(), indicatorId, modelId);
            resultMapper.updateSelected(resultId, "1");
            return;
        }

        // 任务内：清同组其他 + 选中目标
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

            // 取消选中后，尝试从剩余 attempt 中选一个最优
            if (old.getAthleteId() != null) {
                if (old.getTaskItemId() != null) {
                    autoSelectBest(old.getTaskItemId(), old.getAthleteId());
                } else {
                    autoSelectBestFree(old);
                }
            }
        }
    }

    // ============== 模型结构化采集：字段校验 + 派生算法分发 ==============

    /**
     * 按 {@code apms_test_model_field} 配置校验并归一 MODEL 结果的采集值。
     * <ul>
     *   <li>模型必须存在、非组合模型（组合模型成绩由综合评分模块产出）；</li>
     *   <li>每个值必须匹配一个已配置字段，且 collect_mode=INPUT（派生字段禁止手填）；</li>
     *   <li>decimal/number 必须为数字；text 可文本；补齐 fieldId/fieldName/unit/modelId/isDerived；</li>
     *   <li>所有必填 INPUT 字段必须有值；至少提交一个采集值。</li>
     * </ul>
     */
    private void prepareModelValues(ApmsTestResult result, List<ApmsTestResultValue> values) {
        if (result.getModelId() == null) throw new ServiceException("模型结果缺少 modelId");
        ApmsTestModel model = testModelMapper.selectById(result.getModelId());
        if (model == null) throw new ServiceException("测试模型不存在：id=" + result.getModelId());
        if ("1".equals(model.getIsCombo())) {
            throw new ServiceException("「" + model.getName() + "」为组合模型，成绩由综合评分模块生成，不支持手工录入");
        }
        List<ApmsTestModelField> fields = testModelFieldMapper.selectByModelId(result.getModelId());
        if (fields == null || fields.isEmpty()) {
            throw new ServiceException("模型「" + model.getName() + "」尚未配置采集字段，无法录入");
        }
        if (values == null || values.isEmpty()) {
            throw new ServiceException("模型「" + model.getName() + "」至少需要填写一项采集数据");
        }

        Map<Long, ApmsTestModelField> byId = new HashMap<>();
        Map<String, ApmsTestModelField> byKey = new HashMap<>();
        for (ApmsTestModelField f : fields) {
            byId.put(f.getId(), f);
            if (f.getFieldKey() != null) byKey.put(f.getFieldKey().trim(), f);
        }
        Set<Long> providedFieldIds = new HashSet<>();

        for (ApmsTestResultValue v : values) {
            ApmsTestModelField f = v.getFieldId() != null ? byId.get(v.getFieldId())
                    : (v.getFieldKey() != null ? byKey.get(v.getFieldKey().trim()) : null);
            if (f == null) {
                throw new ServiceException("字段不在模型「" + model.getName() + "」配置中："
                        + (v.getFieldKey() != null ? v.getFieldKey() : v.getFieldId()));
            }
            if ("DERIVED".equals(f.getCollectMode())) {
                throw new ServiceException("「" + f.getFieldName() + "」由系统自动计算，不允许手工填写");
            }
            String raw = v.getTextValue();
            if (v.getNumericValue() != null) raw = v.getNumericValue().toPlainString();
            boolean empty = raw == null || raw.trim().isEmpty();

            String type = f.getDataType();
            boolean numericType = "decimal".equalsIgnoreCase(type) || "number".equalsIgnoreCase(type);
            if (!empty && numericType) {
                try {
                    new BigDecimal(raw.trim());
                } catch (NumberFormatException e) {
                    throw new ServiceException("「" + f.getFieldName() + "」需要数字，实际为：" + raw);
                }
            }
            // 归一：统一按配置落值
            v.setModelId(result.getModelId());
            v.setIndicatorId(null);
            v.setFieldId(f.getId());
            v.setFieldKey(f.getFieldKey());
            v.setFieldName(f.getFieldName());
            v.setUnit(f.getUnit());
            v.setIsDerived("0");
            if (numericType) {
                v.setNumericValue(empty ? null : new BigDecimal(raw.trim()));
                v.setTextValue(null);
            } else {
                v.setNumericValue(null);
                if (!empty) v.setTextValue(raw.trim());
            }
            if (!empty) providedFieldIds.add(f.getId());
        }

        for (ApmsTestModelField f : fields) {
            if ("INPUT".equals(f.getCollectMode()) && "1".equals(f.getIsRequired())
                    && !providedFieldIds.contains(f.getId())) {
                throw new ServiceException("「" + f.getFieldName() + "」为必填项");
            }
        }
        if (providedFieldIds.isEmpty()) {
            throw new ServiceException("模型「" + model.getName() + "」至少需要填写一项采集数据");
        }
    }

    /**
     * 保存后分发模型派生算法：按 model.algo_id 在算法注册表中查找实现；
     * 未绑定算法的模型为纯采集模型，不产生派生值。
     * 传给算法的原始值只含非派生采集字段，并按字段 sortOrder 升序排列。
     */
    private void deriveModelResult(ApmsTestResult result, List<ApmsTestResultValue> values) {
        if (!"MODEL".equals(result.getItemType()) || result.getModelId() == null) return;
        ApmsTestModel model = testModelMapper.selectById(result.getModelId());
        if (model == null || model.getAlgoId() == null || model.getAlgoId().trim().isEmpty()) return;
        com.ruoyi.system.service.apms.algorithm.ModelDeriveAlgorithm algo =
                algorithmRegistry.get(model.getAlgoId());
        if (algo == null) {
            throw new ServiceException("模型「" + model.getName() + "」绑定的派生算法未注册：" + model.getAlgoId());
        }
        if (values == null || values.isEmpty()) return;

        Map<Long, Integer> sortMap = new HashMap<>();
        for (ApmsTestModelField f : testModelFieldMapper.selectByModelId(result.getModelId())) {
            sortMap.put(f.getId(), f.getSortOrder() == null ? 0 : f.getSortOrder());
        }
        List<ApmsTestResultValue> rawOrdered = values.stream()
                .filter(v -> !"1".equals(v.getIsDerived()))
                .sorted(Comparator.comparingInt(v -> sortMap.getOrDefault(v.getFieldId(), Integer.MAX_VALUE)))
                .collect(Collectors.toList());
        algo.derive(result, rawOrdered);
    }

    // ============== 内部方法 ==============

    private ApmsTestResult buildQuery(Long taskItemId, Long athleteId) {
        ApmsTestResult q = new ApmsTestResult();
        q.setTaskItemId(taskItemId);
        q.setAthleteId(athleteId);
        return q;
    }

    /** 同组内下一个尝试序号（最大 attempt_no + 1，无历史则 1） */
    private int nextAttemptNo(ApmsTestResult result) {
        List<ApmsTestResult> group;
        if (result.getTaskItemId() != null) {
            group = resultMapper.selectList(buildQuery(result.getTaskItemId(), result.getAthleteId()));
        } else {
            Long indicatorId = "INDICATOR".equals(result.getItemType()) ? result.getIndicatorId() : null;
            Long modelId = indicatorId == null ? result.getModelId() : null;
            group = resultMapper.selectFreeGroup(result.getAthleteId(), indicatorId, modelId);
        }
        int max = 0;
        for (ApmsTestResult r : group) {
            if (r.getAttemptNo() != null && r.getAttemptNo() > max) max = r.getAttemptNo();
        }
        return max + 1;
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
        List<ApmsIndicatorRefLevel> allLevels = repMapper.selectRefLevels(
            result.getIndicatorId(), gender, ageGroup);
        if (allLevels.isEmpty()) return;

        // 边界允许为 null（min=null 负无穷 / max=null 正无穷，界面可配开放区间）。
        // 上下限都为 null 的是「尚未配置完成」的草稿档：若参与匹配会吞掉全部成绩，必须剔除。
        List<ApmsIndicatorRefLevel> levels = new ArrayList<>();
        for (ApmsIndicatorRefLevel l : allLevels) {
            if (l.getMinValue() != null || l.getMaxValue() != null) levels.add(l);
        }
        if (levels.isEmpty()) return;

        // 按 direction 排序 level（从最好到最差）；null 下限视为 -∞
        final String dir = result.getIndicatorDirection() != null
            ? result.getIndicatorDirection() : "HIGHER_BETTER";
        Comparator<BigDecimal> nullAsMinusInf = Comparator.nullsFirst(Comparator.naturalOrder());
        levels.sort((a, b) -> {
            int cmp = nullAsMinusInf.compare(a.getMinValue(), b.getMinValue());
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

    /**
     * 根据区间匹配 rep_no（1=最好档，依次递差；levels 已按 direction 从最好到最差排好序）。
     * null 边界按 ±∞ 处理：min=null 不约束下限，max=null 不约束上限。
     */
    private Integer matchRepNo(BigDecimal value, List<ApmsIndicatorRefLevel> levels) {
        for (int i = 0; i < levels.size(); i++) {
            ApmsIndicatorRefLevel lvl = levels.get(i);
            boolean geMin = lvl.getMinValue() == null || value.compareTo(lvl.getMinValue()) >= 0;
            boolean leMax = lvl.getMaxValue() == null || value.compareTo(lvl.getMaxValue()) <= 0;
            if (geMin && leMax) {
                return i + 1;
            }
        }
        // 没在任何区间 → 超出已配置范围：比最好端更好 → 1；比最差端更差 → 末档
        BigDecimal firstMin = levels.get(0).getMinValue();
        BigDecimal lastMax = levels.get(levels.size() - 1).getMaxValue();
        if (firstMin != null && value.compareTo(firstMin) < 0) return 1;
        if (lastMax != null && value.compareTo(lastMax) > 0) return levels.size();
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
