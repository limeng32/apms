package com.ruoyi.system.service.apms.impl;

import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthleteGroup;
import com.ruoyi.system.mapper.apms.ApmsAthleteGroupMapper;
import com.ruoyi.system.service.apms.IApmsAthleteGroupService;

/**
 * 运动员-小组归属历史 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsAthleteGroupServiceImpl implements IApmsAthleteGroupService {

    @Autowired
    private ApmsAthleteGroupMapper groupMapper;

    @Override
    public List<ApmsAthleteGroup> selectByAthleteId(Long athleteId) {
        return groupMapper.selectByAthleteId(athleteId);
    }

    @Override
    public ApmsAthleteGroup selectCurrentByAthleteId(Long athleteId) {
        return groupMapper.selectCurrentByAthleteId(athleteId);
    }

    @Override
    public List<ApmsAthleteGroup> selectActiveByDeptId(Long deptId) {
        return groupMapper.selectActiveByDeptId(deptId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int joinGroup(Long athleteId, Long deptId, Date joinDate) {
        // 先关闭所有当前在组记录
        Date now = new Date();
        Date effectiveJoinDate = joinDate != null ? joinDate : now;
        groupMapper.closeAllCurrentByAthleteId(athleteId, effectiveJoinDate);

        // 插入新的归属记录
        ApmsAthleteGroup group = new ApmsAthleteGroup();
        group.setAthleteId(athleteId);
        group.setDeptId(deptId);
        group.setJoinDate(effectiveJoinDate);
        group.setStatus("0");
        group.setCreateBy(SecurityUtils.getUsername());
        return groupMapper.insert(group);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int leaveGroup(Long athleteId, Date leaveDate) {
        Date now = new Date();
        Date effectiveLeaveDate = leaveDate != null ? leaveDate : now;
        return groupMapper.closeAllCurrentByAthleteId(athleteId, effectiveLeaveDate);
    }
}
