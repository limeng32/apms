package com.ruoyi.system.service.apms.impl;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsRtpLog;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.domain.apms.dto.RtpBatchUpdateForm;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpLogMapper;
import com.ruoyi.system.mapper.apms.ApmsRtpStatusMapper;
import com.ruoyi.system.service.apms.IApmsRtpService;
import com.ruoyi.system.service.apms.RtpStatusTxHelper;

/**
 * RTP 状态管理 Service 实现
 * 关键规则：状态变更 + 日志写入必须在同一事务（写入逻辑见 RtpStatusTxHelper）
 *
 * @author apms
 */
@Service
public class ApmsRtpServiceImpl implements IApmsRtpService {

    /** 合法状态枚举 */
    private static final Set<String> VALID_STATUS = Set.of("g", "y", "r");

    @Autowired
    private ApmsRtpStatusMapper rtpStatusMapper;

    @Autowired
    private ApmsRtpLogMapper rtpLogMapper;

    @Autowired
    private RtpStatusTxHelper txHelper;

    @Autowired
    private ApmsAthleteMapper athleteMapper;

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
    public void updateRtpStatus(Long athleteId, String newStatus, String reason,
                                String trainingLimit, Date nextReviewDate) {
        txHelper.updateRtpStatusTx(athleteId, newStatus, normalize(reason),
                normalize(trainingLimit), nextReviewDate);
    }

    /**
     * 批量评估：本方法不加事务——每次 txHelper 调用都是独立事务，逐人提交、部分成功。
     */
    @Override
    public RtpBatchResult batchUpdateRtpStatus(List<RtpBatchUpdateForm.Item> rawItems) {
        if (rawItems == null || rawItems.isEmpty()) {
            throw new ServiceException("请至少选择一名队员进行评估");
        }
        if (rawItems.size() > RtpBatchUpdateForm.MAX_ITEMS) {
            throw new ServiceException("单次批量评估不能超过 " + RtpBatchUpdateForm.MAX_ITEMS + " 人");
        }

        // 按 athleteId 去重（保留首次出现的顺序与内容，重复条目计入失败）
        Map<Long, RtpBatchUpdateForm.Item> dedup = new LinkedHashMap<>();
        List<RtpBatchResult.ItemResult> results = new ArrayList<>();
        for (RtpBatchUpdateForm.Item item : rawItems) {
            RtpBatchResult.ItemResult r = new RtpBatchResult.ItemResult();
            Long athleteId = item != null ? item.getAthleteId() : null;
            r.athleteId = athleteId;
            if (athleteId == null) {
                r.status = "failed";
                r.reason = "缺少运动员ID";
                results.add(r);
                continue;
            }
            if (dedup.putIfAbsent(athleteId, item) != null) {
                r.status = "failed";
                r.reason = "同一运动员重复提交";
                results.add(r);
                continue;
            }
            results.add(r);
        }

        int success = 0;
        int failed = 0;
        for (RtpBatchResult.ItemResult r : results) {
            if ("failed".equals(r.status)) {
                failed++;
                continue;
            }
            Long athleteId = r.athleteId;
            RtpBatchUpdateForm.Item item = dedup.get(athleteId);

            // 回显姓名（失败/成功都带，便于前端直接渲染结果表）
            ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
            if (athlete != null) {
                r.athleteName = athlete.getName();
            }

            String status = item.getStatus();
            if (!VALID_STATUS.contains(status)) {
                r.status = "failed";
                r.reason = "状态值非法：" + status;
                failed++;
                continue;
            }

            try {
                // 转绿时前端传 null 清空训练限制；空白字符串统一归一化为 null
                txHelper.updateRtpStatusTx(athleteId, status,
                        normalize(item.getReason()), normalize(item.getTrainingLimit()),
                        item.getNextReviewDate());
                r.status = "success";
                success++;
            } catch (Exception e) {
                r.status = "failed";
                r.reason = StringUtils.isNotEmpty(e.getMessage()) ? e.getMessage() : "评估写入失败";
                failed++;
            }
        }

        RtpBatchResult result = new RtpBatchResult();
        result.items = results;
        result.total = dedup.size();
        result.successCount = success;
        result.failedCount = failed;
        return result;
    }

    @Override
    public void clearRtpStatus(Long athleteId, String reason) {
        txHelper.clearRtpStatusTx(athleteId, normalize(reason));
    }

    /** 空白字符串归一化为 null，避免写入不可见的空格内容 */
    private String normalize(String s) {
        String t = StringUtils.trim(s);
        return StringUtils.isEmpty(t) ? null : t;
    }
}
