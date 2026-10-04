package com.ruoyi.system.service.apms;

import java.util.List;
import java.util.Map;

/**
 * 测试设备接入（一期：内存假实现，重启后注册信息丢失）
 *
 * <p>设备流程：register 注册拿 apiKey → push 用 apiKey 推送成绩（真实写入 apms_test_result）。
 */
public interface IApmsDeviceIngestService {

    /** 注册/更新设备，返回设备信息（含 apiKey） */
    Map<String, Object> register(String deviceCode, String deviceName, String deviceType, String vendor);

    /** 列出已注册设备 */
    List<Map<String, Object>> listDevices();

    /**
     * 设备推送一条成绩
     *
     * @param apiKey       注册时颁发的密钥
     * @param athleteId    运动员 ID（与 athleteName 二选一）
     * @param athleteName  运动员姓名（athleteId 为空时按姓名解析）
     * @param indicatorCode 指标 code
     * @param value        数值
     * @param measureDate  测试日期 yyyy-MM-dd（可空，默认今天）
     * @param sessionKey   场次标识（可空）
     * @return 写入结果（resultId 等）
     */
    Map<String, Object> push(String apiKey, Long athleteId, String athleteName,
                             String indicatorCode, String value, String measureDate, String sessionKey);
}
