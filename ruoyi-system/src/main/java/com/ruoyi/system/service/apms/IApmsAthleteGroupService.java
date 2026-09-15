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

    /** 加入小组（自动关闭之前在组记录） */
    int joinGroup(Long athleteId, Long deptId, Date joinDate);

    /** 离开小组 */
    int leaveGroup(Long athleteId, Date leaveDate);
}
