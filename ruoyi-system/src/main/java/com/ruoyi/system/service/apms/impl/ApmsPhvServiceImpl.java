package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
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
import com.ruoyi.system.util.apms.MirwaldCalculator;

/**
 * PHV测量与计算记录 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsPhvServiceImpl implements IApmsPhvService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private ApmsPhvRecordMapper phvMapper;

    @Autowired
    private ApmsBodyMeasureMapper measureMapper;

    @Autowired
    private ApmsAthleteMapper athleteMapper;

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
}
