package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.dto.DashboardStatsVO;
import com.ruoyi.system.domain.apms.dto.TaskProgressVO;
import com.ruoyi.system.domain.apms.dto.RtpAttentionVO;

/**
 * APMS 看板业务接口
 *
 * @author apms
 */
public interface IApmsDashboardService {

    /** 看板统计 */
    DashboardStatsVO getDashboardStats();

    /** 进行中任务进度 */
    List<TaskProgressVO> getInProgressTasks();

    /** RTP 关注名单 */
    List<RtpAttentionVO> getRtpAttentionList();
}
