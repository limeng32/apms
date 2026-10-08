-- ======================================================================
-- patch-0.0.7-261007193835
-- 组合评分菜单归位 + 算分权限收口（教练只读 / 测量员算分）：
--   1) 删除「运动员」分组下的独立菜单 2415（组合评分 / score-trend）。
--      组合评分已并入「测试 → 组合测试调度 2425」合并页
--      （apms/comboDispatch/index 内的组合评分区块）；
--   2) 在 2425 下新增 F 型权限点 242503「组合评分查看」(apms:comboScore:list)，
--      与 242501/242502 同型：F 不进路由树，仅承载列表查询权限；
--   3) 把 2415 现有角色授权原样复制到 242503，再删除 2415，
--      保证各角色 comboScore:list 不中断；
--   4) 教练 portal_coach 收回 calculate/remove（仅经运动员详情查看数值/快照）；
--      测量员 portal_tester 授予 calculate/remove（在组合测试调度页操作）。
-- 教练查看入口：花名册 → 运动员详情 →「组合评分」Tab（list+query 即可，无遮罩）。
-- 注意：login_token 缓存旧权限，改完后相关用户需重新登录（或在「在线用户」踢出）。
-- 幂等：ON DUPLICATE KEY UPDATE / INSERT NOT EXISTS / DELETE，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

-- 1. 新增 242503 F 型「组合评分查看」
INSERT INTO sys_menu
  (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache,
   menu_type, visible, status, perms, icon, create_by, create_time)
VALUES
  (242503, '组合评分查看', 2425, 3, '', NULL, NULL, 1, 0, 'F', '0', '0',
   'apms:comboScore:list', '#', 'admin', NOW())
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  menu_type = 'F',
  perms = VALUES(perms),
  status = '0';

-- 2. 2415 现有角色授权原样复制到 242503（必须在删除 2415 之前执行）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT rm.role_id, 242503
  FROM sys_role_menu rm
 WHERE rm.menu_id = 2415
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu x
      WHERE x.role_id = rm.role_id AND x.menu_id = 242503
   );

-- 3. 教练收回组合评分算分/删除（list/query 保留，只读）
DELETE rm
  FROM sys_role_menu rm
  JOIN sys_role r ON r.role_id = rm.role_id
  JOIN sys_menu m ON m.menu_id = rm.menu_id
 WHERE r.role_key = 'portal_coach'
   AND m.perms IN ('apms:comboScore:calculate', 'apms:comboScore:remove');

-- 4. 测量员授予算分/删除（按 perms 字符串授权，与菜单 ID 解耦）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.role_id, m.menu_id
  FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key = 'portal_tester'
   AND m.perms IN ('apms:comboScore:calculate', 'apms:comboScore:remove')
   AND NOT EXISTS (
     SELECT 1 FROM sys_role_menu rm
      WHERE rm.role_id = r.role_id AND rm.menu_id = m.menu_id
   );

-- 5. 删除独立菜单 2415 及其全部角色关联
DELETE FROM sys_role_menu WHERE menu_id = 2415;
DELETE FROM sys_menu WHERE menu_id = 2415;

-- ======================================================================
-- 验收查询
-- ======================================================================
-- -- ① 2415 应无记录；242503=F/perms=apms:comboScore:list
-- SELECT menu_id, menu_name, parent_id, menu_type, perms
--   FROM sys_menu WHERE menu_id IN (2415, 242503);
--
-- -- ② 教练仅 list/query；测量员 list/query/calculate/remove 四项齐全
-- SELECT r.role_key, m.perms
--   FROM sys_role r
--   JOIN sys_role_menu rm ON rm.role_id = r.role_id
--   JOIN sys_menu m ON m.menu_id = rm.menu_id
--  WHERE r.role_key IN ('portal_coach', 'portal_tester')
--    AND m.perms LIKE 'apms:comboScore:%'
--  ORDER BY r.role_key, m.perms;
