-- patch-0.0.4-2609261555.sql 修复：sys_dept 补建 dept_type 列（UAT/新环境缺失）
-- =====================================================================
-- 背景：SysDept 实体/SysDeptMapper.xml 已使用 sys_dept.dept_type（APMS 组织层级：
--   10=机构 20=队伍 30=训练小组 40=科研小组 50=恢复小组），但建列 DDL 仅以注释形式
--   存在于 .trae/sql/apms_schema.sql，从未进入可执行补丁链。dev 库手工建过该列，
--   UAT 部署新 jar 后访问「体态测量」等加载部门树的页面报：
--   Unknown column 'd.dept_type' in 'field list'。
-- 变更：
--   1. 幂等补列（information_schema 守卫，MySQL 8 无 ADD COLUMN IF NOT EXISTS）
--   2. 回填 apms_seed.sql 固定 ID 的历史部门类型（仅当 dept_type IS NULL）
-- 幂等：可重复执行；列已存在时跳过 ALTER
-- =====================================================================

SET NAMES utf8mb4;

-- 1. 补建 dept_type 列
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_dept'
      AND COLUMN_NAME = 'dept_type'
);
SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE sys_dept ADD COLUMN dept_type varchar(2) DEFAULT NULL COMMENT ''APMS部门类型：10=机构 20=队伍 30=训练小组 40=科研小组 50=恢复小组''',
    'SELECT ''dept_type already exists, skipped'' AS msg'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 回填种子部门类型（ID 固定来源 apms_seed.sql；存在才更新，不覆盖人工值）
UPDATE sys_dept SET dept_type = '10' WHERE dept_id = 200 AND dept_type IS NULL;
UPDATE sys_dept SET dept_type = '20' WHERE dept_id IN (201, 202) AND dept_type IS NULL;
UPDATE sys_dept SET dept_type = '30' WHERE dept_id IN (203, 205) AND dept_type IS NULL;
UPDATE sys_dept SET dept_type = '50' WHERE dept_id = 204 AND dept_type IS NULL;
