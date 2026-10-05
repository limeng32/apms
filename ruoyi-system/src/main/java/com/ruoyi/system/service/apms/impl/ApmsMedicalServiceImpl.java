package com.ruoyi.system.service.apms.impl;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IApmsMedicalService;
import com.ruoyi.system.service.apms.IRtpRiskService;
import com.ruoyi.system.service.apms.RtpRiskEvaluator;

@Service
public class ApmsMedicalServiceImpl implements IApmsMedicalService {

    private static final Logger log = LoggerFactory.getLogger(ApmsMedicalServiceImpl.class);

    @Autowired private ApmsMedicalRecordMapper recordMapper;
    @Autowired private ApmsMedicalFileMapper fileMapper;
    @Autowired private IRtpRiskService rtpRiskService;
    @Autowired private RtpRiskEvaluator riskEvaluator;

    /** 事件增量：医疗变更后重算当日 RTP 风险，异常只记日志不阻断主写入链路 */
    private void refreshRisk(Long athleteId) {
        if (athleteId == null) return;
        try {
            rtpRiskService.scanOne(athleteId);
        } catch (Exception e) {
            log.warn("[rtp-risk] scanOne after medical write failed, athleteId={}: {}",
                    athleteId, e.getMessage());
        }
    }

    /** injury/surgery 必须指定伤病部位（人体热力图数据基础）；其余类型部位留空 */
    private void validateBodySite(ApmsMedicalRecord r) {
        boolean injuryCase = "injury".equals(r.getRecordType()) || "surgery".equals(r.getRecordType());
        if (injuryCase && (r.getBodySite() == null || r.getBodySite().trim().isEmpty())) {
            throw new ServiceException("损伤/手术记录必须选择伤病部位");
        }
        if (!injuryCase) {
            r.setBodySite(null);
        }
    }

    @Override
    public List<ApmsMedicalRecord> list(ApmsMedicalRecord query) {
        return recordMapper.selectList(query);
    }

    @Override
    public ApmsMedicalRecord getById(Long id) {
        ApmsMedicalRecord r = recordMapper.selectById(id);
        if (r != null) r.setFiles(fileMapper.selectByRecordId(id));
        return r;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int add(ApmsMedicalRecord r, List<ApmsMedicalFile> files) {
        validateBodySite(r);
        r.setCreateBy(SecurityUtils.getUsername());
        recordMapper.insert(r);
        if (files != null) {
            for (ApmsMedicalFile f : files) {
                f.setRecordId(r.getId());
                f.setUploadBy(SecurityUtils.getUsername());
                fileMapper.insert(f);
            }
        }
        refreshRisk(r.getAthleteId());
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int update(ApmsMedicalRecord r, List<ApmsMedicalFile> files) {
        validateBodySite(r);
        recordMapper.update(r);
        if (files != null) {
            // 简化：删旧增新（实际可做差异对比）
            fileMapper.deleteByRecordId(r.getId());
            for (ApmsMedicalFile f : files) {
                f.setId(null);
                f.setRecordId(r.getId());
                f.setUploadBy(SecurityUtils.getUsername());
                fileMapper.insert(f);
            }
        }
        refreshRisk(r.getAthleteId());
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int delete(Long id) {
        ApmsMedicalRecord existing = recordMapper.selectById(id);
        fileMapper.deleteByRecordId(id);
        int rows = recordMapper.deleteById(id);
        if (existing != null) {
            refreshRisk(existing.getAthleteId());
        }
        return rows;
    }

    @Override
    public List<Map<String, Object>> siteStats(ApmsMedicalRecord query, String range) {
        // DataScope 已由 Controller 切面注入 query.params；不复用列表筛选条件，统计全部伤病
        ApmsMedicalRecord all = new ApmsMedicalRecord();
        all.setParams(query.getParams());
        List<ApmsMedicalRecord> records = recordMapper.selectList(all);

        LocalDate today = LocalDate.now();
        LocalDate since = "all".equals(range) ? null : today.minusMonths(12);

        // 按运动员分组（闭环判定只看本人记录）
        Map<Long, List<ApmsMedicalRecord>> byAthlete = records.stream()
                .filter(r -> r.getRecordDate() != null)
                .collect(Collectors.groupingBy(ApmsMedicalRecord::getAthleteId));

        Map<String, Map<String, Object>> agg = new LinkedHashMap<>();
        for (ApmsMedicalRecord r : records) {
            if (!"injury".equals(r.getRecordType()) && !"surgery".equals(r.getRecordType())) {
                continue;
            }
            if (r.getBodySite() == null || r.getBodySite().isEmpty()) {
                continue;
            }
            LocalDate date = toLocalDate(r.getRecordDate());
            if (since != null && date.isBefore(since)) {
                continue;
            }
            List<ApmsMedicalRecord> own = byAthlete.getOrDefault(r.getAthleteId(), new ArrayList<>());
            boolean closed = riskEvaluator.isInjuryClosed(date, own);

            Map<String, Object> bucket = agg.computeIfAbsent(r.getBodySite(), code -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("site", code);
                m.put("total", 0);
                m.put("active", 0);
                return m;
            });
            bucket.put("total", (Integer) bucket.get("total") + 1);
            if (!closed) {
                bucket.put("active", (Integer) bucket.get("active") + 1);
            }
        }

        List<Map<String, Object>> out = new ArrayList<>(agg.values());
        // 活跃例数优先，其次总例数，均降序
        out.sort(Comparator
                .comparingInt((Map<String, Object> m) -> (Integer) m.get("active"))
                .thenComparingInt(m -> (Integer) m.get("total"))
                .reversed());
        return out;
    }

    /** MyBatis DATE 列为 java.sql.Date，toInstant() 不支持，需按实际类型转换 */
    private LocalDate toLocalDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        if (date instanceof java.sql.Date) {
            return ((java.sql.Date) date).toLocalDate();
        }
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }
}
