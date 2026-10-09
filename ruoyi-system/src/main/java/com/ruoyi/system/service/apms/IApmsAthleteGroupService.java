package com.ruoyi.system.service.apms;

import java.util.Date;
import java.util.List;
import com.ruoyi.system.domain.apms.ApmsAthleteGroup;

/**
 * 运动员-小组归属历史 Service 接口
 *
 * @author apms
 */
public interface IApmsAthleteGroupService {

    /** 查询运动员归属历史 */
    List<ApmsAthleteGroup> selectByAthleteId(Long athleteId);

    /** 查询运动员当前在组记录 */
    ApmsAthleteGroup selectCurrentByAthleteId(Long athleteId);

    /** 按小组查询当前在组成员 */
    List<ApmsAthleteGroup> selectActiveByDeptId(Long deptId);

    /**
     * 加入小组（多组并存：不影响该运动员的其他在组记录）。
     * Service 层校验：运动员存在且在队、目标为有效训练/科研/恢复小组、未重复加入。
     */
    int joinGroup(Long athleteId, Long deptId, Date joinDate);

    /**
     * 离开指定小组（多组并存：仅关闭 athlete+deptId 这一条在组记录）。
     * @param deptId 要离开的小组ID，必填
     */
    int leaveGroup(Long athleteId, Long deptId, Date leaveDate);
}
