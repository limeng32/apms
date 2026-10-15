package com.ruoyi.common.core.domain.model;

/**
 * 短信验证码发送对象
 *
 * <p>同一个匿名接口 {@code POST /sms/code} 服务两种场景：
 * <ul>
 *   <li>scene=login：登录页发送，手机号必须已绑定账号；</li>
 *   <li>scene=bind：个人中心绑定新手机号，必须带登录 token，号码未被任何账号绑定。</li>
 * </ul>
 *
 * @author apms
 */
public class SmsSendBody
{
    /** 场景：login=短信登录发码，bind=个人中心绑定新号发码 */
    private String scene;

    /** 手机号（11 位大陆手机号） */
    private String phonenumber;

    /**
     * scene=adminbind 时必填：被代绑手机号的目标用户 ID（由登录的部门管理员操作）。
     * login / bind 场景忽略此字段。
     */
    private Long targetUserId;

    /** 滑块拼图通过标识（开启滑块时必传，一次性消费，服务端安全闸） */
    private String sliderUuid;

    public String getScene()
    {
        return scene;
    }

    public void setScene(String scene)
    {
        this.scene = scene;
    }

    public Long getTargetUserId()
    {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId)
    {
        this.targetUserId = targetUserId;
    }

    public String getPhonenumber()
    {
        return phonenumber;
    }

    public void setPhonenumber(String phonenumber)
    {
        this.phonenumber = phonenumber;
    }

    public String getSliderUuid()
    {
        return sliderUuid;
    }

    public void setSliderUuid(String sliderUuid)
    {
        this.sliderUuid = sliderUuid;
    }
}
