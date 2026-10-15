package com.ruoyi.framework.sms;

import java.util.List;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.core.domain.model.SmsAccountOption;

/**
 * 短信验证码校验结果
 *
 * <ul>
 *   <li>手机号仅绑定 1 个活跃账号：{@link #single} 携带该用户，直接签发 token；</li>
 *   <li>绑定多个活跃账号：{@link #selectToken} + {@link #accounts}，
 *       前端展示账号选择，二次请求凭一次性选择令牌换 token。</li>
 * </ul>
 *
 * @author apms
 */
public class SmsLoginVerifyResult
{
    /** true=单账号直登；false=多账号待选择 */
    private final boolean single;

    /** 单账号场景：目标用户 */
    private final SysUser user;

    /** 多账号场景：一次性选择令牌 */
    private final String selectToken;

    /** 多账号场景：可选账号列表（脱敏展示字段） */
    private final List<SmsAccountOption> accounts;

    private SmsLoginVerifyResult(boolean single, SysUser user, String selectToken,
                                 List<SmsAccountOption> accounts)
    {
        this.single = single;
        this.user = user;
        this.selectToken = selectToken;
        this.accounts = accounts;
    }

    public static SmsLoginVerifyResult ofSingle(SysUser user)
    {
        return new SmsLoginVerifyResult(true, user, null, null);
    }

    public static SmsLoginVerifyResult ofMulti(String selectToken, List<SmsAccountOption> accounts)
    {
        return new SmsLoginVerifyResult(false, null, selectToken, accounts);
    }

    public boolean isSingle()
    {
        return single;
    }

    public SysUser getUser()
    {
        return user;
    }

    public String getSelectToken()
    {
        return selectToken;
    }

    public List<SmsAccountOption> getAccounts()
    {
        return accounts;
    }
}
