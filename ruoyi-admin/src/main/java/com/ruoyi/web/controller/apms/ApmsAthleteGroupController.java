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
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.ApmsAthleteGroup;
import com.ruoyi.system.service.apms.IApmsAthleteGroupService;

/**
 * 运动员-小组归属历史 Controller
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/athlete-group")
public class ApmsAthleteGroupController extends BaseController {

    @Autowired
    private IApmsAthleteGroupService groupService;

    /**
     * 查询运动员归属历史
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/athlete/{athleteId}")
    public AjaxResult getByAthlete(@PathVariable Long athleteId) {
        return success(groupService.selectByAthleteId(athleteId));
    }

    /**
     * 查询运动员当前在组记录
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/athlete/{athleteId}/current")
    public AjaxResult getCurrent(@PathVariable Long athleteId) {
        return success(groupService.selectCurrentByAthleteId(athleteId));
    }

    /**
     * 查询小组当前在组成员
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/dept/{deptId}")
    public AjaxResult getByDept(@PathVariable Long deptId) {
        return success(groupService.selectActiveByDeptId(deptId));
    }

    /**
     * 加入小组
     * Body: { athleteId, deptId, joinDate }
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @PostMapping("/join")
    public AjaxResult joinGroup(@RequestBody ApmsAthleteGroup body) {
        return toAjax(groupService.joinGroup(body.getAthleteId(), body.getDeptId(), body.getJoinDate()));
    }

    /**
     * 离开小组
     * Body: { leaveDate }
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @PostMapping("/leave/{athleteId}")
    public AjaxResult leaveGroup(@PathVariable Long athleteId, @RequestBody(required = false) ApmsAthleteGroup body) {
        return toAjax(groupService.leaveGroup(athleteId, body != null ? body.getLeaveDate() : null));
    }
}
