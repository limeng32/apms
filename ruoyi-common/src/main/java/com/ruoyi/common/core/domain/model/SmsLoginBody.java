package com.ruoyi.common.core.domain.model;

/**
 * 短信登录对象
 *
 * @author apms
 */
public class SmsLoginBody
{
    /** 手机号（11 位大陆手机号） */
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
