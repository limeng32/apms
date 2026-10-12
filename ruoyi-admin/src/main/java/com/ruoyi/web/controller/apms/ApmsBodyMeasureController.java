package com.ruoyi.web.controller.apms;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import com.ruoyi.common.annotation.DataScope;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.service.apms.IApmsBodyMeasureService;
import com.ruoyi.system.service.apms.batchimport.BodyMeasureImportService;
import com.ruoyi.system.service.apms.batchimport.ImportTemplates;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 体态测量 Controller
 */
@RestController
@RequestMapping("/apms/body-measure")
public class ApmsBodyMeasureController extends BaseController {

    @Autowired
    private IApmsBodyMeasureService measureService;

    @Autowired
    private BodyMeasureImportService bodyImportService;

    @Autowired
    private ImportTemplates importTemplates;

    // ==================== 两阶段批量导入（Excel/CSV · 预览 → 确认） ====================

    /** 第一步：上传解析预览（不入库） */
    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PostMapping("/import/preview")
    public AjaxResult importPreview(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) return AjaxResult.error("上传文件为空");
        if (file.getSize() > 10L * 1024 * 1024) return AjaxResult.error("文件不能超过 10MB");
        return AjaxResult.success(bodyImportService.preview(file, getUserId()));
    }

    /** 第二步：token 提交；overwriteImport=true 时覆盖此前导入（data_source='import'）的同日记录 */
    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PostMapping("/import/commit")
    public AjaxResult importCommit(@RequestBody java.util.Map<String, Object> body) {
        String token = body == null ? null : (String) body.get("token");
        if (token == null || token.isEmpty()) return AjaxResult.error("缺少 token");
        boolean overwrite = Boolean.TRUE.equals(body.get("overwriteImport"));
        return AjaxResult.success(bodyImportService.commit(token, overwrite, getUserId()));
    }

    /** 下载导入模板（format=xlsx 默认 / csv） */
    @PreAuthorize("@ss.hasPermi('apms:body:list')")
    @GetMapping("/import/template")
    public void downloadTemplate(@RequestParam(value = "format", required = false, defaultValue = "xlsx") String format,
                                 HttpServletResponse response) throws IOException {
        byte[] data = importTemplates.buildBody(format);
        boolean xlsx = !"csv".equalsIgnoreCase(format);
        String ext = xlsx ? "xlsx" : "csv";
        String fileName = "body-measure-template." + ext;
        response.setContentType(xlsx
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv; charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''"
                        + URLEncoder.encode(fileName, StandardCharsets.UTF_8.name()).replace("+", "%20"));
        response.getOutputStream().write(data);
    }

    /** 全局列表（DataScope 队伍隔离） */
    @PreAuthorize("@ss.hasPermi('apms:body:list')")
    @DataScope(deptAlias = "a")
    @GetMapping("/list")
    public AjaxResult list(ApmsBodyMeasure query) {
        return success(measureService.list(query));
    }

    /** 按运动员查询所有测量记录 */
    @PreAuthorize("@ss.hasPermi('apms:body:query')")
    @GetMapping("/athlete/{athleteId}")
    public AjaxResult getByAthlete(@PathVariable Long athleteId) {
        List<ApmsBodyMeasure> list = measureService.selectByAthleteId(athleteId);
        return success(list);
    }

    /** 按运动员查询最新一条 */
    @PreAuthorize("@ss.hasPermi('apms:body:query')")
    @GetMapping("/athlete/{athleteId}/latest")
    public AjaxResult getLatest(@PathVariable Long athleteId) {
        return success(measureService.selectLatestByAthleteId(athleteId));
    }

    /** 按 ID 查询 */
    @PreAuthorize("@ss.hasPermi('apms:body:query')")
    @GetMapping("/{id}")
    public AjaxResult getById(@PathVariable Long id) {
        return success(measureService.selectById(id));
    }

    /** 新增或更新（upsert） */
    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PostMapping("/upsert")
    public AjaxResult upsert(@RequestBody ApmsBodyMeasure measure) {
        return toAjax(measureService.upsert(measure));
    }

    /** 新增 */
    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PostMapping
    public AjaxResult add(@RequestBody ApmsBodyMeasure measure) {
        return toAjax(measureService.upsert(measure));
    }

    /** 修改 */
    @PreAuthorize("@ss.hasPermi('apms:body:edit')")
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsBodyMeasure measure) {
        return toAjax(measureService.upsert(measure));
    }

    /** 删除 */
    @PreAuthorize("@ss.hasPermi('apms:body:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(measureService.deleteById(id));
    }
}
