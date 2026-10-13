package com.ruoyi.system.service.apms;

import java.util.Date;
import java.util.List;
import com.ruoyi.system.domain.apms.ApmsRtpLog;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.domain.apms.dto.RtpBatchUpdateForm;

/**
 * RTP 状态管理 Service 接口
 *
 * @author apms
 */
public interface IApmsRtpService {

    /** 查询运动员当前RTP状态（无记录=未评估） */
    ApmsRtpStatus selectStatusByAthleteId(Long athleteId);

    /** 列表查询（用于统计） */
    List<ApmsRtpStatus> selectStatusList();

    /** 查询RTP变更历史 */
    List<ApmsRtpLog> selectLogByAthleteId(Long athleteId);

    /**
     * 更新RTP状态（同时写入变更日志，事务绑定）
     * 无旧记录则 INSERT 新 status + 写 from_status=NULL 的 log
     * 有旧记录则 UPDATE status + 写带 from_status 的 log
     */
    void updateRtpStatus(Long athleteId, String newStatus, String reason,
                         String trainingLimit, Date nextReviewDate);

    /**
     * 批量更新RTP状态：逐人独立事务，部分成功；非法条目计入 failed，不中断整批。
     * 入参非法（空 / 超上限）抛 ServiceException 由全局异常处理返回。
     */
    RtpBatchResult batchUpdateRtpStatus(List<RtpBatchUpdateForm.Item> items);

    /** 清除RTP状态（改为未评估），同时写入日志 */
    void clearRtpStatus(Long athleteId, String reason);

    /** 批量评估结果（口径对齐组合评分 BatchResult） */
    class RtpBatchResult {
        /** 去重后实际处理总人数 */
        public int total;
        public int successCount;
        public int failedCount;
        /** 逐人结果，顺序与去重后的入参一致 */
        public List<ItemResult> items;

        public static class ItemResult {
            public Long athleteId;
            public String athleteName;
            /** success / failed */
            public String status;
            /** 失败原因（成功为 null） */
            public String reason;
        }
    }
}
