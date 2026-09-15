package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsMedicalRecord;
import com.ruoyi.system.domain.apms.ApmsMedicalFile;

public interface IApmsMedicalService {
    List<ApmsMedicalRecord> list(ApmsMedicalRecord query);
    ApmsMedicalRecord getById(Long id);
    int add(ApmsMedicalRecord r, List<ApmsMedicalFile> files);
    int update(ApmsMedicalRecord r, List<ApmsMedicalFile> files);
    int delete(Long id);
}
