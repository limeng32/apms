-- ======================================================================
-- patch-0.0.6-261007141101
-- 下线旧版平铺一级菜单「APMS 系统」(2200)，全面切换 demo 分组信息架构
-- （总览/运动员/测试/健康/分析/系统，即 2400 段）：
--   1) 隐藏 2200 根菜单（visible='1'）：侧栏不再显示「APMS 系统」分组；
--      后端菜单查询不过滤 visible，/apms/* 路由仍会注册——
--      门户专岗角色（教练/测量员/队医）的 homePath 与历史旧链接照常可达。
--   2) 将 2400 段全部 M/C 菜单授予 admin、business_admin 角色，
--      避免非 user_id=1 的同权账号在 2200 隐藏后失去 APMS 导航；
--      user_id=1 超管走全量查询，授权对其无副作用。
--   3) F 型按钮权限点沿用既有授权（business_admin 已有全部 apms:* 按钮，
--      2400 段复用同一 perms），无需变更。
-- 幂等：UPDATE 带 visible='0' 旧值守卫；授权用 NOT EXISTS 去重
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 隐藏旧根菜单「APMS 系统」
UPDATE sys_menu
   SET visible = '1', update_time = NOW()
 WHERE menu_id = 2200
   AND visible = '0';

-- 2. 新分组菜单（2400 段 M/C）授权 admin / business_admin
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r
 CROSS JOIN sys_menu m
 WHERE r.role_key IN ('admin', 'business_admin')
   AND m.menu_id BETWEEN 2400 AND 2499
   AND m.menu_type IN ('M', 'C')
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );
