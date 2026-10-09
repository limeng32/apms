package com.ruoyi.system.mapper.apms;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.common.core.domain.entity.SysDept;
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

    /** 全量有效部门（赛季晋升：用于按名称识别 U 档梯队） */
    List<SysDept> selectAllValidDepts();

    /** 全量在训（status='0'）运动员（赛季晋升：含挂在非 U 档/失效部门的队员） */
    List<ApmsAthlete> selectAllActiveAthletes();

    /** 赛季晋升专用：仅更新主队伍（不走球衣号唯一校验） */
    int updatePrimaryTeam(@Param("athleteId") Long athleteId,
                          @Param("teamId") Long teamId,
                          @Param("updateBy") String updateBy);

    /** 统计某部门下当前在队（status='0'）运动员数量（删除部门前的人员占用校验） */
    int countActiveByPrimaryTeamId(Long deptId);

    /** 编辑保存时置为离队/退役并解除队伍归属 */
    int leaveTeamByAthleteId(@Param("athleteId") Long athleteId, @Param("status") String status);
}
