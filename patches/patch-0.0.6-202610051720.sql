-- ======================================================================
-- patch-0.0.6-202610051720
-- 医疗记录新增「伤病部位」结构化字段（伤病部位分布人体热力图的数据基础）
--   1) apms_medical_record.body_site varchar(40)：仅 injury/surgery 使用，
--      取值为 19 个标准部位编码 + OTHER（躯干/上肢/下肢/其它，含左右侧），其余记录类型留空；
--   2) 蓝本种子伤病记录按标题精确匹配回填部位（仅影响种子数据，真实数据 0 行匹配）；
--   3) 活跃/已康复不设状态列：复用风险引擎闭环口径（其后存在康复/复查记录即已康复）。
-- 幂等：列存在守卫 + UPDATE 仅填空（body_site IS NULL），可重复执行。
-- ======================================================================

SET NAMES utf8mb4;
SET @db := DATABASE();

-- 1. 新增 body_site 列
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'apms_medical_record' AND COLUMN_NAME = 'body_site') = 0,
  'ALTER TABLE apms_medical_record ADD COLUMN body_site varchar(40) DEFAULT NULL COMMENT ''伤病部位编码（仅injury/surgery；19点位+OTHER）'' AFTER record_type',
  'SELECT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. 蓝本种子数据回填（标题精确匹配；生产真实记录不受影响）
UPDATE apms_medical_record SET body_site = 'THIGH_BACK_R'
 WHERE body_site IS NULL AND title = '右大腿股二头肌拉伤（Ⅱ级）' AND record_type = 'injury';
UPDATE apms_medical_record SET body_site = 'WRIST_L'
 WHERE body_site IS NULL AND title = '左手腕三角软骨盘轻微损伤' AND record_type = 'injury';
UPDATE apms_medical_record SET body_site = 'KNEE_R'
 WHERE body_site IS NULL AND title = '右膝内侧副韧带轻度拉伤' AND record_type = 'injury';
UPDATE apms_medical_record SET body_site = 'ANKLE_L'
 WHERE body_site IS NULL AND title = '左踝腓骨远端骨折内固定术' AND record_type = 'surgery';
UPDATE apms_medical_record SET body_site = 'KNEE_R'
 WHERE body_site IS NULL AND title = '右膝半月板关节镜手术（演示）' AND record_type = 'surgery';
UPDATE apms_medical_record SET body_site = 'THIGH_BACK_R'
 WHERE body_site IS NULL AND title = '右大腿后群肌拉伤（演示）' AND record_type = 'injury';
UPDATE apms_medical_record SET body_site = 'ANKLE_R'
 WHERE body_site IS NULL AND title = '踝关节扭伤 II 度（演示）' AND record_type = 'injury';

-- ======================================================================
-- 验收查询
--   SELECT record_type, body_site, record_date, title FROM apms_medical_record
--    WHERE record_type IN ('injury','surgery') ORDER BY record_date DESC;
-- ======================================================================
