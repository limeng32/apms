package com.ruoyi.system.domain.apms;

import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 账号-登录手机号绑定对象 apms_user_phone
 *
 * <p>一个账号最多绑定 {@link #MAX_PER_USER} 个登录手机号，任一号码均可短信登录；
 * 一个手机号全局唯一，只能绑定一个账号。
 *
 * @author apms
 */
public class ApmsUserPhone extends BaseEntity
{
    private static final long serialVersionUID = 1L;

    /** 每个账号允许绑定的手机号上限 */
    public static final int MAX_PER_USER = 3;

    /** 主键 */
    private Long id;

    /** 用户 ID（sys_user.user_id） */
    private Long userId;

    /** 登录手机号（11 位） */
    private String phonenumber;

    public Long getId()
    {
        return id;
    }

    public void setId(Long id)
    {
        this.id = id;
    }

    public Long getUserId()
    {
        return userId;
    }

    public void setUserId(Long userId)
    {
        this.userId = userId;
    }

    public String getPhonenumber()
    {
        return phonenumber;
    }

    public void setPhonenumber(String phonenumber)
    {
        this.phonenumber = phonenumber;
    }
}
