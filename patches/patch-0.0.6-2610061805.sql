-- ======================================================================
-- patch-0.0.6-2610061805
-- 修复 super 业务页依赖的系统查询权限：
--   system:dept:list —— 队伍/部门树（花名册、任务下发、体态测量、PHV、
--                       报告生成、健康预警等页面的队伍筛选/下拉都依赖它）
--   system:user:list —— 测试任务「测试人」下拉
-- 以 F 型（按钮）权限菜单挂到「角色权限管理」2451 下，不进入路由树、
-- 不出现在侧边栏。
-- 幂等：ON DUPLICATE KEY UPDATE + INSERT IGNORE。
-- ======================================================================

SET NAMES utf8mb4;

INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
  (245101, '部门树查询', 2451, 1, '', NULL, NULL, 1, 0, 'F', '0', '0', 'system:dept:list', '#', 'admin', NOW()),
  (245102, '用户列表查询', 2451, 2, '', NULL, NULL, 1, 0, 'F', '0', '0', 'system:user:list', '#', 'admin', NOW())
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  menu_type = 'F',
  perms = VALUES(perms),
  status = '0';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 200, menu_id FROM sys_menu WHERE menu_id IN (245101, 245102);
