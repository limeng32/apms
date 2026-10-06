-- ======================================================================
-- patch-0.0.6-2610061605
-- super（客户侧超管）专属分组菜单与角色：
--   1) 新建角色 200「超级用户 / super」（data_scope=全部数据，非门户）；
--   2) 用户 super(100) 由 business_admin(100 角色) 调整到 super 角色；
--   3) 参照 demo 信息架构，新建一套独立菜单树（2400+，复用既有页面组件）：
--        数据驾驶舱
--        运动员：花名册 / 青训发育监控(体态测量、PHV成熟度) / 纵向趋势(组合评分)
--        测试：指标库与任务下发(指标库、测试任务、测试结果) /
--              组合测试调度(测试模型库、组合模型库)
--        健康：健康预警中心(RTP状态管理、RTP风险预警) / 医疗康复
--        分析：报告中心
--        系统：角色权限管理（system/role/index，复用 1007-1011 按钮权限点）
--      页面内按钮权限点复用既有 F 型菜单（22xxx / 1007-1011），
--      不新建重复按钮，避免菜单管理页出现重复权限项；
--   4) 除上述内容外 super 无其它任何菜单/权限。
-- 幂等：菜单与角色 INSERT ... ON DUPLICATE KEY UPDATE；角色-菜单关联整组重放。
-- 注意：新菜单仅授权 super 角色；其他角色（admin/business_admin/门户角色）不受影响。
-- ======================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------
-- 1. 角色 200 超级用户
-- ----------------------------------------------------------------------
INSERT INTO sys_role
  (role_id, role_name, role_key, role_sort, data_scope, menu_check_strictly, dept_check_strictly,
   status, del_flag, create_by, create_time, remark, portal_mode, home_path)
VALUES
  (200, '超级用户', 'super', 1, '1', '1', '1', '0', '0', 'admin', NOW(),
   '客户侧超级账号：demo 分组菜单（驾驶舱/运动员/测试/健康/分析/系统）', 0, '')
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  role_key = VALUES(role_key),
  data_scope = VALUES(data_scope),
  status = '0',
  del_flag = '0',
  portal_mode = 0;

-- ----------------------------------------------------------------------
-- 2. 用户 super(100) 切换到 super 角色（移除 business_admin，重复执行结果一致）
-- ----------------------------------------------------------------------
DELETE FROM sys_user_role WHERE user_id = 100 AND role_id = 100;
INSERT IGNORE INTO sys_user_role (user_id, role_id) VALUES (100, 200);

-- ----------------------------------------------------------------------
-- 3. 分组菜单树（M=目录 C=菜单；嵌套目录组件由后端自动置为 ParentView）
--    列顺序：menu_id,menu_name,parent_id,order_num,path,component,query,is_frame,
--           is_cache,menu_type,visible,status,perms,icon,create_by,create_time
-- ----------------------------------------------------------------------
INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
-- 数据驾驶舱（顶级单菜单）
(2400, '数据驾驶舱', 0,    1, 'cockpit',  'apms/dashboard/index',       NULL, 1, 0, 'C', '0', '0', '',                          'dashboard',     'admin', NOW()),
-- 运动员
(2410, '运动员',     0,    2, 'athletes', NULL,                          NULL, 1, 0, 'M', '0', '0', '',                          'peoples',       'admin', NOW()),
(2411, '花名册',     2410, 1, 'roster',          'apms/athlete/index',      NULL, 1, 0, 'C', '0', '0', 'apms:athlete:list',         'user',          'admin', NOW()),
(2412, '青训发育监控', 2410, 2, 'growth',       NULL,                        NULL, 1, 0, 'M', '0', '0', '',                          'chart',         'admin', NOW()),
(2413, '体态测量',   2412, 1, 'body-measure',    'apms/bodyMeasure/index',  NULL, 1, 0, 'C', '0', '0', 'apms:body:list',            'people',        'admin', NOW()),
(2414, 'PHV 成熟度', 2412, 2, 'phv-maturity',   'apms/phv/index',          NULL, 1, 0, 'C', '0', '0', 'apms:phv:list',            'chart',         'admin', NOW()),
(2415, '纵向趋势',   2410, 3, 'score-trend',    'apms/comboScore/index',   NULL, 1, 0, 'C', '0', '0', 'apms:comboScore:list',     'validCode',     'admin', NOW()),
-- 测试
(2420, '测试',       0,    3, 'testings', NULL,                             NULL, 1, 0, 'M', '0', '0', '',                          'education',     'admin', NOW()),
(2421, '指标库与任务下发', 2420, 1, 'dispatch', NULL,                        NULL, 1, 0, 'M', '0', '0', '',                          'list',          'admin', NOW()),
(2422, '指标库',     2421, 1, 'indicator-pool',  'apms/indicator/index',    NULL, 1, 0, 'C', '0', '0', 'apms:indicator:list',      'list',          'admin', NOW()),
(2423, '测试任务',   2421, 2, 'task-dispatch',   'apms/testTask/index',     NULL, 1, 0, 'C', '0', '0', 'apms:testTask:list',       'date',          'admin', NOW()),
(2424, '测试结果',   2421, 3, 'test-records',    'apms/testResult/index',   NULL, 1, 0, 'C', '0', '0', 'apms:testResult:list',     'edit',          'admin', NOW()),
(2425, '组合测试调度', 2420, 2, 'combo-dispatch', NULL,                       NULL, 1, 0, 'M', '0', '0', '',                          'component',     'admin', NOW()),
(2426, '测试模型库', 2425, 1, 'test-models',     'apms/testModel/index',    NULL, 1, 0, 'C', '0', '0', 'apms:testModel:list',      'build',         'admin', NOW()),
(2427, '组合模型库', 2425, 2, 'combo-models',    'apms/comboModel/index',   NULL, 1, 0, 'C', '0', '0', 'apms:comboModel:list',     'component',     'admin', NOW()),
-- 健康
(2430, '健康',       0,    4, 'healthcare', NULL,                            NULL, 1, 0, 'M', '0', '0', '',                          'monitor',       'admin', NOW()),
(2431, '健康预警中心', 2430, 1, 'alert-center',  NULL,                        NULL, 1, 0, 'M', '0', '0', '',                          'bell',          'admin', NOW()),
(2432, 'RTP 状态管理', 2431, 1, 'rtp-status',   'apms/rtp/index',           NULL, 1, 0, 'C', '0', '0', 'apms:rtp:list',           'monitor',       'admin', NOW()),
(2433, 'RTP 风险预警', 2431, 2, 'rtp-alert',    'apms/rtpWarning/index',    NULL, 1, 0, 'C', '0', '0', 'apms:rtpRisk:list',       'bell',          'admin', NOW()),
(2434, '医疗康复',   2430, 2, 'medical-care',   'apms/medical/index',       NULL, 1, 0, 'C', '0', '0', 'apms:medicalRecord:list', 'documentation', 'admin', NOW()),
-- 分析
(2440, '分析',       0,    5, 'analytics', NULL,                             NULL, 1, 0, 'M', '0', '0', '',                          'chart',         'admin', NOW()),
(2441, '报告中心',   2440, 1, 'report-center',  'apms/report/index',        NULL, 1, 0, 'C', '0', '0', 'apms:report:list',        'form',          'admin', NOW()),
-- 系统
(2450, '系统',       0,    6, 'sysmgr', NULL,                                NULL, 1, 0, 'M', '0', '0', '',                          'system',        'admin', NOW()),
(2451, '角色权限管理', 2450, 1, 'role-acl',     'system/role/index',        NULL, 1, 0, 'C', '0', '0', 'system:role:list',        'peoples',       'admin', NOW())
ON DUPLICATE KEY UPDATE
  menu_name = VALUES(menu_name),
  parent_id = VALUES(parent_id),
  order_num = VALUES(order_num),
  path = VALUES(path),
  component = VALUES(component),
  menu_type = VALUES(menu_type),
  perms = VALUES(perms),
  icon = VALUES(icon),
  visible = '0',
  status = '0';

-- ----------------------------------------------------------------------
-- 4. 角色-菜单授权（整组重放，保证幂等）
--    4.1 分组树的全部目录/菜单
-- ----------------------------------------------------------------------
DELETE FROM sys_role_menu WHERE role_id = 200 AND menu_id BETWEEN 2400 AND 2499;
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 200, menu_id FROM sys_menu WHERE menu_id BETWEEN 2400 AND 2499;

--    4.2 页面内按钮权限点（复用既有 F 型菜单；按 perms 授予，与树结构无关）
INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 200, menu_id FROM sys_menu
 WHERE menu_type = 'F'
   AND perms IN (
     'apms:athlete:query','apms:athlete:add','apms:athlete:edit','apms:athlete:remove',
     'apms:indicator:query','apms:indicator:add','apms:indicator:edit','apms:indicator:remove',
     'apms:testModel:query','apms:testModel:add','apms:testModel:edit','apms:testModel:remove',
     'apms:testTask:query','apms:testTask:add','apms:testTask:edit','apms:testTask:remove',
     'apms:testResult:query','apms:testResult:add','apms:testResult:edit','apms:testResult:remove',
     'apms:body:query','apms:body:edit','apms:body:remove',
     'apms:phv:query','apms:phv:edit','apms:phv:remove',
     'apms:rtp:query','apms:rtp:edit','apms:rtp:clear',
     'apms:comboModel:query','apms:comboModel:add','apms:comboModel:edit','apms:comboModel:remove',
     'apms:comboScore:query','apms:comboScore:calculate','apms:comboScore:remove',
     'apms:rtpRisk:query','apms:rtpRisk:handle','apms:rtpRisk:scan',
     'apms:medicalRecord:query','apms:medicalRecord:add','apms:medicalRecord:edit','apms:medicalRecord:remove',
     'apms:medicalFile:download','apms:medicalFile:remove',
     'apms:report:query','apms:report:generate','apms:report:download','apms:report:remove',
     'system:role:query','system:role:add','system:role:edit','system:role:remove','system:role:export'
   );
