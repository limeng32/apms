package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsAthlete;

/**
 * 运动员档案 Service 接口
 *
 * @author apms
 */
public interface IApmsAthleteService {

    /** 查询运动员详情 */
    ApmsAthlete selectApmsAthleteByAthleteId(Long athleteId);

    /** 列表查询（带 DataScope） */
    List<ApmsAthlete> selectApmsAthleteList(ApmsAthlete apmsAthlete);

    /** 新增 */
    int insertApmsAthlete(ApmsAthlete apmsAthlete);

    /** 修改 */
    int updateApmsAthlete(ApmsAthlete apmsAthlete);

    /** 逻辑删除（改 status=1） */
    int deleteApmsAthleteByAthleteIds(Long[] athleteIds);

    /** 校验球衣号码同队唯一性 */
    boolean checkJerseyNoUnique(ApmsAthlete apmsAthlete);
}
