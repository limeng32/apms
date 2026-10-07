-- ======================================================================
-- patch-0.0.7-261007145310
-- 门户专岗（教练/测量员/队医）恢复侧边栏导航（2400 两层分组树，不含「系统」），
-- 所有业务页只读可见，写（增/删/改/处置/生成）权限按一级分组隔离：
--   portal_coach  ：运动员（花名册/青训发育/纵向趋势）+ 分析（报告中心）
--   portal_tester ：测试（指标库与任务下发/组合测试调度）
--   portal_medic  ：健康（健康预警中心/医疗康复）
-- 做法：
--   1) 清空三角色既有 apms:* F 型授权（旧初始化脚本的零散授权全部失效，
--      保证「只」在本补丁矩阵内），按 perms 字符串重新授权（与菜单 ID 解耦，
--      22xxx/24xxx 任一载体命中即可）；
--   2) 授予 2400 段 M/C 菜单（≤2449，排除 2450/2451 系统组）；
--   3) homePath 指向 2400 树内可见菜单。
-- 后端写接口均有 @PreAuthorize，按钮隐藏 + 接口拒绝双重生效。
-- 幂等：DELETE+INSERT NOT EXISTS，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------
-- 1. 清空三角色既有按钮级授权（apms:* 及业务页依赖的两个 system:* 查询点）
-- ----------------------------------------------------------------------
DELETE rm
  FROM sys_role_menu rm
  JOIN sys_role r ON r.role_id = rm.role_id
  JOIN sys_menu m ON m.menu_id = rm.menu_id
 WHERE r.role_key IN ('portal_coach', 'portal_tester', 'portal_medic')
   AND m.menu_type = 'F'
   AND (m.perms LIKE 'apms:%'
        OR m.perms IN ('system:dept:list', 'system:user:list'));

-- ----------------------------------------------------------------------
-- 2. 公共读权限（三角色一致）：所有业务模块 list/query，
--    病历附件下载、报告下载、部门树/测试人下拉
-- ----------------------------------------------------------------------
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r
 CROSS JOIN sys_menu m
 WHERE r.role_key IN ('portal_coach', 'portal_tester', 'portal_medic')
   AND m.perms IN (
     'apms:athlete:list', 'apms:athlete:query',
     'apms:body:list', 'apms:body:query',
     'apms:phv:list', 'apms:phv:query',
     'apms:comboScore:list', 'apms:comboScore:query',
     'apms:indicator:list', 'apms:indicator:query',
     'apms:testTask:list', 'apms:testTask:query',
     'apms:testResult:list', 'apms:testResult:query',
     'apms:testModel:list', 'apms:testModel:query',
     'apms:comboModel:list', 'apms:comboModel:query',
     'apms:rtp:list', 'apms:rtp:query',
     'apms:rtpRisk:list', 'apms:rtpRisk:query',
     'apms:medicalRecord:list', 'apms:medicalRecord:query',
     'apms:medicalFile:download',
     'apms:report:list', 'apms:report:query', 'apms:report:download',
     'system:dept:list', 'system:user:list'
   )
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );

-- ----------------------------------------------------------------------
-- 3. 写权限（按一级分组隔离）
-- ----------------------------------------------------------------------
-- 3.1 coach：运动员（athlete/body/phv/comboScore）+ 分析（report）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key = 'portal_coach'
   AND m.perms IN (
     'apms:athlete:add', 'apms:athlete:edit', 'apms:athlete:remove',
     'apms:body:edit', 'apms:body:remove',
     'apms:phv:edit', 'apms:phv:remove',
     'apms:comboScore:calculate', 'apms:comboScore:remove',
     'apms:report:generate', 'apms:report:remove'
   )
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );

-- 3.2 tester：测试（indicator/testTask/testResult/testModel/comboModel）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key = 'portal_tester'
   AND m.perms IN (
     'apms:indicator:add', 'apms:indicator:edit', 'apms:indicator:remove',
     'apms:testTask:add', 'apms:testTask:edit', 'apms:testTask:remove',
     'apms:testResult:add', 'apms:testResult:edit', 'apms:testResult:remove',
     'apms:testModel:add', 'apms:testModel:edit', 'apms:testModel:remove',
     'apms:comboModel:add', 'apms:comboModel:edit', 'apms:comboModel:remove'
   )
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );

-- 3.3 medic：健康（rtp/rtpRisk/medicalRecord/medicalFile）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key = 'portal_medic'
   AND m.perms IN (
     'apms:rtp:edit', 'apms:rtp:clear',
     'apms:rtpRisk:handle', 'apms:rtpRisk:scan',
     'apms:medicalRecord:add', 'apms:medicalRecord:edit', 'apms:medicalRecord:remove',
     'apms:medicalFile:remove'
   )
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );

-- ----------------------------------------------------------------------
-- 4. 侧边栏菜单：2400 段 M/C（总览/运动员/测试/健康/分析；排除 2450+ 系统组）
-- ----------------------------------------------------------------------
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key IN ('portal_coach', 'portal_tester', 'portal_medic')
   AND m.menu_id BETWEEN 2400 AND 2449
   AND m.menu_type IN ('M', 'C')
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );

-- ----------------------------------------------------------------------
-- 5. 落地页指向 2400 树内可见路由
-- ----------------------------------------------------------------------
UPDATE sys_role SET home_path = '/overview/cockpit'
 WHERE role_key = 'portal_coach' AND home_path <> '/overview/cockpit';
UPDATE sys_role SET home_path = '/testings/dispatch'
 WHERE role_key = 'portal_tester' AND home_path <> '/testings/dispatch';
UPDATE sys_role SET home_path = '/healthcare/medical-care'
 WHERE role_key = 'portal_medic' AND home_path <> '/healthcare/medical-care';

-- ======================================================================
-- 验收查询
-- ======================================================================
-- -- ① 2400 段导航菜单数（预期均为 14）
-- SELECT r.role_key,
--        SUM(CASE WHEN m.menu_id BETWEEN 2400 AND 2449 AND m.menu_type IN ('M','C')
--                 THEN 1 ELSE 0 END) AS nav_menus,
--        r.home_path
--   FROM sys_role r
--   JOIN sys_role_menu rm ON rm.role_id = r.role_id
--   JOIN sys_menu m ON m.menu_id = rm.menu_id
--  WHERE r.role_key IN ('portal_coach','portal_tester','portal_medic')
--  GROUP BY r.role_key, r.home_path;
--
-- -- ② 各角色 apms 写权限（预期 coach 11 / tester 15 / medic 8 个不同 perms）
-- SELECT r.role_key, COUNT(DISTINCT m.perms) AS write_perms
--   FROM sys_role r
--   JOIN sys_role_menu rm ON rm.role_id = r.role_id
--   JOIN sys_menu m ON m.menu_id = rm.menu_id
--  WHERE r.role_key IN ('portal_coach','portal_tester','portal_medic')
--    AND m.perms REGEXP ':(add|edit|remove|clear|handle|scan|calculate|generate)$'
--  GROUP BY r.role_key;
