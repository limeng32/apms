-- ======================================================================
-- patch-0.0.7-261010111515
-- 随业务数据增长的预防性索引扩容（详见 .trae/documents/index_growth_plan.md）
-- 本次仅 CREATE 4 个二级索引，不 DROP 旧索引：
--   1) apms_test_result(task_id, athlete_id, task_item_id, attempt_no)
--      消除 dashboard 按任务聚合 / 成绩台账四列排序的 filesort（成绩为高增长表）
--   2) apms_phv_record(athlete_id, measure_date)
--      消除取最新 PHV / 按人列表按日期排序的 filesort
--   3) apms_medical_record(athlete_id, record_date)
--      消除按队员查病历按日期排序的 filesort
--   4) apms_medical_record(record_date)
--      消除无过滤台账默认列表的全表+filesort；
--      注意带 @DataScope 的普通用户 SQL 优化器可能选别的访问路径，属正常现象
-- 旧单列索引（test_result.task_id、phv.athlete_id、medical.athlete_id）
-- 被新复合索引最左前缀覆盖，但本补丁不删除——观察一个版本确认不被选中后再单独清理。
-- 幂等：MySQL 8 不支持 CREATE INDEX IF NOT EXISTS，统一用 information_schema 守卫。
-- ======================================================================

SET NAMES utf8mb4;

-- 通用：索引不存在时执行 DDL（@table / @index / @ddl 每次循环前重置）
-- 1. apms_test_result
SET @tbl := 'apms_test_result';
SET @idx := 'idx_task_athlete_item_attempt';
SET @ddl := CONCAT('CREATE INDEX ', @idx, ' ON ', @tbl,
    ' (task_id, athlete_id, task_item_id, attempt_no)');
SET @exist := (
    SELECT COUNT(1) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = @tbl AND index_name = @idx
);
SET @sql := IF(@exist = 0, @ddl, 'SELECT ''idx_task_athlete_item_attempt already exists, skipped'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. apms_phv_record
SET @tbl := 'apms_phv_record';
SET @idx := 'idx_athlete_measuredate';
SET @ddl := CONCAT('CREATE INDEX ', @idx, ' ON ', @tbl,
    ' (athlete_id, measure_date)');
SET @exist := (
    SELECT COUNT(1) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = @tbl AND index_name = @idx
);
SET @sql := IF(@exist = 0, @ddl, 'SELECT ''idx_athlete_measuredate already exists, skipped'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. apms_medical_record (athlete_id, record_date)
SET @tbl := 'apms_medical_record';
SET @idx := 'idx_athlete_recorddate';
SET @ddl := CONCAT('CREATE INDEX ', @idx, ' ON ', @tbl,
    ' (athlete_id, record_date)');
SET @exist := (
    SELECT COUNT(1) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = @tbl AND index_name = @idx
);
SET @sql := IF(@exist = 0, @ddl, 'SELECT ''idx_athlete_recorddate already exists, skipped'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. apms_medical_record (record_date)
SET @tbl := 'apms_medical_record';
SET @idx := 'idx_record_date';
SET @ddl := CONCAT('CREATE INDEX ', @idx, ' ON ', @tbl, ' (record_date)');
SET @exist := (
    SELECT COUNT(1) FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = @tbl AND index_name = @idx
);
SET @sql := IF(@exist = 0, @ddl, 'SELECT ''idx_record_date already exists, skipped'' AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ======================================================================
-- 验收（应用后手动执行，不改数据）
-- ----------------------------------------------------------------------
-- A. 索引存在性（应返回 4 行）：
-- SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) cols
--   FROM information_schema.statistics
--  WHERE table_schema=DATABASE()
--    AND index_name IN ('idx_task_athlete_item_attempt','idx_athlete_measuredate',
--                       'idx_athlete_recorddate','idx_record_date')
--  GROUP BY table_name, index_name;
--
-- B. 三条排序查询应命中新索引且无 Using filesort：
-- EXPLAIN SELECT id FROM apms_phv_record
--  WHERE athlete_id=1 ORDER BY measure_date DESC, id DESC LIMIT 1;
-- EXPLAIN SELECT id FROM apms_medical_record
--  WHERE athlete_id=1 ORDER BY record_date DESC, id DESC;
-- EXPLAIN SELECT r.id FROM apms_test_result r
--  WHERE r.task_id=1
--  ORDER BY r.task_id, r.athlete_id, r.task_item_id, r.attempt_no;
--
-- C. record_date 单列索引：admin 与带 @DataScope 普通用户两种 SQL 各测一次；
--    带 DataScope 场景若仍 filesort 属"队伍过滤 vs 全局时间序"路径冲突，记录即可。
--
-- D. 功能回归：成绩台账分页、数据驾驶舱、PHV 台账、医疗康复台账。
-- ======================================================================
