-- ======================================================================
-- patch-0.0.6-202610042315
-- RTP 风险预警一期：规则引擎 + 每日风险快照 + 待办闭环
--   1) apms_rtp_risk_rule      规则与阈值配置（4 条规则，TEST_DECLINE 留待 1.1）
--   2) apms_rtp_risk_snapshot  每日风险快照（HEALTH/PROCESS 双维度）
--   3) 菜单：2261 改名「RTP 状态管理」；新增 2264「RTP 风险预警」+ 3 个按钮
--   4) sys_job：RTP风险每日扫描（07:00，rtpRiskTask.scanDaily）
--   5) 角色授权：business_admin 全量 / portal_medic 处置 / portal_coach 只读
-- 幂等：DDL 用 information_schema 守卫；DML 用 INSERT IGNORE / NOT EXISTS /
--       UPDATE 旧值守卫，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;
SET @db := DATABASE();

-- 1. 规则配置表 ------------------------------------------------------------
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_rtp_risk_rule') = 0,
  'CREATE TABLE apms_rtp_risk_rule (
      id            bigint       NOT NULL AUTO_INCREMENT COMMENT ''自增'',
      rule_code     varchar(40)  NOT NULL                COMMENT ''规则编码'',
      rule_name     varchar(100) NOT NULL                COMMENT ''规则名称'',
      enabled       char(1)      NOT NULL DEFAULT ''1''  COMMENT ''1=启用 0=停用'',
      kind          varchar(10)  NOT NULL DEFAULT ''HEALTH'' COMMENT ''HEALTH健康因子(计分)/PROCESS流程因子(不计分,仅待办)'',
      severity      tinyint      NOT NULL DEFAULT 0      COMMENT ''健康严重度1低2中3高（仅HEALTH参与评分；PROCESS固定0）'',
      urgency       tinyint      NOT NULL DEFAULT 1      COMMENT ''紧迫度1低2中3高（仅待办排序）'',
      force_warning char(1)      NOT NULL DEFAULT ''0''  COMMENT ''HEALTH因子是否可直接建议红色；PROCESS恒为0'',
      weight        decimal(4,2) NOT NULL DEFAULT 1.00   COMMENT ''权重（仅HEALTH计分使用）'',
      params        json         DEFAULT NULL            COMMENT ''阈值参数（窗口天数/带宽/新鲜天数等）'',
      update_by     varchar(64)  DEFAULT ''''            COMMENT ''更新人'',
      update_time   datetime     DEFAULT NULL            COMMENT ''更新时间'',
      PRIMARY KEY (id),
      UNIQUE KEY uk_code (rule_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''RTP预警规则配置''',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. 每日风险快照表 ---------------------------------------------------------
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_rtp_risk_snapshot') = 0,
  'CREATE TABLE apms_rtp_risk_snapshot (
      id              bigint       NOT NULL AUTO_INCREMENT COMMENT ''自增'',
      athlete_id      bigint       NOT NULL                COMMENT ''运动员ID'',
      dept_id         bigint       DEFAULT NULL            COMMENT ''扫描时主属队伍（筛选/DataScope）'',
      snapshot_date   date         NOT NULL                COMMENT ''快照日期'',
      risk_score      decimal(5,2) NOT NULL DEFAULT 0.00   COMMENT ''健康分=仅HEALTH因子加权和；纯流程待办为0'',
      todo_priority   tinyint      NOT NULL DEFAULT 0      COMMENT ''待办优先级=max(所有因子urgency)，仅排序用'',
      process_only    char(1)      NOT NULL DEFAULT ''0''  COMMENT ''1=纯流程待办（无健康因子，不计RTP建议）'',
      process_flags   json         DEFAULT NULL            COMMENT ''命中的流程因子码，如[\"REVIEW_OVERDUE\"]'',
      suggested_level varchar(16)  NOT NULL                COMMENT ''NONE/INFO/ATTENTION/WARNING'',
      factors         json         NOT NULL                COMMENT ''因子明细JSON'',
      status          varchar(10)  NOT NULL DEFAULT ''ACTIVE'' COMMENT ''ACTIVE/ACKED/ACCEPTED/DISMISSED/EXPIRED'',
      handled_by      varchar(64)  DEFAULT NULL            COMMENT ''处理人'',
      handled_time    datetime     DEFAULT NULL            COMMENT ''处理时间'',
      handle_remark   varchar(500) DEFAULT NULL            COMMENT ''处理备注/忽略理由'',
      accepted_status char(1)      DEFAULT NULL            COMMENT ''采纳写入的RTP状态(y/r)'',
      create_by       varchar(64)  DEFAULT ''''            COMMENT ''创建人'',
      create_time     datetime     DEFAULT NULL            COMMENT ''创建时间'',
      update_time     datetime     DEFAULT NULL            COMMENT ''更新时间'',
      PRIMARY KEY (id),
      UNIQUE KEY uk_athlete_date (athlete_id, snapshot_date),
      KEY idx_date_status (snapshot_date, status),
      KEY idx_dept (dept_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=''RTP风险预警每日快照''',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3. 规则种子（4 条；按 rule_code 幂等。TEST_DECLINE 体测下滑规则 1.1 随引擎策略一起上线）
INSERT INTO apms_rtp_risk_rule
  (rule_code, rule_name, enabled, kind, severity, urgency, force_warning, weight, params, update_by, update_time)
SELECT * FROM (
  SELECT 'REVIEW_OVERDUE' AS rule_code, 'RTP复检已逾期' AS rule_name, '1' AS enabled,
         'PROCESS' AS kind, 0 AS severity, 3 AS urgency, '0' AS force_warning, 1.00 AS weight,
         JSON_OBJECT() AS params, 'admin' AS update_by, NOW() AS update_time
  UNION ALL
  SELECT 'REVIEW_SOON', 'RTP复检临近', '1', 'PROCESS', 0, 2, '0', 1.00,
         JSON_OBJECT('reviewSoonDays', 14), 'admin', NOW()
  UNION ALL
  SELECT 'INJURY_OPEN', '伤病/手术未闭环', '1', 'HEALTH', 2, 2, '0', 1.00,
         JSON_OBJECT('injuryWindowDays', 45, 'closureWindowDays', 90), 'admin', NOW()
  UNION ALL
  SELECT 'PHV_PEAK', '身高突增峰期', '1', 'HEALTH', 1, 1, '0', 1.00,
         JSON_OBJECT('phvPeakBand', 0.5, 'phvFreshDays', 180), 'admin', NOW()
) seed
WHERE NOT EXISTS (SELECT 1 FROM apms_rtp_risk_rule r WHERE r.rule_code = seed.rule_code);

-- 4. 菜单 ------------------------------------------------------------------
-- 4.1 旧 2261 名实对齐：页面本身即「RTP 状态管理」，仅在仍为旧名时改名，不覆盖后续人工调整
UPDATE sys_menu
SET menu_name = 'RTP 状态管理', update_by = 'admin', update_time = NOW()
WHERE menu_id = 2261 AND menu_name = 'RTP 风险预警';

-- 4.2 新菜单 2264「RTP 风险预警」（C）。sys_menu 全列 20 个（含 update_by/update_time）
INSERT IGNORE INTO sys_menu VALUES
(2264, 'RTP 风险预警', 2200, 14, 'rtpWarning', 'apms/rtpWarning/index', '', NULL,
 1, 0, 'C', '0', '0', 'apms:rtpRisk:list', 'bell', 'admin', sysdate(), '', NULL, 'RTP风险预警待办');
-- 列序对照：menu_id,menu_name,parent_id,order_num,path,component,query,route_name,
--          is_frame,is_cache,menu_type,visible,status,perms,icon,create_by,create_time,
--          update_by,update_time,remark

-- 4.3 按钮（F）：查询 / 处置（知悉/忽略/采纳） / 手动扫描
INSERT IGNORE INTO sys_menu VALUES
(22641, '查询', 2264, 1, '', NULL, '', '', 1, 0, 'F', '0', '0', 'apms:rtpRisk:query',  '#', 'admin', sysdate(), '', NULL, '风险明细/规则查询'),
(22642, '处置', 2264, 2, '', NULL, '', '', 1, 0, 'F', '0', '0', 'apms:rtpRisk:handle', '#', 'admin', sysdate(), '', NULL, '知悉/忽略/采纳'),
(22643, '扫描', 2264, 3, '', NULL, '', '', 1, 0, 'F', '0', '0', 'apms:rtpRisk:scan',   '#', 'admin', sysdate(), '', NULL, '手动全量扫描');

-- 5. 定时任务：每日 07:00 全量扫描（不指定 job_id，自增；按 invoke_target 幂等）
INSERT INTO sys_job
  (job_name, job_group, invoke_target, cron_expression, misfire_policy, concurrent, status, create_by, create_time, remark)
SELECT 'RTP风险每日扫描', 'DEFAULT', 'rtpRiskTask.scanDaily', '0 0 7 * * ?', '3', '1', '0', 'admin', sysdate(),
       '每日07:00扫描在训运动员，生成RTP风险快照与预警待办'
WHERE NOT EXISTS (SELECT 1 FROM sys_job j WHERE j.invoke_target = 'rtpRiskTask.scanDaily');

-- 6. 角色授权 ----------------------------------------------------------------
-- 6.1 business_admin：APMS 菜单/按钮通用规则（新菜单 component/perms 命中即授权）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'business_admin'
  AND (m.menu_id = 2264 OR m.perms LIKE 'apms:rtpRisk:%')
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- 6.2 portal_medic 队医：全量（含处置；采纳同时校验 apms:rtp:edit，该角色已拥有）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'portal_medic'
  AND (m.menu_id = 2264 OR m.perms LIKE 'apms:rtpRisk:%')
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- 6.3 portal_coach 教练：只读（菜单 + 查询；不给 handle/scan）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'portal_coach'
  AND (m.menu_id = 2264
       OR m.perms IN ('apms:rtpRisk:list', 'apms:rtpRisk:query'))
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- ======================================================================
-- 验收查询（人工核对）
--   SELECT rule_code, kind, severity, urgency, force_warning FROM apms_rtp_risk_rule;
--   SELECT menu_id, menu_name, perms FROM sys_menu WHERE menu_id IN (2261,2264,22641,22642,22643);
--   SELECT job_name, cron_expression, status FROM sys_job WHERE invoke_target='rtpRiskTask.scanDaily';
-- ======================================================================
