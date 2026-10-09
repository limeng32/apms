package com.ruoyi.system.mapper.apms;

import java.util.Date;
import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.system.domain.apms.ApmsAthleteGroup;

/**
 * 运动员-小组归属历史 Mapper
 *
 * @author apms
 */
public interface ApmsAthleteGroupMapper {

    /** 按运动员查询历史（按 join_date DESC 排序） */
    List<ApmsAthleteGroup> selectByAthleteId(Long athleteId);

    /** 按运动员查询当前在组记录（leave_date IS NULL 且 status=0） */
    ApmsAthleteGroup selectCurrentByAthleteId(Long athleteId);

    /** 查询运动员在指定小组的当前在组记录（多组并存；加入前防重复） */
    ApmsAthleteGroup selectCurrentByAthleteAndDept(@Param("athleteId") Long athleteId, @Param("deptId") Long deptId);

    /** 按小组查询所有成员（当前在组） */
    List<ApmsAthleteGroup> selectActiveByDeptId(Long deptId);

    /** 统计小组当前在组成员数量（leave_date IS NULL 且 status=0；删除部门前校验） */
    int countActiveByDeptId(Long deptId);

    /** 新增归属记录 */
    int insert(ApmsAthleteGroup group);

    /** 修改（主要用于写入 leave_date 关闭历史记录） */
    int update(ApmsAthleteGroup group);

    /** 关闭运动员所有当前在组记录（离队/退役用；设置 leave_date 和 status） */
    int closeAllCurrentByAthleteId(@Param("athleteId") Long athleteId, @Param("leaveDate") Date leaveDate);

    /** 离开指定小组：仅关闭 athlete+dept 这一条在组记录（多组并存，不影响其他组） */
    int closeCurrentByAthleteAndDept(@Param("athleteId") Long athleteId,
                                     @Param("deptId") Long deptId,
                                     @Param("leaveDate") Date leaveDate);

    /**
     * 赛季晋升：关闭运动员挂在原队伍子树下的全部在组小组。
     * 小组挂队伍下（dept_type 30/40/50），dept_id=teamId 或其 ancestors 含 teamId 均属旧队子树。
     */
    int closeCurrentByTeamSubTree(@Param("athleteId") Long athleteId,
                                  @Param("teamId") Long teamId,
                                  @Param("leaveDate") Date leaveDate);
}
