package com.ruoyi.common.core.domain.model;

/**
 * 短信登录「选择账号」候选项
 *
 * <p>一个手机号绑定多个活跃账号时，验码通过后下发本列表供用户选择进入哪个账号。
 * 仅含登录必需的展示字段，不含手机号、角色、权限等敏感信息。
 *
 * @author apms
 */
public class SmsAccountOption
{
    /** 用户 ID（二次确认时回传） */
    private Long userId;

    /** 登录账号 */
    private String userName;

    /** 用户姓名/昵称 */
    private String nickName;

    /** 所属部门名称 */
    private String deptName;

    public SmsAccountOption()
    {
    }

    public SmsAccountOption(Long userId, String userName, String nickName, String deptName)
    {
        this.userId = userId;
        this.userName = userName;
        this.nickName = nickName;
        this.deptName = deptName;
    }

    public Long getUserId()
    {
        return userId;
    }

    public void setUserId(Long userId)
    {
        this.userId = userId;
    }

    public String getUserName()
    {
        return userName;
    }

    public void setUserName(String userName)
    {
        this.userName = userName;
    }

    public String getNickName()
    {
        return nickName;
    }

    public void setNickName(String nickName)
    {
        this.nickName = nickName;
    }

    public String getDeptName()
    {
        return deptName;
    }

    public void setDeptName(String deptName)
    {
        this.deptName = deptName;
    }
}
