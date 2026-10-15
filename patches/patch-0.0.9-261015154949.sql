-- =====================================================================
-- patch-0.0.9-261015154949.sql
-- 功能：短信登录支持「一个手机号绑定多个账号」（同一自然人持多个角色账号）
--   - 唯一约束由手机号全局唯一 uk_phonenumber
--     改为 (user_id, phonenumber) 账号内唯一 uk_user_phone
--   - 保留：每账号最多 3 个号（应用层行锁事务保证）
--   - 登录时一个号码对应多个活跃账号，验码通过后由用户选择账号进入
-- 执行：由部署人手动执行；可重复执行，全部幂等
-- 前置：patch-0.0.9-261015134522.sql 已执行（apms_user_phone 已建表）
-- 说明：历史上因全局唯一未迁移的同号其他账号不做补迁，由本人登录后在
--       个人中心自助绑定（绑定需该号码收码验证所有权）。
-- =====================================================================

-- 1) 删除手机号全局唯一索引（存在才删；MySQL 8 不支持 DROP INDEX IF EXISTS，走 information_schema 守卫）
SET @drop_sql := (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE apms_user_phone DROP INDEX uk_phonenumber',
    'SELECT ''uk_phonenumber not exists, skipped'' AS msg')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'apms_user_phone'
    AND INDEX_NAME = 'uk_phonenumber'
);
PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) 新增 (user_id, phonenumber) 联合唯一索引（不存在才加）
SET @add_sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE apms_user_phone ADD UNIQUE KEY uk_user_phone (user_id, phonenumber)',
    'SELECT ''uk_user_phone already exists, skipped'' AS msg')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'apms_user_phone'
    AND INDEX_NAME = 'uk_user_phone'
);
PREPARE stmt FROM @add_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
