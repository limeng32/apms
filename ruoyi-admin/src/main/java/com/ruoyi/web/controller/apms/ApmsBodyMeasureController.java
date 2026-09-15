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
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.system.domain.apms.ApmsBodyMeasure;
import com.ruoyi.system.service.apms.IApmsBodyMeasureService;

/**
 * 体态测量 Controller
 *
 * @author apms
 */
@RestController
@RequestMapping("/apms/body-measure")
public class ApmsBodyMeasureController extends BaseController {

    @Autowired
    private IApmsBodyMeasureService measureService;

    /**
     * 按运动员查询所有测量记录
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/athlete/{athleteId}")
    public AjaxResult getByAthlete(@PathVariable Long athleteId) {
        List<ApmsBodyMeasure> list = measureService.selectByAthleteId(athleteId);
        return success(list);
    }

    /**
     * 按运动员查询最新一条
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/athlete/{athleteId}/latest")
    public AjaxResult getLatest(@PathVariable Long athleteId) {
        return success(measureService.selectLatestByAthleteId(athleteId));
    }

    /**
     * 按ID查询
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:query')")
    @GetMapping("/{id}")
    public AjaxResult getById(@PathVariable Long id) {
        return success(measureService.selectById(id));
    }

    /**
     * 新增或更新（upsert）
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @PostMapping("/upsert")
    public AjaxResult upsert(@RequestBody ApmsBodyMeasure measure) {
        return toAjax(measureService.upsert(measure));
    }

    /**
     * 新增
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @PostMapping
    public AjaxResult add(@RequestBody ApmsBodyMeasure measure) {
        return toAjax(measureService.upsert(measure));
    }

    /**
     * 修改
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:edit')")
    @PutMapping
    public AjaxResult edit(@RequestBody ApmsBodyMeasure measure) {
        return toAjax(measureService.upsert(measure));
    }

    /**
     * 删除
     */
    @PreAuthorize("@ss.hasPermi('apms:athlete:remove')")
    @DeleteMapping("/{id}")
    public AjaxResult remove(@PathVariable Long id) {
        return toAjax(measureService.deleteById(id));
    }
}
