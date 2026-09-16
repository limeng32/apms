package com.ruoyi.web.controller.apms;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;

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
        for (ApmsRtpStatus r : rtpList) {
            String s = r.getStatus() == null ? "" : r.getStatus().toLowerCase();
            if (s.contains("green") || s.contains("绿") || "0".equals(s)) rtpGreen++;
            else if (s.contains("yellow") || s.contains("黄") || "1".equals(s)) rtpYellow++;
            else if (s.contains("red") || s.contains("红") || "2".equals(s)) rtpRed++;
            else rtpGreen++; // 默认 green
        }
        stats.put("rtpGreenCount", rtpGreen);
        stats.put("rtpYellowCount", rtpYellow);
        stats.put("rtpRedCount", rtpRed);

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

            // 计算进度
            ApmsTestResult rq = new ApmsTestResult();
            rq.setTaskId(t.getId());
            List<ApmsTestResult> results = resultMapper.selectList(rq);
            long selected = results.stream().filter(r -> "1".equals(r.getIsSelected())).count();
            long totalDistinct = results.stream().map(ApmsTestResult::getAthleteId).distinct().count();
            int prog = totalDistinct > 0 ? (int) Math.round(selected * 100.0 / totalDistinct) : 0;

            row.put("completedCount", selected);
            row.put("totalCount", totalDistinct);
            row.put("progress", prog);
            row.put("teamName", t.getTargetDeptId() != null ? String.valueOf(t.getTargetDeptId()) : "—");
            row.put("startDate", t.getStartDate());
            row.put("endDate", t.getEndDate());
            taskList.add(row);
        }
        root.put("taskList", taskList);

        // --- RTP 关注名单（Yellow + Red，最多 6 人） ---
        List<Map<String, Object>> rtpAttention = new ArrayList<>();
        Map<Long, ApmsAthlete> athMap = new HashMap<>();
        for (ApmsAthlete a : athletes) athMap.put(a.getAthleteId(), a);

        for (ApmsRtpStatus r : rtpList) {
            String s = r.getStatus() == null ? "" : r.getStatus().toLowerCase();
            boolean isAttention = s.contains("yellow") || s.contains("黄") || "1".equals(s)
                    || s.contains("red") || s.contains("红") || "2".equals(s);
            if (!isAttention) continue;

            ApmsAthlete a = athMap.get(r.getAthleteId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("athleteId", r.getAthleteId());
            row.put("athleteName", a != null ? a.getName() : "—");
            row.put("jerseyNo", a != null ? a.getJerseyNo() : null);
            row.put("position", a != null ? a.getPosition() : null);
            row.put("status", r.getStatus());
            rtpAttention.add(row);
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

        data.put("summary", summary);
        data.put("comboScoreRanking", comboScoreRanking);
        data.put("indicatorRadar", indicatorRadar);
        data.put("phvScatter", phvScatter);
        data.put("taskCompletion", taskCompletion);
        data.put("teamDistribution", teamDist);

        return success(data);
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
