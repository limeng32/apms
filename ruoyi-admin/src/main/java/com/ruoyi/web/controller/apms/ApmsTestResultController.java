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
import com.ruoyi.system.service.apms.batchimport.ImportTemplates;
import com.ruoyi.system.service.apms.batchimport.ResultImportFacade;

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

    @Autowired
    private ResultImportFacade resultImportFacade;

    @Autowired
    private ImportTemplates importTemplates;

    // ==================== 两阶段批量导入（Excel/CSV · 预览 → 确认） ====================

    /** 第一步：上传解析，返回预览数据（不入库） */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping("/import/preview")
    public AjaxResult importPreview(@RequestParam("file") MultipartFile file,
                                    @RequestParam(value = "taskId", required = false) Long taskId) {
        if (file == null || file.isEmpty()) return AjaxResult.error("上传文件为空");
        if (file.getSize() > 10L * 1024 * 1024) return AjaxResult.error("文件不能超过 10MB");
        return AjaxResult.success(resultImportFacade.preview(file, taskId, getUserId()));
    }

    /** 第二步：按一次性 token 提交入库 */
    @PreAuthorize("@ss.hasPermi('apms:testResult:add')")
    @PostMapping("/import/commit")
    public AjaxResult importCommit(@RequestBody java.util.Map<String, String> body) {
        String token = body == null ? null : body.get("token");
        if (token == null || token.isEmpty()) return AjaxResult.error("缺少 token");
        return AjaxResult.success(resultImportFacade.commit(token, getUserId()));
    }

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
     * 下载导入模板。
     *
     * <p>不带 format 参数：历史 CSV 模板（含指标/模型列，兼容旧 CsvImportDialog）。
     * <br>带 format=csv|xlsx：两阶段导入新模板（<b>仅 INDICATOR 列</b>，预填在训队员）。
     */
    @PreAuthorize("@ss.hasPermi('apms:testResult:list')")
    @GetMapping("/import/template")
    public void downloadTemplate(@RequestParam(value = "taskId", required = false) Long taskId,
                                 @RequestParam(value = "format", required = false) String format,
                                 HttpServletResponse response) throws IOException {
        if (format != null && !format.isEmpty()) {
            byte[] data = importTemplates.buildResult(format.toLowerCase());
            boolean xlsx = "xlsx".equalsIgnoreCase(format) || "xls".equalsIgnoreCase(format);
            String ext = xlsx ? "xlsx" : "csv";
            String fileName = "test-result-template." + ext;
            response.setContentType(xlsx
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : "text/csv; charset=UTF-8");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Content-Disposition",
                    "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''"
                            + URLEncoder.encode(fileName, StandardCharsets.UTF_8.name()).replace("+", "%20"));
            response.getOutputStream().write(data);
            return;
        }
        // 历史 CSV 模板（保持原行为）
        String csv = templateService.buildTemplateCsv(taskId);
        String fileName = (taskId == null ? "test-result-template.csv" : "test-result-task-" + taskId + "-template.csv");
        response.setContentType("text/csv; charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''"
                        + URLEncoder.encode(fileName, StandardCharsets.UTF_8.name()).replace("+", "%20"));
        // UTF-8 BOM（EF BB BF），保证 Excel 双击打开中文不乱码。
        response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});
        response.getOutputStream().write(csv.getBytes(StandardCharsets.UTF_8));
    }

    /** 请求体包装 */
    public static class AddBody {
        public ApmsTestResult result;
        public List<ApmsTestResultValue> values;
    }
}
