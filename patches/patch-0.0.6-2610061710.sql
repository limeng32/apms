-- ======================================================================
-- patch-0.0.6-2610061710
-- super 菜单两层化（第二批）：
--   青训发育监控 2412 → 二级菜单 apms/growth/index（体态测量 + PHV 成熟度）
--   指标库与任务下发 2421 → 二级菜单 apms/dispatch/index（指标库 + 测试任务 + 测试结果）
--   组合测试调度 2425 → 二级菜单 apms/comboDispatch/index（测试模型库 + 组合模型库）
--   删除三级菜单 2413/2414/2422/2423/2424/2426/2427 及 super 角色关联。
--   页面内按钮权限点（apms:body/phv/indicator/testTask/testResult/
--   testModel/comboModel:*）仍在 super 角色上，功能不受影响。
-- 幂等：UPDATE/DELETE 天然可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 三个分组目录 → 二级菜单（合并页）
UPDATE sys_menu
   SET menu_type = 'C', component = 'apms/growth/index', perms = ''
 WHERE menu_id = 2412;

UPDATE sys_menu
   SET menu_type = 'C', component = 'apms/dispatch/index', perms = ''
 WHERE menu_id = 2421;

UPDATE sys_menu
   SET menu_type = 'C', component = 'apms/comboDispatch/index', perms = ''
 WHERE menu_id = 2425;

-- 2. 删除三级菜单及其角色关联
DELETE FROM sys_role_menu
 WHERE role_id = 200
   AND menu_id IN (2413, 2414, 2422, 2423, 2424, 2426, 2427);

DELETE FROM sys_menu
 WHERE menu_id IN (2413, 2414, 2422, 2423, 2424, 2426, 2427);
