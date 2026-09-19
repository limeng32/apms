-- =====================================================================
-- patch: 0.0.2 变更：apms_athlete 成年身高预测 3 列 + APMS 业务字典 + APMS 菜单
-- ---------------------------------------------------------------------
-- 适用库：apms（生产）/ apms-uat（UAT 共用本脚本，deploy 按 apms_db_version 去重）
-- 幂等性：DDL 用 information_schema 判断后再加列；DML 固定 ID 区段先删后插，可重复执行
-- 说明  ：admin 为超管走 *:*:* 通配权限，无需写 sys_role_menu
--         根菜单 2200 的 is_frame 必须为 1（后端据此生成 '/apms'，为 0 会导致前端路由异常）
-- =====================================================================

SET NAMES utf8mb4;

-- ===== 1. DDL：apms_athlete 新增成年身高预测 3 列（MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，逐列判断）=====

SET @c := (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'apms_athlete'
             AND column_name = 'predicted_adult_height');
SET @s := IF(@c = 0,
  'ALTER TABLE `apms_athlete` ADD COLUMN `predicted_adult_height` DECIMAL(5,1) NULL COMMENT ''Khamis-Roche 预测成年身高 cm''',
  'SELECT ''[skip] predicted_adult_height already exists'' AS msg');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'apms_athlete'
             AND column_name = 'adult_height_algo');
SET @s := IF(@c = 0,
  'ALTER TABLE `apms_athlete` ADD COLUMN `adult_height_algo` VARCHAR(32) NULL COMMENT ''成年身高算法标识''',
  'SELECT ''[skip] adult_height_algo already exists'' AS msg');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'apms_athlete'
             AND column_name = 'adult_height_calc_date');
SET @s := IF(@c = 0,
  'ALTER TABLE `apms_athlete` ADD COLUMN `adult_height_calc_date` DATE NULL COMMENT ''成年身高预测计算日期''',
  'SELECT ''[skip] adult_height_calc_date already exists'' AS msg');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ===== 2. DML：字典 + 菜单（固定 ID 区段，先删后插，事务内执行）=====
START TRANSACTION;

-- 2.1 字典类型（4 条）
DELETE FROM `sys_dict_type` WHERE `dict_id` IN (100,103,104,105);
INSERT INTO `sys_dict_type`
(`dict_id`,`dict_name`,`dict_type`,`status`,`create_by`,`create_time`,`remark`) VALUES
(100,'部门类型',    'apms_dept_type',     '0','admin',sysdate(),'APMS 组织层级'),
(103,'医疗记录类型','apms_medical_type',  '0','admin',sysdate(),'APMS 医疗附件分类'),
(104,'球员位置',    'apms_position',      '0','admin',sysdate(),'APMS 场上位置'),
(105,'运动员状态',  'apms_athlete_status','0','admin',sysdate(),'APMS 在队状态');

-- 2.2 字典数据（去重后 19 条；apms_dept_type 早期重复种子只保留 5 条）
DELETE FROM `sys_dict_data` WHERE `dict_code` BETWEEN 100 AND 123;
INSERT INTO `sys_dict_data`
(`dict_code`,`dict_sort`,`dict_label`,`dict_value`,`dict_type`,`css_class`,`list_class`,`is_default`,`status`,`create_by`,`create_time`,`remark`) VALUES
(100,1,'机构',    '10','apms_dept_type',   '','info',   'N','0','admin',sysdate(),NULL),
(101,2,'队伍',    '20','apms_dept_type',   '','success','N','0','admin',sysdate(),NULL),
(102,3,'训练小组','30','apms_dept_type',   '','primary','N','0','admin',sysdate(),NULL),
(103,4,'科研小组','40','apms_dept_type',   '','warning','N','0','admin',sysdate(),NULL),
(104,5,'恢复小组','50','apms_dept_type',   '','danger', 'N','0','admin',sysdate(),NULL),
(110,1,'MRI检查','MRI','apms_medical_type','','danger', 'N','0','admin',sysdate(),NULL),
(111,2,'CT检查', 'CT', 'apms_medical_type','','warning','N','0','admin',sysdate(),NULL),
(112,3,'超声检查','US','apms_medical_type','','info',   'N','0','admin',sysdate(),NULL),
(113,4,'X光检查','XRAY','apms_medical_type','','info',  'N','0','admin',sysdate(),NULL),
(114,5,'血液检验','LAB','apms_medical_type','','primary','N','0','admin',sysdate(),NULL),
(115,6,'康复评估','REHAB','apms_medical_type','','success','N','0','admin',sysdate(),NULL),
(116,7,'其他',  'OTHER','apms_medical_type','','',      'N','0','admin',sysdate(),NULL),
(117,1,'门将','GK','apms_position','','primary','N','0','admin',sysdate(),NULL),
(118,2,'后卫','DF','apms_position','','success','N','0','admin',sysdate(),NULL),
(119,3,'中场','MF','apms_position','','info',   'N','0','admin',sysdate(),NULL),
(120,4,'前锋','FW','apms_position','','warning','N','0','admin',sysdate(),NULL),
(121,1,'在队','0','apms_athlete_status','','success','Y','0','admin',sysdate(),NULL),
(122,2,'离队','1','apms_athlete_status','','info',   'N','0','admin',sysdate(),NULL),
(123,3,'退役','2','apms_athlete_status','','danger', 'N','0','admin',sysdate(),NULL);

-- 2.3 APMS 菜单（根 2200 is_frame=1；component 与前端 views 目录一一对应）
DELETE FROM `sys_role_menu` WHERE `menu_id` BETWEEN 2200 AND 2299;
DELETE FROM `sys_menu`      WHERE `menu_id` BETWEEN 2200 AND 2299;
INSERT INTO `sys_menu`
(`menu_id`,`menu_name`,`parent_id`,`order_num`,`path`,`component`,`query`,`route_name`,
 `is_frame`,`is_cache`,`menu_type`,`visible`,`status`,`perms`,`icon`,`create_by`,`create_time`,`remark`) VALUES
(2200,'APMS 运动员表现管理',0, 5,'apms',      NULL,                          '',NULL,1,0,'M','0','0','',                      'star',         'admin',sysdate(),'APMS 顶级目录'),
(2201,'总览看板',    2200, 1,'dashboard',  'apms/dashboard/index',        '',NULL,1,0,'C','0','0','',                      'dashboard',    'admin',sysdate(),NULL),
(2210,'运动员档案',  2200, 2,'athlete',    'apms/athlete/index',          '',NULL,1,0,'C','0','0','apms:athlete:list',     'user',         'admin',sysdate(),NULL),
(2231,'指标库',      2200, 3,'indicator',  'apms/indicator/index',        '',NULL,1,0,'C','0','0','apms:indicator:list',   'list',         'admin',sysdate(),NULL),
(2232,'测试模型库',  2200, 4,'testModel',  'apms/testModel/index',        '',NULL,1,0,'C','0','0','apms:testModel:list',   'build',        'admin',sysdate(),NULL),
(2241,'测试任务',    2200, 5,'testTask',   'apms/testTask/index',         '',NULL,1,0,'C','0','0','apms:testTask:list',    'date',         'admin',sysdate(),NULL),
(2242,'测试结果',    2200, 6,'testResult', 'apms/testResult/index',       '',NULL,1,0,'C','0','0','apms:testResult:list',  'edit',         'admin',sysdate(),NULL),
(2251,'体态测量',    2200, 7,'bodyMeasure','apms/bodyMeasure/index',      '',NULL,1,0,'C','0','0','apms:body:list',        'people',       'admin',sysdate(),NULL),
(2252,'PHV 成熟度',  2200, 8,'phv',        'apms/phv/index',              '',NULL,1,0,'C','0','0','apms:phv:list',         'chart',        'admin',sysdate(),NULL),
(2261,'RTP 风险预警',2200, 9,'rtp',        'apms/rtp/index',              '',NULL,1,0,'C','0','0','apms:rtp:list',         'monitor',      'admin',sysdate(),NULL),
(2262,'组合模型',    2200,10,'comboModel', 'apms/comboModel/index',       '',NULL,1,0,'C','0','0','apms:comboModel:list',  'build',        'admin',sysdate(),NULL),
(2263,'组合体能评分',2200,11,'comboScore', 'apms/comboScore/index',       '',NULL,1,0,'C','0','0','apms:comboScore:list', 'star',         'admin',sysdate(),NULL),
(2271,'医疗记录',    2200,12,'medical',    'apms/medical/index',          '',NULL,1,0,'C','0','0','apms:medicalRecord:list','documentation','admin',sysdate(),NULL),
(2281,'报告中心',    2200,13,'report',     'apms/report/index',           '',NULL,1,0,'C','0','0','apms:report:list',      'form',         'admin',sysdate(),NULL);

COMMIT;
