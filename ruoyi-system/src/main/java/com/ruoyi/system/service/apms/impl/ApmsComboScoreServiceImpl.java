package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IApmsComboScoreService;
import com.ruoyi.system.util.apms.ComboScoreCalculator;

@Service
public class ApmsComboScoreServiceImpl implements IApmsComboScoreService {

    @Autowired private ApmsComboScoreMapper scoreMapper;
    @Autowired private ApmsComboModelMapper modelMapper;
    @Autowired private ApmsComboComponentMapper componentMapper;
    @Autowired private ApmsTestResultMapper testResultMapper;
    @Autowired private ApmsTestResultValueMapper valueMapper;
    @Autowired private ApmsIndicatorRefMapper indicatorRefMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsIndicatorMapper indicatorMapper;

    @Override
    public List<ApmsComboScore> list(ApmsComboScore query) {
        return scoreMapper.selectList(query);
    }
    @Override public ApmsComboScore selectById(Long id) { return scoreMapper.selectById(id); }
    @Override public int deleteById(Long id) { return scoreMapper.deleteById(id); }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchResult batchCalculate(Long comboModelId, Long taskId) {
        ApmsComboModel model = modelMapper.selectById(comboModelId);
        if (model == null) throw new ServiceException("组合模型不存在: id=" + comboModelId);
        List<ApmsComboComponent> components = componentMapper.selectByComboModelId(comboModelId);
        if (components.isEmpty()) throw new ServiceException("组合模型无 component");

        // 1. 该 task 下 is_selected='1' 的所有 test_result
        //    test_result 粒度是 (athlete, indicator) — 每个运动员有 N 条 result
        ApmsTestResult query = new ApmsTestResult();
        query.setTaskId(taskId);
        query.setIsSelected("1");
        List<ApmsTestResult> selected = testResultMapper.selectList(query);
        if (selected.isEmpty()) throw new ServiceException("该 task 下无 is_selected 结果");

        // 收集所有 result_id + 按 athleteId 聚合 triggerResultId（用第一条）
        List<Long> allResultIds = new ArrayList<>();
        Map<Long, Long> athleteTriggerResultId = new LinkedHashMap<>();
        for (ApmsTestResult r : selected) {
            allResultIds.add(r.getId());
            athleteTriggerResultId.putIfAbsent(r.getAthleteId(), r.getId());
        }

        // 2. 查所有 result_value，按 (athleteId, indicatorId) 聚合
        //    先建 result_id → athleteId 的映射
        Map<Long, Long> resultToAthlete = new HashMap<>();
        for (ApmsTestResult r : selected) resultToAthlete.put(r.getId(), r.getAthleteId());

        // 查每个 result 的 values
        Map<Long, Map<Long, BigDecimal>> athleteValues = new HashMap<>();
        Map<Long, Map<Long, String>> athleteFieldKeys = new HashMap<>(); // 记录是哪个 field_key 的值
        for (Long rid : allResultIds) {
            Long athleteId = resultToAthlete.get(rid);
            List<ApmsTestResultValue> vals = valueMapper.selectByResultId(rid);
            for (ApmsTestResultValue v : vals) {
                if (v.getNumericValue() != null && v.getIndicatorId() != null) {
                    athleteValues
                        .computeIfAbsent(athleteId, k -> new HashMap<>())
                        .merge(v.getIndicatorId(), v.getNumericValue(), (oldVal, newVal) -> {
                            // "result" 优先，否则保留第一个
                            String oldFk = athleteFieldKeys.getOrDefault(athleteId, Collections.emptyMap())
                                .get(v.getIndicatorId());
                            if ("result".equals(v.getFieldKey()) || oldFk == null) {
                                athleteFieldKeys
                                    .computeIfAbsent(athleteId, k -> new HashMap<>())
                                    .put(v.getIndicatorId(), v.getFieldKey());
                                return newVal;
                            }
                            return oldVal;
                        });
                }
            }
        }

        // 收集 athleteIds 列表
        List<Long> athleteIds = new ArrayList<>(athleteTriggerResultId.keySet());

        // 3. 查 ref 阈值：按 component.indicatorId 预加载所有 indicator_ref
        Map<Long, List<ApmsIndicatorRef>> refCache = new HashMap<>();
        for (ApmsComboComponent comp : components) {
            List<ApmsIndicatorRef> refs = indicatorRefMapper.selectByIndicatorId(comp.getIndicatorId());
            refCache.put(comp.getIndicatorId(), refs);
        }

        // 4. 查 indicator evaluation_direction（用于 direction_override 为空时的 fallback）
        Map<Long, String> directionCache = new HashMap<>();
        List<Long> indicatorIds = components.stream()
                .map(ApmsComboComponent::getIndicatorId).collect(Collectors.toList());
        if (!indicatorIds.isEmpty()) {
            List<ApmsIndicator> inds = indicatorMapper.selectList(new ApmsIndicator());
            for (ApmsIndicator ind : inds) directionCache.put(ind.getId(), ind.getEvaluationDirection());
        }

        // 5. 查 athlete gender
        Map<Long, ApmsAthlete> athleteMap = new HashMap<>();
        List<ApmsAthlete> allAthletes = athleteMapper.selectApmsAthleteList(new ApmsAthlete());
        for (ApmsAthlete a : allAthletes) athleteMap.put(a.getAthleteId(), a);

        // 6. 逐人计算
        BatchResult result = new BatchResult();
        result.items = new ArrayList<>();
        result.algoVersion = ComboScoreCalculator.ALGO_VERSION;
        result.totalAthletes = athleteTriggerResultId.size();
        int success = 0, skip = 0;

        for (Long athleteId : athleteTriggerResultId.keySet()) {
            Long triggerResultId = athleteTriggerResultId.get(athleteId);
            ApmsAthlete athlete = athleteMap.get(athleteId);

            BatchResult.AthleteItem item = new BatchResult.AthleteItem();
            item.athleteId = athleteId;
            item.athleteName = athlete != null ? athlete.getName() : "?";

            List<ComboScoreCalculator.ComponentInput> inputs = new ArrayList<>();
            Map<Long, BigDecimal> vals = athleteValues.getOrDefault(athleteId, Collections.emptyMap());
            String gender = athlete != null ? athlete.getGender() : "M";

            for (ApmsComboComponent comp : components) {
                ComboScoreCalculator.ComponentInput ci = new ComboScoreCalculator.ComponentInput();
                ci.componentId = comp.getId();
                ci.indicatorId = comp.getIndicatorId();
                ci.indicatorName = directionCache.getOrDefault(comp.getIndicatorId(), "");
                ci.weight = comp.getWeight();
                ci.direction = resolveDirection(comp, directionCache);
                ci.value = vals.get(comp.getIndicatorId());

                List<ApmsIndicatorRef> refs = refCache.getOrDefault(comp.getIndicatorId(), Collections.emptyList());
                ApmsIndicatorRef ref = findBestRef(refs, gender);
                if (ref != null) {
                    ci.refMin = ref.getRefMin();
                    ci.refMax = ref.getRefMax();
                }
                inputs.add(ci);
            }

            ComboScoreCalculator.Result calc = ComboScoreCalculator.calculate(inputs);

            if (calc.comboScore != null && calc.coveredCount >= 2) {
                scoreMapper.deleteByUnique(athleteId, comboModelId, triggerResultId);

                ApmsComboScore score = new ApmsComboScore();
                score.setComboModelId(comboModelId);
                score.setAthleteId(athleteId);
                score.setTriggerResultId(triggerResultId);
                score.setComboScore(calc.comboScore);
                score.setRefSnapshot(calc.buildRefSnapshot());
                score.setAlgoVersion(calc.algoVersion);
                score.setCalculatedAt(new Date());
                scoreMapper.insert(score);

                item.comboScore = calc.comboScore.doubleValue();
                item.status = "OK";
                item.reason = calc.coveredCount + "/" + inputs.size() + " components";
                success++;
            } else {
                item.status = "SKIP";
                item.reason = calc.comboScore == null ? "无有效指标值" : "覆盖不足";
                skip++;
            }
            result.items.add(item);
        }
        result.successCount = success;
        result.skipCount = skip;
        return result;
    }

    @Override public void recalculate(Long athleteId, Long comboModelId, Long triggerResultId) { /* 复用 batchCalculate */ }

    // ============= helpers =============

    private String resolveDirection(ApmsComboComponent comp, Map<Long, String> directionCache) {
        String o = comp.getDirectionOverride();
        if (o != null && !o.isEmpty() && !"0".equals(o)) {
            return o;
        }
        return directionCache.getOrDefault(comp.getIndicatorId(), "HIGHER_BETTER");
    }

    private ApmsIndicatorRef findBestRef(List<ApmsIndicatorRef> refs, String gender) {
        if (refs.isEmpty()) return null;
        // 精确匹配
        for (ApmsIndicatorRef r : refs) {
            if (gender.equalsIgnoreCase(r.getGender() == null ? "" : r.getGender())) return r;
        }
        // 回退 gender 为空的
        for (ApmsIndicatorRef r : refs) {
            if (r.getGender() == null || r.getGender().isEmpty()) return r;
        }
        return refs.get(0);
    }
}
