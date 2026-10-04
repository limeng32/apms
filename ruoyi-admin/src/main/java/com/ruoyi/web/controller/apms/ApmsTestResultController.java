package com.ruoyi.web.controller.apms;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.system.domain.apms.ApmsTestResult;
import com.ruoyi.system.domain.apms.ApmsTestResultValue;
import com.ruoyi.system.service.apms.IApmsTestResultService;
import com.ruoyi.system.service.apms.ITestResultImportProvider;
import com.ruoyi.system.service.apms.ITestResultTemplateService;

/**
 * 测试结果 Controller
 */
@RestController
@RequestMapping("/apms/test-result")
public class ApmsTestResultController extends BaseController {

    @Autowired
    private IApmsTestResultService resultService;

    @Autowired
    private ITestResultImportProvider csvImportProvider;

    @Autowired
    private ITestResultTemplateService templateService;

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

    /** 散录成绩的同组尝试（不绑任务：同队员+同指标/模型）；indicatorId/modelId 二选一 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:query')")
    @GetMapping("/by-free-group")
    public AjaxResult byFreeGroup(@RequestParam Long athleteId,
                                  @RequestParam(required = false) Long indicatorId,
                                  @RequestParam(required = false) Long modelId) {
        return AjaxResult.success(resultService.listFreeGroup(athleteId, indicatorId, modelId));
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

    /**
     * 手动指定选中某个 attempt
     *
     * <p>事务内：清同组其他 + 选中目标 + 重算任务进度
     */
    @PreAuthorize("@ss.hasPermi('apms:testResult:edit')")
    @PostMapping("/select-attempt/{resultId}")
    public AjaxResult selectAttempt(@PathVariable Long resultId) {
        resultService.selectAttempt(resultId);
        return AjaxResult.success();
    }

    /**
     * CSV 批量导入测试结果
     *
     * <p>CSV 格式（UTF-8）：
     * <pre>
     * athlete_id,measure_date,session_key,HEIGHT,WEIGHT,50M_SPRINT
     * 1001,2026-09-18,S1,178.5,72.3,5.21
     * </pre>
     *
     * <p>列名匹配 indicator.code 或 model.code（大小写不敏感）。
     * 不支持 task_id 绑定（CSV 导入默认为手工批量录入），如需任务绑定请先在 CSV 里设 athlete_id + measure_date + session_key 区分。
     */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping("/import/csv")
    public AjaxResult importCsv(@RequestParam("file") MultipartFile file,
                                @RequestParam(value = "taskId", required = false) Long taskId) {
        if (file.isEmpty()) {
            return AjaxResult.error("上传文件为空");
        }
        try {
            ITestResultImportProvider.ImportResult result =
                    csvImportProvider.importAll(file.getInputStream(), taskId);

            AjaxResult ajax = AjaxResult.success();
            ajax.put("writtenResultCount", result.writtenResultCount);
            ajax.put("rowsProcessed", result.rows.size());
            ajax.put("errorRows", result.errorRows);
            ajax.put("warnings", result.warnings);
            return ajax;
        } catch (Exception e) {
            return AjaxResult.error("CSV 导入失败：" + e.getMessage());
        }
    }

    /**
     * 下载 CSV 导入模板
     *
     * <p>带 taskId：任务模板（预填 task_id、参测队员，列只含该任务测试项）。
     * 不带：通用模板（全部启用指标列，预填在训队员）。
     */
    @PreAuthorize("@ss.hasPermi('apms:testResult:list')")
    @GetMapping("/import/template")
    public void downloadTemplate(@RequestParam(value = "taskId", required = false) Long taskId,
                                 HttpServletResponse response) throws IOException {
        String csv = templateService.buildTemplateCsv(taskId);
        String fileName = (taskId == null ? "test-result-template.csv" : "test-result-task-" + taskId + "-template.csv");
        response.setContentType("text/csv; charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''"
                        + URLEncoder.encode(fileName, StandardCharsets.UTF_8.name()).replace("+", "%20"));
        // UTF-8 BOM（EF BB BF），保证 Excel 双击打开中文不乱码。
        // 注意 OutputStream.write(int) 只写低字节，不能直接 write(0xFEFF)（会变成单字节 0xFF）
        response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});
        response.getOutputStream().write(csv.getBytes(StandardCharsets.UTF_8));
    }

    /** 请求体包装 */
    public static class AddBody {
        public ApmsTestResult result;
        public List<ApmsTestResultValue> values;
    }
}
