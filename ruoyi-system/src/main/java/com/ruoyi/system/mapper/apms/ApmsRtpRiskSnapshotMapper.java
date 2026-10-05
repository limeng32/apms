package com.ruoyi.system.mapper.apms;

import java.util.Date;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsRtpRiskSnapshot;

/**
 * RTP 风险每日快照 Mapper
 *
 * @author apms
 */
public interface ApmsRtpRiskSnapshotMapper {

    /** 主键查询（JOIN 队员信息） */
    ApmsRtpRiskSnapshot selectById(Long id);

    /** 行锁查询（采纳事务内 SELECT ... FOR UPDATE，串行化并发处置） */
    ApmsRtpRiskSnapshot selectByIdForUpdate(@Param("id") Long id);

    /** 按运动员 + 日期查唯一快照（uk_athlete_date） */
    ApmsRtpRiskSnapshot selectByAthleteAndDate(@Param("athleteId") Long athleteId,
                                               @Param("snapshotDate") Date snapshotDate);

    /** 运动员最新一条 ACTIVE 且非 NONE 的快照（详情页"当前系统建议"横幅） */
    ApmsRtpRiskSnapshot selectLatestActiveByAthlete(@Param("athleteId") Long athleteId);

    /** 待办/已处理列表（DataScope + 级别/状态/队伍/姓名过滤） */
    List<ApmsRtpRiskSnapshot> selectList(ApmsRtpRiskSnapshot query);

    /** 新增 */
    int insert(ApmsRtpRiskSnapshot snapshot);

    /** 仅当快照仍为 ACTIVE 时覆盖重算结果（人工终态不被扫描覆盖）；返回影响行数 */
    int updateIfActive(ApmsRtpRiskSnapshot snapshot);

    /**
     * 处置推进（ACKED/ACCEPTED/DISMISSED），仅当当前 status='ACTIVE' 时生效。
     * 返回 0 表示已被并发处置（幂等场景）。
     */
    int markHandled(ApmsRtpRiskSnapshot snapshot);

    /** 早于指定日期的 ACTIVE 快照置 EXPIRED（每日扫描首步） */
    int expireBefore(@Param("snapshotDate") Date snapshotDate);
}
