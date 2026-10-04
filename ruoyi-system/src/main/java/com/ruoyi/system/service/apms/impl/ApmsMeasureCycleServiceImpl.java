package com.ruoyi.system.service.apms.impl;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.domain.apms.ApmsMeasureCycle;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsBodyMeasureMapper;
import com.ruoyi.system.mapper.apms.ApmsMeasureCycleMapper;
import com.ruoyi.system.service.apms.IApmsBodyMeasureService;
import com.ruoyi.system.service.apms.IApmsMeasureCycleService;

@Service
public class ApmsMeasureCycleServiceImpl implements IApmsMeasureCycleService {

    @Autowired private ApmsMeasureCycleMapper cycleMapper;
    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsBodyMeasureMapper measureMapper;
    @Autowired private IApmsBodyMeasureService measureService;

    @Override
    public List<ApmsMeasureCycle> list(ApmsMeasureCycle query) {
        return cycleMapper.selectList(query);
    }

    @Override
    public ApmsMeasureCycle getById(Long id) {
        return cycleMapper.selectById(id);
    }

    @Override
    public int insert(ApmsMeasureCycle cycle) {
        validate(cycle);
        cycle.setCreateBy(SecurityUtils.getUsername());
        return cycleMapper.insert(cycle);
    }

    @Override
    public int update(ApmsMeasureCycle cycle) {
        if (cycle.getId() == null) throw new ServiceException("周期ID不能为空");
        validate(cycle);
        cycle.setUpdateBy(SecurityUtils.getUsername());
        return cycleMapper.update(cycle);
    }

    private void validate(ApmsMeasureCycle c) {
        if (c.getName() == null || c.getName().trim().isEmpty()) throw new ServiceException("周期名称不能为空");
        if (c.getPlanStartDate() != null && c.getPlanEndDate() != null
                && c.getPlanEndDate().before(c.getPlanStartDate())) {
            throw new ServiceException("计划结束日期不能早于开始日期");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteById(Long id) {
        // 周期删除：记录先解链（cycle_id 置 NULL），测量数据保留
        cycleMapper.unlinkMeasures(id);
        return cycleMapper.deleteById(id);
    }

    @Override
    public Map<String, Object> progress(Long cycleId) {
        ApmsMeasureCycle cycle = cycleMapper.selectById(cycleId);
        if (cycle == null) throw new ServiceException("测量周期不存在");

        // 目标队员
        ApmsAthlete q = new ApmsAthlete();
        q.setStatus("0");
        if (cycle.getTargetDeptId() != null) q.setPrimaryTeamId(cycle.getTargetDeptId());
        List<ApmsAthlete> members = athleteMapper.selectApmsAthleteList(q);

        // 已测（cycle_id 关联，每队员一条）
        List<ApmsBodyMeasure> measured = cycleMapper.selectMeasuredByCycle(cycleId);
        Map<Long, ApmsBodyMeasure> measuredMap = new HashMap<>();
        for (ApmsBodyMeasure m : measured) measuredMap.put(m.getAthleteId(), m);

        List<Map<String, Object>> measuredList = new ArrayList<>();
        List<Map<String, Object>> pendingList = new ArrayList<>();
        for (ApmsAthlete a : members) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("athleteId", a.getAthleteId());
            item.put("athleteName", a.getName());
            item.put("teamName", a.getTeamName());
            ApmsBodyMeasure m = measuredMap.get(a.getAthleteId());
            if (m != null) {
                item.put("measureId", m.getId());
                item.put("measureDate", m.getMeasureDate());
                item.put("height", m.getHeight());
                item.put("weight", m.getWeight());
                item.put("sitHeight", m.getSitHeight());
                item.put("bodyFatRate", m.getBodyFatRate());
                item.put("waist", m.getWaist());
                measuredList.add(item);
            } else {
                pendingList.add(item);
            }
        }

        int total = members.size();
        int done = measuredList.size();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cycle", cycle);
        out.put("memberTotal", total);
        out.put("measuredCount", done);
        out.put("pendingCount", pendingList.size());
        out.put("percent", total == 0 ? 0 : Math.round(done * 1000.0 / total) / 10.0);
        out.put("measured", measuredList);
        out.put("pending", pendingList);
        return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int batchSave(Long cycleId, List<ApmsBodyMeasure> measures) {
        ApmsMeasureCycle cycle = cycleMapper.selectById(cycleId);
        if (cycle == null) throw new ServiceException("测量周期不存在");
        if (measures == null || measures.isEmpty()) throw new ServiceException("没有需要保存的测量数据");

        int saved = 0;
        for (ApmsBodyMeasure m : measures) {
            if (m.getAthleteId() == null) continue;
            if (isAllBlank(m)) continue; // 整行未填，跳过
            m.setCycleId(cycleId);
            if (m.getDataSource() == null || m.getDataSource().isEmpty()) m.setDataSource("cycle");
            if (m.getMeasureDate() == null) {
                // 默认落到计划开始日期（便于同周期一致）；无计划日期则今天
                m.setMeasureDate(cycle.getPlanStartDate() != null ? cycle.getPlanStartDate() : new Date());
            }
            // 复用体态 upsert：同队员同日测量唯一真源，并自动触发 PHV/成年身高预测。
            // upsert 按 队员+日期 判重，不识别前端带入的旧行 id；当批量日期相对原测量日
            // 发生变化时，先处理旧行，避免同一队员在周期内残留两条记录。
            Long carryId = m.getId();
            if (carryId != null) {
                ApmsBodyMeasure onDate = measureMapper.selectByUniqueKey(m);
                if (onDate != null && !carryId.equals(onDate.getId())) {
                    // 目标日期已有另一条记录：旧行删除，数据并入同日记录
                    measureMapper.deleteById(carryId);
                    m.setId(null);
                } else if (onDate == null) {
                    // 日期平移到空闲日期：先按 id 平移旧行，再交由 upsert 更新并触发 PHV
                    measureMapper.update(m);
                }
            }
            measureService.upsert(m);
            saved++;
        }
        if (saved == 0) throw new ServiceException("未检测到任何已填写的测量项");
        return saved;
    }

    private boolean isAllBlank(ApmsBodyMeasure m) {
        return m.getHeight() == null && m.getWeight() == null && m.getSitHeight() == null
                && m.getBodyFatRate() == null && m.getWaist() == null;
    }
}
