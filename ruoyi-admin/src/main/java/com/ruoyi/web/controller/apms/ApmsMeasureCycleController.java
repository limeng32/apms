package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.domain.apms.ApmsMeasureCycle;
import com.ruoyi.system.service.apms.IApmsMeasureCycleService;

/**
 * 体态测量周期 Controller
 */
@RestController
@RequestMapping("/apms/measure-cycle")
public class ApmsMeasureCycleController extends BaseController {

    @Autowired
    private IApmsMeasureCycleService cycleService;

    @PreAuthorize("@ss.hasPermi('apms:body:list')")
    @GetMapping("/list")
    public TableDataInfo list(ApmsMeasureCycle query) {
        startPage();
        return getDataTable(cycleService.list(query));
    }

    @PreAuthorize("@ss.hasPermi('apms:body:query')")
    @GetMapping("/{id}")
    public AjaxResult getInfo(@PathVariable Long id) {
        return success(cycleService.getById(id));
    }

    /** 周期完成情况（目标队员 / 已测 / 未测 / 百分比） */
    @PreAuthorize("@ss.hasPermi('apms:body:query')")
    @GetMapping("/{id}/progress")
    public AjaxResult progress(@PathVariable Long id) {
        return success(cycleService.progress(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PostMapping
    public AjaxResult add(@RequestBody ApmsMeasureCycle cycle) {
        return toAjax(cycleService.insert(cycle));
    }

    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsMeasureCycle cycle) {
        return toAjax(cycleService.update(cycle));
    }

    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(cycleService.deleteById(id));
    }

    /** 周期批量录入：body 为测量行数组 */
    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PostMapping("/{id}/batch")
    public AjaxResult batch(@PathVariable Long id, @RequestBody List<ApmsBodyMeasure> measures) {
        int n = cycleService.batchSave(id, measures);
        return AjaxResult.success("已保存 " + n + " 条测量记录", n);
    }
}
