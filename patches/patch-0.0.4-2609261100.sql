-- patch-0.0.4-2609261100.sql 菜单图标修正：侧栏同列表 icon 去重
-- =====================================================================
-- 背景：二级/三级菜单图标放开后（SidebarItem 嵌套层渲染），发现两处同列表图标重复：
--   1. 2263「组合体能评分」与顶级 2200「APMS 系统」同为 star
--   2. 2262「组合模型」与 2232「测试模型库」同为 build
-- 变更：
--   2263 icon: star      → validCode（盾牌+对勾，评估/达标语义，图标库已有该 svg）
--   2262 icon: build     → component（拼图块，组合语义，图标库已有该 svg）
-- 幂等：可重复执行；仅在当前值为旧值时更新，避免覆盖后续人工调整
-- 备注：2300「登录页设计」icon=skin 不变，其缺失的 skin.svg 已在前端图标目录补齐
-- =====================================================================

SET NAMES utf8mb4;

UPDATE sys_menu
SET icon = 'validCode', update_by = 'admin', update_time = NOW()
WHERE menu_id = 2263
  AND menu_name = '组合体能评分'
  AND icon = 'star';

UPDATE sys_menu
SET icon = 'component', update_by = 'admin', update_time = NOW()
WHERE menu_id = 2262
  AND menu_name = '组合模型'
  AND icon = 'build';
