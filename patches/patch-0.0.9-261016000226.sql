-- ======================================================================
-- patch-0.0.9-261016000226
-- 短信发送白名单：sys.sms.whitelistPhones
--
-- 用途：
--   给特定手机号（内部测试/演示/运维）豁免短信「发送类」频控，便于高频取码：
--     · 60 秒重发间隔（sms:ttl:*）
--     · 单手机号每日 30 条（sms:day:*）
--     · 单 IP 每日 50 条（sms:ipday:*）
--     · 发码接口 IP 窗口限流（rate_limit:*，60 秒 10 次）
--   以下安全机制白名单【不豁免】，仍然生效：
--     · 滑块人机校验（sys.account.sliderCaptchaEnabled 开启时）
--     · 验证码 5 分钟有效期、连续输错 5 次当场作废
--     · login 场景手机号必须已绑定有效账号、bind/adminbind 的业务门禁
--
-- 维护方式：
--   「系统管理 → 参数设置」直接修改本参数，多个号码用逗号分隔
--   （同时兼容中文逗号、分号、空白/换行），保存即清参数缓存热生效，无需重启。
--   默认空值 = 无白名单，所有号码走统一频控。
--
-- 幂等：sys_config 无 config_key 唯一索引，用 NOT EXISTS 守卫，不覆盖后续人工
--       维护的号码列表，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

INSERT INTO sys_config (config_name, config_key, config_value, config_type, create_by, create_time, remark)
SELECT '短信发送白名单(免频控)', 'sys.sms.whitelistPhones', '', 'Y', 'admin', NOW(),
       '逗号分隔的手机号白名单；命中的号码豁免短信发送频控（60s间隔/单号日限/IP日限/接口IP限流），滑块与验证码错误锁定仍生效；留空表示不启用'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sys.sms.whitelistPhones');

-- ======================================================================
-- 验收查询（人工执行）
-- ======================================================================
-- SELECT config_name, config_key, config_value FROM sys_config
--  WHERE config_key = 'sys.sms.whitelistPhones';
--
-- 加白示例（参数设置页改，或手工执行；改完无需重启）：
-- UPDATE sys_config SET config_value = '13800000001,13800000002'
--  WHERE config_key = 'sys.sms.whitelistPhones';
