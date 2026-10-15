package com.ruoyi.framework.web.service;

import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import com.ruoyi.common.constant.CacheConstants;
import com.ruoyi.common.constant.Constants;
import com.ruoyi.common.constant.UserConstants;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.core.domain.model.LoginUser;
import com.ruoyi.common.core.redis.RedisCache;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.exception.user.BlackListException;
import com.ruoyi.common.exception.user.CaptchaException;
import com.ruoyi.common.exception.user.CaptchaExpireException;
import com.ruoyi.common.exception.user.UserNotExistsException;
import com.ruoyi.common.exception.user.UserPasswordNotMatchException;
import com.ruoyi.common.utils.DateUtils;
import com.ruoyi.common.utils.MessageUtils;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.common.utils.ip.IpUtils;
import com.ruoyi.framework.manager.AsyncManager;
import com.ruoyi.framework.manager.factory.AsyncFactory;
import com.ruoyi.framework.security.context.AuthenticationContextHolder;
import com.ruoyi.framework.sms.SmsCodeService;
import com.ruoyi.framework.sms.SmsLoginOutcome;
import com.ruoyi.framework.sms.SmsLoginVerifyResult;
import com.ruoyi.system.service.ISysConfigService;
import com.ruoyi.system.service.ISysUserService;

/**
 * 登录校验方法
 * 
 * @author ruoyi
 */
@Component
public class SysLoginService
{
    @Autowired
    private TokenService tokenService;

    @Resource
    private AuthenticationManager authenticationManager;

    @Autowired
    private RedisCache redisCache;
    
    @Autowired
    private ISysUserService userService;

    @Autowired
    private ISysConfigService configService;

    @Autowired
    private com.ruoyi.framework.captcha.SliderCaptchaService sliderCaptchaService;

    @Autowired
    private SmsCodeService smsCodeService;

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    /**
     * 登录验证
     *
     * @param username   用户名
     * @param password   密码
     * @param code       验证码
     * @param uuid       唯一标识
     * @param sliderUuid 滑块拼图验证通过标识
     * @return 结果
     */
    public String login(String username, String password, String code, String uuid, String sliderUuid)
    {
        // 验证码校验（滑块拼图 与 字符/算术验证码 二选一）
        validateCaptcha(username, code, uuid, sliderUuid);
        // 登录前置校验
        loginPreCheck(username, password);
        // 用户验证
        Authentication authentication = null;
        try
        {
            UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(username, password);
            AuthenticationContextHolder.setContext(authenticationToken);
            // 该方法会去调用UserDetailsServiceImpl.loadUserByUsername
            authentication = authenticationManager.authenticate(authenticationToken);
        }
        catch (Exception e)
        {
            if (e instanceof BadCredentialsException)
            {
                AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, MessageUtils.message("user.password.not.match")));
                throw new UserPasswordNotMatchException();
            }
            else
            {
                AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, e.getMessage()));
                throw new ServiceException(e.getMessage());
            }
        }
        finally
        {
            AuthenticationContextHolder.clearContext();
        }
        AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_SUCCESS, MessageUtils.message("user.login.success")));
        LoginUser loginUser = (LoginUser) authentication.getPrincipal();
        // 平台内置管理员(userId=1)密码登录开关：认证通过后、签 token 前判定。
        // 只认 userId 而非 userName——用户名即使被改或出现同名普通账号也不会误判。
        if (Long.valueOf(1L).equals(loginUser.getUserId())
                && !configService.selectAdminPasswordLoginEnabled())
        {
            AsyncManager.me().execute(
                    AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, "管理员密码登录已关闭"));
            throw new ServiceException("管理员密码登录已关闭，请使用短信登录或联系系统管理员");
        }
        recordLoginInfo(loginUser.getUserId());
        // 生成token
        return tokenService.createToken(loginUser);
    }

    /**
     * 短信验证码登录（不经过密码与 AuthenticationManager）
     *
     * <p>安全闸与密码登录保持一致：先过 IP 黑名单，再由 {@link SmsCodeService}
     * 原子消费验证码。手机号仅绑定 1 个活跃账号时直接颁发 token；绑定多个时返回
     * 账号候选与一次性选择令牌，由 {@link #loginBySmsSelect} 完成兑换。
     *
     * @return 单账号场景携带 token；多账号场景携带 selectToken + accounts
     */
    public SmsLoginOutcome loginBySms(String phonenumber, String code)
    {
        // 与密码登录同一道 IP 黑名单，禁止短信通道绕过封禁
        checkLoginIp(phonenumber);

        SmsLoginVerifyResult verify;
        try
        {
            verify = smsCodeService.verifyForLogin(phonenumber, code);
        }
        catch (ServiceException e)
        {
            AsyncManager.me().execute(
                    AsyncFactory.recordLogininfor(phonenumber, Constants.LOGIN_FAIL, e.getMessage()));
            throw e;
        }

        if (verify.isSingle())
        {
            SysUser user = verify.getUser();
            AsyncManager.me().execute(
                    AsyncFactory.recordLogininfor(user.getUserName(), Constants.LOGIN_SUCCESS,
                            MessageUtils.message("user.login.success")));
            LoginUser loginUser = (LoginUser) userDetailsService.createLoginUser(user);
            recordLoginInfo(loginUser.getUserId());
            return SmsLoginOutcome.single(tokenService.createToken(loginUser));
        }
        // 多账号：选择哪个账号登录由用户二次确认，此刻不记登录成功、不颁发 token
        return SmsLoginOutcome.multi(verify.getSelectToken(), verify.getAccounts());
    }

    /**
     * 多账号短信登录的账号选择兑换：选择令牌一次性消费后为所选账号颁发 token。
     */
    public String loginBySmsSelect(String selectToken, Long userId)
    {
        checkLoginIp("sms-select:" + userId);
        SysUser user;
        try
        {
            user = smsCodeService.exchangeSelectToken(selectToken, userId);
        }
        catch (ServiceException e)
        {
            AsyncManager.me().execute(
                    AsyncFactory.recordLogininfor(String.valueOf(userId), Constants.LOGIN_FAIL, e.getMessage()));
            throw e;
        }
        AsyncManager.me().execute(
                AsyncFactory.recordLogininfor(user.getUserName(), Constants.LOGIN_SUCCESS,
                        MessageUtils.message("user.login.success")));
        LoginUser loginUser = (LoginUser) userDetailsService.createLoginUser(user);
        recordLoginInfo(loginUser.getUserId());
        return tokenService.createToken(loginUser);
    }

    /**
     *
     * @param username   用户名
     * @param code       字符验证码
     * @param uuid       字符验证码唯一标识（滑块关闭时使用）
     * @param sliderUuid 滑块拼图通过标识（滑块开启时使用）
     */
    public void validateCaptcha(String username, String code, String uuid, String sliderUuid)
    {
        // 滑块拼图开启：以一次性通过标记为准，不再校验字符验证码
        if (configService.selectSliderCaptchaEnabled())
        {
            if (!sliderCaptchaService.consumePass(sliderUuid))
            {
                AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, "滑块验证未通过或已失效"));
                throw new CaptchaException();
            }
            return;
        }

        boolean captchaEnabled = configService.selectCaptchaEnabled();
        if (captchaEnabled)
        {
            String verifyKey = CacheConstants.CAPTCHA_CODE_KEY + StringUtils.nvl(uuid, "");
            String captcha = redisCache.getCacheObject(verifyKey);
            if (captcha == null)
            {
                AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, MessageUtils.message("user.jcaptcha.expire")));
                throw new CaptchaExpireException();
            }
            redisCache.deleteObject(verifyKey);
            if (!code.equalsIgnoreCase(captcha))
            {
                AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, MessageUtils.message("user.jcaptcha.error")));
                throw new CaptchaException();
            }
        }
    }

    /**
     * 登录前置校验
     * @param username 用户名
     * @param password 用户密码
     */
    public void loginPreCheck(String username, String password)
    {
        // 用户名或密码为空 错误
        if (StringUtils.isEmpty(username) || StringUtils.isEmpty(password))
        {
            AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, MessageUtils.message("not.null")));
            throw new UserNotExistsException();
        }
        // 密码如果不在指定范围内 错误
        if (password.length() < UserConstants.PASSWORD_MIN_LENGTH
                || password.length() > UserConstants.PASSWORD_MAX_LENGTH)
        {
            AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, MessageUtils.message("user.password.not.match")));
            throw new UserPasswordNotMatchException();
        }
        // 用户名不在指定范围内 错误
        if (username.length() < UserConstants.USERNAME_MIN_LENGTH
                || username.length() > UserConstants.USERNAME_MAX_LENGTH)
        {
            AsyncManager.me().execute(AsyncFactory.recordLogininfor(username, Constants.LOGIN_FAIL, MessageUtils.message("user.password.not.match")));
            throw new UserPasswordNotMatchException();
        }
        // IP黑名单校验（密码登录与短信登录共用同一道闸，见 checkLoginIp）
        checkLoginIp(username);
    }

    /**
     * 登录 IP 黑名单校验（sys.login.blackIPList）。
     * 从 {@link #loginPreCheck} 抽出，供密码登录与短信登录共用，避免短信通道绕过封禁。
     *
     * @param loginPrincipal 登录主体（用户名或手机号），仅用于登录日志
     */
    public void checkLoginIp(String loginPrincipal)
    {
        String blackStr = configService.selectConfigByKey("sys.login.blackIPList");
        if (IpUtils.isMatchedIp(blackStr, IpUtils.getIpAddr()))
        {
            AsyncManager.me().execute(AsyncFactory.recordLogininfor(loginPrincipal, Constants.LOGIN_FAIL, MessageUtils.message("login.blocked")));
            throw new BlackListException();
        }
    }

    /**
     * 记录登录信息
     *
     * @param userId 用户ID
     */
    public void recordLoginInfo(Long userId)
    {
        userService.updateLoginInfo(userId, IpUtils.getIpAddr(), DateUtils.getNowDate());
    }
}
