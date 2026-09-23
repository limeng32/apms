package com.ruoyi.web.controller.system;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import jakarta.servlet.http.HttpServletResponse;
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
import com.ruoyi.common.constant.DelegationConstants;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.core.domain.entity.SysRole;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.common.utils.poi.ExcelUtil;
import com.ruoyi.framework.web.service.ManagedBoundary;
import com.ruoyi.framework.web.service.ManagedBoundary.Access;
import com.ruoyi.framework.web.service.SysPermissionService;
import com.ruoyi.framework.web.service.TokenService;
import com.ruoyi.system.domain.SysUserRole;
import com.ruoyi.system.mapper.SysMenuMapper;
import com.ruoyi.system.service.ISysDeptService;
import com.ruoyi.system.service.ISysRoleService;
import com.ruoyi.system.service.ISysUserService;

/**
 * 角色信息
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/system/role")
public class SysRoleController extends BaseController
{
    @Autowired
    private ISysRoleService roleService;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private SysPermissionService permissionService;

    @Autowired
    private ISysUserService userService;

    @Autowired
    private ISysDeptService deptService;

    @Autowired
    private ManagedBoundary managedBoundary;

    @Autowired
    private SysMenuMapper menuMapper;

    @PreAuthorize("@ss.hasPermi('system:role:list')")
    @GetMapping("/list")
    public TableDataInfo list(SysRole role)
    {
        startPage();
        List<SysRole> list = roleService.selectRoleList(role);
        return getDataTable(list);
    }

    @Log(title = "角色管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@ss.hasPermi('system:role:export')")
    @PostMapping("/export")
    public void export(HttpServletResponse response, SysRole role)
    {
        List<SysRole> list = roleService.selectRoleList(role);
        ExcelUtil<SysRole> util = new ExcelUtil<SysRole>(SysRole.class);
        util.exportExcel(response, list, "角色数据");
    }

    /**
     * 根据角色编号获取详细信息
     */
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    @GetMapping(value = "/{roleId}")
    public AjaxResult getInfo(@PathVariable Long roleId)
    {
        managedBoundary.assertRoleManageable(roleId, Access.READ);
        roleService.checkRoleDataScope(roleId);
        return success(roleService.selectRoleById(roleId));
    }

    /**
     * 新增角色
     */
    @PreAuthorize("@ss.hasPermi('system:role:add')")
    @Log(title = "角色管理", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@Validated @RequestBody SysRole role)
    {
        if (!roleService.checkRoleNameUnique(role))
        {
            return error("新增角色'" + role.getRoleName() + "'失败，角色名称已存在");
        }
        else if (!roleService.checkRoleKeyUnique(role))
        {
            return error("新增角色'" + role.getRoleName() + "'失败，角色权限已存在");
        }
        role.setCreateBy(getUsername());
        return toAjax(roleService.insertRole(role));

    }

    /**
     * 修改保存角色
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@Validated @RequestBody SysRole role)
    {
        managedBoundary.assertRoleManageable(role.getRoleId(), Access.WRITE);
        roleService.checkRoleAllowed(role);
        roleService.checkRoleDataScope(role.getRoleId());
        if (!roleService.checkRoleNameUnique(role))
        {
            return error("修改角色'" + role.getRoleName() + "'失败，角色名称已存在");
        }
        else if (!roleService.checkRoleKeyUnique(role))
        {
            return error("修改角色'" + role.getRoleName() + "'失败，角色权限已存在");
        }
        role.setUpdateBy(getUsername());

        // F8 变更前快照：旧角色、旧菜单集合
        SysRole oldRole = roleService.selectRoleById(role.getRoleId());
        List<Long> oldMenuIds = menuMapper.selectMenuListByRoleId(role.getRoleId(), false);

        if (roleService.updateRole(role) > 0)
        {
            boolean portalDefinitionChanged = DelegationConstants.isPortalRole(oldRole.getRoleKey())
                    && (isMenuChanged(oldMenuIds, role.getMenuIds())
                            || !StringUtils.equals(oldRole.getHomePath(), role.getHomePath()));
            if (portalDefinitionChanged)
            {
                // Portal角色定义变更：强制持有者重新登录，以加载新路由/模式/落地页
                tokenService.forceLogoutByRoleId(role.getRoleId());
            }
            else
            {
                // 刷新所有持有该角色的在线用户权限
                tokenService.refreshPermissionByRoleId(role.getRoleId(), permissionService);
            }
            return success();
        }
        return error("修改角色'" + role.getRoleName() + "'失败，请联系管理员");
    }

    /**
     * 比对角色菜单集合是否发生变化
     */
    private boolean isMenuChanged(List<Long> oldMenuIds, Long[] newMenuIds)
    {
        if (newMenuIds == null || oldMenuIds.size() != newMenuIds.length)
        {
            return true;
        }
        Set<Long> oldSet = new HashSet<>(oldMenuIds);
        for (Long newMenuId : newMenuIds)
        {
            if (!oldSet.contains(newMenuId))
            {
                return true;
            }
        }
        return false;
    }

    /**
     * 修改保存数据权限
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @PutMapping("/dataScope")
    public AjaxResult dataScope(@RequestBody SysRole role)
    {
        managedBoundary.assertRoleManageable(role.getRoleId(), Access.WRITE);
        roleService.checkRoleAllowed(role);
        roleService.checkRoleDataScope(role.getRoleId());
        return toAjax(roleService.authDataScope(role));
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.UPDATE)
    @PutMapping("/changeStatus")
    public AjaxResult changeStatus(@RequestBody SysRole role)
    {
        managedBoundary.assertRoleManageable(role.getRoleId(), Access.WRITE);
        roleService.checkRoleAllowed(role);
        roleService.checkRoleDataScope(role.getRoleId());
        role.setUpdateBy(getUsername());
        int rows = roleService.updateRoleStatus(role);
        // F7 停用角色：持有者全部强制下线
        if (rows > 0 && "1".equals(role.getStatus()))
        {
            tokenService.forceLogoutByRoleId(role.getRoleId());
        }
        return toAjax(rows);
    }

    /**
     * 删除角色
     */
    @PreAuthorize("@ss.hasPermi('system:role:remove')")
    @Log(title = "角色管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{roleIds}")
    public AjaxResult remove(@PathVariable Long[] roleIds)
    {
        managedBoundary.assertRolesManageable(roleIds, Access.DELETE);
        return toAjax(roleService.deleteRoleByIds(roleIds));
    }

    /**
     * 获取角色选择框列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    @GetMapping("/optionselect")
    public AjaxResult optionselect()
    {
        return success(managedBoundary.filterRoles(roleService.selectRoleAll(), true));
    }

    /**
     * 查询已分配用户角色列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:list')")
    @GetMapping("/authUser/allocatedList")
    public TableDataInfo allocatedList(SysUser user)
    {
        managedBoundary.assertRoleManageable(user.getRoleId(), Access.READ);
        startPage();
        List<SysUser> list = userService.selectAllocatedList(user);
        return getDataTable(list);
    }

    /**
     * 查询未分配用户角色列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:list')")
    @GetMapping("/authUser/unallocatedList")
    public TableDataInfo unallocatedList(SysUser user)
    {
        managedBoundary.assertRoleManageable(user.getRoleId(), Access.READ);
        startPage();
        List<SysUser> list = userService.selectUnallocatedList(user);
        return getDataTable(list);
    }

    /**
     * 取消授权用户
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @PutMapping("/authUser/cancel")
    public AjaxResult cancelAuthUser(@RequestBody SysUserRole userRole)
    {
        managedBoundary.assertRoleManageable(userRole.getRoleId(), Access.GRANT);
        managedBoundary.assertUserManageable(userRole.getUserId(), Access.GRANT);
        int rows = roleService.deleteAuthUser(userRole);
        // F5 取消授权：目标强制下线
        if (rows > 0)
        {
            tokenService.forceLogoutByUserIds(new Long[] { userRole.getUserId() });
        }
        return toAjax(rows);
    }

    /**
     * 批量取消授权用户
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @PutMapping("/authUser/cancelAll")
    public AjaxResult cancelAuthUserAll(Long roleId, Long[] userIds)
    {
        managedBoundary.assertRoleManageable(roleId, Access.GRANT);
        managedBoundary.assertUsersManageable(userIds, Access.GRANT);
        int rows = roleService.deleteAuthUsers(roleId, userIds);
        // F5 批量取消授权：目标强制下线
        if (rows > 0 && userIds != null)
        {
            tokenService.forceLogoutByUserIds(userIds);
        }
        return toAjax(rows);
    }

    /**
     * 批量选择用户授权
     */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @Log(title = "角色管理", businessType = BusinessType.GRANT)
    @PutMapping("/authUser/selectAll")
    public AjaxResult selectAuthUserAll(Long roleId, Long[] userIds)
    {
        managedBoundary.assertRoleManageable(roleId, Access.GRANT);
        managedBoundary.assertUsersManageable(userIds, Access.GRANT);
        roleService.checkRoleDataScope(roleId);
        int rows = roleService.insertAuthUsers(roleId, userIds);
        // F5 批量授权：目标强制下线
        if (rows > 0 && userIds != null)
        {
            tokenService.forceLogoutByUserIds(userIds);
        }
        return toAjax(rows);
    }

    /**
     * 获取对应角色部门树列表
     */
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    @GetMapping(value = "/deptTree/{roleId}")
    public AjaxResult deptTree(@PathVariable("roleId") Long roleId)
    {
        managedBoundary.assertRoleManageable(roleId, Access.READ);
        AjaxResult ajax = AjaxResult.success();
        ajax.put("checkedKeys", deptService.selectDeptListByRoleId(roleId));
        ajax.put("depts", deptService.selectDeptTreeList(new SysDept()));
        return ajax;
    }
}
