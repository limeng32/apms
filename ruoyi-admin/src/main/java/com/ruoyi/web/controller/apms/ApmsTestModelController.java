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
import com.ruoyi.system.domain.apms.ApmsTestModel;
import com.ruoyi.system.domain.apms.ApmsTestModelField;
import com.ruoyi.system.service.apms.IApmsTestModelService;

/**
 * 测试模型库 Controller
 */
@RestController
@RequestMapping("/apms/test-model")
public class ApmsTestModelController extends BaseController {

    @Autowired
    private IApmsTestModelService modelService;

    // ===== Model CRUD =====
    @PreAuthorize("@ss.hasPermi('apms:testModel:list')")
    @GetMapping("/list")
    public TableDataInfo list(ApmsTestModel model) {
        startPage();
        return getDataTable(modelService.selectList(model));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:query')")
    @GetMapping("/{id}")
    public AjaxResult getDetail(@PathVariable Long id) {
        return success(modelService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:add')")
    @Log(title = "测试模型", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody ApmsTestModel model) {
        return toAjax(modelService.insert(model));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:edit')")
    @Log(title = "测试模型", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsTestModel model) {
        return toAjax(modelService.update(model));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:remove')")
    @Log(title = "测试模型", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids) {
        return toAjax(modelService.deleteByIds(ids));
    }

    // ===== Field CRUD =====
    @PreAuthorize("@ss.hasPermi('apms:testModel:query')")
    @GetMapping("/field/list/{modelId}")
    public AjaxResult fieldList(@PathVariable Long modelId) {
        return success(modelService.selectFieldsByModelId(modelId));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:edit')")
    @PostMapping("/field")
    public AjaxResult fieldAdd(@RequestBody ApmsTestModelField field) {
        return toAjax(modelService.insertField(field));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:edit')")
    @PutMapping("/field")
    public AjaxResult fieldEdit(@RequestBody ApmsTestModelField field) {
        return toAjax(modelService.updateField(field));
    }

    @PreAuthorize("@ss.hasPermi('apms:testModel:edit')")
    @DeleteMapping("/field/{fieldId}")
    public AjaxResult fieldRemove(@PathVariable Long fieldId) {
        return toAjax(modelService.deleteField(fieldId));
    }
}
