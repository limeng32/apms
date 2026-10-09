package com.ruoyi.system.service.apms.impl;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Period;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsAthletePromotionLog;
import com.ruoyi.system.domain.apms.ApmsPromotionItem;
import com.ruoyi.system.domain.apms.ApmsPromotionPlan;
import com.ruoyi.system.domain.apms.ApmsPromotionRequest;
import com.ruoyi.system.mapper.apms.ApmsAthleteGroupMapper;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsAthletePromotionLogMapper;
import com.ruoyi.system.service.apms.IApmsSeasonPromotionService;

/**
 * 赛季整队晋升 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsSeasonPromotionServiceImpl implements IApmsSeasonPromotionService {

    /** 部门名中的 U 档标记：U 前不能是字母/数字，后接 1~2 位数字，如 U16 / U18 梯队 */
    private static final Pattern U_BRACKET = Pattern.compile("(?<![A-Za-z0-9])U(\\d{1,2})(?![0-9])", Pattern.CASE_INSENSITIVE);

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Autowired
    private ApmsAthleteMapper athleteMapper;

    @Autowired
    private ApmsAthletePromotionLogMapper logMapper;

    @Autowired
    private ApmsAthleteGroupMapper groupMapper;

    @Override
    public ApmsPromotionPlan preview(ApmsPromotionRequest request) {
        return buildPlan(resolveCutoff(request));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApmsPromotionPlan execute(ApmsPromotionRequest request) {
        LocalDate cutoff = resolveCutoff(request);
        // 执行时以服务端重算结果为准，不信任前端预览数据
        ApmsPromotionPlan plan = buildPlan(cutoff);
        if (!plan.getConfigErrors().isEmpty()) {
            throw new ServiceException("梯队配置存在问题，请先修正后再执行：" + String.join("；", plan.getConfigErrors()));
        }
        List<ApmsPromotionItem> promotes = new ArrayList<>();
        for (ApmsPromotionItem item : plan.getItems()) {
            if (ApmsPromotionItem.ACTION_PROMOTE.equals(item.getAction())) {
                promotes.add(item);
            }
        }
        if (promotes.isEmpty()) {
            throw new ServiceException("没有需要晋升的队员（当前 cut-off 日无人超龄）");
        }

        String operator = SecurityUtils.getUsername();
        String batchNo = "P" + cutoff.format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-"
                + LocalTime.now().format(DateTimeFormatter.ofPattern("HHmmss"));
        Date cutoffDate = java.sql.Date.valueOf(cutoff);
        List<ApmsAthletePromotionLog> logs = new ArrayList<>();
        for (ApmsPromotionItem item : promotes) {
            int updated = athleteMapper.updatePrimaryTeam(item.getAthleteId(), item.getToTeamId(), operator);
            if (updated == 0) {
                // 并发/状态变化保护：队员已离队则中止整批，事务回滚
                throw new ServiceException("队员 " + item.getName() + " 当前不在训状态，本次晋升已全部回滚，请重新预览后执行");
            }
            // 小组挂在队伍子树下：晋升即脱离旧队，关闭其在旧队子树下的全部在组小组，
            // 离组日期统一取 cut-off 日；到新队伍后由教练重新编组（同事务，失败整批回滚）
            if (item.getFromTeamId() != null) {
                groupMapper.closeCurrentByTeamSubTree(item.getAthleteId(), item.getFromTeamId(), cutoffDate);
            }
            ApmsAthletePromotionLog log = new ApmsAthletePromotionLog();
            log.setBatchNo(batchNo);
            log.setCutoffDate(cutoffDate);
            log.setAthleteId(item.getAthleteId());
            log.setAthleteName(item.getName());
            log.setFromTeamId(item.getFromTeamId());
            log.setToTeamId(item.getToTeamId());
            log.setSeasonAge(item.getAgeAtCutoff());
            log.setCreateBy(operator);
            logs.add(log);
        }
        logMapper.batchInsert(logs);
        plan.setBatchNo(batchNo);
        return plan;
    }

    /**
     * 计算晋升方案（预览/执行共用，保证口径一致）
     */
    private ApmsPromotionPlan buildPlan(LocalDate cutoff) {
        ApmsPromotionPlan plan = new ApmsPromotionPlan();
        plan.setCutoffDate(cutoff.format(DATE_FMT));

        // 1. 识别 U 档梯队：parentId -> (档位数字 -> 部门)
        List<SysDept> allDepts = athleteMapper.selectAllValidDepts();
        Map<Long, TreeMap<Integer, SysDept>> bracketByParent = new HashMap<>();
        Map<Long, int[]> duplicateGuard = new HashMap<>();
        for (SysDept dept : allDepts) {
            Integer bracket = parseBracket(dept.getDeptName());
            if (bracket == null) {
                continue;
            }
            Long parentId = dept.getParentId() == null ? 0L : dept.getParentId();
            SysDept old = bracketByParent.computeIfAbsent(parentId, k -> new TreeMap<>()).put(bracket, dept);
            if (old != null) {
                plan.getConfigErrors().add(String.format("「%s」下同时存在两个 U%d 梯队（%s、%s），无法判定晋升链",
                        parentName(allDepts, parentId), bracket, old.getDeptName(), dept.getDeptName()));
            }
        }
        if (bracketByParent.isEmpty()) {
            plan.getConfigErrors().add("未识别到任何 U 档梯队（部门名需含 U+数字，如 U16 梯队）");
        }

        // 2. 拉取全部在训运动员（含挂在非 U 档/失效部门的队员，需单列提示）+ 各队球衣号集合
        Set<Long> teamIds = new HashSet<>();
        Map<Long, SysDept> teamIndex = new HashMap<>();
        bracketByParent.values().forEach(map -> map.values().forEach(d -> {
            teamIds.add(d.getDeptId());
            teamIndex.put(d.getDeptId(), d);
        }));
        List<ApmsAthlete> athletes = athleteMapper.selectAllActiveAthletes();

        Map<Long, Set<String>> jerseyByTeam = new HashMap<>();
        Map<Long, Integer> memberCount = new HashMap<>();
        for (ApmsAthlete a : athletes) {
            if (!teamIndex.containsKey(a.getPrimaryTeamId())) {
                continue;
            }
            memberCount.merge(a.getPrimaryTeamId(), 1, Integer::sum);
            if (a.getJerseyNo() != null && !a.getJerseyNo().trim().isEmpty()) {
                jerseyByTeam.computeIfAbsent(a.getPrimaryTeamId(), k -> new HashSet<>()).add(a.getJerseyNo().trim());
            }
        }
        bracketByParent.forEach((parentId, map) -> map.forEach((bracket, dept) ->
                plan.addTeam(dept.getDeptId(), dept.getDeptName(), parentId, bracket,
                        memberCount.getOrDefault(dept.getDeptId(), 0))));

        // 3. 逐人判定
        int promote = 0, stayYoung = 0, stayOverAge = 0, noBirthday = 0, invalidTeam = 0;
        for (ApmsAthlete a : athletes) {
            ApmsPromotionItem item = new ApmsPromotionItem();
            item.setAthleteId(a.getAthleteId());
            item.setName(a.getName());
            item.setGender(a.getGender());
            item.setBirthday(a.getBirthday());
            item.setJerseyNo(a.getJerseyNo());
            item.setFromTeamId(a.getPrimaryTeamId());
            item.setFromTeamName(a.getTeamName());

            SysDept from = teamIndex.get(a.getPrimaryTeamId());
            if (from == null) {
                // 挂在非 U 档部门或部门已停用/删除：不参与晋升，单列供人工处理
                item.setAction(ApmsPromotionItem.ACTION_INVALID_TEAM);
                String teamLabel = a.getTeamName() == null || a.getTeamName().trim().isEmpty()
                        ? ("部门#" + a.getPrimaryTeamId()) : a.getTeamName();
                item.setReason("所属「" + teamLabel + "」不是 U 档梯队或已停用/删除，不参与晋升，请先调整归属");
                invalidTeam++;
                plan.getItems().add(item);
                continue;
            }
            Integer fromBracket = parseBracket(from.getDeptName());
            Long parentId = from.getParentId() == null ? 0L : from.getParentId();
            TreeMap<Integer, SysDept> chain = bracketByParent.get(parentId);
            item.setFromTeamName(from.getDeptName());
            item.setFromBracket(fromBracket);

            if (a.getBirthday() == null) {
                item.setAction(ApmsPromotionItem.ACTION_NO_BIRTHDAY);
                item.setReason("出生日期缺失，无法判定年龄段");
                noBirthday++;
            } else {
                LocalDate birth = a.getBirthday().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                int age = Period.between(birth, cutoff).getYears();
                if (age < 0) {
                    age = 0;
                }
                item.setAgeAtCutoff(age);

                if (age < fromBracket) {
                    item.setAction(ApmsPromotionItem.ACTION_STAY_YOUNG);
                    item.setReason(String.format("cut-off 日 %d 岁，未达到 U%d 出档年龄", age, fromBracket));
                    stayYoung++;
                } else {
                    // 在同上级梯队链中找能容纳该年龄的最小档（age < N），自动跳过未建的中间档
                    SysDept target = null;
                    Integer targetBracket = null;
                    for (Map.Entry<Integer, SysDept> e : chain.entrySet()) {
                        if (e.getKey() > fromBracket && age < e.getKey()) {
                            target = e.getValue();
                            targetBracket = e.getKey();
                            break;
                        }
                    }
                    if (target == null) {
                        item.setAction(ApmsPromotionItem.ACTION_STAY_OVERAGE);
                        item.setReason(String.format("cut-off 日 %d 岁已超 U%d，但本机构没有更高档梯队", age, fromBracket));
                        stayOverAge++;
                    } else {
                        item.setAction(ApmsPromotionItem.ACTION_PROMOTE);
                        item.setToTeamId(target.getDeptId());
                        item.setToTeamName(target.getDeptName());
                        item.setToBracket(targetBracket);
                        item.setReason(String.format("cut-off 日 %d 岁，超出 U%d，晋升至 U%s", age, fromBracket,
                                targetBracket == null ? "?" : targetBracket.toString()));
                        if (a.getJerseyNo() != null && !a.getJerseyNo().trim().isEmpty()) {
                            Set<String> targetJerseys = jerseyByTeam.get(target.getDeptId());
                            if (targetJerseys != null && targetJerseys.contains(a.getJerseyNo().trim())) {
                                item.setJerseyConflict(true);
                            }
                        }
                        promote++;
                    }
                }
            }
            plan.getItems().add(item);
        }
        plan.setPromoteCount(promote);
        plan.setStayYoungCount(stayYoung);
        plan.setStayOverAgeCount(stayOverAge);
        plan.setNoBirthdayCount(noBirthday);
        plan.setInvalidTeamCount(invalidTeam);
        return plan;
    }

    /** 解析 cut-off：空则默认下一个 1 月 1 日；非法日期抛业务异常 */
    private LocalDate resolveCutoff(ApmsPromotionRequest request) {
        if (request == null || request.getCutoffDate() == null || request.getCutoffDate().trim().isEmpty()) {
            LocalDate today = LocalDate.now();
            LocalDate janFirst = LocalDate.of(today.getYear(), 1, 1);
            return today.isAfter(janFirst) ? janFirst.plusYears(1) : janFirst;
        }
        try {
            return LocalDate.parse(request.getCutoffDate().trim(), DATE_FMT);
        } catch (Exception e) {
            throw new ServiceException("cut-off 日期格式错误，应为 yyyy-MM-dd");
        }
    }

    /** 从部门名提取 U 档数字，非梯队返回 null */
    private Integer parseBracket(String deptName) {
        if (deptName == null) {
            return null;
        }
        Matcher m = U_BRACKET.matcher(deptName);
        return m.find() ? Integer.valueOf(m.group(1)) : null;
    }

    private String parentName(List<SysDept> allDepts, Long parentId) {
        return allDepts.stream()
                .filter(d -> d.getDeptId() != null && d.getDeptId().equals(parentId))
                .map(SysDept::getDeptName)
                .findFirst().orElse(String.valueOf(parentId));
    }
}
