package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsReport;

public interface ApmsReportMapper {
    ApmsReport selectById(Long id);
    List<ApmsReport> selectList(ApmsReport query);
    int insert(ApmsReport r);
    int update(ApmsReport r);
    int deleteById(Long id);
}
