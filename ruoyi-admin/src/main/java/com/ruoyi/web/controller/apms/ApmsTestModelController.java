package com.ruoyi.web.controller.apms;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import com.ruoyi.system.service.apms.algorithm.ModelAlgorithmRegistry;
import com.ruoyi.system.service.apms.algorithm.ModelDeriveAlgorithm;

/**
 * 测试模型库 Controller
 */
@RestController
@RequestMapping("/apms/test-model")
public class ApmsTestModelController extends BaseController {

    @Autowired
    private IApmsTestModelService modelService;
    @Autowired
    private ModelAlgorithmRegistry algorithmRegistry;

    /** 可绑定的派生算法清单（模型配置页下拉用；新增算法只需实现 ModelDeriveAlgorithm） */
    @PreAuthorize("@ss.hasPermi('apms:testModel:list')")
    @GetMapping("/algorithms")
    public AjaxResult algorithms() {
        List<Map<String, String>> list = new java.util.ArrayList<>();
        for (ModelDeriveAlgorithm a : algorithmRegistry.list()) {
            Map<String, String> item = new LinkedHashMap<>();
            item.put("algoId", a.algoId());
            item.put("displayName", a.displayName());
            list.add(item);
        }
        return success(list);
    }

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
