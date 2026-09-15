-- APMS 运动员档案扩展：字典、菜单、权限
USE `ry-vue`;

-- 1. 球员位置字典
INSERT IGNORE INTO sys_dict_type (
    dict_name, dict_type, status, create_by, create_time, remark
) VALUES (
    '球员位置', 'apms_position', '0', 'admin', sysdate(), 'APMS 场上位置'
);

INSERT IGNORE INTO sys_dict_data (
    dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark
) VALUES
(1, '门将', 'GK', 'apms_position', '', 'primary', 'N', '0', 'admin', sysdate(), NULL),
(2, '后卫', 'DF', 'apms_position', '', 'success', 'N', '0', 'admin', sysdate(), NULL),
(3, '中场', 'MF', 'apms_position', '', 'info',    'N', '0', 'admin', sysdate(), NULL),
(4, '前锋', 'FW', 'apms_position', '', 'warning', 'N', '0', 'admin', sysdate(), NULL);

-- 2. 运动员状态字典
INSERT IGNORE INTO sys_dict_type (
    dict_name, dict_type, status, create_by, create_time, remark
) VALUES (
    '运动员状态', 'apms_athlete_status', '0', 'admin', sysdate(), 'APMS 在队状态'
);

INSERT IGNORE INTO sys_dict_data (
    dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark
) VALUES
(1, '在队', '0', 'apms_athlete_status', '', 'success', 'Y', '0', 'admin', sysdate(), NULL),
(2, '离队', '1', 'apms_athlete_status', '', 'info',    'N', '0', 'admin', sysdate(), NULL),
(3, '退役', '2', 'apms_athlete_status', '', 'danger',  'N', '0', 'admin', sysdate(), NULL);

-- 3. APMS 菜单（顶级目录 + 日常管理子菜单）
-- 假设菜单 ID 2000+ 是 APMS 专用区段
INSERT IGNORE INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark) VALUES
-- APMS 顶级目录
(2000, 'APMS', 0, 5, 'apms', NULL, NULL, 1, 0, 'M', '0', '0', '', 'star', 'admin', sysdate(), 'APMS 顶级目录'),
-- 日常管理
(2010, '日常管理', 2000, 1, 'daily', NULL, NULL, 1, 0, 'M', '0', '0', '', 'date', 'admin', sysdate(), NULL),
-- 队员档案
(2011, '队员档案', 2010, 1, 'athlete', 'apms/athlete/index', NULL, 1, 0, 'C', '0', '0', 'apms:athlete:list', 'user', 'admin', sysdate(), '队员档案列表');

-- 队员档案的 5 个权限点（按钮级权限）
INSERT IGNORE INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query, is_frame, is_cache, menu_type, visible, status, perms, icon, create_by, create_time, remark) VALUES
(2101, '队员查询', 2011, 1, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:athlete:query',  '#', 'admin', sysdate(), NULL),
(2102, '队员新增', 2011, 2, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:athlete:add',    '#', 'admin', sysdate(), NULL),
(2103, '队员修改', 2011, 3, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:athlete:edit',   '#', 'admin', sysdate(), NULL),
(2104, '队员删除', 2011, 4, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:athlete:remove', '#', 'admin', sysdate(), NULL),
(2105, '队员导出', 2011, 5, '', NULL, NULL, 1, 0, 'F', '0', '0', 'apms:athlete:export', '#', 'admin', sysdate(), NULL);

-- 4. 给 admin 角色全部 5 个权限点
INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES
(1, 2000), (1, 2010), (1, 2011), (1, 2101), (1, 2102), (1, 2103), (1, 2104), (1, 2105);
