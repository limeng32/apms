package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.ApmsPhvRecord;
import com.ruoyi.system.service.apms.IApmsPhvService;

/**
 * PHV 测量与计算记录 Controller
 */
@RestController
@RequestMapping("/apms/phv")
public class ApmsPhvController extends BaseController {

    @Autowired
    private IApmsPhvService phvService;

    /**
     * 全局列表（DataScope 队伍隔离）
     */
    @PreAuthorize("@ss.hasPermi('apms:phv:list')")
    @DataScope(deptAlias = "a")
    @GetMapping("/list")
    public AjaxResult list(ApmsPhvRecord query) {
        return success(phvService.list(query));
    }

    /** 按运动员查询所有 PHV 记录 */
    @PreAuthorize("@ss.hasPermi('apms:phv:query')")
    @GetMapping("/athlete/{athleteId}")
    public AjaxResult getByAthlete(@PathVariable Long athleteId) {
        return success(phvService.selectByAthleteId(athleteId));
    }

    /** 按运动员查询最新 PHV 记录 */
    @PreAuthorize("@ss.hasPermi('apms:phv:query')")
    @GetMapping("/athlete/{athleteId}/latest")
    public AjaxResult getLatest(@PathVariable Long athleteId) {
        return success(phvService.selectLatestByAthleteId(athleteId));
    }

    /** 按 ID 查询 */
    @PreAuthorize("@ss.hasPermi('apms:phv:query')")
    @GetMapping("/{id}")
    public AjaxResult getById(@PathVariable Long id) {
        return success(phvService.selectById(id));
    }

    /** 根据体态测量记录计算并保存 PHV */
    @PreAuthorize("@ss.hasPermi('apms:phv:edit')")
    @PostMapping("/calculate")
    public AjaxResult calculate(
            @RequestParam Long athleteId,
            @RequestParam Long measureId) {
        return success(phvService.calculateAndSave(athleteId, measureId));
    }

    /** 直接用给定参数计算并保存 PHV（手动录入） */
    @PreAuthorize("@ss.hasPermi('apms:phv:edit')")
    @PostMapping("/calculate-direct")
    public AjaxResult calculateDirect(@RequestBody ApmsPhvRecord input) {
        return success(phvService.calculateAndSave(input));
    }

    /** 删除 PHV 记录 */
    @PreAuthorize("@ss.hasPermi('apms:phv:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(phvService.deleteById(id));
    }
}
