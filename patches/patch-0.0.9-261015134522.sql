-- =====================================================================
-- patch-0.0.9-261015134522.sql
-- 功能：手机短信登录
--   1) 新建账号-登录手机号绑定表（一个账号最多 3 个，一个手机号全局唯一）
--   2) 历史 sys_user.phonenumber 迁移为各账号首个绑定号
--   3) 新增系统参数 sys.account.smsLoginEnabled（短信登录总开关，默认关闭）
-- 执行：由部署人手动执行（apms-dev/apms-uat/apms 各一次）；可重复执行，全部幂等
-- =====================================================================

-- ---------------------------------------------------------------------
-- 执行前自查（建议人工跑一遍，确认迁移影响面；不影响补丁执行）：
--
-- A. 同一手机号被多个账号占用（迁移时只归最早创建的账号，其余账号不迁移，
--    之后可由本人在个人中心绑定其它手机号）：
--   SELECT phonenumber, COUNT(*) AS cnt, GROUP_CONCAT(user_id) AS user_ids
--   FROM sys_user
--   WHERE phonenumber REGEXP '^1[3-9][0-9]{9}$' AND del_flag = '0'
--   GROUP BY phonenumber HAVING COUNT(*) > 1;
--
-- B. 不符合手机号格式的历史值（不迁移，保留在 sys_user.phonenumber 联系字段）：
--   SELECT user_id, user_name, phonenumber FROM sys_user
--   WHERE phonenumber <> '' AND phonenumber NOT REGEXP '^1[3-9][0-9]{9}$' AND del_flag = '0';
-- ---------------------------------------------------------------------

-- 1) 绑定表
--    必须显式 COLLATE=utf8mb4_general_ci：MySQL 8 下只写 CHARSET=utf8mb4 会落到默认的
--    utf8mb4_0900_ai_ci，而若依基表 sys_user 是 utf8mb4_general_ci，
--    迁移语句 p.phonenumber = u.phonenumber 跨表比较会报 1267 Illegal mix of collations。
CREATE TABLE IF NOT EXISTS apms_user_phone (
  id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  user_id      BIGINT       NOT NULL                COMMENT '用户ID（sys_user.user_id）',
  phonenumber  VARCHAR(11)  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '登录手机号',
  create_by    VARCHAR(64)  DEFAULT ''              COMMENT '创建者',
  create_time  DATETIME                             COMMENT '创建时间',
  update_by    VARCHAR(64)  DEFAULT ''              COMMENT '更新者',
  update_time  DATETIME                             COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_phonenumber (phonenumber) COMMENT '一个手机号只能绑定一个账号',
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='账号-登录手机号绑定（每账号最多3个）';

-- 1.1) 自愈：本补丁早期版本在建表时未指定 COLLATE，MySQL 8 已建成 utf8mb4_0900_ai_ci。
--      CONVERT TO 幂等——排序规则已正确时为空操作；已错误建成时把表与字符列统一改回
--      utf8mb4_general_ci，保证与 sys_user.phonenumber 比较不再报 1267。
ALTER TABLE apms_user_phone CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- 2) 历史号码迁移：
--    仅迁移格式合法、账号未删除的号码；重复号码归 user_id 最小（最早）的账号。
--    NOT EXISTS 保证幂等：已在绑定表中的号码不重复插入。
INSERT INTO apms_user_phone (user_id, phonenumber, create_by, create_time)
SELECT MIN(u.user_id), u.phonenumber, 'system', NOW()
FROM sys_user u
WHERE u.phonenumber REGEXP '^1[3-9][0-9]{9}$'
  AND u.phonenumber <> ''
  AND u.del_flag = '0'
  AND NOT EXISTS (SELECT 1 FROM apms_user_phone p WHERE p.phonenumber = u.phonenumber)
GROUP BY u.phonenumber;

-- 迁移后核对（人工执行）：
--   每个账号迁移到的号码数（应 ≤1，因历史为单字段）：
--   SELECT user_id, COUNT(*) FROM apms_user_phone GROUP BY user_id HAVING COUNT(*) > 1;
--   未迁移成功的有效号码（理论上仅重复号码中的非最早账号）：
--   SELECT u.user_id, u.user_name, u.phonenumber
--   FROM sys_user u
--   WHERE u.phonenumber REGEXP '^1[3-9][0-9]{9}$' AND u.del_flag = '0'
--     AND NOT EXISTS (SELECT 1 FROM apms_user_phone p WHERE p.user_id = u.user_id);

-- 3) 短信登录开关（默认关闭；AK/SK 在 env.conf 配置完成后再置 true）
INSERT INTO sys_config (config_name, config_key, config_value, config_type, create_by, create_time, remark)
SELECT '账号自助-短信登录开关', 'sys.account.smsLoginEnabled', 'false', 'Y', 'admin', NOW(),
       '是否开启手机号短信登录（true开启，false关闭）；开启前需在 env.conf 配置阿里云短信 AK/SK 并完成重新部署'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_config WHERE config_key = 'sys.account.smsLoginEnabled');
