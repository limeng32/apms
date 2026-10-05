package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.domain.apms.ApmsPhvRecord;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsBodyMeasureMapper;
import com.ruoyi.system.mapper.apms.ApmsPhvRecordMapper;
import com.ruoyi.system.service.apms.IApmsPhvService;
import com.ruoyi.system.service.apms.IRtpRiskService;
import com.ruoyi.system.util.apms.MirwaldCalculator;

/**
 * PHV测量与计算记录 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsPhvServiceImpl implements IApmsPhvService {

    private static final Logger log = LoggerFactory.getLogger(ApmsPhvServiceImpl.class);

    @Override
    public List<ApmsPhvRecord> list(ApmsPhvRecord query) {
        return phvMapper.selectList(query);
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private ApmsPhvRecordMapper phvMapper;

    @Autowired
    private ApmsBodyMeasureMapper measureMapper;

    @Autowired
    private ApmsAthleteMapper athleteMapper;

    @Autowired
    private IRtpRiskService rtpRiskService;

    @Override
    public ApmsPhvRecord selectById(Long id) {
        return phvMapper.selectById(id);
    }

    @Override
    public List<ApmsPhvRecord> selectByAthleteId(Long athleteId) {
        return phvMapper.selectByAthleteId(athleteId);
    }

    @Override
    public ApmsPhvRecord selectLatestByAthleteId(Long athleteId) {
        return phvMapper.selectLatestByAthleteId(athleteId);
    }

    @Override
    public ApmsPhvRecord calculateAndSave(Long athleteId, Long measureId) {
        // 1. 查询运动员
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null) {
            throw new ServiceException("运动员不存在：" + athleteId);
        }

        // 2. 查询体态测量记录
        ApmsBodyMeasure measure = measureMapper.selectById(measureId);
        if (measure == null) {
            throw new ServiceException("体态测量记录不存在：" + measureId);
        }

        // 3. 校验必要数据
        if (measure.getHeight() == null || measure.getSitHeight() == null
                || measure.getWeight() == null) {
            throw new ServiceException("体态测量数据不完整，缺少身高/坐高/体重");
        }
        if (athlete.getBirthday() == null) {
            throw new ServiceException("运动员未填写出生日期，无法计算精确年龄");
        }

        // 4. 计算精确年龄
        BigDecimal decimalAge = calcDecimalAge(athlete.getBirthday(), measure.getMeasureDate());

        // 5. 将数据组装到 ApmsPhvRecord，复用另一个 calculateAndSave 方法
        ApmsPhvRecord input = new ApmsPhvRecord();
        input.setAthleteId(athleteId);
        input.setSourceMeasureId(measureId);
        input.setGender(athlete.getGender());
        input.setMeasureDate(measure.getMeasureDate());
        input.setDecimalAge(decimalAge);
        input.setHeight(measure.getHeight());
        input.setSitHeight(measure.getSitHeight());
        input.setWeight(measure.getWeight());
        input.setFatherHeight(null);
        input.setMotherHeight(null);

        return doCalculateAndSave(input);
    }

    @Override
    public ApmsPhvRecord calculateAndSave(ApmsPhvRecord input) {
        // 从 body_measure 关联过来（如果有 sourceMeasureId 但缺少测量值）
        if (input.getSourceMeasureId() != null && input.getHeight() == null) {
            ApmsBodyMeasure measure = measureMapper.selectById(input.getSourceMeasureId());
            if (measure != null) {
                input.setHeight(measure.getHeight());
                input.setSitHeight(measure.getSitHeight());
                input.setWeight(measure.getWeight());
                input.setMeasureDate(measure.getMeasureDate());
            }
        }

        // 如果没有 decimal_age，尝试从 athlete birthday 计算
        if (input.getDecimalAge() == null && input.getAthleteId() != null) {
            ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(input.getAthleteId());
            if (athlete != null && athlete.getBirthday() != null) {
                Date refDate = input.getMeasureDate() != null ? input.getMeasureDate() : new Date();
                input.setDecimalAge(calcDecimalAge(athlete.getBirthday(), refDate));
                if (input.getGender() == null) {
                    input.setGender(athlete.getGender());
                }
            }
        }

        return doCalculateAndSave(input);
    }

    /**
     * 执行 Mirwald 计算 + 持久化
     */
    private ApmsPhvRecord doCalculateAndSave(ApmsPhvRecord input) {
        // 校验必要数据
        if (input.getDecimalAge() == null || input.getHeight() == null
                || input.getSitHeight() == null || input.getWeight() == null
                || input.getGender() == null) {
            throw new ServiceException("PHV计算参数不完整：需要年龄、身高、坐高、体重、性别");
        }

        // 构造 Mirwald 输入
        MirwaldCalculator.Input mInput = new MirwaldCalculator.Input();
        mInput.gender = input.getGender();
        mInput.decimalAge = input.getDecimalAge();
        mInput.height = input.getHeight();
        mInput.sitHeight = input.getSitHeight();
        mInput.weight = input.getWeight();

        // 计算
        MirwaldCalculator.Result result = MirwaldCalculator.calculate(mInput);

        // 组装记录
        ApmsPhvRecord record = new ApmsPhvRecord();
        record.setAthleteId(input.getAthleteId());
        record.setSourceMeasureId(input.getSourceMeasureId());
        record.setGender(input.getGender());
        record.setMeasureDate(input.getMeasureDate());
        record.setDecimalAge(input.getDecimalAge());
        record.setHeight(input.getHeight());
        record.setSitHeight(input.getSitHeight());
        record.setWeight(input.getWeight());
        record.setFatherHeight(input.getFatherHeight());
        record.setMotherHeight(input.getMotherHeight());
        record.setLegLength(result.legLength);
        record.setMaturityOffset(result.maturityOffset);
        record.setPredictedPhvAge(result.predictedPhvAge);
        record.setPredictedAdultHeight(null); // Khamis-Roche 未启用
        record.setMirwaldVersion(result.version);
        record.setKhamisVersion(null); // 未启用

        // 输入快照 JSON
        try {
            java.util.Map<String, Object> snapshot = new java.util.LinkedHashMap<>();
            snapshot.put("gender", input.getGender());
            snapshot.put("decimal_age", input.getDecimalAge());
            snapshot.put("height", input.getHeight());
            snapshot.put("sit_height", input.getSitHeight());
            snapshot.put("weight", input.getWeight());
            snapshot.put("leg_length_input", mInput.getLegLength());
            snapshot.put("measure_date", input.getMeasureDate());
            snapshot.put("source_measure_id", input.getSourceMeasureId());
            record.setInputSnapshot(MAPPER.writeValueAsString(snapshot));
        } catch (Exception e) {
            record.setInputSnapshot("{\"error\":\"snapshot_serialize_failed\"}");
        }

        record.setCreateBy(SecurityUtils.getUsername());
        phvMapper.insert(record);
        return record;
    }

    @Override
    public int deleteById(Long id) {
        return phvMapper.deleteById(id);
    }

    @Override
    public ApmsPhvRecord tryAutoCalculate(Long athleteId) {
        // 1. 查最新 body_measure
        ApmsBodyMeasure latest = measureMapper.selectLatestByAthleteId(athleteId);
        if (latest == null) {
            log.debug("[PHV auto] athleteId={} no body_measure → skip", athleteId);
            return null;
        }

        // 2. Mirwald 三指标齐吗？
        if (latest.getHeight() == null || latest.getSitHeight() == null || latest.getWeight() == null) {
            log.debug("[PHV auto] athleteId={} body_measure#{} incomplete (H={} sit={} W={}) → skip",
                athleteId, latest.getId(), latest.getHeight(), latest.getSitHeight(), latest.getWeight());
            return null; // 数据不齐，等下次触发
        }

        // 3. athlete birthday？
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null || athlete.getBirthday() == null) {
            log.debug("[PHV auto] athleteId={} no birthday → skip", athleteId);
            return null;
        }

        // 4. 去重：同一个 body_measure 已经算过 PHV？
        ApmsPhvRecord existing = phvMapper.selectBySourceMeasureId(athleteId, latest.getId());
        if (existing != null) {
            log.debug("[PHV auto] athleteId={} measureId={} already PHV#{} → skip",
                athleteId, latest.getId(), existing.getId());
            return null; // 已算过，跳过（幂等）
        }

        // 5. 计算并保存
        log.info("[PHV auto] athleteId={} measureId={} → Mirwald calculating...", athleteId, latest.getId());
        ApmsPhvRecord rec = calculateAndSave(athleteId, latest.getId());
        log.info("[PHV auto] athleteId={} PHV#{} offset={} predPHV={}", athleteId, rec.getId(), rec.getMaturityOffset(), rec.getPredictedPhvAge());

        // 6. 事件增量：PHV 新增可能改变 PHV_PEAK 因子，重算当日风险（异常不阻断主链路）
        try {
            rtpRiskService.scanOne(athleteId);
        } catch (Exception e) {
            log.warn("[rtp-risk] scanOne after PHV auto failed, athleteId={}: {}", athleteId, e.getMessage());
        }
        return rec;
    }

    /**
     * 计算精确年龄（从生日到参考日期的年数，带小数）
     * 使用 Period 计算整年 + 剩余天数/365.25
     */
    private BigDecimal calcDecimalAge(Date birthday, Date refDate) {
        LocalDate birth = birthday.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate ref = (refDate != null ? refDate : new Date())
                .toInstant().atZone(ZoneId.systemDefault()).toLocalDate();

        Period period = Period.between(birth, ref);
        int years = period.getYears();
        int months = period.getMonths();
        int days = period.getDays();

        // 月和天转成年的小数部分
        double fraction = (months * 30.0 + days) / 365.25;
        return new BigDecimal(years + fraction).setScale(4, RoundingMode.HALF_UP);
    }

    @Override
    public Map<String, Object> adultHeightDerivation(Long athleteId) {
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null) throw new ServiceException("运动员不存在：" + athleteId);

        Date calcDate = athlete.getAdultHeightCalcDate() != null
                ? athlete.getAdultHeightCalcDate() : new Date();

        // K-R 在体态保存时按"当时最新一条测量"的 H/W 计算（selectLatestByAthleteId 按 measure_date 排序）。
        // adult_height_calc_date 列为 DATE（无时分），故按测量日期 <= 计算日 复现当时最新测量。
        ApmsBodyMeasure source = null;
        LocalDate calcDay = calcDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        for (ApmsBodyMeasure m : measureMapper.selectByAthleteId(athleteId)) {
            if (m.getMeasureDate() == null) continue;
            LocalDate md = m.getMeasureDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            if (md.isAfter(calcDay)) continue;
            if (source == null
                    || md.isAfter(source.getMeasureDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate())
                    || (md.equals(source.getMeasureDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate())
                        && m.getId() > source.getId())) {
                source = m;
            }
        }

        // 年龄口径与 ApmsBodyMeasureServiceImpl#tryKhamisRoche 完全一致：
        // 年 + 月/12 + 天/365.25，参考点为计算时间（非测量日期）
        BigDecimal decimalAge = null;
        if (athlete.getBirthday() != null) {
            LocalDate birth = athlete.getBirthday().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            LocalDate ref = calcDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            Period p = Period.between(birth, ref);
            decimalAge = BigDecimal.valueOf(
                    p.getYears() + p.getMonths() / 12.0 + p.getDays() / 365.25);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("athleteId", athleteId);
        out.put("athleteName", athlete.getName());
        out.put("gender", athlete.getGender());
        out.put("version", athlete.getAdultHeightAlgo());
        out.put("savedHeight", athlete.getPredictedAdultHeight());
        out.put("calcDate", calcDate);
        out.put("decimalAge", decimalAge);
        if (source != null) {
            Map<String, Object> src = new LinkedHashMap<>();
            src.put("id", source.getId());
            src.put("measureDate", source.getMeasureDate());
            src.put("height", source.getHeight());
            src.put("weight", source.getWeight());
            out.put("sourceMeasure", src);
        }
        return out;
    }
}
