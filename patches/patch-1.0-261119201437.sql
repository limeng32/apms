-- ======================================================================
-- patch-1.0-261119201437
-- 修复 APMS 业务字典重复（新增部门「部门类型」下拉选项翻倍的根因）：
--   .trae/sql/apms_schema.sql 早期以自增 id 播种字典，与 patch-0.0.2 的固定
--   区段播种（sys_dict_data dict_code 100-123）id 不重叠；建库脚本被重复执行后
--   残留行无法被 patch-0.0.2 的 "DELETE ... BETWEEN 100 AND 123" 清掉，
--   实测 apms-dev 中 apms_dept_type 每个 dict_value 各有 2 行
--   （规范行 100-104 + 残留行 105-109）。
-- 处理（与具体环境的残留 id 无关，通用组内去重）：
--   1) sys_dict_data：同 (dict_type, dict_value) 只保留 dict_code 最小的一条；
--   2) sys_dict_type：同 dict_type 只保留 dict_id 最小的一条（防御性，dev 实测无重复）。
-- 幂等：重复执行时已无重复分组，DELETE 影响 0 行，可安全重放。
-- 缓存：补丁后须清理 Redis 字典缓存 sys_dict:*——随版本发版时 deploy 的
--   flush_redis_keep 会自动清理；手工热修后执行
--   redis-cli --scan --pattern 'sys_dict:*' | xargs redis-cli del，
--   或在「系统管理→字典管理」点刷新缓存，否则前端仍读到旧缓存。
-- ======================================================================

SET NAMES utf8mb4;

-- 1. sys_dict_data 去重：覆盖 patch-0.0.2 引入的 4 个 APMS 字典。
--    自连接保留每组最小 dict_code（dev 库即保留规范行 100-104/110-123），
--    删除同 dict_type + dict_value 的其余重复行。
DELETE d
FROM `sys_dict_data` d
JOIN `sys_dict_data` k
  ON d.`dict_type` = k.`dict_type`
 AND d.`dict_value` = k.`dict_value`
 AND d.`dict_code` > k.`dict_code`
WHERE d.`dict_type` IN (
  'apms_dept_type',
  'apms_medical_type',
  'apms_position',
  'apms_athlete_status'
);

-- 2. sys_dict_type 防御性去重：建库脚本同样对字典类型做过无固定 id 播种，
--    其他环境可能存在同 dict_type 多行；保留最小 dict_id。
DELETE t
FROM `sys_dict_type` t
JOIN `sys_dict_type` k
  ON t.`dict_type` = k.`dict_type`
 AND t.`dict_id` > k.`dict_id`
WHERE t.`dict_type` IN (
  'apms_dept_type',
  'apms_medical_type',
  'apms_position',
  'apms_athlete_status'
);

-- 3. 验收查询（手工执行时核对，预期每个 dict_type 行数：5/7/4/3 且无重复 value）：
-- SELECT dict_type, COUNT(*) FROM sys_dict_data
-- WHERE dict_type IN ('apms_dept_type','apms_medical_type','apms_position','apms_athlete_status')
-- GROUP BY dict_type ORDER BY dict_type;
