-- ======================================================================
-- patch-0.0.6-2610061640
-- super 菜单两层化（第一批：健康预警中心）：
--   将 2431「健康预警中心」由三级目录改为二级菜单，直接指向合并页
--   apms/healthAlert/index（页面内上：RTP 状态管理；下：RTP 风险预警）；
--   移除其下两个三级菜单 2432/2433 及 super 角色关联。
--   按钮权限点（apms:rtp:* / apms:rtpRisk:*）仍保留在 super 角色上，
--   页面内功能不受影响。
-- 幂等：UPDATE/DELETE 天然可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 健康预警中心：目录 → 二级菜单（合并页）
UPDATE sys_menu
   SET menu_type = 'C',
       component = 'apms/healthAlert/index',
       perms = '',
       order_num = 1
 WHERE menu_id = 2431;

-- 2. 删除两个三级菜单及其角色关联（菜单物理删除，super 菜单树不再有第三层）
DELETE FROM sys_role_menu WHERE role_id = 200 AND menu_id IN (2432, 2433);
DELETE FROM sys_menu WHERE menu_id IN (2432, 2433);
