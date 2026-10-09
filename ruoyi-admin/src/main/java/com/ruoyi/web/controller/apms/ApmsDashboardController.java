package com.ruoyi.web.controller.apms;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.domain.apms.dto.RiskFactor;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IRtpRiskService;
import com.ruoyi.system.service.apms.RtpRiskEvaluator;

/**
 * 团队数据看板 — 单 API 返回所有聚合数据
 */
@RestController
@RequestMapping("/apms/dashboard")
public class ApmsDashboardController extends BaseController {

    @Autowired private ApmsComboScoreMapper scoreMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsPhvRecordMapper phvMapper;
    @Autowired private ApmsBodyMeasureMapper bodyMapper;
    @Autowired private ApmsTestTaskMapper taskMapper;
    @Autowired private ApmsTestResultMapper resultMapper;
    @Autowired private ApmsIndicatorRefMapper refMapper;
    @Autowired private ApmsRtpStatusMapper rtpMapper;
    @Autowired private ApmsMedicalRecordMapper medicalMapper;
    @Autowired private RtpRiskEvaluator riskEvaluator;
    @Autowired private IRtpRiskService rtpRiskService;

    /**
     * GET /apms/dashboard/stats — 首页统计（被 ruoyi-ui/src/views/index.vue 调用）
     */
    @GetMapping("/stats")
    public AjaxResult stats() {
        Map<String, Object> root = new LinkedHashMap<>();

        // --- stats 对象 ---
        Map<String, Object> stats = new LinkedHashMap<>();

        // 运动员总数
        List<ApmsAthlete> athletes = athleteMapper.selectApmsAthleteList(new ApmsAthlete());
        stats.put("athleteCount", athletes.size());

        // 队伍（去重后）
        Set<String> teams = new LinkedHashSet<>();
        for (ApmsAthlete a : athletes) if (a.getTeamName() != null) teams.add(a.getTeamName());
        stats.put("teamList", String.join(" / ", teams.isEmpty() ? new String[]{"—"} : teams.toArray(new String[0])));

        // 任务状态分布
        List<ApmsTestTask> tasks = taskMapper.selectList(new ApmsTestTask());
        int inProgress = 0, pending = 0, completed = 0;
        for (ApmsTestTask t : tasks) {
            if ("completed".equals(t.getStatus())) completed++;
            else if ("in_progress".equals(t.getStatus())) inProgress++;
            else pending++;
        }
        stats.put("taskInProgressCount", inProgress);
        stats.put("taskPendingCount", pending);
        stats.put("taskCompletedCount", completed);

        // RTP 状态分布
        List<ApmsRtpStatus> rtpList = rtpMapper.selectList();
        int rtpGreen = 0, rtpYellow = 0, rtpRed = 0;
        Set<Long> rtpAthleteIds = new HashSet<>();
        for (ApmsRtpStatus r : rtpList) {
            rtpAthleteIds.add(r.getAthleteId());
            String s = r.getStatus() == null ? "" : r.getStatus().toLowerCase();
            if (s.contains("green") || s.contains("绿") || "0".equals(s)) rtpGreen++;
            else if (s.contains("yellow") || s.contains("黄") || "1".equals(s)) rtpYellow++;
            else if (s.contains("red") || s.contains("红") || "2".equals(s)) rtpRed++;
            else rtpGreen++; // 默认 green
        }
        // "未评估" = 运动员总数 − 有 RTP 记录的
        int rtpNotAssessed = (int) athletes.stream()
            .filter(a -> !rtpAthleteIds.contains(a.getAthleteId())).count();
        stats.put("rtpGreenCount", rtpGreen);
        stats.put("rtpYellowCount", rtpYellow);
        stats.put("rtpRedCount", rtpRed);
        stats.put("rtpNotAssessedCount", rtpNotAssessed);

        // 本周新增测量（body + phv 最近 7 天）
        java.sql.Date weekAgo = new java.sql.Date(System.currentTimeMillis() - 7L * 86400000);
        int bodyWeek = 0, phvWeek = 0;
        for (ApmsBodyMeasure b : bodyMapper.selectList(new ApmsBodyMeasure())) {
            if (b.getMeasureDate() != null && !b.getMeasureDate().before(weekAgo)) bodyWeek++;
        }
        for (ApmsPhvRecord p : phvMapper.selectList(new ApmsPhvRecord())) {
            if (p.getMeasureDate() != null && !p.getMeasureDate().before(weekAgo)) phvWeek++;
        }
        stats.put("bodyMeasureWeekCount", bodyWeek);
        stats.put("phvWeekCount", phvWeek);

        root.put("stats", stats);

        // --- 任务列表（取最近 5 个） ---
        List<Map<String, Object>> taskList = new ArrayList<>();
        tasks.sort((a, b) -> {
            if (b.getStartDate() == null) return -1;
            if (a.getStartDate() == null) return 1;
            return b.getStartDate().compareTo(a.getStartDate());
        });
        int tk = Math.min(tasks.size(), 5);
        for (int i = 0; i < tk; i++) {
            ApmsTestTask t = tasks.get(i);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("taskId", t.getId());
            row.put("taskName", t.getTaskName());

            // 统一口径：运动员维度
            ApmsTestResult rq = new ApmsTestResult();
            rq.setTaskId(t.getId());
            List<ApmsTestResult> results = resultMapper.selectList(rq);
            Set<Long> allAthleteIds = new HashSet<>();
            Set<Long> completedAthleteIds = new HashSet<>(); // 有至少 1 个 selected=true 结果
            for (ApmsTestResult r : results) {
                allAthleteIds.add(r.getAthleteId());
                if ("1".equals(r.getIsSelected())) completedAthleteIds.add(r.getAthleteId());
            }
            long totalDistinct = allAthleteIds.size();
            long completedDistinct = completedAthleteIds.size();
            int prog = totalDistinct > 0 ? (int) Math.round(completedDistinct * 100.0 / totalDistinct) : 0;

            row.put("completedCount", completedDistinct);
            row.put("totalCount", totalDistinct);
            row.put("progress", prog);
            row.put("teamName", t.getTargetDeptId() != null ? String.valueOf(t.getTargetDeptId()) : "—");
            row.put("startDate", t.getStartDate());
            row.put("endDate", t.getEndDate());
            taskList.add(row);
        }
        root.put("taskList", taskList);

        // --- RTP 关注名单（Yellow + Red + 未评估，最多 6 人） ---
        List<Map<String, Object>> rtpAttention = new ArrayList<>();
        Map<Long, ApmsAthlete> athMap = new HashMap<>();
        for (ApmsAthlete a : athletes) athMap.put(a.getAthleteId(), a);

        // 1. 先加黄/红状态的（先跳过 green 的，但要记住哪些已经有 RTP 记录了）
        Set<Long> addedIds = new HashSet<>();
        Set<Long> allRtpAthleteIds = new HashSet<>();
        for (ApmsRtpStatus r : rtpList) {
            allRtpAthleteIds.add(r.getAthleteId());
            String s = r.getStatus() == null ? "" : r.getStatus().toLowerCase();
            boolean isAttention = s.contains("yellow") || s.contains("黄") || "1".equals(s)
                    || s.contains("red") || s.contains("红") || "2".equals(s);
            if (!isAttention) continue;

            ApmsAthlete a = athMap.get(r.getAthleteId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", r.getAthleteId());
            row.put("athleteName", a != null ? a.getName() : "—");
            row.put("position", a != null ? a.getPosition() : null);
            row.put("status", "yellow".equals(s) || "y".equals(s) || "1".equals(s) ? "yellow" : "red");
            rtpAttention.add(row);
            addedIds.add(r.getAthleteId());
        }

        // 2. 补未评估成员（没有 rtp_status 记录的 athlete ≠ green）
        for (ApmsAthlete a : athletes) {
            if (allRtpAthleteIds.contains(a.getAthleteId())) continue; // 已有 RTP 记录（包括 green）
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", a.getAthleteId());
            row.put("athleteName", a.getName());
            row.put("position", a.getPosition());
            row.put("status", "none");
            rtpAttention.add(row);
            if (rtpAttention.size() >= 6) break;
        }
        // 最多 6 人
        if (rtpAttention.size() > 6) rtpAttention = rtpAttention.subList(0, 6);
        root.put("rtpList", rtpAttention);

        return success(root);
    }

    /**
     * GET /apms/dashboard/overview
     * 返回看板全部数据：顶部汇总 + 4 个图表数据源
     */
    @GetMapping("/overview")
    @DataScope(deptAlias = "d")
    public AjaxResult overview(ApmsComboScore query) {
        // 触发 DataScope — 用一个空查询先拿到已过滤的 score 列表，再用其 athleteIds 关联后续数据
        // 简化：直接注入一个 params 让 DataScope 生效在 combo_score 子查询上
        Map<String, Object> data = new LinkedHashMap<>();

        // ========= 1. 组合分排名（TOP N 柱状图数据源） =========
        List<Map<String, Object>> comboScoreRanking = new ArrayList<>();
        List<ApmsComboScore> allScores = scoreMapper.selectList(query);
        // 带 JOIN 再查一次拿 name/team
        List<ApmsComboScore> voList = scoreMapper.selectList(query); // 已带 JOIN 字段
        // 排序取前 10
        voList.sort((a, b) -> {
            if (a.getComboScore() == null) return 1;
            if (b.getComboScore() == null) return -1;
            return b.getComboScore().compareTo(a.getComboScore());
        });
        int topN = Math.min(voList.size(), 10);
        for (int i = 0; i < topN; i++) {
            ApmsComboScore s = voList.get(i);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", s.getAthleteId());
            row.put("athleteName", s.getAthleteName());
            row.put("athleteTeam", s.getAthleteTeam());
            row.put("comboScore", s.getComboScore());
            comboScoreRanking.add(row);
        }

        // ========= 2. 指标雷达图（取每个运动员的 ref_snapshot breakdown） =========
        List<Map<String, Object>> indicatorRadar = buildRadar(voList);

        // ========= 3. PHV 成熟度散点图 =========
        List<ApmsPhvRecord> phvList = phvMapper.selectList(new ApmsPhvRecord());
        List<Map<String, Object>> phvScatter = new ArrayList<>();
        Set<Long> phvAthleteIds = new HashSet<>();
        for (ApmsPhvRecord p : phvList) {
            if (p.getPredictedPhvAge() != null && p.getDecimalAge() != null) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("athleteId", p.getAthleteId());
                row.put("decimalAge", p.getDecimalAge());
                row.put("predictedPhvAge", p.getPredictedPhvAge());
                row.put("maturityOffset", p.getMaturityOffset());
                phvScatter.add(row);
                phvAthleteIds.add(p.getAthleteId());
            }
        }

        // 补充 athlete name/team
        enrichAthleteInfo(phvScatter);

        // ========= 4. 测试任务完成率 =========
        List<ApmsTestTask> tasks = taskMapper.selectList(new ApmsTestTask());
        List<Map<String, Object>> taskCompletion = new ArrayList<>();
        for (ApmsTestTask t : tasks) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("taskId", t.getId());
            row.put("taskName", t.getTaskName());
            row.put("startDate", t.getStartDate());
            row.put("status", t.getStatus());
            ApmsTestResult rq = new ApmsTestResult();
            rq.setTaskId(t.getId());
            List<ApmsTestResult> results = resultMapper.selectList(rq);
            long selected = results.stream().filter(r -> "1".equals(r.getIsSelected())).count();
            Set<Long> athleteIds = new HashSet<>();
            for (ApmsTestResult r : results) athleteIds.add(r.getAthleteId());
            row.put("resultCount", results.size());
            row.put("athleteCount", athleteIds.size());
            row.put("selectedCount", selected);
            row.put("testerName", t.getTesterName());
            taskCompletion.add(row);
        }

        // ========= 5. 顶部汇总 =========
        Map<String, Object> summary = new LinkedHashMap<>();
        int totalAthletes = voList.isEmpty() ? 0 : (int) voList.stream().map(ApmsComboScore::getAthleteId).distinct().count();
        BigDecimal avgScore = BigDecimal.ZERO;
        if (!voList.isEmpty()) {
            BigDecimal sum = BigDecimal.ZERO;
            int cnt = 0;
            for (ApmsComboScore s : voList) {
                if (s.getComboScore() != null) { sum = sum.add(s.getComboScore()); cnt++; }
            }
            avgScore = cnt > 0 ? sum.divide(BigDecimal.valueOf(cnt), 3, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;
        }
        int highPerformer = (int) voList.stream().filter(s -> s.getComboScore() != null && s.getComboScore().compareTo(new BigDecimal("0.5")) >= 0).count();
        int needAttention = (int) voList.stream().filter(s -> s.getComboScore() != null && s.getComboScore().compareTo(new BigDecimal("-0.5")) <= 0).count();

        summary.put("totalAthletes", totalAthletes);
        summary.put("totalComboScores", voList.size());
        summary.put("avgComboScore", avgScore);
        summary.put("highPerformer", highPerformer);
        summary.put("needAttention", needAttention);
        summary.put("phvRecords", phvList.size());
        summary.put("testTasks", tasks.size());

        // 队伍分布（DataScope 已过滤）
        Map<String, Long> teamDist = new LinkedHashMap<>();
        for (ApmsComboScore s : voList) {
            String t = s.getAthleteTeam() == null ? "未分组" : s.getAthleteTeam();
            teamDist.merge(t, 1L, Long::sum);
        }

        // ========= 6. 大屏门面区聚合（首页上半屏；无表结构变更，口径复用各业务模块） =========
        // 数据可见范围沿用本控制器既有 /stats 及上方 PHV/任务块的现状（不额外切片 DataScope）
        LocalDate dashToday = LocalDate.now();
        List<ApmsAthlete> dashAthletes = athleteMapper.selectApmsAthleteList(new ApmsAthlete());

        Map<String, Object> rtpDistribution = buildRtpDistribution(dashAthletes);
        Map<String, Object> activeTasksBlock = buildActiveTasks(taskCompletion, tasks, dashToday);
        Map<Long, ApmsAthlete> dashAthMap = new HashMap<>();
        for (ApmsAthlete a : dashAthletes) dashAthMap.put(a.getAthleteId(), a);
        Map<String, Object> injurySummary = buildInjurySummary(dashAthMap, dashToday);
        Map<String, Object> phvBandsBlock = buildPhvBands(phvList);
        Map<String, Object> healthAlerts = buildHealthAlerts();

        data.put("summary", summary);
        data.put("comboScoreRanking", comboScoreRanking);
        data.put("indicatorRadar", indicatorRadar);
        data.put("phvScatter", phvScatter);
        data.put("taskCompletion", taskCompletion);
        data.put("teamDistribution", teamDist);
        data.put("rtpDistribution", rtpDistribution);
        data.put("activeTasks", activeTasksBlock);
        data.put("injurySummary", injurySummary);
        data.put("phvBands", phvBandsBlock);
        data.put("healthAlerts", healthAlerts);

        return success(data);
    }

    // ================= 大屏门面区聚合辅助 =================

    /** RTP 状态码归一化：g/y/r（兼容 green/yellow/red、中文、0/1/2 历史值），无法识别按未评估 */
    private String rtpLevelOf(String raw) {
        if (raw == null) return "none";
        String s = raw.trim().toLowerCase();
        if (s.isEmpty()) return "none";
        if (s.contains("red") || s.contains("红") || "r".equals(s) || "2".equals(s)) return "red";
        if (s.contains("yellow") || s.contains("amber") || s.contains("黄") || "y".equals(s) || "1".equals(s)) return "yellow";
        if (s.contains("green") || s.contains("绿") || "g".equals(s) || "0".equals(s)) return "green";
        return "none";
    }

    /** 参训风险三态 + 未评估，含按队伍堆叠分布（donut 与堆叠条数据源） */
    private Map<String, Object> buildRtpDistribution(List<ApmsAthlete> athletes) {
        Map<Long, String> levelMap = new HashMap<>();
        for (ApmsRtpStatus s : rtpMapper.selectList()) {
            if (s.getAthleteId() != null) levelMap.put(s.getAthleteId(), rtpLevelOf(s.getStatus()));
        }
        int green = 0, yellow = 0, red = 0, none = 0;
        Map<String, int[]> teamBuckets = new LinkedHashMap<>();
        for (ApmsAthlete a : athletes) {
            String team = (a.getTeamName() == null || a.getTeamName().isEmpty()) ? "未分组" : a.getTeamName();
            int[] b = teamBuckets.computeIfAbsent(team, k -> new int[4]); // green,yellow,red,none
            switch (levelMap.getOrDefault(a.getAthleteId(), "none")) {
                case "green": green++; b[0]++; break;
                case "yellow": yellow++; b[1]++; break;
                case "red": red++; b[2]++; break;
                default: none++; b[3]++;
            }
        }
        List<Map<String, Object>> byTeam = new ArrayList<>();
        teamBuckets.forEach((team, b) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("team", team);
            row.put("green", b[0]);
            row.put("yellow", b[1]);
            row.put("red", b[2]);
            row.put("none", b[3]);
            byTeam.add(row);
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("green", green);
        out.put("yellow", yellow);
        out.put("red", red);
        out.put("none", none);
        out.put("total", athletes.size());
        out.put("byTeam", byTeam);
        return out;
    }

    /** 本周活跃任务：未完成且任务窗口覆盖今天（日期缺失视为进行中），含平均完成率 */
    private Map<String, Object> buildActiveTasks(List<Map<String, Object>> taskRows,
                                                 List<ApmsTestTask> tasks, LocalDate today) {
        List<Map<String, Object>> list = new ArrayList<>();
        long progressSum = 0;
        for (int i = 0; i < tasks.size(); i++) {
            ApmsTestTask t = tasks.get(i);
            if ("completed".equals(t.getStatus())) continue;
            LocalDate s = toLocalDate(t.getStartDate());
            LocalDate e = toLocalDate(t.getEndDate());
            boolean windowActive = (s == null || !s.isAfter(today)) && (e == null || !e.isBefore(today));
            if (!windowActive) continue;
            Map<String, Object> row = new LinkedHashMap<>(taskRows.get(i));
            long target = ((Number) row.getOrDefault("athleteCount", 0)).longValue();
            long tested = ((Number) row.getOrDefault("selectedCount", 0)).longValue();
            int progress = target > 0 ? (int) Math.round(tested * 100.0 / target) : 0;
            row.put("progress", progress);
            list.add(row);
            progressSum += progress;
        }
        // 最近开始的在前，最多 6 项
        list.sort((a, b) -> {
            Date da = (Date) a.get("startDate");
            Date db = (Date) b.get("startDate");
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });
        int avg = list.isEmpty() ? 0 : (int) Math.round(progressSum * 1.0 / list.size());
        if (list.size() > 6) list.subList(6, list.size()).clear();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", list);
        out.put("avgProgress", avg);
        return out;
    }

    /**
     * 伤病台账摘要（近 12 个月 injury/surgery 口径）：
     * 活跃=未出现同日或之后 rehabilitation/checkup 记录（复用 RtpRiskEvaluator 闭环判定，与部位热力图同口径）；
     * 本月新发=自然月内未闭环；已康复=已闭环伤病记录数；部位仅统计活跃例数。
     */
    private Map<String, Object> buildInjurySummary(Map<Long, ApmsAthlete> athMap, LocalDate today) {
        List<ApmsMedicalRecord> records = medicalMapper.selectList(new ApmsMedicalRecord());
        LocalDate since = today.minusMonths(12);
        LocalDate monthStart = today.withDayOfMonth(1);
        Map<Long, List<ApmsMedicalRecord>> byAthlete = new HashMap<>();
        for (ApmsMedicalRecord r : records) {
            if (r.getAthleteId() == null) continue;
            byAthlete.computeIfAbsent(r.getAthleteId(), k -> new ArrayList<>()).add(r);
        }
        int active = 0, newThisMonth = 0, recovered = 0;
        Map<String, Map<String, Object>> sites = new LinkedHashMap<>();
        List<Map<String, Object>> activeRows = new ArrayList<>();
        for (ApmsMedicalRecord r : records) {
            if (!"injury".equals(r.getRecordType()) && !"surgery".equals(r.getRecordType())) continue;
            LocalDate d = toLocalDate(r.getRecordDate());
            if (d == null || d.isBefore(since)) continue;
            if (riskEvaluator.isInjuryClosed(d, byAthlete.get(r.getAthleteId()))) {
                recovered++;
                continue;
            }
            active++;
            if (!d.isBefore(monthStart)) newThisMonth++;
            if (r.getBodySite() != null && !r.getBodySite().isEmpty()) {
                Map<String, Object> bucket = sites.computeIfAbsent(r.getBodySite(), k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("site", k);
                    m.put("active", 0);
                    m.put("total", 0);
                    return m;
                });
                bucket.put("active", (Integer) bucket.get("active") + 1);
                bucket.put("total", (Integer) bucket.get("total") + 1);
            }
            ApmsAthlete a = athMap.get(r.getAthleteId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", r.getAthleteId());
            row.put("athleteName", a != null ? a.getName() : null);
            row.put("title", r.getTitle());
            row.put("bodySite", r.getBodySite());
            row.put("recordType", r.getRecordType());
            row.put("recordDate", r.getRecordDate());
            activeRows.add(row);
        }
        List<Map<String, Object>> siteList = new ArrayList<>(sites.values());
        siteList.sort(Comparator.comparingInt((Map<String, Object> m) -> (Integer) m.get("active")).reversed());
        if (siteList.size() > 5) siteList.subList(5, siteList.size()).clear();
        activeRows.sort((x, y) -> {
            Date dx = (Date) x.get("recordDate");
            Date dy = (Date) y.get("recordDate");
            return dy.compareTo(dx);
        });
        if (activeRows.size() > 3) activeRows.subList(3, activeRows.size()).clear();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("active", active);
        out.put("newThisMonth", newThisMonth);
        out.put("recovered", recovered);
        out.put("sites", siteList);
        out.put("recent", activeRows);
        return out;
    }

    /** PHV 发育阶段 4 档分布（每人取 measureDate 最新一条 maturityOffset），并统计 ±1 年窗口人数 */
    private Map<String, Object> buildPhvBands(List<ApmsPhvRecord> phvRecords) {
        Map<Long, ApmsPhvRecord> latest = new HashMap<>();
        for (ApmsPhvRecord p : phvRecords) {
            if (p.getAthleteId() == null || p.getMeasureDate() == null) continue;
            ApmsPhvRecord cur = latest.get(p.getAthleteId());
            if (cur == null || p.getMeasureDate().after(cur.getMeasureDate())) latest.put(p.getAthleteId(), p);
        }
        String[][] bandDefs = {
            {"pre", "PHV 前期"}, {"near", "接近期"}, {"post", "高峰后"}, {"beyond", "已越过"}
        };
        int[] counts = new int[4];
        int window = 0;
        for (ApmsPhvRecord p : latest.values()) {
            if (p.getMaturityOffset() == null) continue;
            double v = p.getMaturityOffset().doubleValue();
            if (v < -1) counts[0]++;
            else if (v < 0.5) counts[1]++;
            else if (v <= 1.5) counts[2]++;
            else counts[3]++;
            if (v >= -1 && v <= 1) window++;
        }
        List<Map<String, Object>> bands = new ArrayList<>();
        for (int i = 0; i < bandDefs.length; i++) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", bandDefs[i][0]);
            m.put("label", bandDefs[i][1]);
            m.put("count", counts[i]);
            bands.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("bands", bands);
        out.put("windowCount", window);
        out.put("total", latest.size());
        return out;
    }

    /** 健康预警：RTP 规则引擎当日 ACTIVE 快照统计 + 红黄优先 TOP3 名单 */
    private Map<String, Object> buildHealthAlerts() {
        Map<String, Object> stat = rtpRiskService.stat(new ApmsRtpRiskSnapshot());
        List<ApmsRtpRiskSnapshot> alerts = rtpRiskService.selectList(new ApmsRtpRiskSnapshot());
        alerts.sort(Comparator
                .comparingInt((ApmsRtpRiskSnapshot s) -> "WARNING".equals(s.getSuggestedLevel()) ? 0
                        : "ATTENTION".equals(s.getSuggestedLevel()) ? 1 : 2)
                .thenComparing(s -> s.getRiskScore() == null ? BigDecimal.ZERO : s.getRiskScore(),
                        Comparator.reverseOrder()));
        List<Map<String, Object>> top = new ArrayList<>();
        for (ApmsRtpRiskSnapshot s : alerts) {
            if (top.size() >= 3) break;
            String reason = "";
            List<RiskFactor> factors = s.getFactorList();
            if (factors != null && !factors.isEmpty() && factors.get(0).getTitle() != null) {
                reason = factors.get(0).getTitle();
            } else if (s.getProcessFlagList() != null && !s.getProcessFlagList().isEmpty()) {
                reason = s.getProcessFlagList().get(0);
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("snapshotId", s.getId());
            row.put("athleteId", s.getAthleteId());
            row.put("athleteName", s.getAthleteName());
            row.put("athleteTeam", s.getAthleteTeam());
            row.put("level", s.getSuggestedLevel());
            row.put("processOnly", s.getProcessOnly());
            row.put("riskScore", s.getRiskScore());
            row.put("reason", reason);
            top.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.putAll(stat);
        out.put("list", top);
        return out;
    }

    /** MyBatis DATE 列为 java.sql.Date，toInstant() 不支持，需按实际类型转换 */
    private static LocalDate toLocalDate(Date date) {
        if (date == null) return null;
        if (date instanceof java.sql.Date) return ((java.sql.Date) date).toLocalDate();
        return date.toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate();
    }

    /** 从 ref_snapshot JSON 中提取每个运动员的 z_score，用于雷达图 */
    private List<Map<String, Object>> buildRadar(List<ApmsComboScore> scores) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ApmsComboScore s : scores) {
            if (s.getRefSnapshot() == null) continue;
            try {
                com.alibaba.fastjson2.JSONObject snap = com.alibaba.fastjson2.JSON.parseObject(s.getRefSnapshot());
                com.alibaba.fastjson2.JSONArray comps = snap.getJSONArray("components");
                if (comps == null) continue;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("athleteId", s.getAthleteId());
                row.put("athleteName", s.getAthleteName());
                // 提取每个 indicatorId → normalized (z_score)
                List<Map<String, Object>> dims = new ArrayList<>();
                for (int i = 0; i < comps.size(); i++) {
                    com.alibaba.fastjson2.JSONObject c = comps.getJSONObject(i);
                    Map<String, Object> dim = new LinkedHashMap<>();
                    dim.put("indicatorId", c.getLong("indicatorId"));
                    dim.put("weight", c.getBigDecimal("weight"));
                    dim.put("direction", c.getString("direction"));
                    dim.put("normalized", c.getBigDecimal("normalized"));
                    dim.put("weightedScore", c.getBigDecimal("weightedScore"));
                    dim.put("valid", c.getBoolean("valid"));
                    dims.add(dim);
                }
                row.put("dimensions", dims);
                result.add(row);
            } catch (Exception e) { /* skip malformed */ }
        }
        enrichAthleteInfo(result);
        return result;
    }

    /** 批量补充运动员 name/team — 遍历一次 */
    private void enrichAthleteInfo(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) return;
        Set<Long> ids = new HashSet<>();
        for (Map<String, Object> r : rows) {
            Object id = r.get("athleteId");
            if (id != null) ids.add(Long.valueOf(id.toString()));
        }
        if (ids.isEmpty()) return;
        List<ApmsAthlete> all = athleteMapper.selectApmsAthleteList(new ApmsAthlete());
        Map<Long, ApmsAthlete> map = new HashMap<>();
        for (ApmsAthlete a : all) map.put(a.getAthleteId(), a);
        for (Map<String, Object> r : rows) {
            Object id = r.get("athleteId");
            if (id != null) {
                ApmsAthlete a = map.get(Long.valueOf(id.toString()));
                if (a != null) {
                    r.putIfAbsent("athleteName", a.getName());
                    r.put("athleteTeam", a.getTeamName());
                }
            }
        }
    }
}
