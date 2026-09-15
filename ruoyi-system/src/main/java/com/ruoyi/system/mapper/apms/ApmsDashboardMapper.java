package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.dto.DashboardStatsVO;
import com.ruoyi.system.domain.apms.dto.TaskProgressVO;
import com.ruoyi.system.domain.apms.dto.RtpAttentionVO;

/**
 * APMS 看板数据 Mapper
 *
 * @author apms
 */
public interface ApmsDashboardMapper {

    /** 看板统计 */
    DashboardStatsVO selectDashboardStats();

    /** 进行中任务进度列表 */
    List<TaskProgressVO> selectInProgressTasks();

    /** RTP 关注名单（status IN ('y','r')） */
    List<RtpAttentionVO> selectRtpAttentionList();
}
