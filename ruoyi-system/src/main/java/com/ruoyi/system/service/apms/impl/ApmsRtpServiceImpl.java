package com.ruoyi.system.service.apms.impl;

import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsRtpLog;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.mapper.apms.ApmsRtpLogMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpStatusMapper;
import com.ruoyi.system.service.apms.IApmsRtpService;

/**
 * RTP 状态管理 Service 实现
 * 关键规则：状态变更 + 日志写入必须在同一事务
 *
 * @author apms
 */
@Service
public class ApmsRtpServiceImpl implements IApmsRtpService {

    @Autowired
    private ApmsRtpStatusMapper rtpStatusMapper;

    @Autowired
    private ApmsRtpLogMapper rtpLogMapper;

    @Override
    public ApmsRtpStatus selectStatusByAthleteId(Long athleteId) {
        return rtpStatusMapper.selectByAthleteId(athleteId);
    }

    @Override
    public List<ApmsRtpStatus> selectStatusList() {
        return rtpStatusMapper.selectList();
    }

    @Override
    public List<ApmsRtpLog> selectLogByAthleteId(Long athleteId) {
        return rtpLogMapper.selectByAthleteId(athleteId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateRtpStatus(Long athleteId, String newStatus, String reason,
                                String trainingLimit, Date nextReviewDate) {
        // 1. 查询旧状态
        ApmsRtpStatus existing = rtpStatusMapper.selectByAthleteId(athleteId);
        String fromStatus = existing != null ? existing.getStatus() : null;

        // 2. 更新或插入 status
        String username = SecurityUtils.getUsername();
        if (existing != null) {
            ApmsRtpStatus update = new ApmsRtpStatus();
            update.setId(existing.getId());
            update.setStatus(newStatus);
            update.setReason(reason);
            update.setTrainingLimit(trainingLimit);
            update.setNextReviewDate(nextReviewDate);
            update.setUpdatedBy(username);
            rtpStatusMapper.update(update);
        } else {
            ApmsRtpStatus insert = new ApmsRtpStatus();
            insert.setAthleteId(athleteId);
            insert.setStatus(newStatus);
            insert.setReason(reason);
            insert.setTrainingLimit(trainingLimit);
            insert.setNextReviewDate(nextReviewDate);
            insert.setUpdatedBy(username);
            rtpStatusMapper.insert(insert);
        }

        // 3. 写入日志
        Long userId = SecurityUtils.getUserId();
        ApmsRtpLog log = new ApmsRtpLog();
        log.setAthleteId(athleteId);
        log.setFromStatus(fromStatus);
        log.setToStatus(newStatus);
        log.setReason(reason);
        log.setTrainingLimit(trainingLimit);
        log.setNextReviewDate(nextReviewDate);
        log.setOperatorId(userId != null ? userId : 0L);
        log.setOperatorName(username);
        rtpLogMapper.insert(log);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void clearRtpStatus(Long athleteId, String reason) {
        ApmsRtpStatus existing = rtpStatusMapper.selectByAthleteId(athleteId);
        if (existing == null) {
            return; // 本来就没评估过，不需要操作
        }

        String fromStatus = existing.getStatus();
        rtpStatusMapper.deleteByAthleteId(athleteId);

        // 写入清除日志
        Long userId = SecurityUtils.getUserId();
        ApmsRtpLog log = new ApmsRtpLog();
        log.setAthleteId(athleteId);
        log.setFromStatus(fromStatus);
        log.setToStatus(null); // 清除 = 回到未评估
        log.setReason(reason);
        log.setOperatorId(userId != null ? userId : 0L);
        log.setOperatorName(SecurityUtils.getUsername());
        rtpLogMapper.insert(log);
    }
}
