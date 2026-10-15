-- ======================================================================
-- patch-0.0.9-261015213412
-- 平台内置管理员（user_id=1）账号密码登录热开关。
--
-- 背景：
--   登录页默认只暴露短信登录入口，账号/密码入口改为连续点击主 Logo 6 次
--   才出现的隐藏后门。为防止后门被调出后 admin 密码入口始终裸露，新增热开关：
--     sys.login.adminPasswordEnabled = true  允许 userId=1 密码登录（默认）
--     sys.login.adminPasswordEnabled = false 即使调出后门，userId=1 也拒绝密码登录，
--                                          仅可短信登录；其他有密码账号不受影响。
--
-- 缺省策略：与「关闭高危入口」类开关一致，未配置/非法值时后端默认放行 true，
--           避免升级即把唯一管理员锁在门外；本补丁显式落一行 true，
--           运维确认短信链路可用后可在「参数设置」改为 false 热生效（无需重启）。
--
-- 幂等：sys_config 在本库无 config_key 唯一索引，用 NOT EXISTS 守卫，
--       不覆盖后续人工修改，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

INSERT INTO sys_config (config_name, config_key, config_value, config_type, create_by, create_time, remark)
SELECT '账号自助-管理员密码登录开关', 'sys.login.adminPasswordEnabled', 'true', 'Y', 'admin', NOW(),
       '是否允许平台内置管理员（user_id=1）通过账号密码登录（true允许，false拒绝）；关闭后登录页后门调出也无法密码登录，其他账号不受影响'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sys.login.adminPasswordEnabled');

-- ======================================================================
-- 验收查询（人工执行）
-- ======================================================================
-- SELECT config_name, config_key, config_value FROM sys_config
--  WHERE config_key = 'sys.login.adminPasswordEnabled';
