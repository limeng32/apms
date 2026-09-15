package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IApmsMedicalService;

@Service
public class ApmsMedicalServiceImpl implements IApmsMedicalService {

    @Autowired private ApmsMedicalRecordMapper recordMapper;
    @Autowired private ApmsMedicalFileMapper fileMapper;

    @Override
    public List<ApmsMedicalRecord> list(ApmsMedicalRecord query) {
        return recordMapper.selectList(query);
    }

    @Override
    public ApmsMedicalRecord getById(Long id) {
        ApmsMedicalRecord r = recordMapper.selectById(id);
        if (r != null) r.setFiles(fileMapper.selectByRecordId(id));
        return r;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int add(ApmsMedicalRecord r, List<ApmsMedicalFile> files) {
        r.setCreateBy(SecurityUtils.getUsername());
        recordMapper.insert(r);
        if (files != null) {
            for (ApmsMedicalFile f : files) {
                f.setRecordId(r.getId());
                f.setUploadBy(SecurityUtils.getUsername());
                fileMapper.insert(f);
            }
        }
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int update(ApmsMedicalRecord r, List<ApmsMedicalFile> files) {
        recordMapper.update(r);
        if (files != null) {
            // 简化：删旧增新（实际可做差异对比）
            fileMapper.deleteByRecordId(r.getId());
            for (ApmsMedicalFile f : files) {
                f.setId(null);
                f.setRecordId(r.getId());
                f.setUploadBy(SecurityUtils.getUsername());
                fileMapper.insert(f);
            }
        }
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int delete(Long id) {
        fileMapper.deleteByRecordId(id);
        return recordMapper.deleteById(id);
    }
}
