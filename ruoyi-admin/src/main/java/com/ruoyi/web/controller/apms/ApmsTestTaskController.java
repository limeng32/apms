package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.system.domain.apms.ApmsTestTask;
import com.ruoyi.system.domain.apms.ApmsTaskItem;
import com.ruoyi.system.domain.apms.ApmsTaskMember;
import com.ruoyi.system.service.apms.IApmsTestTaskService;

/**
 * 测试任务 Controller
 */
@RestController
@RequestMapping("/apms/test-task")
public class ApmsTestTaskController extends BaseController {

    @Autowired
    private IApmsTestTaskService taskService;

    // ===== Task CRUD =====
    @PreAuthorize("@ss.hasPermi('apms:testTask:list')")
    @DataScope(deptAlias = "t", deptField = "target_dept_id")
    @GetMapping("/list")
    public TableDataInfo list(ApmsTestTask task) {
        startPage();
        return getDataTable(taskService.selectList(task));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:query')")
    @GetMapping("/{id}")
    public AjaxResult getDetail(@PathVariable Long id) {
        return success(taskService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:add')")
    @Log(title = "测试任务", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody ApmsTestTask task) {
        task.setCreateBy(getUsername());
        return toAjax(taskService.insert(task));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @Log(title = "测试任务", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsTestTask task) {
        return toAjax(taskService.update(task));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:remove')")
    @Log(title = "测试任务", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids) {
        return toAjax(taskService.deleteByIds(ids));
    }

    // ===== Task Item =====
    @PreAuthorize("@ss.hasPermi('apms:testTask:query')")
    @GetMapping("/item/list/{taskId}")
    public AjaxResult itemList(@PathVariable Long taskId) {
        return success(taskService.selectItems(taskId));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @PostMapping("/item")
    public AjaxResult itemAdd(@RequestBody ApmsTaskItem item) {
        return toAjax(taskService.insertItem(item));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @PutMapping("/item")
    public AjaxResult itemEdit(@RequestBody ApmsTaskItem item) {
        return toAjax(taskService.updateItem(item));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @DeleteMapping("/item/{itemId}")
    public AjaxResult itemRemove(@PathVariable Long itemId) {
        return toAjax(taskService.deleteItem(itemId));
    }

    // ===== Task Member =====
    @PreAuthorize("@ss.hasPermi('apms:testTask:query')")
    @GetMapping("/member/list/{taskId}")
    public AjaxResult memberList(@PathVariable Long taskId) {
        return success(taskService.selectMembers(taskId));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @PostMapping("/member/enroll")
    public AjaxResult enroll(@RequestBody ApmsTaskMember m) {
        return toAjax(taskService.enrollMember(m.getTaskId(), m.getAthleteId()));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @PostMapping("/member/batch-enroll")
    public AjaxResult batchEnroll(@RequestParam Long taskId, @RequestBody List<Long> athleteIds) {
        return toAjax(taskService.batchEnroll(taskId, athleteIds));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @PutMapping("/member/status")
    public AjaxResult memberEditStatus(@RequestBody ApmsTaskMember m) {
        return toAjax(taskService.updateMemberStatus(m.getTaskId(), m.getAthleteId(), m.getStatus()));
    }

    @PreAuthorize("@ss.hasPermi('apms:testTask:edit')")
    @DeleteMapping("/member")
    public AjaxResult memberRemove(@RequestParam Long taskId, @RequestParam Long athleteId) {
        return toAjax(taskService.removeMember(taskId, athleteId));
    }
}
