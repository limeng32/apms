-- ======================================================================
-- patch-0.0.6-202610032124
-- 模型结构化成绩采集（可配置）
--   1) apms_test_model_field.collect_mode：字段采集方式
--        INPUT   = 人工/设备采集（默认，录入表单渲染输入框）
--        DERIVED = 系统计算（只读，由模型绑定的派生算法产出，不允许手填）
--   2) apms_test_model.algo_id：模型绑定的派生算法标识（关联后端算法注册表，
--        如 rsa-sdec；为空表示纯采集模型，无派生计算）
-- 幂等：均使用 IF NOT EXISTS / 带条件 UPDATE，可重复执行。
-- ======================================================================

-- 1. 新增列 ----------------------------------------------------------------
SET @db := DATABASE();

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_test_model_field' AND COLUMN_NAME = 'collect_mode') = 0,
  'ALTER TABLE apms_test_model_field ADD COLUMN collect_mode VARCHAR(10) DEFAULT ''INPUT'' COMMENT ''采集方式 INPUT=人工/设备采集 DERIVED=系统计算'' AFTER is_required',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_test_model' AND COLUMN_NAME = 'algo_id') = 0,
  'ALTER TABLE apms_test_model ADD COLUMN algo_id VARCHAR(50) DEFAULT NULL COMMENT ''派生算法标识（算法注册表 key，如 rsa-sdec）'' AFTER algo_version',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. 存量字段归类（按 model.code + field_key 定位，环境通用）----------------
-- RSA 10×20：最佳/平均/Sdec 为派生
UPDATE apms_test_model_field f
JOIN apms_test_model m ON f.model_id = m.id
SET f.collect_mode = 'DERIVED'
WHERE m.code = 'RSA_10X20' AND f.field_key IN ('best_time', 'mean_time', 'sdec');

-- YOYO IR1：估算 VO2max 为派生
UPDATE apms_test_model_field f
JOIN apms_test_model m ON f.model_id = m.id
SET f.collect_mode = 'DERIVED'
WHERE m.code = 'YOYO_IR1' AND f.field_key = 'estimated_vo2max';

-- T-Test：最佳时间为派生
UPDATE apms_test_model_field f
JOIN apms_test_model m ON f.model_id = m.id
SET f.collect_mode = 'DERIVED'
WHERE m.code = 'T_TEST' AND f.field_key = 'best_time';

-- 其余字段默认 INPUT（含历史 NULL 兜底）
UPDATE apms_test_model_field SET collect_mode = 'INPUT' WHERE collect_mode IS NULL OR collect_mode = '';

-- 3. 模型绑定派生算法 ------------------------------------------------------
UPDATE apms_test_model SET algo_id = 'rsa-sdec' WHERE code = 'RSA_10X20' AND (algo_id IS NULL OR algo_id = '');
