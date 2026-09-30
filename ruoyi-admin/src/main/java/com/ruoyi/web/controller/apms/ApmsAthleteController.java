package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.system.domain.apms.ApmsAthlete;
import com.ruoyi.system.domain.apms.ApmsPromotionRequest;
import com.ruoyi.system.service.apms.IApmsAthleteService;
import com.ruoyi.system.service.apms.IApmsSeasonPromotionService;

/**
 * 运动员档案 Controller
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/athlete")
public class ApmsAthleteController extends BaseController {

    @Autowired
    private IApmsAthleteService athleteService;

    @Autowired
    private IApmsSeasonPromotionService seasonPromotionService;

    /**
     * 列表查询（带 DataScope：队伍级数据权限）
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:list')")
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    @GetMapping("/list")
    public TableDataInfo list(ApmsAthlete apmsAthlete) {
        startPage();
        List<ApmsAthlete> list = athleteService.selectApmsAthleteList(apmsAthlete);
        return getDataTable(list);
    }

    /**
     * RTP 状态人数汇总（花名册筛选条 chip 计数；过滤条件、数据权限与列表一致）
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:list')")
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    @GetMapping("/rtpSummary")
    public AjaxResult rtpSummary(ApmsAthlete apmsAthlete) {
        return success(athleteService.selectRtpSummary(apmsAthlete));
    }

    /**
     * 详情
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/{athleteId}")
    public AjaxResult getInfo(@PathVariable Long athleteId) {
        return success(athleteService.selectApmsAthleteByAthleteId(athleteId));
    }

    /**
     * 新增
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:add')")
    @PostMapping
    public AjaxResult add(@RequestBody ApmsAthlete apmsAthlete) {
        return toAjax(athleteService.insertApmsAthlete(apmsAthlete));
    }

    /**
     * 修改
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsAthlete apmsAthlete) {
        return toAjax(athleteService.updateApmsAthlete(apmsAthlete));
    }

    /**
     * 逻辑删除（离队状态）
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:remove')")
    @DeleteMapping("/{athleteIds}")
    public AjaxResult remove(@PathVariable Long[] athleteIds) {
        return toAjax(athleteService.deleteApmsAthleteByAthleteIds(athleteIds));
    }

    /**
     * 校验球衣号码同队唯一性
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/check_jersey_no")
    public AjaxResult checkJerseyNo(ApmsAthlete apmsAthlete) {
        return AjaxResult.success(athleteService.checkJerseyNoUnique(apmsAthlete));
    }

    /**
     * 赛季晋升：预览名单（不落库）
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:list')")
    @PostMapping("/promotion/preview")
    public AjaxResult promotionPreview(@RequestBody(required = false) ApmsPromotionRequest request) {
        return success(seasonPromotionService.preview(request));
    }

    /**
     * 赛季晋升：执行（服务端重新计算，更新主队伍并写晋升记录；历史成绩不重算）
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @Log(title = "赛季整队晋升", businessType = BusinessType.UPDATE)
    @PostMapping("/promotion/execute")
    public AjaxResult promotionExecute(@RequestBody(required = false) ApmsPromotionRequest request) {
        return success(seasonPromotionService.execute(request));
    }
}
