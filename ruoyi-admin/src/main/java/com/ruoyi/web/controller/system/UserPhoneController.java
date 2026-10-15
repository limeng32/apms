package com.ruoyi.web.controller.system;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.core.domain.model.SmsBindBody;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.common.utils.SecurityUtils;
import com.ruoyi.framework.web.service.ManagedBoundary;
import com.ruoyi.framework.web.service.ManagedBoundary.Access;
import com.ruoyi.framework.sms.SmsCodeService;
import com.ruoyi.system.domain.apms.ApmsUserPhone;
import com.ruoyi.system.service.ISysUserService;
import com.ruoyi.system.service.apms.IApmsUserPhoneService;

/**
 * 登录手机号绑定
 *
 * <p>两类入口，路径分离：
 * <ul>
 *   <li>个人中心 {@code /system/user/profile/phone/**}：本人查询/绑定/解绑，
 *       userId 一律取自登录态，禁止信任前端传入；</li>
 *   <li>管理员 {@code /system/user/phone/**}：复用 system:user:list/edit 权限，
 *       且必须通过 ManagedBoundary + 数据范围 + 超管保护三闸（P0 防越权）。</li>
 * </ul>
 *
 * @author apms
 */
@RestController
public class UserPhoneController extends BaseController
{
    @Autowired
    private IApmsUserPhoneService userPhoneService;

    @Autowired
    private SmsCodeService smsCodeService;

    @Autowired
    private ISysUserService userService;

    @Autowired
    private ManagedBoundary managedBoundary;

    // ==================== 个人中心（本人） ====================

    /**
     * 我的登录手机号列表
     */
    @GetMapping("/system/user/profile/phone/list")
    public AjaxResult myList()
    {
        Long userId = SecurityUtils.getUserId();
        List<ApmsUserPhone> list = userPhoneService.selectByUserId(userId);
        AjaxResult ajax = AjaxResult.success(list);
        ajax.put("maxCount", ApmsUserPhone.MAX_PER_USER);
        return ajax;
    }

    /**
     * 绑定新手机号：验证码已通过 /sms/code(scene=bind) 发送到新号本人手机，
     * 此处一次性消费后在行锁事务内落库。
     */
    @Log(title = "登录手机号", businessType = BusinessType.INSERT)
    @PostMapping("/system/user/profile/phone/bind")
    public AjaxResult bind(@RequestBody SmsBindBody body)
    {
        Long userId = SecurityUtils.getUserId();
        // 1) 一次性消费 bind 场景验证码（失败即抛）
        smsCodeService.verifyForBind(body.getPhonenumber(), body.getCode());
        // 2) 行锁事务内做最终上限/唯一判定并落库
        userPhoneService.bindPhone(userId, body.getPhonenumber(), SecurityUtils.getUsername());
        AjaxResult ajax = AjaxResult.success("绑定成功", userPhoneService.selectByUserId(userId));
        ajax.put("maxCount", ApmsUserPhone.MAX_PER_USER);
        return ajax;
    }

    /**
     * 本人解绑（Service 强制归属校验）
     */
    @Log(title = "登录手机号", businessType = BusinessType.DELETE)
    @DeleteMapping("/system/user/profile/phone/unbind/{id}")
    public AjaxResult unbindMine(@PathVariable("id") Long id)
    {
        return toAjax(userPhoneService.unbindOwn(SecurityUtils.getUserId(), id));
    }

    // ==================== 管理员（强制管理，不可代绑） ====================

    /**
     * 查看指定账号的绑定号码：除 list 权限外必须通过管理边界 + 数据范围校验
     */
    @PreAuthorize("@ss.hasPermi('system:user:list')")
    @GetMapping("/system/user/phone/list/{userId}")
    public AjaxResult adminList(@PathVariable("userId") Long userId)
    {
        managedBoundary.assertUserManageable(userId, Access.READ);
        userService.checkUserDataScope(userId);
        List<ApmsUserPhone> list = userPhoneService.selectByUserId(userId);
        AjaxResult ajax = AjaxResult.success(list);
        ajax.put("maxCount", ApmsUserPhone.MAX_PER_USER);
        return ajax;
    }

    /**
     * 强制解绑：先按绑定 id 反查所属 userId（绝不信任前端传参），再依次过
     * WRITE 管理边界 → 超管保护 → 数据范围，三闸全过才删除。
     */
    @Log(title = "登录手机号", businessType = BusinessType.DELETE)
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @DeleteMapping("/system/user/phone/unbind/{id}")
    public AjaxResult adminUnbind(@PathVariable("id") Long id)
    {
        ApmsUserPhone record = userPhoneService.selectById(id);
        if (record == null)
        {
            return error("绑定记录不存在");
        }
        Long userId = record.getUserId();
        managedBoundary.assertUserManageable(userId, Access.WRITE);
        userService.checkUserAllowed(new SysUser(userId));
        userService.checkUserDataScope(userId);
        return toAjax(userPhoneService.unbindById(id));
    }
}
