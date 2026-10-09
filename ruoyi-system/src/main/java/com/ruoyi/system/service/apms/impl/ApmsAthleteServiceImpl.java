package com.ruoyi.system.service.apms.impl;

import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.mapper.apms.ApmsAthleteGroupMapper;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.service.apms.IApmsAthleteService;

/**
 * 运动员档案 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsAthleteServiceImpl implements IApmsAthleteService {

    @Autowired
    private ApmsAthleteMapper athleteMapper;

    @Autowired
    private ApmsAthleteGroupMapper groupMapper;

    @Override
    public ApmsAthlete selectApmsAthleteByAthleteId(Long athleteId) {
        return athleteMapper.selectApmsAthleteByAthleteId(athleteId);
    }

    @Override
    public List<ApmsAthlete> selectApmsAthleteList(ApmsAthlete apmsAthlete) {
        return athleteMapper.selectApmsAthleteList(apmsAthlete);
    }

    @Override
    public List<java.util.Map<String, Object>> selectRtpSummary(ApmsAthlete apmsAthlete) {
        return athleteMapper.selectRtpSummary(apmsAthlete);
    }

    @Override
    public int insertApmsAthlete(ApmsAthlete apmsAthlete) {
        // 校验球衣号码同队唯一
        if (!checkJerseyNoUnique(apmsAthlete)) {
            throw new ServiceException(String.format("球衣号码 %s 在该队伍已存在", apmsAthlete.getJerseyNo()));
        }
        return athleteMapper.insertApmsAthlete(apmsAthlete);
    }

    @Override
    public int updateApmsAthlete(ApmsAthlete apmsAthlete) {
        boolean leaving = "1".equals(apmsAthlete.getStatus()) || "2".equals(apmsAthlete.getStatus());
        // 离队/退役无需校验球衣号（队伍归属即将解除）；在队编辑才校验
        if (!leaving && !checkJerseyNoUnique(apmsAthlete)) {
            throw new ServiceException(String.format("球衣号码 %s 在该队伍已存在", apmsAthlete.getJerseyNo()));
        }
        int rows = athleteMapper.updateApmsAthlete(apmsAthlete);
        if (leaving) {
            detachFromTeams(apmsAthlete.getAthleteId(), apmsAthlete.getStatus());
        }
        return rows;
    }

    /**
     * 离队（逻辑删除）：解除与原队伍及小组的全部当前归属。
     * 离队/退役后运动员与原队伍再无关系，primary_team_id 置空，
     * 当前在组记录写入 leave_date 关闭（历史轨迹保留在归属历史表）。
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteApmsAthleteByAthleteIds(Long[] athleteIds) {
        int rows = athleteMapper.deleteApmsAthleteByAthleteIds(athleteIds);
        for (Long athleteId : athleteIds) {
            detachFromTeams(athleteId, "1");
        }
        return rows;
    }

    /** 解除运动员与队伍/小组的当前归属 */
    private void detachFromTeams(Long athleteId, String status) {
        athleteMapper.leaveTeamByAthleteId(athleteId, status);
        groupMapper.closeAllCurrentByAthleteId(athleteId, new Date());
    }

    @Override
    public boolean checkJerseyNoUnique(ApmsAthlete apmsAthlete) {
        if (apmsAthlete.getJerseyNo() == null || apmsAthlete.getJerseyNo().isEmpty()) {
            return true; // 球衣号非必填，空值不做唯一性校验
        }
        ApmsAthlete existing = athleteMapper.checkJerseyNoUnique(
                apmsAthlete.getPrimaryTeamId(),
                apmsAthlete.getJerseyNo(),
                apmsAthlete.getAthleteId() == null ? -1L : apmsAthlete.getAthleteId());
        return existing == null;
    }
}
