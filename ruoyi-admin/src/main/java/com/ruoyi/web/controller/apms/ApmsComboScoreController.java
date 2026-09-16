package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.ApmsComboScore;
import com.ruoyi.system.service.apms.IApmsComboScoreService;

/**
 * 组合模型评分 Controller
 */
@RestController
@RequestMapping("/apms/combo-score")
public class ApmsComboScoreController extends BaseController {

    @Autowired
    private IApmsComboScoreService scoreService;

    /** 全局列表（DataScope 队伍隔离） */
    @PreAuthorize("@ss.hasPermi('apms:comboScore:list')")
    @DataScope(deptAlias = "a")
    @GetMapping("/list")
    public AjaxResult list(ApmsComboScore query) {
        return success(scoreService.list(query));
    }

    @PreAuthorize("@ss.hasPermi('apms:comboScore:query')")
    @GetMapping("/{id}")
    public AjaxResult getById(@PathVariable Long id) {
        return success(scoreService.selectById(id));
    }

    /**
     * 触发批量计算
     * Body: { comboModelId, taskId }
     */
    @PreAuthorize("@ss.hasPermi('apms:comboScore:calculate')")
    @PostMapping("/calculate")
    public AjaxResult calculate(@RequestBody java.util.Map<String, Long> body) {
        Long comboModelId = body.get("comboModelId");
        Long taskId = body.get("taskId");
        IApmsComboScoreService.BatchResult result = scoreService.batchCalculate(comboModelId, taskId);
        return success(result);
    }

    @PreAuthorize("@ss.hasPermi('apms:comboScore:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(scoreService.deleteById(id));
    }
}
