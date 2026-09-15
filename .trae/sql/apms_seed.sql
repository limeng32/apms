-- APMS 种子数据（演示用，覆盖 admin 看板所需的全部数据）
USE `ry-vue`;

-- 1. 队伍部门（sys_dept 扩展 dept_type）
INSERT IGNORE INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, leader, phone, email, status, del_flag, create_by, create_time, dept_type) VALUES
(200, 100, '0,100', 'APMS 总部', 10, '管理员', '15888888888', 'admin@apms.com', '0', '0', 'admin', sysdate(), '10'),
(201, 200, '0,100,200', 'U18 梯队', 1, '李教练', '15900000001', 'coach.li@apms.com', '0', '0', 'admin', sysdate(), '20'),
(202, 200, '0,100,200', 'U16 梯队', 2, '王教练', '15900000002', 'coach.wang@apms.com', '0', '0', 'admin', sysdate(), '20'),
(203, 201, '0,100,200,201', '速度专项组', 1, NULL, NULL, NULL, '0', '0', 'admin', sysdate(), '30'),
(204, 201, '0,100,200,201', '康复组', 2, NULL, NULL, NULL, '0', '0', 'admin', sysdate(), '50'),
(205, 202, '0,100,200,202', '力量组', 1, NULL, NULL, NULL, '0', '0', 'admin', sysdate(), '30');

-- 2. 运动员档案
INSERT IGNORE INTO apms_athlete (athlete_id, jersey_no, name, gender, birthday, primary_team_id, position, status, create_by, create_time) VALUES
(1001, '10', '张志远', 'M', '2009-03-15', 201, '中场', '0', 'admin', sysdate()),
(1002, '7',  '李铭昊', 'M', '2009-05-22', 201, '前锋', '0', 'admin', sysdate()),
(1003, '4',  '王浩然', 'M', '2009-07-10', 201, '后卫', '0', 'admin', sysdate()),
(1004, '23', '陈嘉宇', 'M', '2009-01-08', 201, '门将', '0', 'admin', sysdate()),
(1005, '8',  '刘子轩', 'M', '2009-04-14', 201, '中场', '0', 'admin', sysdate()),
(1006, '11', '赵天明', 'M', '2008-11-25', 201, '前锋', '0', 'admin', sysdate()),
(1007, '5',  '孙宇辰', 'M', '2009-06-30', 201, '后卫', '0', 'admin', sysdate()),
(1008, '6',  '周泽霖', 'M', '2009-02-18', 201, '后卫', '0', 'admin', sysdate()),
(1009, '9',  '吴俊杰', 'M', '2008-12-05', 201, '前锋', '0', 'admin', sysdate()),
(1010, '3',  '郑博文', 'M', '2009-08-20', 201, '后卫', '0', 'admin', sysdate()),
(1011, '14', '冯思源', 'M', '2010-03-12', 202, '中场', '0', 'admin', sysdate()),
(1012, '17', '许俊豪', 'M', '2010-05-08', 202, '前锋', '0', 'admin', sysdate());

-- 3. 测试任务
INSERT IGNORE INTO apms_test_task (id, task_name, target_dept_id, tester_id, start_date, end_date, status) VALUES
(1, '冬季体能测试 · U18',     201, 1, '2026-12-10', '2026-12-20', 'IN_PROGRESS'),
(2, '康复评估专项 · 伤后归队', 204, 1, '2026-12-15', '2026-12-22', 'IN_PROGRESS'),
(3, 'CMJ 力量测试 · 全队',     200, 1, '2026-12-18', '2026-12-20', 'IN_PROGRESS'),
(4, '春季选拔测试',           200, 1, '2027-02-10', '2027-02-15', 'PENDING'),
(5, '秋季体能基线',           200, 1, '2026-09-01', '2026-09-10', 'COMPLETED'),
(6, '速度专项测试 · 速度组',   203, 1, '2026-11-01', '2026-11-05', 'COMPLETED'),
(7, 'PHV 生长发育监测 · 全队', 200, 1, '2026-12-01', '2026-12-31', 'COMPLETED');

-- 4. 任务成员（复合主键 task_id + athlete_id）
INSERT IGNORE INTO apms_task_member (task_id, athlete_id, status) VALUES
-- 任务 1: U18 冬季体能, 8/12
(1, 1001, 'completed'), (1, 1002, 'completed'), (1, 1003, 'completed'), (1, 1004, 'completed'),
(1, 1005, 'completed'), (1, 1006, 'completed'), (1, 1007, 'completed'), (1, 1008, 'completed'),
(1, 1009, 'pending'),   (1, 1010, 'pending'),   (1, 1011, 'pending'),   (1, 1012, 'pending'),
-- 任务 2: 康复评估, 3/4
(2, 1001, 'completed'), (2, 1002, 'completed'), (2, 1003, 'completed'), (2, 1004, 'partial'),
-- 任务 3: CMJ 力量, 10/12
(3, 1001, 'completed'), (3, 1002, 'completed'), (3, 1003, 'completed'), (3, 1004, 'completed'),
(3, 1005, 'completed'), (3, 1006, 'completed'), (3, 1007, 'completed'), (3, 1008, 'completed'),
(3, 1009, 'completed'), (3, 1010, 'completed'), (3, 1011, 'pending'),   (3, 1012, 'pending');

-- 5. RTP 状态
INSERT IGNORE INTO apms_rtp_status (athlete_id, status, reason, training_limit, next_review_date, updated_by, updated_time) VALUES
(1001, 'y', '踝关节外侧韧带轻度松弛', '限制冲刺',           '2026-12-30', 'rehab', sysdate()),
(1002, 'y', '腘绳肌轻度拉伤恢复期',   '限制长距离',         '2026-12-25', 'rehab', sysdate()),
(1003, 'y', '腰部肌肉紧张',           '限制大力量训练',     '2026-12-28', 'rehab', sysdate()),
(1004, 'r', '肩关节术后恢复期',       '不建议参与训练',     '2027-01-15', 'rehab', sysdate()),
(1005, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1006, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1007, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1008, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1009, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1010, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1011, 'g', NULL, NULL, NULL, 'rehab', sysdate()),
(1012, 'g', NULL, NULL, NULL, 'rehab', sysdate());

-- 6. 体态测量（本周 4 人次）
INSERT IGNORE INTO apms_body_measure (athlete_id, measure_date, height, weight, sit_height, data_source, create_by, create_time) VALUES
(1001, '2026-09-10', 175.2, 65.3, 92.0, 'manual', 'admin', sysdate()),
(1002, '2026-09-11', 178.5, 70.1, 93.5, 'manual', 'admin', sysdate()),
(1005, '2026-09-12', 172.0, 62.5, 90.0, 'manual', 'admin', sysdate()),
(1009, '2026-09-13', 180.0, 72.0, 94.0, 'manual', 'admin', sysdate());

-- 7. PHV 记录（本周 3 人次）
INSERT IGNORE INTO apms_phv_record (athlete_id, gender, measure_date, decimal_age, height, sit_height, weight, leg_length, maturity_offset, predicted_phv_age, mirwald_version, input_snapshot, create_by, create_time) VALUES
(1001, 'M', '2026-09-10', 17.6301, 175.2, 92.0, 65.3, 83.2, 1.4500, 16.1801, 'mirwald-v1-male', '{"age":17.6,"height":175.2,"weight":65.3,"sit_height":92.0,"leg_length":83.2}', 'admin', sysdate()),
(1002, 'M', '2026-09-11', 17.4253, 178.5, 93.5, 70.1, 85.0, 1.3200, 16.1053, 'mirwald-v1-male', '{"age":17.4,"height":178.5,"weight":70.1,"sit_height":93.5,"leg_length":85.0}', 'admin', sysdate()),
(1005, 'M', '2026-09-12', 17.2510, 172.0, 90.0, 62.5, 82.0, 1.1800, 16.0710, 'mirwald-v1-male', '{"age":17.2,"height":172.0,"weight":62.5,"sit_height":90.0,"leg_length":82.0}', 'admin', sysdate());
