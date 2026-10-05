package com.ruoyi.system.service.apms;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruoyi.system.domain.apms.ApmsMedicalRecord;
import com.ruoyi.system.domain.apms.ApmsPhvRecord;
import com.ruoyi.system.domain.apms.ApmsRtpRiskRule;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.dto.RiskEvalResult;
import com.ruoyi.system.domain.apms.dto.RiskFactor;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsMedicalRecordMapper;
import com.ruoyi.system.mapper.apms.ApmsPhvRecordMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpRiskRuleMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpStatusMapper;

/**
 * RTP 风险评估引擎（无状态 Spring 组件）。
 *
 * 计分入口先按 kind 切开：PROCESS 因子不进 healthScore（汇总逻辑见 RiskEvalResult.summarize）。
 * 阈值一期为常量，后续迁配置：INFO 3 / ATTENTION 6 / WARNING 9。
 *
 * @author apms
 */
@Component
public class RtpRiskEvaluator {

    private static final Logger log = LoggerFactory.getLogger(RtpRiskEvaluator.class);

    /** 健康分阈值 */
    public static final int SCORE_INFO = 3;
    public static final int SCORE_ATTENTION = 6;
    public static final int SCORE_WARNING = 9;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired private ApmsRtpRiskRuleMapper ruleMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsRtpStatusMapper rtpStatusMapper;
    @Autowired private ApmsMedicalRecordMapper medicalMapper;
    @Autowired private ApmsPhvRecordMapper phvMapper;

    /** 事件增量入口：取当日启用规则 + 今日重算单个运动员 */
    public RiskEvalResult evaluate(Long athleteId) {
        return evaluate(athleteId, ruleMapper.selectAllEnabled(), LocalDate.now());
    }

    /** 扫描主入口：规则由调用方当日加载一次 */
    public RiskEvalResult evaluate(Long athleteId, List<ApmsRtpRiskRule> rules, LocalDate today) {
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null) {
            return RiskEvalResult.summarize(new ArrayList<>(), SCORE_INFO, SCORE_ATTENTION, SCORE_WARNING);
        }
        ApmsRtpStatus rtp = rtpStatusMapper.selectByAthleteId(athleteId);
        ApmsMedicalRecord medQuery = new ApmsMedicalRecord();
        medQuery.setAthleteId(athleteId);
        List<ApmsMedicalRecord> medicals = medicalMapper.selectList(medQuery);
        ApmsPhvRecord latestPhv = phvMapper.selectLatestByAthleteId(athleteId);
        return evaluateData(athlete, rtp, medicals, latestPhv, rules, today);
    }

    /**
     * 纯数据评估（无 DB 访问）：规则策略 + 汇总。可见性包级，便于轻量断言验证。
     */
    public RiskEvalResult evaluateData(ApmsAthlete athlete, ApmsRtpStatus rtp,
                                       List<ApmsMedicalRecord> medicals, ApmsPhvRecord latestPhv,
                                       List<ApmsRtpRiskRule> rules, LocalDate today) {
        List<RiskFactor> factors = new ArrayList<>();
        if (rules != null) {
            for (ApmsRtpRiskRule rule : rules) {
                try {
                    RiskFactor f = runRule(rule, athlete, rtp, medicals, latestPhv, today);
                    if (f != null) {
                        factors.add(f);
                    }
                } catch (Exception e) {
                    // 单条规则异常不阻断当日整体评估
                    log.warn("[rtp-risk] rule {} evaluate failed, athleteId={}: {}",
                            rule.getRuleCode(), athlete.getAthleteId(), e.getMessage(), e);
                }
            }
        }
        return RiskEvalResult.summarize(factors, SCORE_INFO, SCORE_ATTENTION, SCORE_WARNING);
    }

    private RiskFactor runRule(ApmsRtpRiskRule rule, ApmsAthlete athlete, ApmsRtpStatus rtp,
                               List<ApmsMedicalRecord> medicals, ApmsPhvRecord latestPhv,
                               LocalDate today) {
        JsonNode params = parseParams(rule.getParams());
        switch (rule.getRuleCode()) {
            case "REVIEW_OVERDUE":
                return evalReviewOverdue(rule, rtp, today, params);
            case "REVIEW_SOON":
                return evalReviewSoon(rule, rtp, today, params);
            case "INJURY_OPEN":
                return evalInjuryOpen(rule, medicals, today, params);
            case "PHV_PEAK":
                return evalPhvPeak(rule, latestPhv, today, params);
            default:
                // 未知规则（如未来的 TEST_DECLINE）静默，不报错
                return null;
        }
    }

    // ============================ 流程因子 ============================

    private RiskFactor evalReviewOverdue(ApmsRtpRiskRule rule, ApmsRtpStatus rtp,
                                         LocalDate today, JsonNode params) {
        LocalDate review = toLocalDate(rtp == null ? null : rtp.getNextReviewDate());
        if (review == null || !review.isBefore(today)) {
            return null;
        }
        long daysOverdue = ChronoUnit.DAYS.between(review, today);
        RiskFactor f = baseFactor(rule);
        f.setTitle("RTP复检已逾期");
        f.setDetail("复检日 " + review + "，已逾期 " + daysOverdue
                + " 天（流程待办，不参与健康风险评分），请尽快安排复检");
        f.getRefData().put("nextReviewDate", review.toString());
        f.getRefData().put("daysOverdue", daysOverdue);
        return f;
    }

    private RiskFactor evalReviewSoon(ApmsRtpRiskRule rule, ApmsRtpStatus rtp,
                                      LocalDate today, JsonNode params) {
        LocalDate review = toLocalDate(rtp == null ? null : rtp.getNextReviewDate());
        if (review == null || review.isBefore(today)) {
            // 与 OVERDUE 互斥：已逾期时不再报临近
            return null;
        }
        int soonDays = intParam(params, "reviewSoonDays", 14);
        long daysUntil = ChronoUnit.DAYS.between(today, review);
        if (daysUntil < 0 || daysUntil > soonDays) {
            return null;
        }
        RiskFactor f = baseFactor(rule);
        f.setTitle("RTP复检临近");
        f.setDetail("复检日 " + review + "，还有 " + daysUntil
                + " 天到期（流程待办，不参与健康风险评分），请提前安排");
        f.getRefData().put("nextReviewDate", review.toString());
        f.getRefData().put("daysUntil", daysUntil);
        return f;
    }

    // ============================ 健康因子 ============================

    private RiskFactor evalInjuryOpen(ApmsRtpRiskRule rule, List<ApmsMedicalRecord> medicals,
                                      LocalDate today, JsonNode params) {
        if (medicals == null || medicals.isEmpty()) {
            return null;
        }
        int injuryWindowDays = intParam(params, "injuryWindowDays", 45);
        int closureWindowDays = intParam(params, "closureWindowDays", 90);

        // 列表按 record_date DESC：最近一次 injury/surgery 即候选
        ApmsMedicalRecord issue = null;
        for (ApmsMedicalRecord r : medicals) {
            if ("injury".equals(r.getRecordType()) || "surgery".equals(r.getRecordType())) {
                issue = r;
                break;
            }
        }
        if (issue == null) {
            return null;
        }
        LocalDate issueDate = toLocalDate(issue.getRecordDate());
        if (issueDate == null) {
            return null;
        }
        long ageDays = ChronoUnit.DAYS.between(issueDate, today);
        if (ageDays > closureWindowDays) {
            return null; // 旧伤过期，静默
        }
        // 其后存在更晚（含同日）的 rehabilitation/checkup → 视为已闭环
        for (ApmsMedicalRecord r : medicals) {
            LocalDate d = toLocalDate(r.getRecordDate());
            if (d == null) {
                continue;
            }
            if (("rehabilitation".equals(r.getRecordType()) || "checkup".equals(r.getRecordType()))
                    && !d.isBefore(issueDate)) {
                return null;
            }
        }
        if (ageDays > injuryWindowDays) {
            return null; // 45~90 天的未闭环旧伤本期不提示
        }

        RiskFactor f = baseFactor(rule);
        boolean surgery = "surgery".equals(issue.getRecordType());
        if (surgery) {
            // 引擎按记录子类型覆盖默认严重度/紧迫度/forceWarning，覆盖结果随快照可追溯
            f.setSeverity(3);
            f.setUrgency(3);
            f.setForceWarning(true);
            f.setTitle("术后未检测到康复/复查记录");
            f.setDetail(issueDate + " 有手术记录" + appendTitle(issue)
                    + "，其后无康复或复查记录，建议停训就医评估（供参考）。"
                    + "未检测到康复/复查记录，请人工核实");
        } else {
            f.setTitle("伤病未检测到康复/复查记录");
            f.setDetail(issueDate + " 有伤病记录" + appendTitle(issue)
                    + "，其后无康复或复查记录，建议关注恢复情况、必要时限制参训（供参考）。"
                    + "未检测到康复/复查记录，请人工核实");
        }
        f.getRefData().put("recordType", issue.getRecordType());
        f.getRefData().put("recordDate", issueDate.toString());
        f.getRefData().put("recordTitle", issue.getTitle());
        f.getRefData().put("ageDays", ageDays);
        return f;
    }

    private RiskFactor evalPhvPeak(ApmsRtpRiskRule rule, ApmsPhvRecord latestPhv,
                                   LocalDate today, JsonNode params) {
        if (latestPhv == null || latestPhv.getMaturityOffset() == null
                || latestPhv.getMeasureDate() == null) {
            return null;
        }
        BigDecimal band = decimalParam(params, "phvPeakBand", new BigDecimal("0.5"));
        int freshDays = intParam(params, "phvFreshDays", 180);

        BigDecimal offset = latestPhv.getMaturityOffset();
        LocalDate measureDate = toLocalDate(latestPhv.getMeasureDate());
        if (measureDate == null || offset.abs().compareTo(band) > 0) {
            return null;
        }
        long ageDays = ChronoUnit.DAYS.between(measureDate, today);
        if (ageDays > freshDays) {
            return null;
        }
        RiskFactor f = baseFactor(rule);
        f.setTitle("身高突增峰期");
        f.setDetail("最新 PHV 成熟度偏移 " + offset.stripTrailingZeros().toPlainString()
                + "（测量日 " + measureDate + "），处于身高突增峰期带（±" + band.stripTrailingZeros().toPlainString()
                + "），训练安排请注意生长发育风险（供参考）");
        f.getRefData().put("maturityOffset", offset);
        f.getRefData().put("measureDate", measureDate.toString());
        f.getRefData().put("ageDays", ageDays);
        return f;
    }

    // ============================ 辅助 ============================

    private RiskFactor baseFactor(ApmsRtpRiskRule rule) {
        RiskFactor f = new RiskFactor(rule.getRuleCode(), rule.getKind());
        f.setSeverity(rule.getSeverity() == null ? 0 : rule.getSeverity());
        f.setUrgency(rule.getUrgency() == null ? 1 : rule.getUrgency());
        f.setForceWarning("1".equals(rule.getForceWarning()));
        f.setWeight(rule.getWeight() == null ? BigDecimal.ONE : rule.getWeight());
        return f;
    }

    private String appendTitle(ApmsMedicalRecord r) {
        return r.getTitle() != null && !r.getTitle().isEmpty() ? "（" + r.getTitle() + "）" : "";
    }

    private JsonNode parseParams(String json) {
        if (json == null || json.isEmpty()) {
            return MAPPER.createObjectNode();
        }
        try {
            return MAPPER.readTree(json);
        } catch (Exception e) {
            log.warn("[rtp-risk] bad rule params json: {}", json);
            return MAPPER.createObjectNode();
        }
    }

    private int intParam(JsonNode node, String key, int fallback) {
        JsonNode v = node == null ? null : node.get(key);
        return v != null && v.isNumber() ? v.asInt() : fallback;
    }

    private BigDecimal decimalParam(JsonNode node, String key, BigDecimal fallback) {
        JsonNode v = node == null ? null : node.get(key);
        return v != null && v.isNumber() ? v.decimalValue() : fallback;
    }

    private LocalDate toLocalDate(Date date) {
        if (date == null) {
            return null;
        }
        // MyBatis DATE 列映射为 java.sql.Date，其 toInstant() 会抛 UnsupportedOperationException
        if (date instanceof java.sql.Date) {
            return ((java.sql.Date) date).toLocalDate();
        }
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }
}
