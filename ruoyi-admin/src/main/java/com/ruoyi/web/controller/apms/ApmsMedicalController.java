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
import com.ruoyi.system.domain.apms.ApmsMedicalRecord;
import com.ruoyi.system.domain.apms.ApmsMedicalFile;
import com.ruoyi.system.mapper.apms.ApmsMedicalFileMapper;
import com.ruoyi.system.service.apms.IApmsMedicalService;

/**
 * 医疗记录 Controller
 *
 * 隐私设计：
 *   - list 挂 @DataScope，队伍级隔离
 *   - download 独立权限点 apms:medicalFile:download，不暴露 /common/download
 */
@RestController
@RequestMapping("/apms/medical-record")
public class ApmsMedicalController extends BaseController {

    @Autowired private IApmsMedicalService medicalService;
    @Autowired private ApmsMedicalFileMapper fileMapper;

    @Value("${ruoyi.profile}")
    private String profilePath;

    // ========== 记录 CRUD ==========

    @PreAuthorize("@ss.hasPermi('apms:medicalRecord:list')")
    @DataScope(deptAlias = "a", deptField = "primary_team_id")
    @GetMapping("/list")
    public TableDataInfo list(ApmsMedicalRecord query) {
        startPage();
        return getDataTable(medicalService.list(query));
    }

    @PreAuthorize("@ss.hasPermi('apms:medicalRecord:query')")
    @GetMapping("/{id}")
    public AjaxResult getInfo(@PathVariable Long id) {
        return AjaxResult.success(medicalService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('apms:medicalRecord:add')")
    @PostMapping
    public AjaxResult add(@RequestBody AddBody body) {
        medicalService.add(body.record, body.files);
        return AjaxResult.success();
    }

    @PreAuthorize("@ss.hasPermi('apms:medicalRecord:edit')")
    @PutMapping
    public AjaxResult edit(@RequestBody AddBody body) {
        medicalService.update(body.record, body.files);
        return AjaxResult.success();
    }

    @PreAuthorize("@ss.hasPermi('apms:medicalRecord:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(medicalService.delete(id));
    }

    // ========== 文件下载（私有权限点） ==========

    @PreAuthorize("@ss.hasPermi('apms:medicalFile:download')")
    @GetMapping("/file/download/{fileId}")
    public void download(@PathVariable Long fileId, HttpServletResponse response) {
        ApmsMedicalFile f = fileMapper.selectById(fileId);
        if (f == null) throw new ServiceException("附件不存在");

        File file = new File(profilePath + "/" + f.getFilePath());
        if (!file.exists()) throw new ServiceException("文件不存在（可能未实际存储）");

        try (FileInputStream fis = new FileInputStream(file);
             OutputStream os = response.getOutputStream()) {
            response.setContentType("application/octet-stream");
            response.setHeader("Content-Disposition", "attachment; filename="
                + URLEncoder.encode(f.getFileName(), StandardCharsets.UTF_8).replace("+", "%20"));
            response.setContentLengthLong(file.length());

            byte[] buf = new byte[4096];
            int len;
            while ((len = fis.read(buf)) != -1) os.write(buf, 0, len);
            os.flush();
        } catch (Exception e) {
            throw new ServiceException("下载失败: " + e.getMessage());
        }
    }

    @PreAuthorize("@ss.hasPermi('apms:medicalFile:remove')")
    @DeleteMapping("/file/{fileId}")
    public AjaxResult deleteFile(@PathVariable Long fileId) {
        return toAjax(fileMapper.deleteById(fileId));
    }

    // ========== 请求体包装 ==========

    public static class AddBody {
        public ApmsMedicalRecord record;
        public List<ApmsMedicalFile> files;
    }
}
