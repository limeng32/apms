-- ======================================================================
-- patch-0.0.9-261015194914
-- super（业务管理员，user_id=100 / role_id=200 / role_key=super）新增用户入口：
--   在「系统」(2450) 下新增「用户管理」(2453)，与「角色权限管理」(2451)、
--   「组织架构」(2452) 平级，最终路由 /sysmgr/user，复用既有页面组件
--   system/user/index。
--
-- 背景：
--   super 不是平台内置 admin(user_id=1)，不享受 isAdmin() 自动全放行，
--   侧边栏动态菜单与按钮鉴权都依赖 sys_role_menu 实际授权。此前 super
--   角色只被授予了角色/部门与业务模块权限，没有任何 system:user:* 权限点，
--   因此「系统」分组下看不到用户管理、也无法调新建用户接口。
--
-- 内容：
--   1) 新增 C 型菜单 2453（perms=system:user:list，控制菜单显示与列表接口）；
--   2) 授予 super(role_id=200) 菜单 2453 及原生用户管理按钮点
--      1000~1006（query/add/edit/remove/export/import/resetPwd），
--      与标准用户管理功能对齐（F 点全局唯一，直接授权即可，无需新建一套）。
--
-- 安全边界（保持既有设计，不在本补丁改动）：
--   * super 的数据范围 data_scope=1（全部），checkDeptDataScope/checkRoleDataScope
--     因此放行，可在任意部门下建用户；
--   * 但 ManagedBoundary.assertRolesManageable 仍限制 super 只能给新用户分配
--     portal_* 专岗角色，不能授予 admin / business_admin 等保留角色
--     （前端角色下拉同样只列 portal_*）；
--   * 平台内置 admin(user_id=1) 走原生「系统管理 → 用户管理」(menu 100)，不受影响。
--
-- 生效：菜单/权限在登录时加载并随 token 缓存，执行后 super 需重新登录
--       （或在「在线用户」踢出后重登）。
-- 幂等：INSERT ... ON DUPLICATE KEY UPDATE + INSERT IGNORE，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

-- 1) 「系统 → 用户管理」二级菜单（复用 system/user/index 页面与 /system/user/* 接口）
INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
  (2453, '用户管理', 2450, 3, 'user', 'system/user/index', NULL, 1, 0,
   'C', '0', '0', 'system:user:list', 'user', 'admin', NOW())
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

-- 2) 授予 super(role_id=200)：用户管理菜单 + 7 个按钮权限点
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES
  (200, 2453),
  (200, 1000),  -- 用户查询  system:user:query
  (200, 1001),  -- 用户新增  system:user:add
  (200, 1002),  -- 用户修改  system:user:edit
  (200, 1003),  -- 用户删除  system:user:remove
  (200, 1004),  -- 用户导出  system:user:export
  (200, 1005),  -- 用户导入  system:user:import
  (200, 1006);  -- 重置密码  system:user:resetPwd

-- ======================================================================
-- 验收查询（人工执行）
-- ======================================================================
-- -- ① 「系统」(2450) 下出现「用户管理」，C 型，component=system/user/index
-- SELECT menu_id, menu_name, parent_id, order_num, path, component, menu_type, perms
--   FROM sys_menu WHERE menu_id = 2453;
--
-- -- ② super 应已获得菜单 + 7 个按钮点（共 8 行）
-- SELECT rm.menu_id, m.menu_name, m.perms
--   FROM sys_role_menu rm JOIN sys_menu m ON rm.menu_id = m.menu_id
--  WHERE rm.role_id = 200 AND rm.menu_id IN (2453,1000,1001,1002,1003,1004,1005,1006)
--  ORDER BY rm.menu_id;
