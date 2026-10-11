-- ======================================================================
-- patch-0.0.7-261011150000
-- 花名册离队/退役人员管理（A 止血版）：
--   apms_athlete 增加 last_team_id —— 离队/退役时快照「当时所属主队伍」。
--   离队动作会把 primary_team_id 置空，此前离队人员因此既无法按队伍筛选、
--   也在「在训」花名册中找不到入口。新增列后：
--     1) 离队/退役人员可按原队伍筛选、展示「原队伍」；
--     2) 支持花名册「在训/离队/退役/全部」状态视图与重入队。
--   纯加列 + 存量回填，无删除、无类型变更，可安全重复执行。
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 新列：离队/退役时所属主队伍快照（在队期间为 NULL，不影响现有在队查询）
SET @col_exists := (
    SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE table_schema = DATABASE()
       AND table_name = 'apms_athlete'
       AND column_name = 'last_team_id'
);
SET @ddl := IF(@col_exists = 0,
    'ALTER TABLE apms_athlete ADD COLUMN last_team_id BIGINT NULL COMMENT ''离队/退役时所属主队伍快照（离队人员按原队伍筛选/展示）'' AFTER primary_team_id',
    'SELECT ''apms_athlete.last_team_id 已存在，跳过 ADD COLUMN'' AS msg');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 普通索引：离队/退役视图按原队伍过滤（数据量小，普通索引即可）
SET @idx_exists := (
    SELECT COUNT(1) FROM information_schema.STATISTICS
     WHERE table_schema = DATABASE()
       AND table_name = 'apms_athlete'
       AND index_name = 'idx_athlete_last_team'
);
SET @ddl := IF(@idx_exists = 0,
    'CREATE INDEX idx_athlete_last_team ON apms_athlete (last_team_id)',
    'SELECT ''idx_athlete_last_team 已存在，跳过 CREATE INDEX'' AS msg');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 存量回填：对已经离队/退役（status 1/2）且无快照的记录，
--    取其小组归属历史中最近一条（优先已关闭记录）的 dept_id 作为原队伍。
--    无法从小组历史确定的保持 NULL（管理员仍可在「全部队伍」下看到并操作重入队）。
UPDATE apms_athlete a
JOIN (
    SELECT g.athlete_id, g.dept_id
      FROM apms_athlete_group g
      JOIN (
          SELECT athlete_id,
                 MAX(COALESCE(leave_date, join_date)) AS last_at
            FROM apms_athlete_group
           GROUP BY athlete_id
      ) t ON t.athlete_id = g.athlete_id
         AND COALESCE(g.leave_date, g.join_date) = t.last_at
) x ON x.athlete_id = a.athlete_id
   SET a.last_team_id = x.dept_id
 WHERE a.status IN ('1', '2')
   AND a.last_team_id IS NULL;
