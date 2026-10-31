-- ======================================================================
-- patch-1.0-261031224744
-- AI 产品线（ruoyi-ai）RPA 插件热开关：初始化参数。
--   sys.ai.rpa.enabled = true：RPA 助手插件默认开启；
--   参数管理改为 false 即热关闭（下一次请求立即 404，无需重启）。
-- 统一数据库原则：本补丁在 standard 与 ai 两条产品线**都会执行**；
--   standard 部署无 AI 装配代码，该行只是不被消费的普通参数，无任何副作用。
-- 幂等：键已存在则不插入（保留现场人工取值，可重复执行）。
-- ======================================================================

SET NAMES utf8mb4;

-- sys_config 在本库无 config_key 唯一索引，用 NOT EXISTS 保证可重复执行不产生重复行
INSERT INTO sys_config
    (config_name, config_key, config_value, config_type, create_by, create_time, remark)
SELECT 'AI · RPA 助手开关', 'sys.ai.rpa.enabled', 'true', 'Y', 'admin', sysdate(),
       'ruoyi-ai rpa 插件热开关（true开启/false关闭）；仅 AI 版（app.edition=ai）部署消费，标准版该行不生效'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sys.ai.rpa.enabled');

-- 验收查询（手工执行）：
-- SELECT config_key, config_value FROM sys_config WHERE config_key = 'sys.ai.rpa.enabled';
