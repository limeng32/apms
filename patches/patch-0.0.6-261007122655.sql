-- ======================================================================
-- patch-0.0.6-261007122655
-- super 菜单补回「总览」分组（参照 demo 信息架构）：
--   2401 总览(M, order=1)
--     └ 2402 数据驾驶舱(C, 复用 apms/dashboard/index)
--   说明：2400 旧驾驶舱单菜单曾被 patch-2610061740 移除（首页 /index
--   已渲染同一组件）；此处按 demo 侧边栏结构以「总览」分组形式恢复入口。
--   M 型目录后端自动 alwaysShow=true，单子菜单仍保留分组标签。
-- 幂等：INSERT ... ON DUPLICATE KEY UPDATE；角色授权整组重放
-- ======================================================================

SET NAMES utf8mb4;

INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
(2401, '总览',       0,    1, 'overview', NULL,                    NULL, 1, 0, 'M', '0', '0', '', '', 'admin', NOW()),
(2402, '数据驾驶舱', 2401, 1, 'cockpit',  'apms/dashboard/index',  NULL, 1, 0, 'C', '0', '0', '', 'layout-dashboard', 'admin', NOW())
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

-- super 角色（200）授权
DELETE FROM sys_role_menu WHERE role_id = 200 AND menu_id IN (2401, 2402);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES (200, 2401), (200, 2402);
