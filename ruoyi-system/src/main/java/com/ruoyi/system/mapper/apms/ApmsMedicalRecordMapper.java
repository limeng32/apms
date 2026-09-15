package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsMedicalRecord;

public interface ApmsMedicalRecordMapper {
    ApmsMedicalRecord selectById(Long id);
    List<ApmsMedicalRecord> selectList(ApmsMedicalRecord query);
    int insert(ApmsMedicalRecord r);
    int update(ApmsMedicalRecord r);
    int deleteById(Long id);
    int deleteByAthleteId(Long athleteId);
}
