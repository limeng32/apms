package com.ruoyi.web.controller.apms;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.dto.DashboardStatsVO;
import com.ruoyi.system.domain.apms.dto.TaskProgressVO;
import com.ruoyi.system.domain.apms.dto.RtpAttentionVO;
import com.ruoyi.system.service.apms.IApmsDashboardService;

/**
 * APMS 看板接口
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/dashboard")
public class ApmsDashboardController extends BaseController {

    @Autowired
    private IApmsDashboardService dashboardService;

    /**
     * 看板聚合数据（统计卡 + 任务进度 + RTP 关注名单一次返回）
     */
    @GetMapping("/stats")
    public AjaxResult getStats() {
        DashboardStatsVO stats = dashboardService.getDashboardStats();
        List<TaskProgressVO> tasks = dashboardService.getInProgressTasks();
        List<RtpAttentionVO> rtp = dashboardService.getRtpAttentionList();

        Map<String, Object> data = new HashMap<>();
        data.put("stats", stats);
        data.put("taskList", tasks);
        data.put("rtpList", rtp);
        return AjaxResult.success(data);
    }

    /**
     * 仅统计卡（轻量接口，用于卡片刷新）
     */
    @GetMapping("/summary")
    public AjaxResult getSummary() {
        return AjaxResult.success(dashboardService.getDashboardStats());
    }

    /**
     * 进行中任务进度
     */
    @GetMapping("/tasks")
    public AjaxResult getTasks() {
        return AjaxResult.success(dashboardService.getInProgressTasks());
    }

    /**
     * RTP 关注名单
     */
    @GetMapping("/rtp")
    public AjaxResult getRtp() {
        return AjaxResult.success(dashboardService.getRtpAttentionList());
    }
}
