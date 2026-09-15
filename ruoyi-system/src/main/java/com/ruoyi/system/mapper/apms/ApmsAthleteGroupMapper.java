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

    /** 按小组查询所有成员（当前在组） */
    List<ApmsAthleteGroup> selectActiveByDeptId(Long deptId);

    /** 新增归属记录 */
    int insert(ApmsAthleteGroup group);

    /** 修改（主要用于写入 leave_date 关闭历史记录） */
    int update(ApmsAthleteGroup group);

    /** 关闭运动员所有当前在组记录（设置 leave_date 和 status） */
    int closeAllCurrentByAthleteId(@Param("athleteId") Long athleteId, @Param("leaveDate") Date leaveDate);
}
