-- ======================================================================
-- patch-0.0.6-2610061755
-- 修复 super 合并页丢失 :list 权限：
-- 两级化时删除了携带 apms:xxx:list 的三级 C 菜单，合并页 C 菜单 perms 置空，
-- 导致 super 打开合并页时各列表/统计接口报「当前操作没有权限」。
-- 现以 F 型（按钮）权限菜单挂在合并后的 C 菜单下补回 9 个 :list 权限点。
-- F 型不参与路由树构建（menu_type IN ('M','C')），故不会在侧边栏产生任何条目。
-- 幂等：INSERT ... ON DUPLICATE KEY UPDATE + INSERT IGNORE。
-- ======================================================================

SET NAMES utf8mb4;

INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
  -- 青训发育监控 2412
  (241201, '体态测量查看', 2412, 1, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:body:list',     '#', 'admin', NOW()),
  (241202, 'PHV查看',     2412, 2, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:phv:list',      '#', 'admin', NOW()),
  -- 指标库与任务下发 2421
  (242101, '指标库查看', 2421, 1, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:indicator:list',  '#', 'admin', NOW()),
  (242102, '任务查看',   2421, 2, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:testTask:list',   '#', 'admin', NOW()),
  (242103, '成绩查看',   2421, 3, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:testResult:list', '#', 'admin', NOW()),
  -- 组合测试调度 2425
  (242501, '测试模型查看', 2425, 1, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:testModel:list',  '#', 'admin', NOW()),
  (242502, '组合模型查看', 2425, 2, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:comboModel:list', '#', 'admin', NOW()),
  -- 健康预警中心 2431
  (243101, 'RTP状态查看', 2431, 1, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:rtp:list',     '#', 'admin', NOW()),
  (243102, '风险预警查看', 2431, 2, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:rtpRisk:list', '#', 'admin', NOW())
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  menu_type = 'F',
  perms = VALUES(perms),
  status = '0';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT 200, menu_id FROM sys_menu WHERE menu_id IN
  (241201, 241202, 242101, 242102, 242103, 242501, 242502, 243101, 243102);
