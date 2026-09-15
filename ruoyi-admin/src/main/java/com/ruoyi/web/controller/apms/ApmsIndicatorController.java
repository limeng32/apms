package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.system.domain.apms.ApmsIndicator;
import com.ruoyi.system.domain.apms.ApmsIndicatorRef;
import com.ruoyi.system.domain.apms.ApmsIndicatorRefLevel;
import com.ruoyi.system.service.apms.IApmsIndicatorService;

/**
 * 指标库 Controller
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/indicator")
public class ApmsIndicatorController extends BaseController {

    @Autowired
    private IApmsIndicatorService indicatorService;

    // ===================== Indicator CRUD =====================

    @PreAuthorize("@ss.hasPermi('apms:indicator:list')")
    @GetMapping("/list")
    public TableDataInfo list(ApmsIndicator indicator) {
        startPage();
        List<ApmsIndicator> list = indicatorService.selectList(indicator);
        return getDataTable(list);
    }

    /** 聚合详情：indicator + refs[] + levels[] */
    @PreAuthorize("@ss.hasPermi('apms:indicator:query')")
    @GetMapping("/{id}")
    public AjaxResult getDetail(@PathVariable Long id) {
        return success(indicatorService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:add')")
    @Log(title = "指标库", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody ApmsIndicator indicator) {
        return toAjax(indicatorService.insert(indicator));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @Log(title = "指标库", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsIndicator indicator) {
        return toAjax(indicatorService.update(indicator));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:remove')")
    @Log(title = "指标库", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids) {
        return toAjax(indicatorService.deleteByIds(ids));
    }

    // ===================== Ref CRUD =====================

    @PreAuthorize("@ss.hasPermi('apms:indicator:query')")
    @GetMapping("/ref/list/{indicatorId}")
    public AjaxResult refList(@PathVariable Long indicatorId) {
        return success(indicatorService.selectRefByIndicatorId(indicatorId));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @PostMapping("/ref")
    public AjaxResult refAdd(@RequestBody ApmsIndicatorRef ref) {
        return toAjax(indicatorService.insertRef(ref));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @PutMapping("/ref")
    public AjaxResult refEdit(@RequestBody ApmsIndicatorRef ref) {
        return toAjax(indicatorService.updateRef(ref));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @DeleteMapping("/ref/{refId}")
    public AjaxResult refRemove(@PathVariable Long refId) {
        return toAjax(indicatorService.deleteRef(refId));
    }

    // ===================== Level CRUD =====================

    @PreAuthorize("@ss.hasPermi('apms:indicator:query')")
    @GetMapping("/level/list/{refId}")
    public AjaxResult levelList(@PathVariable Long refId) {
        return success(indicatorService.selectLevelsByRefId(refId));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @PostMapping("/level")
    public AjaxResult levelAdd(@RequestBody ApmsIndicatorRefLevel level) {
        return toAjax(indicatorService.insertLevel(level));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @PutMapping("/level")
    public AjaxResult levelEdit(@RequestBody ApmsIndicatorRefLevel level) {
        return toAjax(indicatorService.updateLevel(level));
    }

    @PreAuthorize("@ss.hasPermi('apms:indicator:edit')")
    @DeleteMapping("/level/{levelId}")
    public AjaxResult levelRemove(@PathVariable Long levelId) {
        return toAjax(indicatorService.deleteLevel(levelId));
    }
}
