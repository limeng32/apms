package com.ruoyi.system.service.apms.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.system.mapper.apms.ApmsDashboardMapper;
import com.ruoyi.system.domain.apms.dto.DashboardStatsVO;
import com.ruoyi.system.domain.apms.dto.TaskProgressVO;
import com.ruoyi.system.domain.apms.dto.RtpAttentionVO;
import com.ruoyi.system.service.apms.IApmsDashboardService;

/**
 * APMS 看板业务实现
 *
 * @author apms
 */
@Service
public class ApmsDashboardServiceImpl implements IApmsDashboardService {

    @Autowired
    private ApmsDashboardMapper dashboardMapper;

    @Override
    public DashboardStatsVO getDashboardStats() {
        return dashboardMapper.selectDashboardStats();
    }

    @Override
    public List<TaskProgressVO> getInProgressTasks() {
        return dashboardMapper.selectInProgressTasks();
    }

    @Override
    public List<RtpAttentionVO> getRtpAttentionList() {
        return dashboardMapper.selectRtpAttentionList();
    }
}
