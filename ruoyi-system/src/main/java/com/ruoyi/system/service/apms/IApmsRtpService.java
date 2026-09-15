package com.ruoyi.system.service.apms;

import java.util.Date;
import java.util.List;
import com.ruoyi.system.domain.apms.ApmsRtpLog;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;

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

    /** 清除RTP状态（改为未评估），同时写入日志 */
    void clearRtpStatus(Long athleteId, String reason);
}
