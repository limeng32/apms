package com.ruoyi.system.service.apms.impl;

import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.mapper.SysDeptMapper;
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

    @Autowired
    private SysDeptMapper sysDeptMapper;

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
        // 在队（含新建默认在队）必须挂靠有效队伍；离队/退役不强制
        if (isActiveStatus(apmsAthlete.getStatus())) {
            validateActiveTeam(apmsAthlete.getPrimaryTeamId());
        }
        // 校验球衣号码同队唯一
        if (!checkJerseyNoUnique(apmsAthlete)) {
            throw new ServiceException(String.format("球衣号码 %s 在该队伍已存在", apmsAthlete.getJerseyNo()));
        }
        return athleteMapper.insertApmsAthlete(apmsAthlete);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int updateApmsAthlete(ApmsAthlete apmsAthlete) {
        boolean leaving = "1".equals(apmsAthlete.getStatus()) || "2".equals(apmsAthlete.getStatus());
        if (leaving) {
            // 离队/退役无需校验球衣号（队伍归属即将解除）
            int rows = athleteMapper.updateApmsAthlete(apmsAthlete);
            // 主队伍置空 + 关闭全部在组小组，须与主表更新同一事务
            detachFromTeams(apmsAthlete.getAthleteId(), apmsAthlete.getStatus());
            return rows;
        }
        // 在队（status=0/空）：必须挂靠有效队伍，防止直调 API 造出 status=0 但无队伍的幽灵队员
        validateActiveTeam(apmsAthlete.getPrimaryTeamId());
        if (!checkJerseyNoUnique(apmsAthlete)) {
            throw new ServiceException(String.format("球衣号码 %s 在该队伍已存在", apmsAthlete.getJerseyNo()));
        }
        return athleteMapper.updateApmsAthlete(apmsAthlete);
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

    /** 是否在队状态：status 为空时按建表默认值 '0' 在队处理 */
    private boolean isActiveStatus(String status) {
        return status == null || status.isEmpty() || "0".equals(status);
    }

    /**
     * 在队运动员必须挂靠有效主属队伍（Service 层硬校验，前端可绕过，不能只靠页面规则）：
     * 队伍存在、未删除、未停用，且 dept_type=20（队伍层级，不能挂机构/小组）。
     */
    private void validateActiveTeam(Long primaryTeamId) {
        if (primaryTeamId == null) {
            throw new ServiceException("在队运动员必须选择主属队伍");
        }
        SysDept dept = sysDeptMapper.selectDeptById(primaryTeamId);
        if (dept == null || "2".equals(dept.getDelFlag())) {
            throw new ServiceException("所选主属队伍不存在或已删除，请重新选择");
        }
        if (!"20".equals(dept.getDeptType())) {
            throw new ServiceException("主属队伍必须选择队伍层级部门");
        }
        if ("1".equals(dept.getStatus())) {
            throw new ServiceException("所选主属队伍已停用，请先启用或更换队伍");
        }
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
