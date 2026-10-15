package com.ruoyi.framework.web.service;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.common.constant.DelegationConstants;
import com.ruoyi.common.core.domain.entity.SysRole;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.system.service.ISysRoleService;
import com.ruoyi.system.service.ISysUserService;

/**
 * 客户侧可管理对象统一门禁（D10）。
 * admin 操作者全放行；其余操作者按对象类别与操作类型判定。
 *
 * @author ruoyi
 */
@Component
public class ManagedBoundary
{
    /**
     * 操作类型：R查询 W修改 G授权 D删除
     */
    public enum Access
    {
        READ, WRITE, GRANT, DELETE
    }

    @Autowired
    private ISysRoleService roleService;

    @Autowired
    private ISysUserService userService;

    /**
     * 手机号管理门禁（绑定/解绑他人账号的登录手机号）。
     *
     * <p>规则：
     * <ul>
     *   <li>平台管理员(userId=1)：可对任意用户绑/解绑，免短信验证码（调用方据此走免码分支）；</li>
     *   <li>其他操作者（如 super/role_key=super）：目标用户必须在自己的数据范围内，
     *       且目标用户至少拥有一个 portal_* 专岗角色，否则拒绝。
     *       绑定是否还需短信验证码由调用方按"绑要码、解绑不要码"另行处理。</li>
     * </ul>
     * 注：数据范围用 {@link ISysUserService#checkUserDataScope}（越权抛异常）；
     * 平台保留账号(userId=1)另由 SysUserService.checkUserAllowed 在解绑链路兜底。
     *
     * @param targetUserId 被管理手机号所属用户
     * @param op           READ/WRITE/DELETE（语义同其他门禁，仅用于日志/异常文案）
     */
    public void assertPhoneManageable(Long targetUserId, Access op)
    {
        if (targetUserId == null)
        {
            throw new ServiceException("未指定用户");
        }
        if (isPlatformAdmin())
        {
            return;
        }
        // 数据范围：不在本部门数据范围即抛异常
        userService.checkUserDataScope(targetUserId);
        // 角色范围：非平台管理员只能管理 portal_* 专岗用户
        List<SysRole> roles = roleService.selectRolesByUserId(targetUserId);
        boolean hasPortal = roles != null && roles.stream()
                .map(SysRole::getRoleKey)
                .anyMatch(DelegationConstants::isPortalRole);
        if (!hasPortal)
        {
            throw new ServiceException("仅可管理本部门专岗角色用户的登录手机号");
        }
    }

    /**
     * 校验单个用户可触达
     */
    public void assertUserManageable(Long userId, Access op)
    {
        if (isPlatformAdmin())
        {
            return;
        }
        if (userId == null)
        {
            throw new ServiceException("未指定操作对象");
        }
        if (SecurityUtils.isAdmin(userId))
        {
            throw new ServiceException("无权操作平台保留账号");
        }
        Long currentUserId = SecurityUtils.getUserId();
        if (userId.equals(currentUserId))
        {
            // 自身：查询、改资料允许；授权换角色、删除一律禁止
            if (op == Access.GRANT || op == Access.DELETE)
            {
                throw new ServiceException("无权对当前登录账号执行该操作");
            }
        }
    }

    /**
     * 批量校验用户可触达
     */
    public void assertUsersManageable(Long[] userIds, Access op)
    {
        if (isPlatformAdmin() || userIds == null)
        {
            return;
        }
        for (Long userId : userIds)
        {
            assertUserManageable(userId, op);
        }
    }

    /**
     * 校验单个角色可触达
     */
    public void assertRoleManageable(Long roleId, Access op)
    {
        if (isPlatformAdmin())
        {
            return;
        }
        if (roleId == null)
        {
            throw new ServiceException("未指定操作对象");
        }
        SysRole role = roleService.selectRoleById(roleId);
        if (role == null)
        {
            throw new ServiceException("角色不存在或已被删除");
        }
        String roleKey = role.getRoleKey();
        if (SysRole.isAdmin(roleId) || "admin".equals(roleKey))
        {
            throw new ServiceException("无权操作平台保留角色");
        }
        if ("business_admin".equals(roleKey))
        {
            if (op != Access.READ)
            {
                throw new ServiceException("业务管理角色为内置角色，不可修改、授权或删除");
            }
            return;
        }
        if (!DelegationConstants.isPortalRole(roleKey))
        {
            if (op == Access.READ)
            {
                throw new ServiceException("无权查看该角色");
            }
            throw new ServiceException("仅专岗角色可执行该操作");
        }
    }

    /**
     * 批量校验角色可触达
     */
    public void assertRolesManageable(Long[] roleIds, Access op)
    {
        if (isPlatformAdmin() || roleIds == null)
        {
            return;
        }
        for (Long roleId : roleIds)
        {
            assertRoleManageable(roleId, op);
        }
    }

    /**
     * 列表/导出过滤：剔除平台保留用户
     */
    public List<SysUser> filterUsers(List<SysUser> users)
    {
        if (isPlatformAdmin() || users == null)
        {
            return users;
        }
        List<SysUser> result = new ArrayList<>();
        for (SysUser user : users)
        {
            if (!SecurityUtils.isAdmin(user.getUserId()))
            {
                result.add(user);
            }
        }
        return result;
    }

    /**
     * 列表/下拉/导出过滤：
     * forAssign=false 保留 business_admin(只读)+portal_*，剔除 admin；
     * forAssign=true 仅保留 portal_*。
     */
    public List<SysRole> filterRoles(List<SysRole> roles, boolean forAssign)
    {
        if (isPlatformAdmin() || roles == null)
        {
            return roles;
        }
        List<SysRole> result = new ArrayList<>();
        for (SysRole role : roles)
        {
            String roleKey = role.getRoleKey();
            if (SysRole.isAdmin(role.getRoleId()) || "admin".equals(roleKey))
            {
                continue;
            }
            if (forAssign && !DelegationConstants.isPortalRole(roleKey))
            {
                continue;
            }
            result.add(role);
        }
        return result;
    }

    /**
     * 当前操作者是否为平台保留admin
     */
    private boolean isPlatformAdmin()
    {
        Long userId = SecurityUtils.getUserId();
        return userId != null && SecurityUtils.isAdmin(userId);
    }
}
