-- =====================================================================
-- APMS 增量补丁
-- 版本: 0.0.3
-- 时间: 2026-09-20 20:35
-- 变更: 登录页设计器 M2 —— 系统管理下新增「登录页设计」菜单与保存权限点
-- 说明:
--   1. 菜单挂在「系统管理」(menu_id=1) 下；菜单 ID 使用 2300-2309 新区间
--   2. 菜单权限 system:loginconfig:query（进入页面/回显）
--      按钮权限 system:loginconfig:edit（保存/导入）
--   3. 超管 admin 拥有 *:*:*，无需额外分配 sys_role_menu
--   4. 幂等：重复执行先清区间内旧数据
-- =====================================================================

START TRANSACTION;

DELETE FROM `sys_role_menu` WHERE `menu_id` BETWEEN 2300 AND 2309;
DELETE FROM `sys_menu`      WHERE `menu_id` BETWEEN 2300 AND 2309;

INSERT INTO `sys_menu`
(`menu_id`,`menu_name`,`parent_id`,`order_num`,`path`,`component`,`query`,`route_name`,
 `is_frame`,`is_cache`,`menu_type`,`visible`,`status`,`perms`,`icon`,`create_by`,`create_time`,`remark`) VALUES
(2300,'登录页设计',1,12,'loginConfig','system/loginConfig/index','',NULL,1,0,'C','0','0',
 'system:loginconfig:query','skin','admin',sysdate(),'登录页可视化配置（文案/颜色/布局）'),
(2301,'登录页配置保存',2300,1,'',NULL,'',NULL,1,0,'F','0','0',
 'system:loginconfig:edit','#','admin',sysdate(),'登录页配置保存/JSON 导入');

COMMIT;
