package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsRtpLog;

/**
 * RTP状态变更日志 Mapper
 *
 * @author apms
 */
public interface ApmsRtpLogMapper {

    /** 按运动员查询历史（按 operate_time DESC） */
    List<ApmsRtpLog> selectByAthleteId(Long athleteId);

    /** 新增日志 */
    int insert(ApmsRtpLog log);
}
