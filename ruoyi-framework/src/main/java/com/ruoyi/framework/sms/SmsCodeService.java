package com.ruoyi.framework.sms;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import com.alibaba.fastjson2.JSON;
import com.ruoyi.common.constant.CacheConstants;
import com.ruoyi.common.core.domain.entity.SysUser;
import com.ruoyi.common.core.domain.model.SmsAccountOption;
import com.ruoyi.common.enums.UserStatus;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.StringUtils;
import com.ruoyi.common.utils.uuid.IdUtils;
import com.ruoyi.framework.captcha.SliderCaptchaService;
import com.ruoyi.system.domain.apms.ApmsUserPhone;
import com.ruoyi.system.service.ISysConfigService;
import com.ruoyi.system.service.ISysUserService;
import com.ruoyi.system.service.apms.IApmsUserPhoneService;

/**
 * 短信验证码服务：发码（含人机校验/场景校验/频控）与一次性消费校验。
 *
 * <p>安全要点（详见 .trae/documents/sms_login_plan.md）：
 * <ul>
 *   <li>验证码用 {@link SecureRandom} 生成 6 位数字；</li>
 *   <li>60s 间隔用 SET NX 原子占位；手机号/IP 日计数用 Lua INCR+EXPIRE 原子完成；</li>
 *   <li>写码即清旧错误计数（Lua）；校验「比较→消费」单 Lua 原子完成，杜绝并发重放；</li>
 *   <li>错 5 次码当场作废；阿里云发送失败回滚删除 code/err/ttl，日计数保留。</li>
 * </ul>
 *
 * @author apms
 */
@Service
public class SmsCodeService
{
    /** 场景：登录验证码 */
    public static final String SCENE_LOGIN = "login";
    /** 场景：个人中心绑定新手机号 */
    public static final String SCENE_BIND = "bind";
    /** 场景：管理员给数据范围内专岗用户代绑新手机号（super 需验证码；admin 走免码接口不发码） */
    public static final String SCENE_ADMIN_BIND = "adminbind";

    /** 重发间隔（秒） */
    private static final int RESEND_SECONDS = 60;
    /** 同一手机号每日发送上限（login+bind 合计） */
    private static final int MAX_PER_PHONE_PER_DAY = 30;
    /** 同一 IP 每日发送上限 */
    private static final int MAX_PER_IP_PER_DAY = 50;
    /** 验证码有效期（秒） */
    private static final int CODE_TTL_SECONDS = 300;
    /** 验证码最大连续错误次数（达到即作废） */
    private static final int MAX_VERIFY_ERROR = 5;
    /** 多账号场景：验码通过后的账号选择令牌有效期（秒） */
    private static final int SELECT_TOKEN_TTL_SECONDS = 300;

    /** 大陆手机号格式 */
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /** 密码学安全随机数（线程安全，单例复用） */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** Lua A：写入新码（带 TTL）并清零旧错误计数——发新码即旧账一笔勾销 */
    private static final RedisScript<Long> SAVE_CODE_SCRIPT = new DefaultRedisScript<>(
            "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]); "
          + "redis.call('DEL', KEYS[2]); "
          + "return 1;", Long.class);

    /** Lua C：日计数 INCR，仅首次（返回 1）设置到当日结束的过期时间 */
    private static final RedisScript<Long> INC_DAY_SCRIPT = new DefaultRedisScript<>(
            "local n = redis.call('INCR', KEYS[1]); "
          + "if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; "
          + "return n;", Long.class);

    /**
     * Lua B：比较并一次性消费。
     * 返回：0=成功（已删除 code+err）；-1=无码（过期/未发送/已消费）；
     *       正整数 n=第 n 次错误（n>=最大次数时代码已被当场删除）。
     */
    private static final RedisScript<Long> CONSUME_SCRIPT = new DefaultRedisScript<>(
            "local stored = redis.call('GET', KEYS[1]); "
          + "if stored == false then return -1 end; "
          + "if stored == ARGV[1] then "
          + "  redis.call('DEL', KEYS[1], KEYS[2]); "
          + "  return 0; "
          + "end; "
          + "local n = redis.call('INCR', KEYS[2]); "
          + "redis.call('EXPIRE', KEYS[2], ARGV[3]); "
          + "if n >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) end; "
          + "return n;", Long.class);

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ISysConfigService configService;

    @Autowired
    private SliderCaptchaService sliderCaptchaService;

    @Autowired
    private IApmsUserPhoneService userPhoneService;

    @Autowired
    private ISysUserService userService;

    @Autowired
    private com.ruoyi.framework.web.service.ManagedBoundary managedBoundary;

    @Autowired
    private AliyunSmsSender smsSender;

    /**
     * 发送验证码。
     *
     * @param phone      手机号
     * @param scene      {@link #SCENE_LOGIN} / {@link #SCENE_BIND}
     * @param userId     bind 场景必填（当前登录账号）；login 传 null
     * @param ip         来源 IP（频控）
     * @param sliderUuid 滑块通过标记（滑块开关开启时必填，一次性消费）
     */
    public void sendCode(String phone, String scene, Long userId, String ip, String sliderUuid)
    {
        if (!configService.selectSmsLoginEnabled())
        {
            throw new ServiceException("短信登录未开启");
        }
        if (!SCENE_LOGIN.equals(scene) && !SCENE_BIND.equals(scene))
        {
            throw new ServiceException("非法的短信场景");
        }
        if (StringUtils.isEmpty(phone) || !PHONE_PATTERN.matcher(phone).matches())
        {
            throw new ServiceException("请输入正确的手机号");
        }

        // 人机校验：滑块开关开启时必须消费一次性通过标记；关闭时与密码登录验证码策略一致（放行）
        if (configService.selectSliderCaptchaEnabled()
                && !sliderCaptchaService.consumePass(sliderUuid))
        {
            throw new ServiceException("请先完成滑块安全验证");
        }

        // 场景业务校验（不满足则不产生短信费用）
        if (SCENE_LOGIN.equals(scene))
        {
            List<SysUser> activeUsers = activeUsersByPhone(phone);
            if (activeUsers.isEmpty())
            {
                // 区分「从未绑定」与「绑定了但全部停用/删除」，便于用户理解
                if (userPhoneService.selectListByPhone(phone).isEmpty())
                {
                    throw new ServiceException("该手机号尚未关联系统账号，请使用账号密码登录或联系管理员");
                }
                throw new ServiceException("该手机号关联的账号均已停用或删除，请联系管理员");
            }
        }
        else
        {
            if (userId == null)
            {
                throw new ServiceException("登录状态已失效，请重新登录后再试");
            }
            if (userPhoneService.countByUserId(userId) >= ApmsUserPhone.MAX_PER_USER)
            {
                throw new ServiceException("每个账号最多绑定 " + ApmsUserPhone.MAX_PER_USER
                        + " 个手机号，请先解绑后再添加");
            }
            // 规则：账号内不可重复绑定；同一手机号允许绑定到不同账号（同一自然人多角色账号）
            boolean boundToSelf = userPhoneService.selectListByPhone(phone).stream()
                    .anyMatch(b -> userId.equals(b.getUserId()));
            if (boundToSelf)
            {
                throw new ServiceException("该手机号已绑定在当前账号，无需重复绑定");
            }
        }

        // ===== 频控 + 生成 + 发送（公共段，按场景隔离 key） =====
        dispatchSms(scene, phone, ip);
    }

    /**
     * 频控（60s 间隔/单号日上限/IP 日上限，全部 Redis 原子）→ SecureRandom 生成码
     * → Lua 原子写码清错 → 发送；发送失败回滚 code/err/ttl 允许立即重试。
     */
    private void dispatchSms(String scene, String phone, String ip)
    {
        // ===== 频控（全部 Redis 原子操作，禁止先查后加） =====
        String day = LocalDate.now().format(DAY_FMT);
        String ttlKey = CacheConstants.SMS_TTL_KEY + scene + ":" + phone;
        String dayKey = CacheConstants.SMS_DAY_KEY + phone + ":" + day;
        String ipDayKey = CacheConstants.SMS_IPDAY_KEY + ip + ":" + day;

        // 60 秒重发间隔：SET NX 原子占位
        Boolean firstInWindow = redisTemplate.opsForValue()
                .setIfAbsent(ttlKey, "1", RESEND_SECONDS, TimeUnit.SECONDS);
        if (!Boolean.TRUE.equals(firstInWindow))
        {
            throw new ServiceException("验证码发送过于频繁，请 " + RESEND_SECONDS + " 秒后再试");
        }
        // 单号日上限
        Long phoneCount = incrDayCounter(dayKey);
        if (phoneCount > MAX_PER_PHONE_PER_DAY)
        {
            throw new ServiceException("该手机号今日接收验证码次数已达上限，请明天再试");
        }
        // 单 IP 日上限
        Long ipCount = incrDayCounter(ipDayKey);
        if (ipCount > MAX_PER_IP_PER_DAY)
        {
            throw new ServiceException("当前网络今日验证码请求次数过多，请稍后再试");
        }

        // 生成并写入验证码（SecureRandom + Lua 原子写码/清错误计数）
        String code = String.valueOf(100000 + SECURE_RANDOM.nextInt(900000));
        String codeKey = CacheConstants.SMS_CODE_KEY + scene + ":" + phone;
        String errKey = CacheConstants.SMS_ERR_KEY + scene + ":" + phone;
        redisTemplate.execute(SAVE_CODE_SCRIPT,
                List.of(codeKey, errKey), code, String.valueOf(CODE_TTL_SECONDS));

        try
        {
            smsSender.sendVerificationCode(phone, code);
        }
        catch (RuntimeException e)
        {
            // 用户收不到的码不得残留：删除 code/err/ttl，允许立刻重试；日计数保留（计尝试次数）
            redisTemplate.delete(List.of(codeKey, errKey, ttlKey));
            throw e;
        }
    }

    /**
     * 短信登录：校验并一次性消费验证码。
     *
     * <p>手机号仅绑定 1 个活跃账号 → 直接返回该用户；绑定多个 → 生成一次性选择令牌
     * （Redis 5 分钟）并返回账号候选列表，由 {@link #exchangeSelectToken} 完成最终兑换。
     *
     * @throws ServiceException 码过期/错误/作废、无活跃绑定账号
     */
    public SmsLoginVerifyResult verifyForLogin(String phone, String input)
    {
        if (!configService.selectSmsLoginEnabled())
        {
            throw new ServiceException("短信登录未开启");
        }
        if (StringUtils.isEmpty(phone) || !PHONE_PATTERN.matcher(phone).matches())
        {
            throw new ServiceException("请输入正确的手机号");
        }
        consumeOrThrow(SCENE_LOGIN, phone, input);

        List<SysUser> activeUsers = activeUsersByPhone(phone);
        if (activeUsers.isEmpty())
        {
            throw new ServiceException("该手机号未关联有效系统账号，请联系管理员");
        }
        if (activeUsers.size() == 1)
        {
            return SmsLoginVerifyResult.ofSingle(activeUsers.get(0));
        }

        // 多账号：发一次性选择令牌，内容只存手机号与合法 userId 集合（兑换时再校验账号状态）
        List<Long> userIds = activeUsers.stream().map(SysUser::getUserId).toList();
        List<SmsAccountOption> options = activeUsers.stream()
                .map(u -> new SmsAccountOption(u.getUserId(), u.getUserName(), u.getNickName(),
                        u.getDept() == null ? null : u.getDept().getDeptName()))
                .toList();
        String token = IdUtils.fastSimpleUUID();
        String payload = JSON.toJSONString(new SelectPayload(phone, userIds));
        redisTemplate.opsForValue().set(CacheConstants.SMS_SELECT_KEY + token, payload,
                SELECT_TOKEN_TTL_SECONDS, TimeUnit.SECONDS);
        return SmsLoginVerifyResult.ofMulti(token, options);
    }

    /**
     * 凭一次性选择令牌兑换指定账号的登录用户（GETDEL 原子消费，令牌不可重放）。
     *
     * @throws ServiceException 令牌失效、userId 不在绑定集合、账号已停用/删除
     */
    public SysUser exchangeSelectToken(String selectToken, Long userId)
    {
        if (StringUtils.isEmpty(selectToken) || userId == null)
        {
            throw new ServiceException("账号选择已失效，请重新获取验证码登录");
        }
        // getAndDelete 单命令原子完成，两个并发请求恰好一个能取到
        String raw = redisTemplate.opsForValue()
                .getAndDelete(CacheConstants.SMS_SELECT_KEY + selectToken);
        if (StringUtils.isEmpty(raw))
        {
            throw new ServiceException("账号选择已失效，请重新获取验证码登录");
        }
        SelectPayload payload;
        try
        {
            payload = JSON.parseObject(raw, SelectPayload.class);
        }
        catch (Exception e)
        {
            throw new ServiceException("账号选择数据异常，请重新获取验证码登录");
        }
        if (payload == null || payload.getUserIds() == null || !payload.getUserIds().contains(userId))
        {
            throw new ServiceException("请选择该手机号绑定的账号");
        }
        SysUser user = userService.selectUserById(userId);
        if (user == null || UserStatus.DELETED.getCode().equals(user.getDelFlag()))
        {
            throw new ServiceException("账号已被删除，请联系管理员");
        }
        if (UserStatus.DISABLE.getCode().equals(user.getStatus()))
        {
            throw new ServiceException("账号已停用，请联系管理员");
        }
        // 二次确认：选择与兑换之间绑定关系可能被解绑
        boolean stillBound = userPhoneService.selectListByPhone(payload.getPhone()).stream()
                .anyMatch(b -> userId.equals(b.getUserId()));
        if (!stillBound)
        {
            throw new ServiceException("该手机号与所选账号的绑定关系已变更，请重新登录");
        }
        return user;
    }

    /**
     * 查询手机号当前绑定的全部「活跃」账号（未删除、未停用），按绑定表 user_id 升序
     */
    private List<SysUser> activeUsersByPhone(String phone)
    {
        List<SysUser> active = new ArrayList<>();
        for (ApmsUserPhone bound : userPhoneService.selectListByPhone(phone))
        {
            SysUser u = userService.selectUserById(bound.getUserId());
            if (u != null
                    && !UserStatus.DELETED.getCode().equals(u.getDelFlag())
                    && !UserStatus.DISABLE.getCode().equals(u.getStatus()))
            {
                active.add(u);
            }
        }
        return active;
    }

    /** 选择令牌载荷（Redis JSON） */
    public static class SelectPayload
    {
        private String phone;
        private List<Long> userIds;

        public SelectPayload()
        {
        }

        public SelectPayload(String phone, List<Long> userIds)
        {
            this.phone = phone;
            this.userIds = userIds;
        }

        public String getPhone()
        {
            return phone;
        }

        public void setPhone(String phone)
        {
            this.phone = phone;
        }

        public List<Long> getUserIds()
        {
            return userIds;
        }

        public void setUserIds(List<Long> userIds)
        {
            this.userIds = userIds;
        }
    }

    /**
     * 绑定新手机号：只校验并一次性消费 bind 场景验证码。
     * 账号上限与号码唯一性的最终判定在 IApmsUserPhoneService.bindPhone 行锁事务内完成。
     */
    public void verifyForBind(String phone, String input)
    {
        if (StringUtils.isEmpty(phone) || !PHONE_PATTERN.matcher(phone).matches())
        {
            throw new ServiceException("请输入正确的手机号");
        }
        consumeOrThrow(SCENE_BIND, phone, input);
    }

    /**
     * 管理员（super）给数据范围内专岗用户代绑新手机号——发码。
     *
     * <p>与本人 bind 的区别：绑定目标是 {@code targetUserId} 而非自己；发码前强制过
     * 手机号管理门禁（admin 全放行不会走到这——admin 走免码接口；super 校验数据范围+portal）。
     *
     * @param targetUserId 被绑定用户
     * @param phone        新手机号
     */
    public void sendCodeForAdminBind(Long targetUserId, String phone, String ip, String sliderUuid)
    {
        if (!configService.selectSmsLoginEnabled())
        {
            throw new ServiceException("短信登录未开启");
        }
        if (StringUtils.isEmpty(phone) || !PHONE_PATTERN.matcher(phone).matches())
        {
            throw new ServiceException("请输入正确的手机号");
        }
        // 人机校验
        if (configService.selectSliderCaptchaEnabled()
                && !sliderCaptchaService.consumePass(sliderUuid))
        {
            throw new ServiceException("请先完成滑块安全验证");
        }
        // 门禁：admin 直接放行；super 必须数据范围内 + portal 角色
        managedBoundary.assertPhoneManageable(targetUserId,
                com.ruoyi.framework.web.service.ManagedBoundary.Access.WRITE);
        // 目标账号上限 / 账号内重复
        assertBindable(targetUserId, phone);

        dispatchSms(SCENE_ADMIN_BIND, phone, ip);
    }

    /**
     * 管理员代绑——校验并一次性消费 adminbind 验证码，并再次复核门禁与可绑定性
     * （防止发码后目标用户被改角色/挪部门导致的越权窗口）。通过后由 Controller 落库。
     */
    public void verifyForAdminBind(Long targetUserId, String phone, String input)
    {
        if (StringUtils.isEmpty(phone) || !PHONE_PATTERN.matcher(phone).matches())
        {
            throw new ServiceException("请输入正确的手机号");
        }
        if (targetUserId == null)
        {
            throw new ServiceException("未指定目标用户");
        }
        consumeOrThrow(SCENE_ADMIN_BIND, phone, input);
        managedBoundary.assertPhoneManageable(targetUserId,
                com.ruoyi.framework.web.service.ManagedBoundary.Access.WRITE);
        assertBindable(targetUserId, phone);
    }

    /** 目标账号绑定数上限 + 账号内号码不重复（不限制跨账号一号多绑） */
    private void assertBindable(Long userId, String phone)
    {
        if (userPhoneService.countByUserId(userId) >= ApmsUserPhone.MAX_PER_USER)
        {
            throw new ServiceException("该账号绑定手机号已达上限（" + ApmsUserPhone.MAX_PER_USER + " 个）");
        }
        boolean boundToTarget = userPhoneService.selectListByPhone(phone).stream()
                .anyMatch(b -> userId.equals(b.getUserId()));
        if (boundToTarget)
        {
            throw new ServiceException("该手机号已绑定在此账号，无需重复绑定");
        }
    }

    /**
     * 执行 Lua B 并把返回值映射为业务异常（成功直接返回）
     */
    private void consumeOrThrow(String scene, String phone, String input)
    {
        if (StringUtils.isEmpty(input))
        {
            throw new ServiceException("请输入短信验证码");
        }
        String codeKey = CacheConstants.SMS_CODE_KEY + scene + ":" + phone;
        String errKey = CacheConstants.SMS_ERR_KEY + scene + ":" + phone;
        Long result = redisTemplate.execute(CONSUME_SCRIPT,
                List.of(codeKey, errKey),
                input.trim(), String.valueOf(MAX_VERIFY_ERROR), String.valueOf(CODE_TTL_SECONDS));
        long r = result == null ? -1L : result;
        if (r == 0L)
        {
            return;
        }
        if (r == -1L)
        {
            throw new ServiceException("验证码已过期或已使用，请重新获取");
        }
        if (r >= MAX_VERIFY_ERROR)
        {
            throw new ServiceException("验证码错误次数过多，请重新获取验证码");
        }
        throw new ServiceException("验证码错误，还可尝试 " + (MAX_VERIFY_ERROR - r) + " 次");
    }

    /**
     * 原子日计数（INCR + 首次 EXPIRE 到当日 24:00）
     */
    private Long incrDayCounter(String dayKey)
    {
        long ttl = Duration.between(LocalDateTime.now(),
                LocalDate.now().plusDays(1).atStartOfDay()).getSeconds();
        Long n = redisTemplate.execute(INC_DAY_SCRIPT, List.of(dayKey), String.valueOf(ttl));
        return n == null ? Long.MAX_VALUE : n;
    }
}
