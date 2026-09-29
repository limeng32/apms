-- patch-0.0.6-202609291827.sql 指标评级：apms_indicator_ref_level.level 扩长 varchar(10) → varchar(32)
-- =====================================================================
-- 背景：指标库界面支持自定义评级（GOOD/NORMAL/ATTENTION/EXCELLENT/POOR 之外
--   可自定义枚举码，如 CRITICAL/SUPERIOR）。原列 varchar(10) 与前端输入上限
--   maxlength=32 不一致，自定义长码保存时触发 Data truncation 报错。
-- 变更：
--   1. level 列扩长为 varchar(32)（幂等守卫：仅当实际长度 < 32 时执行 MODIFY）
--   2. 不触碰任何业务数据；唯一键 uk_ref_level(ref_id, level) 保持不变
-- 幂等：可重复执行；列长度已 ≥32 时跳过 DDL
-- =====================================================================

SET NAMES utf8mb4;

SET @col_len := (
    SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'apms_indicator_ref_level'
      AND COLUMN_NAME = 'level'
);
SET @ddl := IF(COALESCE(@col_len, 0) < 32,
    'ALTER TABLE apms_indicator_ref_level MODIFY COLUMN level varchar(32) NOT NULL COMMENT ''评级枚举码（GOOD/NORMAL/ATTENTION/EXCELLENT/POOR/自定义，大小写不敏感去重）''',
    'SELECT ''apms_indicator_ref_level.level already >= varchar(32), skipped'' AS msg'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
