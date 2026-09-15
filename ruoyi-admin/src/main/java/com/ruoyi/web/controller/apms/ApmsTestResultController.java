package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.service.apms.IApmsTestResultService;

/**
 * 测试结果 Controller
 */
@RestController
@RequestMapping("/apms/test-result")
public class ApmsTestResultController extends BaseController {

    @Autowired
    private IApmsTestResultService resultService;

    /** 列表查询 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:list')")
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    @GetMapping("/list")
    public TableDataInfo list(ApmsTestResult query) {
        startPage();
        List<ApmsTestResult> list = resultService.list(query);
        return getDataTable(list);
    }

    /** 详情（含 values + reps 聚合） */
    @PreAuthorize("@ss.hasPermi('apms:testResult:query')")
    @GetMapping(value = "/{id}")
    public AjaxResult getInfo(@PathVariable Long id) {
        return AjaxResult.success(resultService.getById(id));
    }

    /** 按 task_member 查（一组 attempt） */
    @PreAuthorize("@ss.hasPermi('apms:testResult:query')")
    @GetMapping("/by-task-member")
    public AjaxResult byTaskMember(@RequestParam Long taskId, @RequestParam Long athleteId) {
        return AjaxResult.success(resultService.listByTaskMember(taskId, athleteId));
    }

    /** 新增（Service 自动 REP 计算 + autoSelectBest） */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping
    public AjaxResult add(@RequestBody AddBody body) {
        resultService.add(body.result, body.values);
        return AjaxResult.success();
    }

    /** 修改 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:edit')")
    @PutMapping
    public AjaxResult edit(@RequestBody AddBody body) {
        resultService.update(body.result, body.values);
        return AjaxResult.success();
    }

    /** 删除 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(resultService.delete(id));
    }

    /** 按 task_id 批量删除 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:remove')")
    @DeleteMapping("/task/{taskId}")
    public AjaxResult removeByTask(@PathVariable Long taskId) {
        return toAjax(resultService.deleteByTaskId(taskId));
    }

    /** 手动触发 autoSelectBest（同组 attempt 自动选最佳） */
    @PreAuthorize("@ss.hasPermi('apms:testResult:edit')")
    @PostMapping("/auto-select")
    public AjaxResult autoSelect(@RequestParam Long taskItemId, @RequestParam Long athleteId) {
        return AjaxResult.success(resultService.autoSelectBest(taskItemId, athleteId));
    }

    /** 请求体包装 */
    public static class AddBody {
        public ApmsTestResult result;
        public List<ApmsTestResultValue> values;
    }
}
