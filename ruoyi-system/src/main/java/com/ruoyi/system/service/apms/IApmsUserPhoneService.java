package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsUserPhone;

/**
 * 账号-登录手机号绑定 Service
 *
 * <p>一个账号最多 {@link ApmsUserPhone#MAX_PER_USER} 个手机号；
 * 一个手机号全局只能绑定一个账号（uk_phonenumber 兜底）。
 *
 * @author apms
 */
public interface IApmsUserPhoneService
{
    /**
     * 查询某账号的全部绑定号码（按绑定时间升序）
     */
    List<ApmsUserPhone> selectByUserId(Long userId);

    /**
     * 按绑定主键查询
     */
    ApmsUserPhone selectById(Long id);

    /**
     * 按手机号查询全部绑定记录（一个手机号可绑多个账号）
     */
    List<ApmsUserPhone> selectListByPhone(String phonenumber);

    /**
     * 统计某账号已绑定号码数
     */
    int countByUserId(Long userId);

    /**
     * 绑定新手机号（短信验证码已由 SmsCodeService 一次性消费通过后调用）。
     *
     * <p>事务内先对 sys_user 行 FOR UPDATE 串行化同一账号的并发绑定，
     * 再校验上限并插入；手机号全局唯一冲突时转友好异常。
     *
     * @param userId   绑定目标账号
     * @param phone    已验证所有权的手机号
     * @param operator 操作人（create_by；个人中心=本人账号，管理员不能代绑）
     */
    void bindPhone(Long userId, String phone, String operator);

    /**
     * 本人解绑：仅当绑定记录属于 loginUserId 时才删除
     *
     * @return 影响行数（0=记录不存在或不属于本人）
     */
    int unbindOwn(Long loginUserId, Long id);

    /**
     * 按绑定主键删除（管理员强制解绑；越权/超管校验由 Controller 完成）
     */
    int unbindById(Long id);

    /**
     * 按账号删除全部绑定（用户逻辑删除链路同事务调用）
     */
    int deleteByUserId(Long userId);

    /**
     * 批量按账号删除全部绑定（批量删除用户同事务调用）
     */
    int deleteByUserIds(Long[] userIds);
}
