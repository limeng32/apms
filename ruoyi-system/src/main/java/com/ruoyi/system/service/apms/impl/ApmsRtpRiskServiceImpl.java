package com.ruoyi.system.service.apms.impl;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsRtpRiskRule;
import com.ruoyi.system.domain.apms.ApmsRtpRiskSnapshot;
import com.ruoyi.system.domain.apms.dto.RiskEvalResult;
import com.ruoyi.system.domain.apms.dto.RiskFactor;
import com.ruoyi.system.domain.apms.dto.RtpRiskHandleForm;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpRiskRuleMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpRiskSnapshotMapper;
import com.ruoyi.system.service.apms.IApmsRtpService;
import com.ruoyi.system.service.apms.IRtpRiskService;
import com.ruoyi.system.service.apms.RtpRiskEvaluator;

/**
 * RTP 风险预警 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsRtpRiskServiceImpl implements IRtpRiskService {

    private static final Logger log = LoggerFactory.getLogger(ApmsRtpRiskServiceImpl.class);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 快照终态：当日已处理，扫描不得覆盖 */
    private static final List<String> TERMINAL_STATUS = List.of("ACCEPTED", "ACKED", "DISMISSED");

    @Autowired private ApmsRtpRiskSnapshotMapper snapshotMapper;
    @Autowired private ApmsRtpRiskRuleMapper ruleMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private RtpRiskEvaluator evaluator;
    @Autowired private IApmsRtpService rtpService;

    // ============================ 查询 ============================

    @Override
    public List<ApmsRtpRiskSnapshot> selectList(ApmsRtpRiskSnapshot query) {
        applyDefaults(query);
        List<ApmsRtpRiskSnapshot> list = snapshotMapper.selectList(query);
        list.forEach(this::enrich);
        return list;
    }

    @Override
    public ApmsRtpRiskSnapshot getById(Long id) {
        ApmsRtpRiskSnapshot s = snapshotMapper.selectById(id);
        return enrich(s);
    }

    @Override
    public ApmsRtpRiskSnapshot latestByAthlete(Long athleteId) {
        return enrich(snapshotMapper.selectLatestActiveByAthlete(athleteId));
    }

    @Override
    public List<ApmsRtpRiskRule> listRules() {
        return ruleMapper.selectAll();
    }

    @Override
    public Map<String, Object> stat(ApmsRtpRiskSnapshot query) {
        applyDefaults(query);
        List<ApmsRtpRiskSnapshot> list = snapshotMapper.selectList(query);
        Map<String, Object> out = new LinkedHashMap<>();
        int total = 0, warning = 0, attention = 0, infoHealth = 0, processOnly = 0;
        for (ApmsRtpRiskSnapshot s : list) {
            total++;
            switch (s.getSuggestedLevel()) {
                case "WARNING": warning++; break;
                case "ATTENTION": attention++; break;
                default:
                    if ("1".equals(s.getProcessOnly())) {
                        processOnly++;
                    } else {
                        infoHealth++;
                    }
            }
        }
        out.put("total", total);
        out.put("warning", warning);
        out.put("attention", attention);
        out.put("infoHealth", infoHealth);
        out.put("processOnly", processOnly);
        return out;
    }

    private void applyDefaults(ApmsRtpRiskSnapshot query) {
        if (query.getSnapshotDate() == null) {
            query.setSnapshotDate(toDate(LocalDate.now()));
        }
        if (query.getStatusList() == null || query.getStatusList().isEmpty()) {
            query.setStatusList(List.of("ACTIVE"));
        }
    }

    // ============================ 扫描 ============================

    @Override
    public Map<String, Object> scanDaily() {
        LocalDate today = LocalDate.now();
        // 1. 昨日（含更早）未处理 ACTIVE → EXPIRED
        snapshotMapper.expireBefore(toDate(today));

        List<ApmsRtpRiskRule> rules = ruleMapper.selectAllEnabled();
        List<ApmsAthlete> athletes = athleteMapper.selectAllActiveAthletes();

        int withRisk = 0;
        Map<String, Integer> byLevel = new LinkedHashMap<>();
        byLevel.put("WARNING", 0);
        byLevel.put("ATTENTION", 0);
        byLevel.put("INFO", 0);
        for (ApmsAthlete a : athletes) {
            try {
                RiskEvalResult result = evaluateAndUpsert(a, rules, today);
                if (result != null && !RiskEvalResult.NONE.equals(result.getSuggestedLevel())) {
                    withRisk++;
                    byLevel.put(result.getSuggestedLevel(),
                            byLevel.getOrDefault(result.getSuggestedLevel(), 0) + 1);
                }
            } catch (Exception e) {
                // 单人失败不阻断全量扫描
                log.error("[rtp-risk] scanDaily athleteId={} failed: {}", a.getAthleteId(), e.getMessage(), e);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", athletes.size());
        out.put("withRisk", withRisk);
        out.put("byLevel", byLevel);
        log.info("[rtp-risk] scanDaily done: total={}, withRisk={}, byLevel={}", athletes.size(), withRisk, byLevel);
        return out;
    }

    @Override
    public void scanOne(Long athleteId) {
        LocalDate today = LocalDate.now();
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null) {
            return;
        }
        evaluateAndUpsert(athlete, ruleMapper.selectAllEnabled(), today);
    }

    /**
     * 评估并 upsert 当日快照。
     * 不变量：当日快照已处终态（ACCEPTED/ACKED/DISMISSED）时不覆盖——
     * 人工处理结果保留到次日，次日由 scanDaily 置 EXPIRED 后重新评估。
     */
    private RiskEvalResult evaluateAndUpsert(ApmsAthlete athlete, List<ApmsRtpRiskRule> rules, LocalDate today) {
        RiskEvalResult result = evaluator.evaluate(athlete.getAthleteId(), rules, today);

        ApmsRtpRiskSnapshot snapshot = new ApmsRtpRiskSnapshot();
        snapshot.setAthleteId(athlete.getAthleteId());
        snapshot.setDeptId(athlete.getPrimaryTeamId());
        snapshot.setSnapshotDate(toDate(today));
        snapshot.setRiskScore(result.getRiskScore());
        snapshot.setTodoPriority(result.getTodoPriority());
        snapshot.setProcessOnly(result.isProcessOnly() ? "1" : "0");
        snapshot.setSuggestedLevel(result.getSuggestedLevel());
        snapshot.setProcessFlags(writeJson(result.getProcessFlags()));
        snapshot.setFactors(writeJson(result.getFactors()));
        snapshot.setCreateBy(currentUserOr("scan"));

        ApmsRtpRiskSnapshot existing =
                snapshotMapper.selectByAthleteAndDate(athlete.getAthleteId(), toDate(today));
        if (existing == null) {
            try {
                snapshotMapper.insert(snapshot);
            } catch (DuplicateKeyException dup) {
                // 并发扫描：另一线程已插入当日行，退化为 ACTIVE 条件更新
                snapshotMapper.updateIfActive(snapshot);
            }
        } else if (!TERMINAL_STATUS.contains(existing.getStatus())) {
            snapshot.setId(existing.getId());
            snapshotMapper.updateIfActive(snapshot);
        }
        // else 当日终态：保留人工结论，不覆盖
        return result;
    }

    // ============================ 处置 ============================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApmsRtpRiskSnapshot ack(Long id, String remark) {
        ApmsRtpRiskSnapshot current = snapshotMapper.selectById(id);
        if (current == null) {
            throw new ServiceException("风险提示不存在");
        }
        if (!"ACTIVE".equals(current.getStatus())) {
            return enrich(current); // 幂等：已处理直接返回当前态
        }
        if (!RiskEvalResult.INFO.equals(current.getSuggestedLevel())) {
            throw new ServiceException("仅「INFO 健康关注 / 流程提醒」可标记已知悉，ATTENTION/WARNING 请采纳或忽略");
        }
        int rows = doMarkHandled(id, "ACKED", null, remark);
        if (rows == 0) {
            return getById(id);
        }
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApmsRtpRiskSnapshot dismiss(Long id, String remark) {
        if (remark == null || remark.trim().isEmpty()) {
            throw new ServiceException("忽略时必须填写理由");
        }
        ApmsRtpRiskSnapshot current = snapshotMapper.selectById(id);
        if (current == null) {
            throw new ServiceException("风险提示不存在");
        }
        if (!"ACTIVE".equals(current.getStatus())) {
            return enrich(current);
        }
        int rows = doMarkHandled(id, "DISMISSED", null, remark.trim());
        if (rows == 0) {
            return getById(id);
        }
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApmsRtpRiskSnapshot acceptAndApplyRtp(Long id, RtpRiskHandleForm form) {
        // 1. 行锁：串行化同一快照的并发采纳/扫描，彻底消除 upsert 竞争
        ApmsRtpRiskSnapshot snap = snapshotMapper.selectByIdForUpdate(id);
        if (snap == null) {
            throw new ServiceException("风险提示不存在");
        }
        // 幂等：已非 ACTIVE（双击/超时重试）直接返回当前态，不重复写 RTP/log
        if (!"ACTIVE".equals(snap.getStatus())) {
            return enrich(snapshotMapper.selectById(id));
        }

        // 2. 级别校验
        String level = snap.getSuggestedLevel();
        if (RiskEvalResult.ATTENTION.equals(level)) {
            if (!"y".equals(form.getStatus())) {
                throw new ServiceException("ATTENTION 采纳仅允许写入 yellow（限制参训）");
            }
        } else if (RiskEvalResult.WARNING.equals(level)) {
            if (!"r".equals(form.getStatus())) {
                throw new ServiceException("WARNING 采纳仅允许写入 red（不建议训练）");
            }
        } else {
            throw new ServiceException("仅 ATTENTION/WARNING 提示可采纳并更新 RTP，INFO 请知悉或忽略");
        }

        // 3. 不降级校验：采纳是风险升级动作，红→黄/任何→green 一律拒绝
        var currentRtp = rtpService.selectStatusByAthleteId(snap.getAthleteId());
        if (currentRtp != null && statusRank(currentRtp.getStatus()) > statusRank(form.getStatus())) {
            throw new ServiceException("当前为更严格的 RTP 状态（" + rtpLabel(currentRtp.getStatus())
                    + "），无需下调；如需转级请在 RTP 模块主动评估");
        }

        Long athleteId = snap.getAthleteId();

        // 4. 事务提交后再触发重扫（当日快照已 ACCEPTED，扫描只跳过，不覆盖本次结论）
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        scanOne(athleteId);
                    } catch (Exception e) {
                        log.warn("[rtp-risk] afterCommit scanOne athleteId={} failed: {}",
                                athleteId, e.getMessage());
                    }
                }
            });
        }

        // 5+6. 写 RTP + rtp_log（复用现有 upsert，同事务传播 REQUIRED）
        rtpService.updateRtpStatus(athleteId, form.getStatus(), form.getReason(),
                form.getTrainingLimit(), form.getNextReviewDate());

        // 7. 快照置 ACCEPTED（行锁在手，必为 ACTIVE，rows 必为 1）
        int rows = doMarkHandled(id, "ACCEPTED", form.getStatus(),
                form.getRemark() == null ? null : form.getRemark().trim());
        if (rows == 0) {
            throw new ServiceException("该风险提示已被其他操作处理，请刷新后重试");
        }
        return getById(id);
    }

    private int doMarkHandled(Long id, String status, String acceptedStatus, String remark) {
        ApmsRtpRiskSnapshot update = new ApmsRtpRiskSnapshot();
        update.setId(id);
        update.setStatus(status);
        update.setAcceptedStatus(acceptedStatus);
        update.setHandleRemark(remark);
        update.setHandledBy(currentUserOr("system"));
        return snapshotMapper.markHandled(update);
    }

    // ============================ 辅助 ============================

    private ApmsRtpRiskSnapshot enrich(ApmsRtpRiskSnapshot s) {
        if (s == null) {
            return null;
        }
        if (s.getFactors() != null && !s.getFactors().isEmpty()) {
            try {
                s.setFactorList(MAPPER.readValue(s.getFactors(), new TypeReference<List<RiskFactor>>() {}));
            } catch (Exception e) {
                log.warn("[rtp-risk] bad factors json snapshotId={}: {}", s.getId(), e.getMessage());
            }
        }
        if (s.getProcessFlags() != null && !s.getProcessFlags().isEmpty()) {
            try {
                s.setProcessFlagList(MAPPER.readValue(s.getProcessFlags(), new TypeReference<List<String>>() {}));
            } catch (Exception e) {
                log.warn("[rtp-risk] bad process_flags json snapshotId={}: {}", s.getId(), e.getMessage());
            }
        }
        return s;
    }

    private String writeJson(Object o) {
        try {
            return MAPPER.writeValueAsString(o);
        } catch (Exception e) {
            throw new ServiceException("风险快照序列化失败: " + e.getMessage());
        }
    }

    private Date toDate(LocalDate d) {
        return Date.from(d.atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private String currentUserOr(String fallback) {
        try {
            String name = SecurityUtils.getUsername();
            return name != null && !name.isEmpty() ? name : fallback;
        } catch (Exception e) {
            // Quartz 无线程上下文
            return fallback;
        }
    }

    private int statusRank(String status) {
        if ("r".equals(status)) {
            return 3;
        }
        if ("y".equals(status)) {
            return 2;
        }
        if ("g".equals(status)) {
            return 1;
        }
        return 0; // 未评估
    }

    private String rtpLabel(String status) {
        if ("r".equals(status)) {
            return "不建议训练";
        }
        if ("y".equals(status)) {
            return "限制参训";
        }
        if ("g".equals(status)) {
            return "正常参训";
        }
        return "未评估";
    }
}
