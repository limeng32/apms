package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsMedicalFile;
import org.apache.ibatis.annotations.Param;

public interface ApmsMedicalFileMapper {
    ApmsMedicalFile selectById(Long id);
    List<ApmsMedicalFile> selectByRecordId(Long recordId);
    int insert(ApmsMedicalFile f);
    int deleteById(Long id);
    int deleteByRecordId(@Param("recordId") Long recordId);
}
