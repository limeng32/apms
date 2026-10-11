-- ======================================================================
-- patch-0.0.7-261011160000
-- 登录真人滑块拼图验证码：新增参数开关。
--   sys.account.sliderCaptchaEnabled = true 时，登录强制拖拽拼图校验
--   （与 sys.account.captchaEnabled 字符/算术验证码二选一，滑块优先）；
--   默认 true 开启。如需临时关闭，参数管理改为 false 即可（无需发版）。
-- 幂等：键已存在则只更新取值。
-- ======================================================================

SET NAMES utf8mb4;

-- sys_config 在本库无 config_key 唯一索引，用 NOT EXISTS 保证可重复执行不产生重复行
INSERT INTO sys_config
    (config_name, config_key, config_value, config_type, create_by, create_time, remark)
SELECT '账号自助-滑块拼图验证码开关', 'sys.account.sliderCaptchaEnabled', 'true', 'Y', 'admin', sysdate(),
       '是否开启滑块拼图拖拽验证码（true开启，false关闭）；开启后登录需完成真人拖拽校验，优先于字符/算术验证码'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sys.account.sliderCaptchaEnabled');
