-- ======================================================================
-- patch-0.0.7-261012113000
-- 授权 admin 角色查看「系统 → 组织架构」(2452)
--
-- 背景：
--   2452「组织架构」(component=system/dept/index, /sysmgr/org) 此前仅授权
--   super（role_id=200，见 patch-0.0.7-261011180000）。现需让平台方 admin
--   （role_id=1 超级管理员）也能看到该菜单。
--
--   两个入口的定位保持分工：
--     * 「系统 → 组织架构」(2452)：super 的维护入口，上级部门树最高只到
--       「APMS 总部」（前端按角色裁剪，见 system/dept/index.vue）；
--       admin 打开同一页面时树不裁剪，可看到平台根公司全树。
--     * 「系统管理 → 部门管理」(103)：经典部门管理菜单，admin 既有入口，
--       完整组织树，admin 需建立与「APMS 总部」平级的机构（挂到根公司
--       「康耐特科技」下）时在此操作。
--
--   说明：
--     * user_id=1 的超管账号后端走「全部菜单」逻辑本就能看到 2452，
--       此处对 role_id=1 做显式授权，保证同样拥有 admin 角色但 user_id≠1
--       的账号也能稳定看到该菜单，菜单可见性以角色授权为单一依据。
--     * 部门增删改按钮权限（system:dept:add/edit/remove/query）：
--       user_id=1 后端按 *:*:* 放行；非 user_id=1 的 admin 角色账号如需
--       在组织架构页写操作，沿用 2451 下隐藏 F 点（245101 等）的既有
--       perms 串即可，本补丁不重复授权。
--
-- 幂等：INSERT ... SELECT ... WHERE EXISTS + INSERT 列无唯一键，
--       用 NOT EXISTS 防重复，可反复执行。
-- ======================================================================

SET NAMES utf8mb4;

-- 父目录 2450「系统」与子菜单 2452「组织架构」一并授权：
-- RuoYi 菜单接口按授权结果构建菜单树，只有子菜单而缺父目录时，
-- 非 user_id=1 的 admin 角色账号会因子节点挂不上树而看不到入口。
-- user_id=1 的超管走全菜单逻辑，两行对其均为空操作。
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, m.menu_id
  FROM sys_menu m
 WHERE m.menu_id IN (2450, 2452)
   AND NOT EXISTS (
         SELECT 1 FROM sys_role_menu rm
          WHERE rm.role_id = 1 AND rm.menu_id = m.menu_id
       );

-- ======================================================================
-- 验收查询
-- ======================================================================
-- -- ① super 与 admin 均应持有 2452（admin 另含父目录 2450）
-- SELECT rm.role_id, r.role_key, rm.menu_id
--   FROM sys_role_menu rm
--   JOIN sys_role r ON r.role_id = rm.role_id
--  WHERE rm.menu_id IN (2450, 2452)
--  ORDER BY rm.menu_id, rm.role_id;
--
-- -- 预期：
-- -- role_id=1   admin  → 2450、2452
-- -- role_id=200 super  → 2452（2450 已由 super 两层化补丁授予）
--
-- -- ② admin 仍持有经典「部门管理」(103)，可建与 APMS 总部平级的机构
-- SELECT role_id, menu_id FROM sys_role_menu
--  WHERE role_id = 1 AND menu_id IN (103, 2452)
--  ORDER BY menu_id;
