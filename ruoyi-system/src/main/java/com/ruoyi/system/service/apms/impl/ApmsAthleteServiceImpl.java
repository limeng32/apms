package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsAthlete;
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

    @Override
    public ApmsAthlete selectApmsAthleteByAthleteId(Long athleteId) {
        return athleteMapper.selectApmsAthleteByAthleteId(athleteId);
    }

    @Override
    public List<ApmsAthlete> selectApmsAthleteList(ApmsAthlete apmsAthlete) {
        return athleteMapper.selectApmsAthleteList(apmsAthlete);
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
        // 校验球衣号码同队唯一
        if (!checkJerseyNoUnique(apmsAthlete)) {
            throw new ServiceException(String.format("球衣号码 %s 在该队伍已存在", apmsAthlete.getJerseyNo()));
        }
        return athleteMapper.updateApmsAthlete(apmsAthlete);
    }

    @Override
    public int deleteApmsAthleteByAthleteIds(Long[] athleteIds) {
        return athleteMapper.deleteApmsAthleteByAthleteIds(athleteIds);
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
