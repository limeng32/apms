-- ======================================================================
-- patch-0.0.7-261008223158
-- 修正离队/退役运动员与原队伍的残留归属：
--   业务语义：离队(1)/退役(2)后运动员与原队伍、小组再无当前关系，
--   历史轨迹保留在 apms_athlete_group（leave_date/status=1）中。
--   1) apms_athlete.primary_team_id 原为 NOT NULL，无法表达「无所属队伍」，
--      改为可空（NULL=离队/退役后无归属）；
--   2) 离队/退役运动员 primary_team_id 置空；
--   3) 关闭他们仍处于「在组」状态的小组归属记录（写离开日期=今天）。
--   此后解除动作由后端在状态变更时自动完成，本补丁同时修结构与存量。
-- 幂等：列定义用 information_schema 守卫（MySQL 8 无 ALTER COLUMN IF EXISTS）；
--       UPDATE 带条件，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

-- 1. primary_team_id 改为可空（仅当仍为 NOT NULL 时执行）
SET @col_notnull := (
    SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'apms_athlete'
       AND COLUMN_NAME = 'primary_team_id'
);
SET @ddl := IF(@col_notnull = 'NO',
    'ALTER TABLE apms_athlete MODIFY COLUMN primary_team_id BIGINT NULL COMMENT ''所属主队伍（sys_dept，dept_type=20）；离队/退役后为 NULL''',
    'SELECT ''primary_team_id already nullable, skipped'' AS msg'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 解除离队/退役运动员与主属队伍的关联
UPDATE apms_athlete
   SET primary_team_id = NULL, update_time = NOW()
 WHERE status IN ('1', '2')
   AND primary_team_id IS NOT NULL;

-- 3. 关闭这些运动员仍在组的小组记录（历史行保留，仅写离开日期）
UPDATE apms_athlete_group g
  JOIN apms_athlete a ON a.athlete_id = g.athlete_id
   SET g.leave_date = CURDATE(),
       g.status = '1'
 WHERE a.status IN ('1', '2')
   AND g.leave_date IS NULL
   AND g.status = '0';

-- ======================================================================
-- 验收
-- ======================================================================
-- ① primary_team_id 应为 YES
-- SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='apms_athlete' AND COLUMN_NAME='primary_team_id';
-- ② 以下两个计数应返回 0
-- SELECT COUNT(1) FROM apms_athlete WHERE status IN ('1','2') AND primary_team_id IS NOT NULL;
-- SELECT COUNT(1) FROM apms_athlete_group g
--   JOIN apms_athlete a ON a.athlete_id = g.athlete_id
--  WHERE a.status IN ('1','2') AND g.leave_date IS NULL AND g.status='0';

-- ======================================================================
-- 可选：恢复此前因校验口径错误被误删的 U17（dept_id=211，UAT）。
-- 清理后其下已无在队/在组人员，恢复与否由业务决定；需要则手动执行：
--   UPDATE sys_dept SET del_flag = '0' WHERE dept_id = 211;
-- ======================================================================
