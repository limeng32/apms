-- ======================================================================
-- patch-0.0.9-261015225117
-- 修复：admin 原生「系统管理 → 用户管理」/system/user 变 404。
--
-- 根因：
--   patch-0.0.9-261015194914 新增的 super 用户管理菜单 2453（path=user，
--   挂在目录 2450 sysmgr 下，最终 URL /sysmgr/user）与原生菜单 100
--   （系统管理 system 下，path=user，URL /system/user）path 相同。
--   RuoYi 路由 name 取 capitalize(path)（route_name 为空时），两条菜单
--   生成同名路由 'User'。admin(user_id=1) 走 selectMenuTreeAll 拿到全部
--   菜单，前端 vue-router addRoute 注册同名路由时会先移除旧的同名路由，
--   /system/user 被 /sysmgr/user 顶掉，访问即 404。
--   （同组 2451 取 path=role-acl、2452 取 path=org 均已规避，唯独 2453 遗漏。）
--
-- 修复：
--   仅给 2453 设置唯一 route_name='SysmgrUser'，path 保持 'user' 不变，
--   URL 仍是 /sysmgr/user，书签/菜单无需调整；原生 100 的 name 仍为 User。
--
-- 生效：getRouters 在登录时构建，admin/super 重新登录即可，无需重启后端
--       （菜单查询实时读库，无服务端缓存；如仍异常可在「在线用户」踢出重登）。
-- 幂等：UPDATE 固定值，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

UPDATE sys_menu
   SET route_name = 'SysmgrUser'
 WHERE menu_id = 2453;

-- ======================================================================
-- 验收查询（人工执行）
-- ======================================================================
-- -- ① 2453 应有独立路由名，100 仍为空（由 path 推导为 User）
-- SELECT menu_id, menu_name, parent_id, path, route_name, component
--   FROM sys_menu WHERE menu_id IN (100, 2453);
--
-- -- ② 全库不应再有其他 path='user' 且 route_name 为空/为 'User' 的 C 型菜单
-- SELECT menu_id, menu_name, path, route_name
--   FROM sys_menu WHERE menu_type = 'C' AND path = 'user';
