-- ======================================================================
-- patch-0.0.7-261007183044
-- 2400 新分组树菜单更名：
--   2415「纵向趋势」→「组合评分」（页面 apms/comboScore/index 即组合体能评分）
-- 仅改显示名，path(score-trend)/perms/component 不变，前端路由与权限无需调整。
-- 幂等：UPDATE 带旧名守卫，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

UPDATE sys_menu
   SET menu_name = '组合评分', update_time = NOW()
 WHERE menu_id = 2415
   AND menu_name = '纵向趋势';

-- 验收：SELECT menu_id, menu_name, path, perms FROM sys_menu WHERE menu_id = 2415;
-- 预期：menu_name=组合评分，path=score-trend，perms=apms:comboScore:list
