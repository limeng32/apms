package com.ruoyi.common.core.domain.model;

/**
 * 短信登录账号选择对象（一个手机号绑定多个账号时二次确认）
 *
 * @author apms
 */
public class SmsSelectBody
{
    /** 验码通过后服务端下发的一次性选择令牌（sms:select:，5 分钟有效） */
    private String selectToken;

    /** 用户选择进入的账号 ID（必须在该手机号绑定的账号集合内） */
    private Long userId;

    public String getSelectToken()
    {
        return selectToken;
    }

    public void setSelectToken(String selectToken)
    {
        this.selectToken = selectToken;
    }

    public Long getUserId()
    {
        return userId;
    }

    public void setUserId(Long userId)
    {
        this.userId = userId;
    }
}
