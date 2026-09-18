package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsBodyMeasureMapper;
import com.ruoyi.system.mapper.apms.ApmsPhvRecordMapper;
import com.ruoyi.system.service.apms.IApmsBodyMeasureService;
import com.ruoyi.system.service.apms.IApmsPhvService;
import com.ruoyi.system.util.apms.KhamisRocheCalculator;

/**
 * 体态测量 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsBodyMeasureServiceImpl implements IApmsBodyMeasureService {

    @Autowired
    private ApmsBodyMeasureMapper measureMapper;

    @Autowired
    private ApmsPhvRecordMapper phvRecordMapper;

    @Autowired
    private IApmsPhvService phvService;

    @Autowired
    private ApmsAthleteMapper athleteMapper;

    @Override
    public List<ApmsBodyMeasure> list(ApmsBodyMeasure query) {
        return measureMapper.selectList(query);
    }

    @Override
    public ApmsBodyMeasure selectById(Long id) {
        return measureMapper.selectById(id);
    }

    @Override
    public List<ApmsBodyMeasure> selectByAthleteId(Long athleteId) {
        return measureMapper.selectByAthleteId(athleteId);
    }

    @Override
    public ApmsBodyMeasure selectLatestByAthleteId(Long athleteId) {
        return measureMapper.selectLatestByAthleteId(athleteId);
    }

    @Override
    public int upsert(ApmsBodyMeasure measure) {
        // 用唯一键查询是否已存在
        ApmsBodyMeasure existing = measureMapper.selectByUniqueKey(measure);
        int rows;
        if (existing != null) {
            // 更新已有记录
            measure.setId(existing.getId());
            rows = measureMapper.update(measure);
        } else {
            // 新增
            measure.setCreateBy(SecurityUtils.getUsername());
            rows = measureMapper.insert(measure);
        }

        // 🟢 PHV 自动触发：upsert 成功后尝试 Mirwald 计算
        if (rows > 0 && measure.getAthleteId() != null) {
            try { phvService.tryAutoCalculate(measure.getAthleteId()); } catch (Exception ignored) {}

            // 🟢 Khamis-Roche 成年身高预测自动触发
            try { tryKhamisRoche(measure.getAthleteId()); } catch (Exception ignored) {}
        }
        return rows;
    }

    /**
     * Khamis-Roche 成年身高预测 — 条件齐（H + W + age + gender）就写入 athlete 表
     * 非幂等（每次 H/W 变了就重算，预测值随年龄收敛）
     */
    private void tryKhamisRoche(Long athleteId) {
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null || athlete.getBirthday() == null || athlete.getGender() == null) return;

        ApmsBodyMeasure latest = measureMapper.selectLatestByAthleteId(athleteId);
        if (latest == null || latest.getHeight() == null || latest.getWeight() == null) return;

        // decimal age
        LocalDate birth = athlete.getBirthday().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate today = LocalDate.now();
        Period p = Period.between(birth, today);
        double decimalAge = p.getYears() + p.getMonths() / 12.0 + p.getDays() / 365.25;

        KhamisRocheCalculator.Input in = new KhamisRocheCalculator.Input();
        in.gender = athlete.getGender();
        in.decimalAge = BigDecimal.valueOf(decimalAge);
        in.currentHeight = latest.getHeight();
        in.weight = latest.getWeight();

        KhamisRocheCalculator.Result res = new KhamisRocheCalculator().calculate(in);

        // 写回 athlete 表
        ApmsAthlete update = new ApmsAthlete();
        update.setAthleteId(athleteId);
        update.setPredictedAdultHeight(res.predictedAdultHeight);
        update.setAdultHeightAlgo(res.version);
        update.setAdultHeightCalcDate(new java.util.Date());
        athleteMapper.updateApmsAthlete(update);
    }

    @Override
    public int deleteById(Long id) {
        // 🔴 级联：删掉引用该 body_measure 的所有 PHV 记录
        phvRecordMapper.deleteBySourceMeasureId(id);
        return measureMapper.deleteById(id);
    }
}
