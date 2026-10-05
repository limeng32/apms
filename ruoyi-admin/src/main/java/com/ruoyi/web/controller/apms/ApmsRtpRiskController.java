package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.system.domain.apms.ApmsRtpRiskSnapshot;
import com.ruoyi.system.domain.apms.dto.RtpRiskHandleForm;
import com.ruoyi.system.service.apms.IRtpRiskService;

/**
 * RTP 风险预警 Controller
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/rtp-risk")
public class ApmsRtpRiskController extends BaseController {

    @Autowired
    private IRtpRiskService riskService;

    /**
     * 待办/已处理列表。
     * 查询参数：suggestedLevel/status（兼容单值）/levelList/statusList/deptId/keyword/snapshotDate。
     */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:list')")
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    @GetMapping("/list")
    public TableDataInfo list(ApmsRtpRiskSnapshot query,
                              String suggestedLevel, String status) {
        if (suggestedLevel != null && !suggestedLevel.isEmpty()
                && (query.getLevelList() == null || query.getLevelList().isEmpty())) {
            query.setLevelList(List.of(suggestedLevel.split(",")));
        }
        if (status != null && !status.isEmpty()
                && (query.getStatusList() == null || query.getStatusList().isEmpty())) {
            query.setStatusList(List.of(status.split(",")));
        }
        startPage();
        return getDataTable(riskService.selectList(query));
    }

    /** KPI 统计（同列表 DataScope；挂 list 权限） */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:list')")
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    @GetMapping("/stat")
    public AjaxResult stat(ApmsRtpRiskSnapshot query,
                           String suggestedLevel, String status) {
        if (suggestedLevel != null && !suggestedLevel.isEmpty()
                && (query.getLevelList() == null || query.getLevelList().isEmpty())) {
            query.setLevelList(List.of(suggestedLevel.split(",")));
        }
        if (status != null && !status.isEmpty()
                && (query.getStatusList() == null || query.getStatusList().isEmpty())) {
            query.setStatusList(List.of(status.split(",")));
        }
        return success(riskService.stat(query));
    }

    /** 因子明细 */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:query')")
    @GetMapping("/{id}")
    public AjaxResult getInfo(@PathVariable Long id) {
        return success(riskService.getById(id));
    }

    /** 运动员详情页当前系统建议（无 ACTIVE 建议时 data=null） */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:query')")
    @GetMapping("/athlete/{athleteId}/latest")
    public AjaxResult latestByAthlete(@PathVariable Long athleteId) {
        return success(riskService.latestByAthlete(athleteId));
    }

    /** 规则配置（一期只读） */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:query')")
    @GetMapping("/rules")
    public AjaxResult rules() {
        return success(riskService.listRules());
    }

    /** 已知悉（仅 INFO） */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:handle')")
    @PostMapping("/{id}/ack")
    public AjaxResult ack(@PathVariable Long id, @RequestBody(required = false) RtpRiskHandleForm form) {
        String remark = form != null ? form.getRemark() : null;
        return success(riskService.ack(id, remark));
    }

    /** 忽略（理由必填） */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:handle')")
    @PostMapping("/{id}/dismiss")
    public AjaxResult dismiss(@PathVariable Long id, @RequestBody RtpRiskHandleForm form) {
        return success(riskService.dismiss(id, form == null ? null : form.getRemark()));
    }

    /**
     * 采纳并更新 RTP（仅 ATTENTION/WARNING）：
     * 单接口单本地事务——写 RTP + rtp_log + 快照 ACCEPTED 一起提交，afterCommit 再重扫。
     */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:handle') and @ss.hasPermi('apms:rtp:edit')")
    @PostMapping("/{id}/accept")
    public AjaxResult accept(@PathVariable Long id, @RequestBody RtpRiskHandleForm form) {
        return success(riskService.acceptAndApplyRtp(id, form));
    }

    /** 手动全量扫描 */
    @PreAuthorize("@ss.hasPermi('apms:rtpRisk:scan')")
    @PostMapping("/scan")
    public AjaxResult scan() {
        return success(riskService.scanDaily());
    }
}
