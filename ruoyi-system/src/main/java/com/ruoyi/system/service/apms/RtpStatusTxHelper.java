package com.ruoyi.system.service.apms;

import java.util.Date;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsRtpLog;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.mapper.apms.ApmsRtpLogMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpStatusMapper;

/**
 * RTP 状态写入事务 Helper
 *
 * 独立 Bean 承载 {@code @Transactional} 写操作：
 * - 单人接口 / 风险采纳：REQUIRED 传播，沿用原有同事务保证；
 * - 批量循环：每次调用都是跨 Bean 的独立事务，一人失败回滚一人，实现部分成功
 *   （若在 ApmsRtpServiceImpl 内 this 自调用，事务代理不生效，会变成一人失败整批回滚）。
 *
 * @author apms
 */
@Service
public class RtpStatusTxHelper {

    @Autowired
    private ApmsRtpStatusMapper rtpStatusMapper;

    @Autowired
    private ApmsRtpLogMapper rtpLogMapper;

    /**
     * 更新RTP状态（同时写入变更日志，状态与日志同一事务）
     * 无旧记录则 INSERT 新 status + 写 from_status=NULL 的 log
     * 有旧记录则 UPDATE status + 写带 from_status 的 log
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateRtpStatusTx(Long athleteId, String newStatus, String reason,
                                  String trainingLimit, Date nextReviewDate) {
        // 1. 查询旧状态
        ApmsRtpStatus existing = rtpStatusMapper.selectByAthleteId(athleteId);
        String fromStatus = existing != null ? existing.getStatus() : null;

        // 2. 更新或插入 status（四个字段显式赋值：传 null 即清空，例如转绿时清空旧训练限制）
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

    /** 清除RTP状态（回到未评估），状态删除与清除日志同一事务 */
    @Transactional(rollbackFor = Exception.class)
    public void clearRtpStatusTx(Long athleteId, String reason) {
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
