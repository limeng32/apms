-- ======================================================================
-- patch-0.0.6-202610051630
-- 修复：RTP「清除状态」写变更日志失败
--   apms_rtp_log.to_status 原约束 NOT NULL，但业务上"清除 = 回到未评估"
--   本就没有目标状态，Service/前端/mock 均以 NULL 表示（前端渲染为「未评估」，
--   同表 from_status 首次评估时也为 NULL）。原 NOT NULL 导致 clearRtpStatus
--   插入日志抛 SQLIntegrityConstraintViolationException，清除动作整体失败。
-- 幂等：仅当列仍为 NOT NULL 时才 MODIFY，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;
SET @db := DATABASE();

-- 1. to_status 改为允许 NULL（与 from_status 对齐；char(1) 语义不变）
SET @sql := (SELECT IF(
  (SELECT IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_rtp_log' AND COLUMN_NAME = 'to_status') = 'NO',
  'ALTER TABLE apms_rtp_log MODIFY COLUMN to_status char(1) DEFAULT NULL COMMENT ''变更后状态（NULL=清除，回到未评估）''',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ======================================================================
-- 验收查询
--   SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_COMMENT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'apms_rtp_log'
--     AND COLUMN_NAME IN ('from_status','to_status');
--   预期两行 IS_NULLABLE 均为 YES
-- ======================================================================
