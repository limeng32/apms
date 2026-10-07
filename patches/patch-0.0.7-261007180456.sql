-- ======================================================================
-- patch-0.0.7-261007180456
-- 菜单可见性按角色收口（合并原 261007180214 + 261007180456 两补丁）：
--
-- 目标矩阵：
--   · 平台 admin（user_id=1）        ：走 selectMenuTreeAll 全量查询，
--                                      完整看到「APMS 系统」(2200) 旧树
--   · super（business_admin 角色）   ：只保留 2400 六个新分组树
--   · coach/tester/medic 门户专岗    ：只保留 2400 新分组树
--
-- 做法：
--   1) 恢复 2200 visible='0'（撤销 patch-261007141101 的全局隐藏）。
--      visible 是全局属性，无法按角色区分显隐，因此用「角色授权」控制：
--      user_id=1 不依赖授权（全量查询）天然可见；其余角色靠 sys_role_menu。
--   2) 收回 business_admin 与三个门户角色对 2200 段【M/C 导航菜单】的授权。
--      只删 menu_type IN ('M','C')；22xxx 段 F 型按钮（apms:* 读写权限点）
--      一律保留，业务/门户角色的操作权限矩阵不受影响。
-- 幂等：UPDATE 带 visible='1' 守卫；DELETE 天然可重复执行
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 恢复「APMS 系统」根菜单可见
UPDATE sys_menu
   SET visible = '0', update_time = NOW()
 WHERE menu_id = 2200
   AND visible = '1';

-- 2. 业务管理员 + 门户专岗移除 2200 旧树导航（M/C），F 型按钮权限点保留
DELETE rm
  FROM sys_role_menu rm
  JOIN sys_role r ON r.role_id = rm.role_id
  JOIN sys_menu m ON m.menu_id = rm.menu_id
 WHERE r.role_key IN ('business_admin', 'portal_coach', 'portal_tester', 'portal_medic')
   AND m.menu_id BETWEEN 2200 AND 2299
   AND m.menu_type IN ('M', 'C');

-- ======================================================================
-- 验收查询
-- ======================================================================
-- -- ① 2200 已恢复可见（预期 visible=0）
-- SELECT menu_id, menu_name, visible, status FROM sys_menu WHERE menu_id = 2200;
--
-- -- ② 下列角色在 2200 段的 M/C 应为 0；F 型 apms 按钮保持原数量
-- SELECT r.role_key,
--        SUM(m.menu_type IN ('M','C')) AS old_nav_menus,
--        SUM(m.menu_type = 'F' AND m.perms LIKE 'apms:%') AS apms_buttons
--   FROM sys_role r
--   JOIN sys_role_menu rm ON rm.role_id = r.role_id
--   JOIN sys_menu m ON m.menu_id = rm.menu_id
--  WHERE r.role_key IN ('business_admin','portal_coach','portal_tester','portal_medic')
--    AND m.menu_id BETWEEN 2200 AND 2299
--  GROUP BY r.role_key;
-- 预期：四行 old_nav_menus 均为 0，apms_buttons 不变
--
-- -- ③ 平台 admin 不受影响（user_id=1 走全量查询，始终可见 2200）
-- SELECT menu_id, menu_name, visible FROM sys_menu WHERE menu_id = 2200;
