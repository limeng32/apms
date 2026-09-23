-- patch-0.0.4-260923143956.sql 权限体系：Portal字段+F菜单+business_admin/super+三专岗角色授权
-- =====================================================================
-- APMS 权限体系增量 patch（依据 PERMISSION_DESIGN.md v1.3，D1–D11）
-- 适用：MySQL 5.7+ / 8.0；本 patch 可重复执行（幂等）
-- 内容：
--   0. 补建「APMS 总部」部门（dept_id=200，super 归属）
--   1. sys_role 增加 portal_mode / home_path
--   2. 补齐 APMS 2200 系列缺失的 F 型按钮菜单（46 个）
--   3. 创建 business_admin 角色与 super 用户（初始密码 admin123，首登即改）
--   4. 创建 portal_coach / portal_tester / portal_medic 三个专岗角色并授权
-- 预期授权计数：business_admin=115，portal_coach=13，portal_tester=20，portal_medic=14
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 0. 补建「APMS 总部」部门（列名显式声明，兼容有无 dept_type 列的环境）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO sys_dept
  (dept_id, parent_id, ancestors, dept_name, order_num, leader, phone, email,
   status, del_flag, create_by, create_time)
VALUES (200, 100, '0,100', 'APMS 总部', 10, '管理员', '15888888888', 'admin@apms.com',
        '0', '0', 'admin', sysdate());

-- ---------------------------------------------------------------------
-- 1. sys_role 增加 Portal 字段（information_schema 守卫，可重复执行）
-- ---------------------------------------------------------------------
SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE sys_role ADD COLUMN portal_mode char(1) DEFAULT ''0'' COMMENT ''是否Portal专岗角色（0否 1是）''',
  'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'portal_mode');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE sys_role ADD COLUMN home_path varchar(200) DEFAULT '''' COMMENT ''Portal落地页完整路由''',
  'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'home_path');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- 2. 补齐 APMS 按钮型（F）菜单，固定 ID = 父菜单ID*10 + 序号
-- ---------------------------------------------------------------------
INSERT IGNORE INTO sys_menu VALUES
-- 运动员档案 2210
(22101, '详情', 2210, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:athlete:query',  '#', 'admin', sysdate(), '', null, '运动员详情按钮'),
(22102, '新增', 2210, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:athlete:add',    '#', 'admin', sysdate(), '', null, '运动员新增按钮'),
(22103, '修改', 2210, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:athlete:edit',   '#', 'admin', sysdate(), '', null, '运动员修改按钮'),
(22104, '离队', 2210, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:athlete:remove', '#', 'admin', sysdate(), '', null, '运动员离队按钮'),
-- 指标库 2231
(22311, '详情', 2231, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:indicator:query',  '#', 'admin', sysdate(), '', null, '指标详情按钮'),
(22312, '新增', 2231, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:indicator:add',    '#', 'admin', sysdate(), '', null, '指标新增按钮'),
(22313, '修改', 2231, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:indicator:edit',   '#', 'admin', sysdate(), '', null, '指标修改按钮'),
(22314, '删除', 2231, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:indicator:remove', '#', 'admin', sysdate(), '', null, '指标删除按钮'),
-- 测试模型库 2232
(22321, '详情', 2232, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testModel:query',  '#', 'admin', sysdate(), '', null, '测试模型详情按钮'),
(22322, '新增', 2232, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testModel:add',    '#', 'admin', sysdate(), '', null, '测试模型新增按钮'),
(22323, '修改', 2232, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testModel:edit',   '#', 'admin', sysdate(), '', null, '测试模型修改按钮'),
(22324, '删除', 2232, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testModel:remove', '#', 'admin', sysdate(), '', null, '测试模型删除按钮'),
-- 测试任务 2241
(22411, '查询', 2241, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testTask:query',  '#', 'admin', sysdate(), '', null, '测试任务查询按钮'),
(22412, '新增', 2241, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testTask:add',    '#', 'admin', sysdate(), '', null, '测试任务新增按钮'),
(22413, '执行', 2241, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testTask:edit',   '#', 'admin', sysdate(), '', null, '测试任务执行按钮'),
(22414, '删除', 2241, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testTask:remove', '#', 'admin', sysdate(), '', null, '测试任务删除按钮'),
-- 测试结果 2242
(22421, '查询', 2242, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testResult:query',  '#', 'admin', sysdate(), '', null, '测试结果查询按钮'),
(22422, '录入', 2242, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testResult:add',    '#', 'admin', sysdate(), '', null, '测试结果录入按钮'),
(22423, '修改', 2242, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testResult:edit',   '#', 'admin', sysdate(), '', null, '测试结果修改按钮'),
(22424, '删除', 2242, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:testResult:remove', '#', 'admin', sysdate(), '', null, '测试结果删除按钮'),
-- 体态测量 2251（perms 前缀 apms:body）
(22511, '查询', 2251, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:body:query',  '#', 'admin', sysdate(), '', null, '体态测量查询按钮'),
(22512, '编辑', 2251, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:body:edit',   '#', 'admin', sysdate(), '', null, '体态测量编辑按钮'),
(22513, '删除', 2251, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:body:remove', '#', 'admin', sysdate(), '', null, '体态测量删除按钮'),
-- PHV 成熟度 2252
(22521, '查询', 2252, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:phv:query',  '#', 'admin', sysdate(), '', null, 'PHV查询按钮'),
(22522, '编辑', 2252, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:phv:edit',   '#', 'admin', sysdate(), '', null, 'PHV编辑按钮'),
(22523, '删除', 2252, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:phv:remove', '#', 'admin', sysdate(), '', null, 'PHV删除按钮'),
-- RTP 风险预警 2261
(22611, '查询', 2261, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:rtp:query', '#', 'admin', sysdate(), '', null, 'RTP查询按钮'),
(22612, '评估处置', 2261, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:rtp:edit',  '#', 'admin', sysdate(), '', null, 'RTP评估处置按钮'),
(22613, '清除', 2261, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:rtp:clear', '#', 'admin', sysdate(), '', null, 'RTP清除按钮'),
-- 组合模型 2262
(22621, '详情', 2262, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboModel:query',  '#', 'admin', sysdate(), '', null, '组合模型详情按钮'),
(22622, '新增', 2262, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboModel:add',    '#', 'admin', sysdate(), '', null, '组合模型新增按钮'),
(22623, '修改', 2262, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboModel:edit',   '#', 'admin', sysdate(), '', null, '组合模型修改按钮'),
(22624, '删除', 2262, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboModel:remove', '#', 'admin', sysdate(), '', null, '组合模型删除按钮'),
-- 组合体能评分 2263
(22631, '详情', 2263, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboScore:query',    '#', 'admin', sysdate(), '', null, '组合体能评分详情按钮'),
(22632, '计算', 2263, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboScore:calculate', '#', 'admin', sysdate(), '', null, '组合体能评分计算按钮'),
(22633, '删除', 2263, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:comboScore:remove',   '#', 'admin', sysdate(), '', null, '组合体能评分删除按钮'),
-- 医疗记录 2271（含病历附件按钮，perms 前缀不同）
(22711, '详情', 2271, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:medicalRecord:query',  '#', 'admin', sysdate(), '', null, '医疗记录详情按钮'),
(22712, '新增', 2271, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:medicalRecord:add',    '#', 'admin', sysdate(), '', null, '医疗记录新增按钮'),
(22713, '修改', 2271, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:medicalRecord:edit',   '#', 'admin', sysdate(), '', null, '医疗记录修改按钮'),
(22714, '删除', 2271, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:medicalRecord:remove', '#', 'admin', sysdate(), '', null, '医疗记录删除按钮'),
(22715, '附件下载', 2271, 5, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:medicalFile:download', '#', 'admin', sysdate(), '', null, '病历附件下载按钮'),
(22716, '附件删除', 2271, 6, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:medicalFile:remove',   '#', 'admin', sysdate(), '', null, '病历附件删除按钮'),
-- 报告中心 2281
(22811, '查询', 2281, 1, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:report:query',    '#', 'admin', sysdate(), '', null, '报告查询按钮'),
(22812, '生成', 2281, 2, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:report:generate', '#', 'admin', sysdate(), '', null, '报告生成按钮'),
(22813, '下载', 2281, 3, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:report:download', '#', 'admin', sysdate(), '', null, '报告下载按钮'),
(22814, '删除', 2281, 4, '', null, '', '', 1, 0, 'F', '0', '0', 'apms:report:remove',   '#', 'admin', sysdate(), '', null, '报告删除按钮');

-- ---------------------------------------------------------------------
-- 3. 创建 business_admin 角色（super 的角色；非 Portal）
-- ---------------------------------------------------------------------
INSERT INTO sys_role
  (role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly,
   status, del_flag, portal_mode, home_path, create_by, create_time, remark)
SELECT '业务管理员', 'business_admin', 2, '1', 1, 1,
       '0', '0', '0', '', 'admin', sysdate(), '客户侧最高账号（super）'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key = 'business_admin');

-- ---------------------------------------------------------------------
-- 4. 创建 super 用户（初始密码 admin123，BCrypt），归属 APMS 总部
-- ---------------------------------------------------------------------
INSERT INTO sys_user
  (dept_id, user_name, nick_name, user_type, email, phonenumber, sex, avatar,
   password, status, del_flag, create_by, create_time, remark)
SELECT (SELECT dept_id FROM sys_dept WHERE dept_name = 'APMS 总部' LIMIT 1),
       'super', '业务管理员', '00', '', '', '0', '',
       '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2',
       '0', '0', 'admin', sysdate(), '客户侧最高账号'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_user WHERE user_name = 'super');

-- super ↔ business_admin 关联
INSERT INTO sys_user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM sys_user u CROSS JOIN sys_role r
WHERE u.user_name = 'super' AND r.role_key = 'business_admin'
  AND NOT EXISTS (SELECT 1 FROM sys_user_role ur
                  WHERE ur.user_id = u.user_id AND ur.role_id = r.role_id);

-- ---------------------------------------------------------------------
-- 5. 创建三个 Portal 专岗角色（portal_mode='1'，data_scope='1'）
-- ---------------------------------------------------------------------
INSERT INTO sys_role
  (role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly,
   status, del_flag, portal_mode, home_path, create_by, create_time, remark)
SELECT '教练', 'portal_coach', 10, '1', 1, 1,
       '0', '0', '1', '/apms/dashboard', 'admin', sysdate(), '专岗：看板/档案/成绩/PHV/RTP只读 + 报告'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key = 'portal_coach');

INSERT INTO sys_role
  (role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly,
   status, del_flag, portal_mode, home_path, create_by, create_time, remark)
SELECT '测量员', 'portal_tester', 11, '1', 1, 1,
       '0', '0', '1', '/apms/testTask', 'admin', sysdate(), '专岗：测试执行/成绩录入/体态测量/PHV'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key = 'portal_tester');

INSERT INTO sys_role
  (role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly,
   status, del_flag, portal_mode, home_path, create_by, create_time, remark)
SELECT '队医', 'portal_medic', 12, '1', 1, 1,
       '0', '0', '1', '/apms/medical', 'admin', sysdate(), '专岗：医疗记录/RTP处置/报告'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key = 'portal_medic');

-- ---------------------------------------------------------------------
-- 6. 授权：super（business_admin）—— 全部 APMS 菜单
-- ---------------------------------------------------------------------
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'business_admin'
  AND (m.menu_id = 2200 OR m.perms LIKE 'apms:%' OR m.component LIKE 'apms/%')
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- ---------------------------------------------------------------------
-- 7. 授权：super —— 系统能力（不含菜单管理、系统监控、系统工具）
-- ---------------------------------------------------------------------
-- 7.1 目录：系统管理(1)、日志管理(108)
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'business_admin' AND m.menu_id IN (1, 108)
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- 7.2 菜单（C）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'business_admin'
  AND m.perms IN (
    'system:user:list', 'system:role:list', 'system:dept:list', 'system:post:list',
    'system:dict:list', 'system:config:list', 'system:notice:list',
    'system:loginconfig:query',
    'monitor:operlog:list', 'monitor:logininfor:list')
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- 7.3 按钮（F）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'business_admin'
  AND m.perms IN (
    -- 用户
    'system:user:query', 'system:user:add', 'system:user:edit', 'system:user:remove',
    'system:user:export', 'system:user:import', 'system:user:resetPwd',
    -- 角色（无菜单管理相关）
    'system:role:query', 'system:role:add', 'system:role:edit', 'system:role:remove',
    'system:role:export',
    -- 部门
    'system:dept:query', 'system:dept:add', 'system:dept:edit', 'system:dept:remove',
    -- 岗位
    'system:post:query', 'system:post:add', 'system:post:edit', 'system:post:remove',
    'system:post:export',
    -- 字典
    'system:dict:query', 'system:dict:add', 'system:dict:edit', 'system:dict:remove',
    'system:dict:export',
    -- 参数
    'system:config:query', 'system:config:add', 'system:config:edit', 'system:config:remove',
    'system:config:export',
    -- 通知公告
    'system:notice:query', 'system:notice:add', 'system:notice:edit', 'system:notice:remove',
    -- 登录页设计
    'system:loginconfig:edit',
    -- 操作日志
    'monitor:operlog:query', 'monitor:operlog:remove', 'monitor:operlog:export',
    -- 登录日志
    'monitor:logininfor:query', 'monitor:logininfor:remove', 'monitor:logininfor:export',
    'monitor:logininfor:unlock')
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- ---------------------------------------------------------------------
-- 8. 授权：教练 portal_coach
--    看板/档案/成绩/PHV/RTP 只读 + 全部报告 list/query/download
-- ---------------------------------------------------------------------
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'portal_coach'
  AND (m.menu_id = 2200
       OR m.component = 'apms/dashboard/index'
       OR m.perms IN (
         'apms:athlete:list', 'apms:athlete:query',
         'apms:testResult:list', 'apms:testResult:query',
         'apms:phv:list', 'apms:phv:query',
         'apms:rtp:list', 'apms:rtp:query',
         'apms:report:list', 'apms:report:query', 'apms:report:download'))
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- ---------------------------------------------------------------------
-- 9. 授权：测量员 portal_tester
--    测试任务现场执行、成绩录入、体态测量、PHV；指标库/模型库只读
-- ---------------------------------------------------------------------
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'portal_tester'
  AND (m.menu_id = 2200
       OR m.perms IN (
         'apms:athlete:list', 'apms:athlete:query',
         'apms:indicator:list', 'apms:indicator:query',
         'apms:testModel:list', 'apms:testModel:query',
         'apms:testTask:list', 'apms:testTask:query', 'apms:testTask:edit',
         'apms:testResult:list', 'apms:testResult:query',
         'apms:testResult:add', 'apms:testResult:edit',
         'apms:body:list', 'apms:body:query', 'apms:body:edit',
         'apms:phv:list', 'apms:phv:query', 'apms:phv:edit'))
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- ---------------------------------------------------------------------
-- 10. 授权：队医 portal_medic
--     医疗记录维护、RTP 评估处置（含clear）、全部报告；病历附件仅下载
-- ---------------------------------------------------------------------
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
FROM sys_role r CROSS JOIN sys_menu m
WHERE r.role_key = 'portal_medic'
  AND (m.menu_id = 2200
       OR m.perms IN (
         'apms:athlete:list',
         'apms:rtp:list', 'apms:rtp:query', 'apms:rtp:edit', 'apms:rtp:clear',
         'apms:medicalRecord:list', 'apms:medicalRecord:query',
         'apms:medicalRecord:add', 'apms:medicalRecord:edit',
         'apms:medicalFile:download',
         'apms:report:list', 'apms:report:query', 'apms:report:download'))
  AND NOT EXISTS (SELECT 1 FROM sys_role_menu rm
                  WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id);

-- =====================================================================
-- 验收查询（patch 应用后人工核对，预期 115/13/20/14）
-- =====================================================================
-- SELECT r.role_key, r.portal_mode, r.home_path, COUNT(rm.menu_id) AS menu_cnt
-- FROM sys_role r LEFT JOIN sys_role_menu rm ON rm.role_id = r.role_id
-- WHERE r.role_key IN ('business_admin','portal_coach','portal_tester','portal_medic')
-- GROUP BY r.role_key, r.portal_mode, r.home_path;
