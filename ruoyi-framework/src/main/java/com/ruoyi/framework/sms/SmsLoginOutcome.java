package com.ruoyi.framework.sms;

import java.util.List;
import com.ruoyi.common.core.domain.model.SmsAccountOption;

/**
 * 短信登录结果
 *
 * <ul>
 *   <li>单账号：{@link #token} 非空，前端直接落库跳转；</li>
 *   <li>多账号：{@link #selectToken} + {@link #accounts}，前端先展示账号选择，
 *       再调 /login/sms/select 兑换。</li>
 * </ul>
 *
 * @author apms
 */
public class SmsLoginOutcome
{
    /** 单账号场景：登录令牌 */
    private final String token;

    /** 多账号场景：账号选择一次性令牌 */
    private final String selectToken;

    /** 多账号场景：可选账号 */
    private final List<SmsAccountOption> accounts;

    private SmsLoginOutcome(String token, String selectToken, List<SmsAccountOption> accounts)
    {
        this.token = token;
        this.selectToken = selectToken;
        this.accounts = accounts;
    }

    public static SmsLoginOutcome single(String token)
    {
        return new SmsLoginOutcome(token, null, null);
    }

    public static SmsLoginOutcome multi(String selectToken, List<SmsAccountOption> accounts)
    {
        return new SmsLoginOutcome(null, selectToken, accounts);
    }

    public String getToken()
    {
        return token;
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
