-- ======================================================================
-- patch-0.0.7-261011190000
-- 数值录入合理区间字典（体态测量 + 成绩指标）
--
-- 背景：体态测量/成绩录入此前无范围校验，身高 24cm 等异常值可直接入库。
--       区间不写死在代码里，改由系统字典配置，管理员可在
--       「系统管理 → 字典管理」调整，无需改代码发版。
--
-- 字典约定：
--   apms_measure_range   体态测量字段区间，dict_value=字段名
--   apms_indicator_range 成绩指标录入区间，dict_value=指标编码（本次只建类型，
--                        由管理员按需配置；未配置的指标仅做数字格式校验）
--   remark 存 JSON：{"hardMin":..,"hardMax":..,"warnMin":..,"warnMax":..}
--     hard* = 物理硬限：超出直接拒绝（前后端双层拦截，后端兜底不可绕过）
--     warn* = 合理区间：超出时前端弹确认框，确认后可保存，列表中标红提醒
--
-- 默认区间（13–18 岁运动员口径，单位见标签）：
--   身高 cm   hard 50–250 / warn 100–220
--   体重 kg   hard 10–200 / warn 30–150
--   坐高 cm   hard 30–150 / warn 55–120
--   体脂率 %  hard 2–60   / warn 5–35
--   腰围 cm   hard 30–200 / warn 45–130
--
-- 幂等：固定 ID 先删后插，可重复执行；重复执行会把管理员在库里对区间 JSON
--       的手工调整覆盖回默认值（标签/排序调整不受影响），如需仅补缺可改为
--       INSERT IGNORE——发版补丁保持收敛默认的口径。
-- ======================================================================

SET NAMES utf8mb4;

START TRANSACTION;

-- 1. 字典类型（106/107）
DELETE FROM `sys_dict_type` WHERE `dict_id` IN (106, 107);
INSERT INTO `sys_dict_type`
(`dict_id`,`dict_name`,`dict_type`,`status`,`create_by`,`create_time`,`remark`) VALUES
(106,'体态测量合理区间','apms_measure_range',  '0','admin',sysdate(),'录入硬限(hard)/合理区间(warn)，remark 为 JSON'),
(107,'成绩指标录入区间','apms_indicator_range','0','admin',sysdate(),'按指标编码配置录入硬限/合理区间，remark 为 JSON');

-- 2. 体态测量默认区间（130–134）
DELETE FROM `sys_dict_data` WHERE `dict_code` BETWEEN 130 AND 139;
INSERT INTO `sys_dict_data`
(`dict_code`,`dict_sort`,`dict_label`,`dict_value`,`dict_type`,`css_class`,`list_class`,`is_default`,`status`,`create_by`,`create_time`,`remark`) VALUES
(130,1,'身高(cm)',  'height',      'apms_measure_range','','','N','0','admin',sysdate(),
 '{"hardMin":50,"hardMax":250,"warnMin":100,"warnMax":220}'),
(131,2,'体重(kg)',  'weight',      'apms_measure_range','','','N','0','admin',sysdate(),
 '{"hardMin":10,"hardMax":200,"warnMin":30,"warnMax":150}'),
(132,3,'坐高(cm)',  'sitHeight',   'apms_measure_range','','','N','0','admin',sysdate(),
 '{"hardMin":30,"hardMax":150,"warnMin":55,"warnMax":120}'),
(133,4,'体脂率(%)', 'bodyFatRate', 'apms_measure_range','','','N','0','admin',sysdate(),
 '{"hardMin":2,"hardMax":60,"warnMin":5,"warnMax":35}'),
(134,5,'腰围(cm)',  'waist',       'apms_measure_range','','','N','0','admin',sysdate(),
 '{"hardMin":30,"hardMax":200,"warnMin":45,"warnMax":130}');

COMMIT;

-- 3. 字典缓存由后端在下次读取时自动回源并回填（DictUtils 未命中查库），
--    也可手工执行：DELETE FROM sys_dict_data 对应缓存或重启/调字典刷新接口。

-- ======================================================================
-- 验收查询
-- ======================================================================
-- SELECT dict_label, dict_value, remark FROM sys_dict_data
--  WHERE dict_type = 'apms_measure_range' ORDER BY dict_sort;
-- SELECT dict_id, dict_name, dict_type FROM sys_dict_type WHERE dict_id IN (106,107);
