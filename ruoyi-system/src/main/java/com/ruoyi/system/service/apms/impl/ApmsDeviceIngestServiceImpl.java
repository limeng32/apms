package com.ruoyi.system.service.apms.impl;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsIndicatorMapper;
import com.ruoyi.system.service.apms.IApmsDeviceIngestService;
import com.ruoyi.system.service.apms.IApmsTestResultService;

/**
 * 设备接入一期：内存注册（假实现）+ 真实成绩落库。
 * 注册信息重启丢失；推过的成绩持久化在 apms_test_result，data_source=DEVICE:&lt;code&gt;。
 */
@Service
public class ApmsDeviceIngestServiceImpl implements IApmsDeviceIngestService {

    @Autowired private ApmsAthleteMapper athleteMapper;
    @Autowired private ApmsIndicatorMapper indicatorMapper;
    @Autowired private IApmsTestResultService testResultService;

    /** deviceCode → 设备档案 */
    private final Map<String, Map<String, Object>> devices = new ConcurrentHashMap<>();
    /** apiKey → deviceCode */
    private final Map<String, String> keyIndex = new ConcurrentHashMap<>();
    private final AtomicLong idSeq = new AtomicLong(0);

    @Override
    public synchronized Map<String, Object> register(String deviceCode, String deviceName,
                                                     String deviceType, String vendor) {
        if (deviceCode == null || deviceCode.trim().isEmpty()) {
            throw new ServiceException("deviceCode 不能为空");
        }
        deviceCode = deviceCode.trim();
        Map<String, Object> d = devices.get(deviceCode);
        if (d == null) {
            d = new LinkedHashMap<>();
            d.put("deviceId", idSeq.incrementAndGet());
            d.put("deviceCode", deviceCode);
            String apiKey = "dk-" + UUID.randomUUID().toString().replace("-", "");
            d.put("apiKey", apiKey);
            d.put("registeredAt", new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
            devices.put(deviceCode, d);
            keyIndex.put(apiKey, deviceCode);
        }
        if (deviceName != null) d.put("deviceName", deviceName);
        if (deviceType != null) d.put("deviceType", deviceType);
        if (vendor != null) d.put("vendor", vendor);
        d.put("status", "ONLINE");
        return new LinkedHashMap<>(d);
    }

    @Override
    public List<Map<String, Object>> listDevices() {
        return new ArrayList<>(devices.values());
    }

    @Override
    public Map<String, Object> push(String apiKey, Long athleteId, String athleteName,
                                    String indicatorCode, String value, String measureDate,
                                    String sessionKey) {
        if (apiKey == null || keyIndex.get(apiKey) == null) {
            throw new ServiceException("设备未注册或 apiKey 无效，请先调用 register");
        }
        String deviceCode = keyIndex.get(apiKey);

        // 1. 解析运动员
        Long resolvedAthleteId = athleteId;
        if (resolvedAthleteId == null && athleteName != null && !athleteName.trim().isEmpty()) {
            ApmsAthlete q = new ApmsAthlete();
            q.setName(athleteName.trim());
            List<ApmsAthlete> list = athleteMapper.selectApmsAthleteList(q);
            if (list.isEmpty()) throw new ServiceException("无法按姓名匹配运动员：" + athleteName);
            resolvedAthleteId = list.get(0).getAthleteId();
        }
        if (resolvedAthleteId == null) throw new ServiceException("缺少 athleteId/athleteName");

        // 2. 解析指标
        if (indicatorCode == null || indicatorCode.trim().isEmpty()) {
            throw new ServiceException("indicatorCode 不能为空");
        }
        ApmsIndicator indicator = indicatorMapper.selectByCode(indicatorCode.trim());
        if (indicator == null) throw new ServiceException("指标 code 不存在：" + indicatorCode);

        // 3. 组装结果（无任务绑定，与手工散录一致）
        Date date;
        try {
            date = (measureDate == null || measureDate.isEmpty())
                    ? new Date()
                    : new SimpleDateFormat("yyyy-MM-dd").parse(measureDate);
        } catch (Exception e) {
            throw new ServiceException("measureDate 格式应为 yyyy-MM-dd：" + measureDate);
        }

        ApmsTestResult result = new ApmsTestResult();
        result.setAthleteId(resolvedAthleteId);
        result.setIndicatorId(indicator.getId());
        result.setItemType("INDICATOR");
        result.setMeasureDate(date);
        result.setSessionKey(sessionKey);
        result.setIsValid("1");
        result.setIsSelected("1");
        result.setDataSource("DEVICE:" + deviceCode);

        ApmsTestResultValue rv = new ApmsTestResultValue();
        rv.setIndicatorId(indicator.getId());
        rv.setFieldKey("result");
        rv.setIsDerived("0");
        if (value != null) {
            try {
                rv.setNumericValue(new BigDecimal(value.trim()));
            } catch (NumberFormatException e) {
                rv.setTextValue(value);
            }
        }
        testResultService.add(result, Collections.singletonList(rv));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("resultId", result.getId());
        out.put("athleteId", resolvedAthleteId);
        out.put("indicatorCode", indicator.getCode());
        out.put("deviceCode", deviceCode);
        out.put("measureDate", new SimpleDateFormat("yyyy-MM-dd").format(date));
        return out;
    }
}
