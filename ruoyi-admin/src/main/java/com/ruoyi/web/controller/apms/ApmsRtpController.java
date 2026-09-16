package com.ruoyi.web.controller.apms;

import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.ApmsRtpLog;
import com.ruoyi.system.domain.apms.ApmsRtpStatus;
import com.ruoyi.system.service.apms.IApmsRtpService;

/**
 * RTP 状态管理 Controller
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/rtp")
public class ApmsRtpController extends BaseController {

    @Autowired
    private IApmsRtpService rtpService;

    /**
     * 查询运动员当前RTP状态（无记录=未评估）
     */
    @PreAuthorize("@ss.hasPermi('apms:rtp:query')")
    @GetMapping("/status/{athleteId}")
    public AjaxResult getStatus(@PathVariable Long athleteId) {
        return success(rtpService.selectStatusByAthleteId(athleteId));
    }

    /**
     * 列表查询（用于统计/批量查看）
     */
    @PreAuthorize("@ss.hasPermi('apms:rtp:list')")
    @GetMapping("/status/list")
    public AjaxResult listStatus() {
        List<ApmsRtpStatus> list = rtpService.selectStatusList();
        return success(list);
    }

    /**
     * 查询RTP变更历史
     */
    @PreAuthorize("@ss.hasPermi('apms:rtp:query')")
    @GetMapping("/log/{athleteId}")
    public AjaxResult getLog(@PathVariable Long athleteId) {
        List<ApmsRtpLog> list = rtpService.selectLogByAthleteId(athleteId);
        return success(list);
    }

    /**
     * 更新RTP状态（自动写入变更日志，事务绑定）
     * Body: { athleteId, status, reason, trainingLimit, nextReviewDate }
     */
    @PreAuthorize("@ss.hasPermi('apms:rtp:edit')")
    @PostMapping("/update")
    public AjaxResult update(@RequestBody ApmsRtpStatus body) {
        rtpService.updateRtpStatus(
                body.getAthleteId(), body.getStatus(),
                body.getReason(), body.getTrainingLimit(),
                body.getNextReviewDate());
        return success();
    }

    /**
     * 清除RTP状态（回到未评估，自动写入日志）
     * Body: { reason }
     */
    @PreAuthorize("@ss.hasPermi('apms:rtp:clear')")
    @PostMapping("/clear/{athleteId}")
    public AjaxResult clear(@PathVariable Long athleteId, @RequestBody(required = false) ApmsRtpLog body) {
        String reason = body != null ? body.getReason() : null;
        rtpService.clearRtpStatus(athleteId, reason);
        return success();
    }
}
