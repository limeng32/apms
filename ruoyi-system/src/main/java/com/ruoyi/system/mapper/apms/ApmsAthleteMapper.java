package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsAthlete;

/**
 * 运动员档案 Mapper
 *
 * @author apms
 */
public interface ApmsAthleteMapper {

    /** 根据ID查询 */
    ApmsAthlete selectApmsAthleteByAthleteId(Long athleteId);

    /** 列表查询（带 DataScope） */
    List<ApmsAthlete> selectApmsAthleteList(ApmsAthlete apmsAthlete);

    /** RTP 状态人数汇总（g/y/r/未评估，过滤条件与列表一致） */
    List<java.util.Map<String, Object>> selectRtpSummary(ApmsAthlete apmsAthlete);

    /** 新增 */
    int insertApmsAthlete(ApmsAthlete apmsAthlete);

    /** 修改 */
    int updateApmsAthlete(ApmsAthlete apmsAthlete);

    /** 删除（逻辑删除：改 status） */
    int deleteApmsAthleteByAthleteIds(Long[] athleteIds);

    /** 校验球衣号码唯一性（同队内） */
    ApmsAthlete checkJerseyNoUnique(Long teamId, String jerseyNo, Long excludeAthleteId);
}
