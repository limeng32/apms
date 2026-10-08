-- ======================================================================
-- patch-0.0.7-261008171535
-- super 可在「系统 > 角色权限管理」页面内维护部门（APMS 总部之下建队）：
-- 部门管理已以前端 Tab 子模块形式并入角色权限管理页
-- （system/role/index 内嵌 system/dept/index，路由仍为 /sysmgr/role-acl），
-- 不新增独立菜单。super 此前仅持有隐藏 F 点 245101(system:dept:list，
-- 供业务页部门树下拉使用)，本补丁补齐部门查询/新增/修改/删除写权限，
-- 按 perms 字符串命中旧树 F 菜单 1016-1019，与菜单 ID 解耦。
-- super data_scope=全部数据，checkDeptDataScope 不会拦截。
-- 幂等：INSERT NOT EXISTS，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

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

-- 验收：super 应拿到 dept 五项权限（list 由 245101 授予，其余四项本补丁补齐）
-- SELECT m.menu_id, m.menu_type, m.perms
--   FROM sys_role_menu rm
--   JOIN sys_menu m ON m.menu_id = rm.menu_id
--  WHERE rm.role_id = 200 AND m.perms LIKE 'system:dept:%'
--  ORDER BY m.perms;
