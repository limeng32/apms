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
import com.ruoyi.system.domain.apms.ApmsComboModel;
import com.ruoyi.system.domain.apms.ApmsComboComponent;
import com.ruoyi.system.service.apms.IApmsComboModelService;

/**
 * 组合模型 Controller
 */
@RestController
@RequestMapping("/apms/combo-model")
public class ApmsComboModelController extends BaseController {

    @Autowired
    private IApmsComboModelService comboService;

    @PreAuthorize("@ss.hasPermi('apms:comboModel:list')")
    @GetMapping("/list")
    public TableDataInfo list(ApmsComboModel model) {
        startPage();
        return getDataTable(comboService.selectList(model));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:query')")
    @GetMapping("/{id}")
    public AjaxResult getDetail(@PathVariable Long id) {
        return success(comboService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:add')")
    @Log(title = "组合模型", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody ApmsComboModel model) {
        return toAjax(comboService.insert(model));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:edit')")
    @Log(title = "组合模型", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsComboModel model) {
        return toAjax(comboService.update(model));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:remove')")
    @Log(title = "组合模型", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids) {
        return toAjax(comboService.deleteByIds(ids));
    }

    // ===== Component =====
    @PreAuthorize("@ss.hasPermi('apms:comboModel:query')")
    @GetMapping("/component/list/{comboModelId}")
    public AjaxResult componentList(@PathVariable Long comboModelId) {
        return success(comboService.selectComponents(comboModelId));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:edit')")
    @PostMapping("/component")
    public AjaxResult componentAdd(@RequestBody ApmsComboComponent c) {
        return toAjax(comboService.insertComponent(c));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:edit')")
    @PutMapping("/component")
    public AjaxResult componentEdit(@RequestBody ApmsComboComponent c) {
        return toAjax(comboService.updateComponent(c));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboModel:edit')")
    @DeleteMapping("/component/{componentId}")
    public AjaxResult componentRemove(@PathVariable Long componentId) {
        return toAjax(comboService.deleteComponent(componentId));
    }
}
