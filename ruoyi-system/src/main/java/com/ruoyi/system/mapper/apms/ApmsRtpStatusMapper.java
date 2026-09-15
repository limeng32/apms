package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;

/**
 * RTP当前状态 Mapper
 *
 * @author apms
 */
public interface ApmsRtpStatusMapper {

    /** 按运动员ID查询 */
    ApmsRtpStatus selectByAthleteId(Long athleteId);

    /** 列表查询（全量，用于统计） */
    List<ApmsRtpStatus> selectList();

    /** 新增（upsert：UNIQUE athlete_id） */
    int insert(ApmsRtpStatus status);

    /** 修改 */
    int update(ApmsRtpStatus status);

    /** 按运动员ID删除 */
    int deleteByAthleteId(Long athleteId);
}
