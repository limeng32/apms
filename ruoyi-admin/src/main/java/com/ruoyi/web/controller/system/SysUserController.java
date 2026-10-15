package com.ruoyi.web.controller.system;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import jakarta.servlet.http.HttpServletResponse;
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
import org.springframework.web.multipart.MultipartFile;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.entity.SysDept;
import com.ruoyi.common.core.domain.entity.SysRole;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.common.utils.poi.ExcelUtil;
import com.ruoyi.framework.web.service.ManagedBoundary;
import com.ruoyi.framework.web.service.ManagedBoundary.Access;
import com.ruoyi.framework.web.service.TokenService;
import com.ruoyi.system.service.ISysDeptService;
import com.ruoyi.system.service.ISysPostService;
import com.ruoyi.system.service.ISysRoleService;
import com.ruoyi.system.service.ISysUserService;

/**
 * 用户信息
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/system/user")
public class SysUserController extends BaseController
{
    @Autowired
    private ISysUserService userService;

    @Autowired
    private ISysRoleService roleService;

    @Autowired
    private ISysDeptService deptService;

    @Autowired
    private ISysPostService postService;

    @Autowired
    private ManagedBoundary managedBoundary;

    @Autowired
    private TokenService tokenService;

    /**
     * 获取用户列表
     */
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/list")
    public TableDataInfo list(SysUser user)
    {
        startPage();
        List<SysUser> list = userService.selectUserList(user);
        return getDataTable(list);
    }

    @Log(title = "用户管理", businessType = BusinessType.EXPORT)
    @PreAuthorize("@ss.hasPermi('system:user:export')")
    @PostMapping("/export")
    public void export(HttpServletResponse response, SysUser user)
    {
        List<SysUser> list = userService.selectUserList(user);
        ExcelUtil<SysUser> util = new ExcelUtil<SysUser>(SysUser.class);
        util.exportExcel(response, list, "用户数据");
    }

    @Log(title = "用户管理", businessType = BusinessType.IMPORT)
    @PreAuthorize("@ss.hasPermi('system:user:import')")
    @PostMapping("/importData")
    public AjaxResult importData(MultipartFile file, boolean updateSupport) throws Exception
    {
        // 导入的新用户统一使用初始密码，部门管理员无法按「手机号建号、不指定密码」策略建号，
        // 故禁止其导入，避免产生可密码登录或无法登录的账号；请走「新增用户」逐个建号
        if (!SecurityUtils.isAdmin())
        {
            return error("部门管理员不支持批量导入，请通过「新增用户」填写登录手机号逐个创建");
        }
        ExcelUtil<SysUser> util = new ExcelUtil<SysUser>(SysUser.class);
        List<SysUser> userList = util.importExcel(file.getInputStream());
        String operName = getUsername();
        String message = userService.importUser(userList, updateSupport, operName);
        return success(message);
    }

    @PostMapping("/importTemplate")
    public void importTemplate(HttpServletResponse response)
    {
        ExcelUtil<SysUser> util = new ExcelUtil<SysUser>(SysUser.class);
        util.importTemplateExcel(response, "用户数据");
    }

    /**
     * 根据用户编号获取详细信息
     */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping(value = { "/", "/{userId}" })
    public AjaxResult getInfo(@PathVariable(value = "userId", required = false) Long userId)
    {
        AjaxResult ajax = AjaxResult.success();
        if (StringUtils.isNotNull(userId))
        {
            managedBoundary.assertUserManageable(userId, Access.READ);
            userService.checkUserDataScope(userId);
            SysUser sysUser = userService.selectUserById(userId);
            ajax.put(AjaxResult.DATA_TAG, sysUser);
            ajax.put("postIds", postService.selectPostListByUserId(userId));
            ajax.put("roleIds", sysUser.getRoles().stream().map(SysRole::getRoleId).collect(Collectors.toList()));
        }
        List<SysRole> roles = roleService.selectRoleAll();
        ajax.put("roles", managedBoundary.filterRoles(roles, true));
        ajax.put("posts", postService.selectPostAll());
        return ajax;
    }

    /**
     * 新增用户
     */
    @PreAuthorize("@ss.hasPermi('system:user:add')")
    @Log(title = "用户管理", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@Validated @RequestBody SysUser user)
    {
        managedBoundary.assertRolesManageable(user.getRoleIds(), Access.GRANT);
        deptService.checkDeptManageScope(user.getDeptId());
        roleService.checkRoleDataScope(user.getRoleIds());
        if (!userService.checkUserNameUnique(user))
        {
            return error("新增用户'" + user.getUserName() + "'失败，登录账号已存在");
        }
        else if (StringUtils.isNotEmpty(user.getPhonenumber()) && !userService.checkPhoneUnique(user))
        {
            return error("新增用户'" + user.getUserName() + "'失败，手机号码已存在");
        }
        else if (StringUtils.isNotEmpty(user.getEmail()) && !userService.checkEmailUnique(user))
        {
            return error("新增用户'" + user.getUserName() + "'失败，邮箱账号已存在");
        }
        // 凭证策略：
        //  - 平台管理员(userId=1)：密码与登录手机号至少一项，可按传统账号密码建号；
        //  - 其他管理员（super 等）：禁止指定密码（前端传了也忽略），必须填登录手机号，
        //    系统生成 32 位随机强密码占位，账号初始只能短信登录，需要密码时联系平台管理员。
        boolean platformAdmin = SecurityUtils.isAdmin();
        String rawPassword = platformAdmin ? user.getPassword() : null;
        String loginPhone = StringUtils.trim(user.getLoginPhonenumber());
        boolean hasPassword = StringUtils.isNotEmpty(rawPassword);
        boolean hasLoginPhone = StringUtils.isNotEmpty(loginPhone);
        if (!platformAdmin && !hasLoginPhone)
        {
            return error("请填写登录手机号（部门管理员创建的账号仅支持短信登录）");
        }
        if (platformAdmin && !hasPassword && !hasLoginPhone)
        {
            return error("登录密码与登录手机号至少填写一项");
        }
        if (hasLoginPhone && !loginPhone.matches("^1[3-9]\\d{9}$"))
        {
            return error("请输入正确的登录手机号");
        }
        if (!hasPassword)
        {
            // 无显式密码（平台管理员仅手机号建号 / 部门管理员强制路径）：
            // 生成 32 位随机强密码并 BCrypt 加密，明文不返回、不记日志
            rawPassword = generateRandomPassword();
        }
        user.setCreateBy(getUsername());
        user.setPassword(SecurityUtils.encryptPassword(rawPassword));
        return toAjax(userService.insertUserWithPhone(user, hasLoginPhone ? loginPhone : null, getUsername()));
    }

    /**
     * 生成 32 位随机强密码（SecureRandom，大小写字母+数字并保证三类覆盖）。
     * 明文仅用于本次 BCrypt 加密，禁止出现在返回值与日志中。
     */
    private String generateRandomPassword()
    {
        final String upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        final String lower = "abcdefghijklmnopqrstuvwxyz";
        final String digit = "0123456789";
        final String all = upper + lower + digit;
        SecureRandom random = new SecureRandom();
        List<Character> chars = new ArrayList<>(32);
        // 先保证大写、小写、数字各至少一位
        chars.add(upper.charAt(random.nextInt(upper.length())));
        chars.add(lower.charAt(random.nextInt(lower.length())));
        chars.add(digit.charAt(random.nextInt(digit.length())));
        for (int i = 3; i < 32; i++)
        {
            chars.add(all.charAt(random.nextInt(all.length())));
        }
        // 打乱，避免前三位类别位置固定
        Collections.shuffle(chars, random);
        StringBuilder sb = new StringBuilder(32);
        for (Character c : chars)
        {
            sb.append(c.charValue());
        }
        return sb.toString();
    }

    /**
     * 修改用户
     */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@Validated @RequestBody SysUser user)
    {
        managedBoundary.assertUserManageable(user.getUserId(), Access.WRITE);
        managedBoundary.assertRolesManageable(user.getRoleIds(), Access.GRANT);
        userService.checkUserAllowed(user);
        userService.checkUserDataScope(user.getUserId());
        // 与 changeStatus 同口径：禁止通过编辑资料停用当前登录用户自己
        if (user.getUserId().equals(getUserId()) && "1".equals(user.getStatus()))
        {
            return error("当前用户不能停用");
        }
        deptService.checkDeptManageScope(user.getDeptId());
        roleService.checkRoleDataScope(user.getRoleIds());
        if (!userService.checkUserNameUnique(user))
        {
            return error("修改用户'" + user.getUserName() + "'失败，登录账号已存在");
        }
        else if (StringUtils.isNotEmpty(user.getPhonenumber()) && !userService.checkPhoneUnique(user))
        {
            return error("修改用户'" + user.getUserName() + "'失败，手机号码已存在");
        }
        else if (StringUtils.isNotEmpty(user.getEmail()) && !userService.checkEmailUnique(user))
        {
            return error("修改用户'" + user.getUserName() + "'失败，邮箱账号已存在");
        }
        user.setUpdateBy(getUsername());
        // F3 变更前角色快照（自身编辑不比较：角色集合恒锁定）
        boolean compareRoles = !user.getUserId().equals(getUserId());
        List<Long> oldRoleIds = compareRoles ? roleService.selectRoleListByUserId(user.getUserId()) : null;
        int rows = userService.updateUser(user);
        // F3 角色集合变更：目标强制下线；仅改昵称等资料不踢
        if (rows > 0 && compareRoles && isRolesChanged(oldRoleIds, user.getRoleIds()))
        {
            tokenService.forceLogoutByUserIds(new Long[] { user.getUserId() });
        }
        return toAjax(rows);
    }

    /**
     * 比对用户角色集合是否发生变化
     */
    private boolean isRolesChanged(List<Long> oldRoleIds, Long[] newRoleIds)
    {
        if (newRoleIds == null || oldRoleIds.size() != newRoleIds.length)
        {
            return true;
        }
        Set<Long> oldSet = new HashSet<>(oldRoleIds);
        for (Long newRoleId : newRoleIds)
        {
            if (!oldSet.contains(newRoleId))
            {
                return true;
            }
        }
        return false;
    }

    /**
     * 删除用户
     */
    @PreAuthorize("@ss.hasPermi('system:user:remove')")
    @Log(title = "用户管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{userIds}")
    public AjaxResult remove(@PathVariable Long[] userIds)
    {
        if (ArrayUtils.contains(userIds, getUserId()))
        {
            return error("当前用户不能删除");
        }
        managedBoundary.assertUsersManageable(userIds, Access.DELETE);
        int rows = userService.deleteUserByIds(userIds);
        // F2 删除用户：目标全部强制下线
        if (rows > 0)
        {
            tokenService.forceLogoutByUserIds(userIds);
        }
        return toAjax(rows);
    }

    /**
     * 重置密码
     *
     * 仅平台内置管理员(userId=1)可重置他人密码；super 等部门管理员创建的账号
     * 走短信登录体系，无权设置/重置密码（个人中心凭旧密码改自己密码不受此限制）。
     * 硬闸在 Controller，不依赖前端按钮显隐或权限点是否已回收。
     */
    @PreAuthorize("@ss.hasPermi('system:user:resetPwd')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping("/resetPwd")
    public AjaxResult resetPwd(@RequestBody SysUser user)
    {
        if (!SecurityUtils.isAdmin())
        {
            return error("仅平台管理员可重置密码；该账号可使用短信验证码登录");
        }
        managedBoundary.assertUserManageable(user.getUserId(), Access.WRITE);
        userService.checkUserAllowed(user);
        userService.checkUserDataScope(user.getUserId());
        user.setPassword(SecurityUtils.encryptPassword(user.getPassword()));
        user.setUpdateBy(getUsername());
        int rows = userService.resetPwd(user);
        // F6 重置密码：目标强制下线，以新密码重新登录
        if (rows > 0)
        {
            tokenService.forceLogoutByUserIds(new Long[] { user.getUserId() });
        }
        return toAjax(rows);
    }

    /**
     * 状态修改
     */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.UPDATE)
    @PutMapping("/changeStatus")
    public AjaxResult changeStatus(@RequestBody SysUser user)
    {
        managedBoundary.assertUserManageable(user.getUserId(), Access.WRITE);
        userService.checkUserAllowed(user);
        userService.checkUserDataScope(user.getUserId());
        if (user.getUserId().equals(getUserId()) && "1".equals(user.getStatus()))
        {
            return error("当前用户不能停用");
        }
        user.setUpdateBy(getUsername());
        int rows = userService.updateUserStatus(user);
        // F1 停用用户：目标强制下线（启用不踢）
        if (rows > 0 && "1".equals(user.getStatus()))
        {
            tokenService.forceLogoutByUserIds(new Long[] { user.getUserId() });
        }
        return toAjax(rows);
    }

    /**
     * 根据用户编号获取授权角色
     */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/authRole/{userId}")
    public AjaxResult authRole(@PathVariable("userId") Long userId)
    {
        managedBoundary.assertUserManageable(userId, Access.READ);
        AjaxResult ajax = AjaxResult.success();
        SysUser user = userService.selectUserById(userId);
        List<SysRole> roles = roleService.selectRolesByUserId(userId);
        ajax.put("user", user);
        ajax.put("roles", managedBoundary.filterRoles(roles, true));
        return ajax;
    }

    /**
     * 用户授权角色
     */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @Log(title = "用户管理", businessType = BusinessType.GRANT)
    @PutMapping("/authRole")
    public AjaxResult insertAuthRole(Long userId, Long[] roleIds)
    {
        managedBoundary.assertUserManageable(userId, Access.GRANT);
        managedBoundary.assertRolesManageable(roleIds, Access.GRANT);
        userService.checkUserDataScope(userId);
        roleService.checkRoleDataScope(roleIds);
        userService.insertUserAuth(userId, roleIds);
        // F4 用户授权角色：目标强制下线
        tokenService.forceLogoutByUserIds(new Long[] { userId });
        return success();
    }

    /**
     * 获取部门树列表
     */
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/deptTree")
    public AjaxResult deptTree(SysDept dept)
    {
        return success(deptService.selectDeptTreeList(dept));
    }
}
