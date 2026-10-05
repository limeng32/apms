package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.*;
import com.ruoyi.system.mapper.apms.*;
import com.ruoyi.system.service.apms.IApmsMedicalService;
import com.ruoyi.system.service.apms.IRtpRiskService;

@Service
public class ApmsMedicalServiceImpl implements IApmsMedicalService {

    private static final Logger log = LoggerFactory.getLogger(ApmsMedicalServiceImpl.class);

    @Autowired private ApmsMedicalRecordMapper recordMapper;
    @Autowired private ApmsMedicalFileMapper fileMapper;
    @Autowired private IRtpRiskService rtpRiskService;

    /** 事件增量：医疗变更后重算当日 RTP 风险，异常只记日志不阻断主写入链路 */
    private void refreshRisk(Long athleteId) {
        if (athleteId == null) return;
        try {
            rtpRiskService.scanOne(athleteId);
        } catch (Exception e) {
            log.warn("[rtp-risk] scanOne after medical write failed, athleteId={}: {}",
                    athleteId, e.getMessage());
        }
    }

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
        refreshRisk(r.getAthleteId());
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
        refreshRisk(r.getAthleteId());
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int delete(Long id) {
        ApmsMedicalRecord existing = recordMapper.selectById(id);
        fileMapper.deleteByRecordId(id);
        int rows = recordMapper.deleteById(id);
        if (existing != null) {
            refreshRisk(existing.getAthleteId());
        }
        return rows;
    }
}
