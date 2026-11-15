-- ======================================================================
-- patch-1.0-261115161833
-- 组合评分方案（apms_combo_model）版本标识与生命周期管理：
--   1) version_label：方案业务名称（同载体下多套方案可辨识），物理可空、Service 层必填
--   2) status：0=启用 1=停用；停用方案不可再用于组合分计算，历史评分不受影响
--   3) is_default：同 model_id 下唯一默认方案（互斥由 Service 事务保证，此处仅普通索引）
-- 统一数据库原则：standard 与 ai 两条产品线执行完全相同的本补丁，无 Edition 专属 SQL。
-- 幂等：DDL 走 information_schema 守卫；DML 回填带条件，可重复执行不覆盖人工数据。
-- ======================================================================

SET NAMES utf8mb4;
SET @db := DATABASE();

-- 1. 新增列 ----------------------------------------------------------------
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_combo_model' AND COLUMN_NAME = 'version_label') = 0,
  'ALTER TABLE apms_combo_model ADD COLUMN version_label VARCHAR(100) DEFAULT NULL COMMENT ''方案业务名称（如 2026春季权重v2）'' AFTER model_id',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_combo_model' AND COLUMN_NAME = 'status') = 0,
  'ALTER TABLE apms_combo_model ADD COLUMN status CHAR(1) DEFAULT ''0'' COMMENT ''0=启用 1=停用'' AFTER version_label',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_combo_model' AND COLUMN_NAME = 'is_default') = 0,
  'ALTER TABLE apms_combo_model ADD COLUMN is_default CHAR(1) DEFAULT ''0'' COMMENT ''同model_id下唯一默认方案：1=是 0=否'' AFTER status',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. 辅助索引（默认方案查询；唯一互斥由 Service 单事务保证，不建唯一索引） ----
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_combo_model' AND INDEX_NAME = 'idx_model_default') = 0,
  'CREATE INDEX idx_model_default ON apms_combo_model (model_id, is_default)',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3. 存量数据回填（仅补 NULL/缺失，不覆盖后续人工取值） ----------------------
-- 3.1 状态与默认标记先归一，避免 NULL 参与后续判断
UPDATE apms_combo_model SET status = '0' WHERE status IS NULL;
UPDATE apms_combo_model SET is_default = '0' WHERE is_default IS NULL;

-- 3.2 方案名称：取关联测试模型名 + 组合模型 id，保证同载体下可读且不重名
UPDATE apms_combo_model cm
LEFT JOIN apms_test_model tm ON cm.model_id = tm.id
SET cm.version_label = CONCAT(COALESCE(tm.name, '组合体系'), '（#', cm.id, '）')
WHERE cm.version_label IS NULL;

-- 3.3 默认标记：尚无默认方案的 model_id，取其最小 id 行置默认；
--     已存在 is_default='1' 的 model_id 整体跳过，重跑幂等不覆盖人工设置。
--     双重守卫：JOIN ON 限定候选行 + WHERE 显式排除已是默认的行（3.1 归一化后该列仅 0/1）
UPDATE apms_combo_model cm
JOIN (
  SELECT model_id, MIN(id) AS min_id
  FROM apms_combo_model
  WHERE model_id NOT IN (
    SELECT model_id FROM apms_combo_model WHERE is_default = '1'
  )
  GROUP BY model_id
) t ON cm.id = t.min_id
SET cm.is_default = '1'
WHERE cm.is_default = '0';

-- 验收查询（手工执行）：
-- SELECT id, model_id, version_label, status, is_default FROM apms_combo_model ORDER BY model_id, id;
-- SELECT model_id, SUM(is_default = '1') AS default_cnt FROM apms_combo_model GROUP BY model_id HAVING default_cnt <> 1;
