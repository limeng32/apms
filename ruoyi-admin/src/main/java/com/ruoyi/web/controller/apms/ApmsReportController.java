package com.ruoyi.web.controller.apms;

import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsReport;
import com.ruoyi.system.service.apms.IApmsReportService;

/**
 * PDF 报告 Controller
 *
 * 端点：
 *   GET    /apms/report/list          列表（DataScope 队伍级）
 *   GET    /apms/report/{id}          详情（含 JSON 快照）
 *   POST   /apms/report/generate      生成新报告（聚合 + PDF 渲染 + 存快照）
 *   GET    /apms/report/download/{id} 下载 PDF（独立权限点）
 *   DELETE /apms/report/{id}          删除
 */
@RestController
@RequestMapping("/apms/report")
public class ApmsReportController extends BaseController {

    @Autowired private IApmsReportService reportService;

    @Value("${ruoyi.profile}")
    private String profilePath;

    @PreAuthorize("@ss.hasPermi('apms:report:list')")
    @DataScope(deptAlias = "r", deptField = "dept_id")
    @GetMapping("/list")
    public TableDataInfo list(ApmsReport query) {
        startPage();
        return getDataTable(reportService.list(query));
    }

    @PreAuthorize("@ss.hasPermi('apms:report:query')")
    @GetMapping("/{id}")
    public AjaxResult getInfo(@PathVariable Long id) {
        return AjaxResult.success(reportService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:report:generate')")
    @PostMapping("/generate")
    public AjaxResult generate(@RequestParam String reportType,
                               @RequestParam(required = false) Long athleteId,
                               @RequestParam(required = false) Long deptId,
                               @RequestParam(required = false) Long taskId) {
        ApmsReport r = reportService.generate(reportType, athleteId, deptId, taskId);
        return AjaxResult.success(r);
    }

    @PreAuthorize("@ss.hasPermi('apms:report:download')")
    @GetMapping("/download/{id}")
    public void download(@PathVariable Long id, HttpServletResponse response) {
        ApmsReport r = reportService.getById(id);
        if (r == null) throw new ServiceException("报告不存在");
        if (r.getFilePath() == null) throw new ServiceException("报告未生成文件");

        File file = new File(profilePath + "/" + r.getFilePath());
        if (!file.exists()) throw new ServiceException("PDF 文件不存在（可能被清理）");

        try (FileInputStream fis = new FileInputStream(file);
             OutputStream os = response.getOutputStream()) {
            String fileName = (r.getAthleteName() != null ? r.getAthleteName() + "_" : "")
                + r.getReportType() + ".pdf";
            response.setContentType("application/pdf");
            response.setHeader("Content-Disposition", "attachment; filename="
                + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20"));
            response.setContentLengthLong(file.length());

            byte[] buf = new byte[4096];
            int len;
            while ((len = fis.read(buf)) != -1) os.write(buf, 0, len);
            os.flush();
        } catch (Exception e) {
            throw new ServiceException("下载失败: " + e.getMessage());
        }
    }

    @PreAuthorize("@ss.hasPermi('apms:report:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(reportService.delete(id));
    }
}
