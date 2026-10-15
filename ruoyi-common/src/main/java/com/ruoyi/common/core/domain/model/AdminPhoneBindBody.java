package com.ruoyi.common.core.domain.model;

/**
 * 管理员给指定用户绑定登录手机号。
 *
 * <p>同一接口服务两类操作者：
 * <ul>
 *   <li>平台管理员 userId=1：免短信验证码，code 传空；</li>
 *   <li>部门管理员（super 等）：必须传该手机号收到的 adminbind 场景验证码。</li>
 * </ul>
 * 是否需要验证码、目标用户是否可管理，由后端按当前登录身份判定，不信任前端。
 *
 * @author apms
 */
public class AdminPhoneBindBody
{
    /** 被绑定用户 ID */
    private Long userId;

    /** 登录手机号 */
    private String phonenumber;

    /** 部门管理员必填的短信验证码；平台管理员免码时为空 */
    private String code;

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

    public String getCode()
    {
        return code;
    }

    public void setCode(String code)
    {
        this.code = code;
    }
}
