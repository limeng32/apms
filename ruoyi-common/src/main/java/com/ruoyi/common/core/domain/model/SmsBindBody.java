package com.ruoyi.common.core.domain.model;

/**
 * 绑定登录手机号对象（个人中心：新手机号收码验证后提交）
 *
 * @author apms
 */
public class SmsBindBody
{
    /** 待绑定的手机号（11 位大陆手机号，发送的是 scene=bind 验证码） */
    private String phonenumber;

    /** 短信验证码（6 位数字，一次性消费） */
    private String code;

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
