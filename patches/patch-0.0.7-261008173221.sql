-- ======================================================================
-- patch-0.0.7-261008173221
-- 部门管理方案收敛：由「独立菜单」改为「角色权限管理页内 Tab 子模块」
-- （前端 system/role/index 内嵌 system/dept/index，路由仍 /sysmgr/role-acl）。
--
-- 背景：同名补丁 patch-0.0.7-261008171535 曾先发布为「新增独立菜单 2452 +
-- 授权」版本，随后改为「仅授权、不建菜单」版本；部署按 patch_name 去重，
-- 已执行旧版的库中会残留 2452。本补丁对三种库状态统一收敛：
--   A) 执行过旧版 171535：存在 2452 → 本补丁删除菜单及授权关联；
--   B) 执行过新版 171535：无 2452 → DELETE 为空操作；
--   C) 未执行过 171535 ：由该补丁授予写权限，本补丁 DELETE 为空操作。
-- 最终态一致：无独立部门菜单；super 持有 dept list/query/add/edit/remove。
-- super 的 system:dept:list 由既有隐藏 F 点 245101 提供，不动。
-- 幂等：DELETE + INSERT NOT EXISTS，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 移除早期方案遗留的独立「部门管理」菜单 2452 及其角色关联
DELETE FROM sys_role_menu WHERE menu_id = 2452;
DELETE FROM sys_menu WHERE menu_id = 2452;

-- 2. 幂等授予 super（200）部门查询/新增/修改/删除（已存在则无操作）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 200, m.menu_id
  FROM sys_menu m
 WHERE m.perms IN (
   'system:dept:query', 'system:dept:add',
   'system:dept:edit',  'system:dept:remove'
 )
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = 200 AND rm.menu_id = m.menu_id
   );

-- ======================================================================
-- 验收查询
-- ======================================================================
-- -- ① 2452 应无记录
-- SELECT menu_id, menu_name FROM sys_menu WHERE menu_id = 2452;
--
-- -- ② super 的 dept 权限应为 list/query/add/edit/remove 五项
-- SELECT m.menu_id, m.menu_type, m.perms
--   FROM sys_role_menu rm
--   JOIN sys_menu m ON m.menu_id = rm.menu_id
--  WHERE rm.role_id = 200 AND m.perms LIKE 'system:dept:%'
--  ORDER BY m.perms;
