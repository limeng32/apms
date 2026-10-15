package com.ruoyi.common.constant;

/**
 * 缓存的key 常量
 * 
 * @author ruoyi
 */
public class CacheConstants
{
    /**
     * 登录用户 redis key
     */
    public static final String LOGIN_TOKEN_KEY = "login_tokens:";

    /**
     * 验证码 redis key
     */
    public static final String CAPTCHA_CODE_KEY = "captcha_codes:";

    /**
     * 滑块拼图验证码挑战（答案） redis key
     */
    public static final String SLIDER_CAPTCHA_KEY = "slider_captcha:";

    /**
     * 滑块拼图验证通过标记（换取登录） redis key
     */
    public static final String SLIDER_PASS_KEY = "slider_pass:";

    /**
     * 参数管理 cache key
     */
    public static final String SYS_CONFIG_KEY = "sys_config:";

    /**
     * 字典管理 cache key
     */
    public static final String SYS_DICT_KEY = "sys_dict:";

    /**
     * 防重提交 redis key
     */
    public static final String REPEAT_SUBMIT_KEY = "repeat_submit:";

    /**
     * 限流 redis key
     */
    public static final String RATE_LIMIT_KEY = "rate_limit:";

    /**
     * 登录账户密码错误次数 redis key
     */
    public static final String PWD_ERR_CNT_KEY = "pwd_err_cnt:";

    /**
     * 短信登录验证码 redis key（完整 key 后缀：scene:phone）
     */
    public static final String SMS_CODE_KEY = "sms:code:";

    /**
     * 短信验证码校验错误次数 redis key（完整 key 后缀：scene:phone）
     */
    public static final String SMS_ERR_KEY = "sms:err:";

    /**
     * 短信重发间隔标记 redis key（60 秒内禁止重复发送；后缀：scene:phone）
     */
    public static final String SMS_TTL_KEY = "sms:ttl:";

    /**
     * 同一手机号当日短信发送计数 redis key（后缀：phone:yyyyMMdd）
     */
    public static final String SMS_DAY_KEY = "sms:day:";

    /**
     * 同一 IP 当日短信发送计数 redis key（后缀：ip:yyyyMMdd）
     */
    public static final String SMS_IPDAY_KEY = "sms:ipday:";

    /**
     * 短信验码通过后的「账号选择」一次性令牌 redis key（一个手机号绑定多个账号时使用）
     */
    public static final String SMS_SELECT_KEY = "sms:select:";
}
