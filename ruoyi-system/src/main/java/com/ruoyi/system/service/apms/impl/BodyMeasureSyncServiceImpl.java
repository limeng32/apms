package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IBodyMeasureSyncService;

/**
 * 体态数据同步服务实现
 *
 * <p>
 * 核心逻辑：找到刚写入的 test_result 所属 session_key（或 task_id + measure_date），
 * 拉取同会话下该运动员的所有 result + values，提取 HEIGHT/WEIGHT/SIT_HEIGHT/
 * BODY_FAT_RATE/WAIST 五个体态指标，聚合后 upsert 到 apms_body_measure。
 *
 * <p>
 * 直接依赖 Mapper 层避免循环依赖（不依赖 ApmsTestResultService / ApmsBodyMeasureService）。
 *
 * @author apms
 */
@Service
public class BodyMeasureSyncServiceImpl implements IBodyMeasureSyncService {

    /** 体态指标 code → body_measure 字段名（ApmsBodyMeasure 属性名） */
    private static final Map<String, String> INDICATOR_TO_FIELD = new LinkedHashMap<>();
    static {
        INDICATOR_TO_FIELD.put("HEIGHT",       "height");
        INDICATOR_TO_FIELD.put("WEIGHT",       "weight");
        INDICATOR_TO_FIELD.put("SIT_HEIGHT",   "sitHeight");
        INDICATOR_TO_FIELD.put("BODY_FAT_RATE","bodyFatRate");
        INDICATOR_TO_FIELD.put("WAIST",        "waist");
    }

    /** 反向：ApmsBodyMeasure 字段名 → indicator code */
    private static final Map<String, String> FIELD_TO_INDICATOR = new LinkedHashMap<>();
    static {
        for (Map.Entry<String, String> e : INDICATOR_TO_FIELD.entrySet()) {
            FIELD_TO_INDICATOR.put(e.getValue(), e.getKey());
        }
    }

    /** 体态指标 code 集合 — 快速判空用 */
    private static final Set<String> BODY_MEASURE_CODES = INDICATOR_TO_FIELD.keySet();

    @Autowired private ApmsTestResultMapper      resultMapper;
    @Autowired private ApmsTestResultValueMapper  valueMapper;
    @Autowired private ApmsIndicatorMapper        indicatorMapper;
    @Autowired private ApmsBodyMeasureMapper      measureMapper;

    // ============== 公开接口 ==============

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void syncFromResult(Long resultId) {
        ApmsTestResult source = resultMapper.selectById(resultId);
        if (source == null) return;

        // 先快速过滤：这条 result 是不是体态相关
        if (!isBodyMeasureRelated(source)) return;

        doAggregateAndUpsert(source);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void resyncTaskMember(Long taskId, Long athleteId) {
        ApmsTestResult query = new ApmsTestResult();
        query.setTaskId(taskId);
        query.setAthleteId(athleteId);
        List<ApmsTestResult> allResults = resultMapper.selectList(query);
        if (allResults.isEmpty()) return;

        // 按 session_key 分组（null 归入一组）
        Map<String, List<ApmsTestResult>> bySession = new LinkedHashMap<>();
        for (ApmsTestResult r : allResults) {
            String key = r.getSessionKey() != null ? r.getSessionKey() : "__NO_SESSION__";
            bySession.computeIfAbsent(key, k -> new ArrayList<>()).add(r);
        }

        // 每个 session 单独聚合并 upsert
        for (List<ApmsTestResult> group : bySession.values()) {
            ApmsTestResult first = group.get(0);
            doAggregateAndUpsert(first);
        }
    }

    // ============== 核心聚合逻辑 ==============

    /**
     * 核心方法：给定一个源 result，找到它的"同一次测量会话"范围内所有体态值，聚合 upsert
     */
    private void doAggregateAndUpsert(ApmsTestResult source) {
        Long athleteId = source.getAthleteId();
        Date measureDate = source.getMeasureDate();
        Long taskId = source.getTaskId();
        String sessionKey = source.getSessionKey();

        // 1. 查出同会话内该运动员的所有 result
        List<ApmsTestResult> scopeResults = queryScopeResults(athleteId, taskId, sessionKey, measureDate);

        // 2. 查所有涉及的 indicator code → numeric_value
        Map<String, BigDecimal> bodyValues = collectBodyValues(scopeResults);
        if (bodyValues.isEmpty()) return; // 没有任何体态数据，不写 body_measure

        // 3. 组装 ApmsBodyMeasure 并 upsert
        ApmsBodyMeasure measure = new ApmsBodyMeasure();
        measure.setAthleteId(athleteId);
        measure.setMeasureDate(measureDate != null ? measureDate : source.getMeasureDate());
        measure.setSourceTaskId(taskId);
        measure.setSourceSessionKey(sessionKey);
        measure.setDataSource(taskId != null ? "task" : "manual");

        // 字段填充（按 indicator_code → body_measure_field 映射）
        for (Map.Entry<String, BigDecimal> e : bodyValues.entrySet()) {
            String fieldName = INDICATOR_TO_FIELD.get(e.getKey());
            if (fieldName == null) continue;
            setField(measure, fieldName, e.getValue());
        }

        // 4. 查唯一键是否已存在，决定 insert 还是 update
        ApmsBodyMeasure existing = findMatchingMeasure(measure);
        if (existing != null) {
            measure.setId(existing.getId());
            measureMapper.update(measure);
        } else {
            measureMapper.insert(measure);
        }
    }

    /**
     * 判断一条 test_result 是否与体态指标相关（快速过滤，避免全量聚合）
     *
     * 策略：先查 indicator_id 对应的 code，再看是否在 BODY_MEASURE_CODES 里。
     * MODEL 型 result（model_id != null）暂不识别为体态相关（体态指标都是 INDICATOR 型）。
     */
    private boolean isBodyMeasureRelated(ApmsTestResult r) {
        if (r.getIndicatorId() == null) return false;
        ApmsIndicator ind = indicatorMapper.selectById(r.getIndicatorId());
        if (ind == null) return false;
        return BODY_MEASURE_CODES.contains(ind.getCode());
    }

    /**
     * 查询与源 result 同"测量会话"范围内的所有 result
     *
     * 会话范围定义：
     * - 有 session_key：athlete + session_key（任务流程场景）
     * - 无 session_key 但有 task_id + measure_date：athlete + task_id + measure_date（非 session 场景）
     * - 纯手工录入（task_id=NULL）：athlete + measure_date（同日同运动员）
     */
    private List<ApmsTestResult> queryScopeResults(Long athleteId, Long taskId, String sessionKey, Date measureDate) {
        ApmsTestResult q = new ApmsTestResult();
        q.setAthleteId(athleteId);
        q.setTaskId(taskId);
        if (sessionKey != null && !sessionKey.isEmpty()) {
            q.setSessionKey(sessionKey);
        }
        return resultMapper.selectList(q);
    }

    /**
     * 从 scope 所有 result 的 values 里提取体态指标数值
     * 返回 Map<indicator_code, numeric_value> — 同 code 出现多次时取最后一条
     */
    private Map<String, BigDecimal> collectBodyValues(List<ApmsTestResult> results) {
        Map<String, BigDecimal> collected = new LinkedHashMap<>();

        for (ApmsTestResult r : results) {
            // 非选中的也参与聚合（体态数据没有"最佳 attempt"概念）
            // 只跳过 is_valid=0 的
            if ("0".equals(r.getIsValid())) continue;

            List<ApmsTestResultValue> vals = valueMapper.selectByResultId(r.getId());
            for (ApmsTestResultValue v : vals) {
                if (v.getIndicatorId() == null) continue;
                if (v.getNumericValue() == null) continue;

                ApmsIndicator ind = indicatorMapper.selectById(v.getIndicatorId());
                if (ind == null) continue;
                if (!BODY_MEASURE_CODES.contains(ind.getCode())) continue;

                // 同 code 多次出现，后面的覆盖前面的
                collected.put(ind.getCode(), v.getNumericValue());
            }
        }
        return collected;
    }

    /**
     * 查找与 measure 匹配的已有 body_measure 记录（upsert 条件）
     *
     * 优先级：athlete + task_id + session_key > athlete + measure_date
     */
    private ApmsBodyMeasure findMatchingMeasure(ApmsBodyMeasure measure) {
        // 优先用 selectByUniqueKey（按 athlete_id + measure_date + source_task_id + source_session_key）
        ApmsBodyMeasure found = measureMapper.selectByUniqueKey(measure);
        if (found != null) return found;

        // 回退：同 athlete + 同 measure_date（手工录入场景）
        // selectLatestByAthleteId 不保证同日多条，这里简单扫一下
        List<ApmsBodyMeasure> sameDay = measureMapper.selectList(new ApmsBodyMeasure() {{
            setAthleteId(measure.getAthleteId());
            setMeasureDate(measure.getMeasureDate());
        }});
        // 找 source_task_id 和 source_session_key 都为 null 的那条（纯手工）
        for (ApmsBodyMeasure m : sameDay) {
            if (m.getSourceTaskId() == null && m.getSourceSessionKey() == null) {
                return m;
            }
        }
        return null;
    }

    // ============== 反射辅助（避免引入 reflect 工具类，直接用 setXxx） ==============

    private void setField(ApmsBodyMeasure measure, String fieldName, BigDecimal value) {
        switch (fieldName) {
            case "height":      measure.setHeight(value); break;
            case "weight":      measure.setWeight(value); break;
            case "sitHeight":   measure.setSitHeight(value); break;
            case "bodyFatRate": measure.setBodyFatRate(value); break;
            case "waist":       measure.setWaist(value); break;
            default: break; // 未知字段跳过
        }
    }
}
