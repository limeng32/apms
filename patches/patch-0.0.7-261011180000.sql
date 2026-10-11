-- ======================================================================
-- patch-0.0.7-261011180000
-- super 菜单：在「系统」下新增「组织架构」（队伍/训练小组维护入口），
--             与「角色权限管理」(2451) 平级，最终路由 /sysmgr/org
--
-- 背景：部门（队伍/训练小组）管理此前仅作为 Tab 内嵌在
--       「系统 → 角色权限管理」页内（前端 system/role/index 内嵌
--       system/dept/index），用户难以发现。现把它改为「系统」目录下的
--       独立二级菜单，复用既有页面组件 system/dept/index；
--       角色权限页内嵌的部门 Tab 由前端版本同步移除。
--
-- 说明：
--   * 菜单形态参照 2451（角色权限管理）：挂在目录「系统」2450 下的 C 型菜单，
--     最终路由 /sysmgr/org，前端按 component 字段动态加载。
--   * perms 复用 system:dept:list（与隐藏 F 点 245101 同权限串，不影响鉴权）；
--     add/edit/remove/query 已由 patch-0.0.7-261008173221 授予 super。
--   * menu_id 2452 曾被早期方案占用并已由 261008173221 删除，此处重新启用；
--     ON DUPLICATE KEY UPDATE 对历史残留行（含曾短暂发布为顶级菜单的版本）
--     同样收敛为「系统」下二级菜单。
--   * 仅授权 super（200）；admin 仍走系统管理内原部门管理菜单，不受影响。
-- 幂等：INSERT ... ON DUPLICATE KEY UPDATE + INSERT IGNORE，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
  (2452, '组织架构', 2450, 2, 'org', 'system/dept/index', NULL, 1, 0, 'C', '0', '0',
   'system:dept:list', 'tree', 'admin', NOW())
ON DUPLICATE KEY UPDATE
  menu_name = VALUES(menu_name),
  parent_id = VALUES(parent_id),
  order_num = VALUES(order_num),
  path = VALUES(path),
  component = VALUES(component),
  query = VALUES(query),
  menu_type = VALUES(menu_type),
  visible = '0',
  status = '0',
  perms = VALUES(perms),
  icon = VALUES(icon);

-- 授权 super（200）
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (200, 2452);

-- ======================================================================
-- 验收查询
-- ======================================================================
-- -- ① 「系统」(2450) 下应出现「组织架构」，C 型，parent_id=2450，component=system/dept/index
-- SELECT menu_id, menu_name, parent_id, order_num, path, component, menu_type, perms, icon
--   FROM sys_menu WHERE menu_id = 2452;
--
-- -- ② super 应已授权
-- SELECT role_id, menu_id FROM sys_role_menu WHERE role_id = 200 AND menu_id = 2452;
