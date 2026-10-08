package com.ruoyi.web.controller.system;

import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.ArrayUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.constant.UserConstants;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.system.service.ISysDeptService;

/**
 * 部门信息
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/system/dept")
public class SysDeptController extends BaseController
{
    @Autowired
    private ISysDeptService deptService;

    /**
     * 获取部门列表
     */
    @PreAuthorize("@ss.hasPermi('system:dept:list')")
    @GetMapping("/list")
    public AjaxResult list(SysDept dept)
    {
        List<SysDept> depts = deptService.selectDeptList(dept);
        return success(depts);
    }

    /**
     * 查询部门列表（排除节点）
     */
    @PreAuthorize("@ss.hasPermi('system:dept:list')")
    @GetMapping("/list/exclude/{deptId}")
    public AjaxResult excludeChild(@PathVariable(value = "deptId", required = false) Long deptId)
    {
        List<SysDept> depts = deptService.selectDeptList(new SysDept());
        depts.removeIf(d -> d.getDeptId().intValue() == deptId || ArrayUtils.contains(StringUtils.split(d.getAncestors(), ","), deptId + ""));
        return success(depts);
    }

    /**
     * 根据部门编号获取详细信息
     */
    @PreAuthorize("@ss.hasPermi('system:dept:query')")
    @GetMapping(value = "/{deptId}")
    public AjaxResult getInfo(@PathVariable Long deptId)
    {
        deptService.checkDeptDataScope(deptId);
        return success(deptService.selectDeptById(deptId));
    }

    /**
     * 新增部门
     */
    @PreAuthorize("@ss.hasPermi('system:dept:add')")
    @Log(title = "部门管理", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@Validated @RequestBody SysDept dept)
    {
        // 仅平台管理员可建顶级/根公司下部门；其他角色（如 super）只能在
        // 二级部门（APMS 总部）及其子树下新增，防止绕过前端直接调接口
        if (!SecurityUtils.isAdmin())
        {
            Long parentId = dept.getParentId();
            if (parentId == null || parentId == 0L)
            {
                return error("新增部门失败：不支持创建顶级部门，请在「APMS 总部」下新增下级");
            }
            SysDept parent = deptService.selectDeptById(parentId);
            if (parent == null || parent.getParentId() == null || parent.getParentId() == 0L)
            {
                return error("新增部门失败：仅支持在「APMS 总部」及其下级部门下新增");
            }
        }
        // 类型层级约束：机构(10)→队伍(20)→训练/科研/恢复小组(30/40/50)
        AjaxResult typeCheck = validateDeptTypeHierarchy(dept);
        if (typeCheck != null)
        {
            return typeCheck;
        }
        if (!deptService.checkDeptNameUnique(dept))
        {
            return error("新增部门'" + dept.getDeptName() + "'失败，部门名称已存在");
        }
        dept.setCreateBy(getUsername());
        return toAjax(deptService.insertDept(dept));
    }

    /**
     * 校验部门类型与上级部门的层级关系（机构-队伍-小组）。
     * @return null=通过；否则为包含错误信息的 AjaxResult
     */
    private AjaxResult validateDeptTypeHierarchy(SysDept dept)
    {
        String type = dept.getDeptType();
        if (StringUtils.isEmpty(type))
        {
            return error("请选择部门类型（队伍/训练小组/科研小组/恢复小组）");
        }
        // 顶级机构只能由平台管理员创建
        if ("10".equals(type))
        {
            if (!SecurityUtils.isAdmin())
            {
                return error("仅平台管理员可创建机构");
            }
            return null;
        }
        Long parentId = dept.getParentId();
        if (parentId == null || parentId == 0L)
        {
            return error("队伍或小组必须挂在上级部门下");
        }
        SysDept parent = deptService.selectDeptById(parentId);
        if (parent == null)
        {
            return error("上级部门不存在");
        }
        String parentType = parent.getDeptType();
        if ("20".equals(type))
        {
            // 队伍只能挂在机构下
            if (!"10".equals(parentType))
            {
                return error("队伍（梯队）只能建在机构（APMS 总部）下");
            }
        }
        else if ("30".equals(type) || "40".equals(type) || "50".equals(type))
        {
            // 小组只能挂在队伍（梯队）下
            if (!"20".equals(parentType))
            {
                return error("小组只能建在队伍（梯队）下");
            }
        }
        else
        {
            return error("未知的部门类型：" + type);
        }
        return null;
    }

    /**
     * 修改部门
     */
    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @Log(title = "部门管理", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@Validated @RequestBody SysDept dept)
    {
        Long deptId = dept.getDeptId();
        deptService.checkDeptDataScope(deptId);
        if (!deptService.checkDeptNameUnique(dept))
        {
            return error("修改部门'" + dept.getDeptName() + "'失败，部门名称已存在");
        }
        else if (dept.getParentId().equals(deptId))
        {
            return error("修改部门'" + dept.getDeptName() + "'失败，上级部门不能是自己");
        }
        else if (StringUtils.equals(UserConstants.DEPT_DISABLE, dept.getStatus()) && deptService.selectNormalChildrenDeptById(deptId) > 0)
        {
            return error("该部门包含未停用的子部门！");
        }
        // 类型层级约束（传了部门类型才校验，兼容历史无类型数据）
        if (StringUtils.isNotEmpty(dept.getDeptType()))
        {
            AjaxResult typeCheck = validateDeptTypeHierarchy(dept);
            if (typeCheck != null)
            {
                return typeCheck;
            }
        }
        dept.setUpdateBy(getUsername());
        return toAjax(deptService.updateDept(dept));
    }

    /**
     * 保存部门排序
     */
    @PreAuthorize("@ss.hasPermi('system:dept:edit')")
    @Log(title = "保存部门排序", businessType = BusinessType.UPDATE)
    @PutMapping("/updateSort")
    public AjaxResult updateSort(@RequestBody Map<String, String> params)
    {
        String[] deptIds = params.get("deptIds").split(",");
        String[] orderNums = params.get("orderNums").split(",");
        deptService.updateDeptSort(deptIds, orderNums);
        return success();
    }

    /**
     * 删除部门
     */
    @PreAuthorize("@ss.hasPermi('system:dept:remove')")
    @Log(title = "部门管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{deptId}")
    public AjaxResult remove(@PathVariable Long deptId)
    {
        if (deptService.hasChildByDeptId(deptId))
        {
            return warn("存在下级部门,不允许删除");
        }
        if (deptService.checkDeptExistUser(deptId))
        {
            return warn("部门存在用户,不允许删除");
        }
        if (deptService.checkDeptExistAthlete(deptId))
        {
            return warn("该部门下存在在队运动员或在组成员,不允许删除,请先调整人员归属");
        }
        deptService.checkDeptDataScope(deptId);
        return toAjax(deptService.deleteDeptById(deptId));
    }
}
