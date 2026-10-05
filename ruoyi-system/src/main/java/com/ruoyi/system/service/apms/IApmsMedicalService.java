package com.ruoyi.system.service.apms;

import java.util.List;
import java.util.Map;
import com.ruoyi.system.domain.apms.ApmsMedicalRecord;
import com.ruoyi.system.domain.apms.ApmsMedicalFile;

public interface IApmsMedicalService {
    List<ApmsMedicalRecord> list(ApmsMedicalRecord query);
    ApmsMedicalRecord getById(Long id);
    int add(ApmsMedicalRecord r, List<ApmsMedicalFile> files);
    int update(ApmsMedicalRecord r, List<ApmsMedicalFile> files);
    int delete(Long id);

    /**
     * 伤病部位分布统计（人体热力图）。
     * @param query 已注入 DataScope 的查询载体
     * @param range 12m=近12个月（默认）/ all=全部历史
     * @return site → {site,total,active} 列表，按总数降序
     */
    List<Map<String, Object>> siteStats(ApmsMedicalRecord query, String range);
}
