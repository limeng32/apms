package com.ruoyi.system.service.apms.impl;

import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsAthleteGroup;
import com.ruoyi.system.mapper.SysDeptMapper;
import com.ruoyi.system.mapper.apms.ApmsAthleteGroupMapper;
import com.ruoyi.system.mapper.apms.ApmsAthleteMapper;
import com.ruoyi.system.service.apms.IApmsAthleteGroupService;

/**
 * 运动员-小组归属历史 Service 实现
 *
 * <p>多组并存模型：一名运动员可同时属于多个训练/科研/恢复小组，
 * 加入新组不影响其他在组记录，离组必须指定具体小组。</p>
 *
 * @author apms
 */
@Service
public class ApmsAthleteGroupServiceImpl implements IApmsAthleteGroupService {

    @Autowired
    private ApmsAthleteGroupMapper groupMapper;

    @Autowired
    private ApmsAthleteMapper athleteMapper;

    @Autowired
    private SysDeptMapper sysDeptMapper;

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
        if (athleteId == null) {
            throw new ServiceException("运动员ID不能为空");
        }
        if (deptId == null) {
            throw new ServiceException("请选择目标小组");
        }
        // 运动员必须存在且在队（离队/退役者先归队才能编组）
        ApmsAthlete athlete = athleteMapper.selectApmsAthleteByAthleteId(athleteId);
        if (athlete == null) {
            throw new ServiceException("运动员不存在");
        }
        if (!"0".equals(athlete.getStatus())) {
            throw new ServiceException("运动员已离队或退役，不能加入小组");
        }
        // 目标必须是有效小组（dept_type 30训练/40科研/50恢复），不能是队伍或机构
        SysDept dept = sysDeptMapper.selectDeptById(deptId);
        if (dept == null || "2".equals(dept.getDelFlag())) {
            throw new ServiceException("目标小组不存在或已删除");
        }
        String deptType = dept.getDeptType();
        if (!"30".equals(deptType) && !"40".equals(deptType) && !"50".equals(deptType)) {
            throw new ServiceException("只能加入训练小组、科研小组或恢复小组");
        }
        if ("1".equals(dept.getStatus())) {
            throw new ServiceException("目标小组已停用，不能加入");
        }
        // 多组并存：同一小组不可重复加入，但不影响其在其他小组的在组记录
        if (groupMapper.selectCurrentByAthleteAndDept(athleteId, deptId) != null) {
            throw new ServiceException("该运动员已在此小组中，无需重复加入");
        }

        Date effectiveJoinDate = joinDate != null ? joinDate : new Date();
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
    public int leaveGroup(Long athleteId, Long deptId, Date leaveDate) {
        if (athleteId == null) {
            throw new ServiceException("运动员ID不能为空");
        }
        if (deptId == null) {
            throw new ServiceException("请选择要离开的小组");
        }
        Date effectiveLeaveDate = leaveDate != null ? leaveDate : new Date();
        int rows = groupMapper.closeCurrentByAthleteAndDept(athleteId, deptId, effectiveLeaveDate);
        if (rows == 0) {
            throw new ServiceException("该运动员当前不在此小组中，可能已离组");
        }
        return rows;
    }
}
