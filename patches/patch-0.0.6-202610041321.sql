-- ======================================================================
-- patch-0.0.6-202610041321
-- 体态测量：周期性测量管理
--   1) apms_measure_cycle：测量周期定义（名称/目标队伍/计划起止/状态）
--   2) apms_body_measure.cycle_id：测量记录归属周期（可空=非周期测量）
-- 幂等：均使用 IF NOT EXISTS，可重复执行。
-- ======================================================================

SET @db := DATABASE();

-- 1. 周期表 ----------------------------------------------------------------
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_measure_cycle') = 0,
  'CREATE TABLE apms_measure_cycle (
      id               bigint       NOT NULL AUTO_INCREMENT COMMENT ''自增'',
      name             varchar(50)  NOT NULL                COMMENT ''周期名称（如 2026 秋季入队体态测量）'',
      target_dept_id   bigint       DEFAULT NULL            COMMENT ''目标队伍ID（NULL=全部在训队员）'',
      plan_start_date  date         DEFAULT NULL            COMMENT ''计划开始日期'',
      plan_end_date    date         DEFAULT NULL            COMMENT ''计划结束日期'',
      status           char(1)      DEFAULT ''0''           COMMENT ''0=进行中 1=已关闭'',
      remark           varchar(255) DEFAULT NULL            COMMENT ''备注'',
      create_by        varchar(64)  DEFAULT ''''            COMMENT ''创建人'',
      create_time      datetime     DEFAULT NULL            COMMENT ''创建时间'',
      update_by        varchar(64)  DEFAULT NULL            COMMENT ''更新人'',
      update_time      datetime     DEFAULT NULL            COMMENT ''更新时间'',
      PRIMARY KEY (id),
      KEY idx_target_dept (target_dept_id),
      KEY idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''体态测量周期''',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. body_measure 加周期列 --------------------------------------------------
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_body_measure' AND COLUMN_NAME = 'cycle_id') = 0,
  'ALTER TABLE apms_body_measure ADD COLUMN cycle_id bigint DEFAULT NULL COMMENT ''测量周期ID（apms_measure_cycle.id，NULL=非周期测量）'' AFTER source_session_key',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_body_measure' AND INDEX_NAME = 'idx_cycle_id') = 0,
  'CREATE INDEX idx_cycle_id ON apms_body_measure (cycle_id)',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
