-- ======================================================================
-- dev-seed-rtp-risk.sql（仅 dev 演示用，不进 patches/ 补丁链）
-- 基准日期：2026-10-05。制造 7 种预警场景：
--   1003 王浩然  surgery 09-12 未闭环 → WARNING（建议红，当前 g，可采纳升级）
--   1004 陈嘉宇  injury 09-22 未闭环  → ATTENTION（建议黄，但当前 r，按钮置灰演示不降级）
--   1006 赵天明  injury 09-18 未闭环  → ATTENTION（建议黄，当前 g，可采纳）
--   1009 吴俊杰  PHV 峰期            → 健康 INFO（只能知悉/忽略）
--   1010 郑博文  复检逾期 + PHV 峰期 → INFO 但健康分仅 1、逾期 urgency 置顶（演示双维度隔离）
--   1011 冯思源  复检逾期 14 天       → 纯流程待办（健康分 0，灰蓝徽标）
--   1012 许俊豪  复检 7 天后到期      → 纯流程待办（REVIEW_SOON）
-- 配套：INJURY_OPEN 权重临时调为 3.00（severity 2 × 3 = 6 才能达到 ATTENTION；
--       一期默认权重下非手术伤病最高 3 分只能到 INFO）。
-- 幂等：带 dev-seed 标记的行先删后插；复检日只重置被本脚本改过的 3 人；权重可一键还原。
-- 清理：执行本文件末尾的「== 清理段 ==」即可完全还原。
-- ======================================================================

SET NAMES utf8mb4;

-- ---------- 清理旧种子（支持重复执行） ----------
DELETE FROM apms_medical_record WHERE institution = 'DEV_SEED_RTP_RISK';
DELETE FROM apms_phv_record     WHERE create_by = 'dev-seed';
-- 这三人原本 next_review_date 均为 NULL，还原之
UPDATE apms_rtp_status SET next_review_date = NULL
 WHERE athlete_id IN (1010, 1011, 1012) AND next_review_date IN ('2026-09-25','2026-09-21','2026-10-12');
-- 清掉当日演示扫描产生的快照，便于重新扫描
DELETE FROM apms_rtp_risk_snapshot WHERE snapshot_date = '2026-10-05' AND create_by IN ('scan','admin');

-- ---------- 伤病（引擎取最近一条 injury/surgery，且其后无 rehab/checkup） ----------
INSERT INTO apms_medical_record
  (athlete_id, record_type, record_date, institution, title, remark, create_by, create_time)
VALUES
  (1003, 'surgery', '2026-09-12', 'DEV_SEED_RTP_RISK', '右膝半月板关节镜手术（演示）',
   'dev 种子：术后未录入康复/复查，用于触发 WARNING forceWarning', 'dev-seed', NOW()),
  (1004, 'injury',  '2026-09-22', 'DEV_SEED_RTP_RISK', '右大腿后群肌拉伤（演示）',
   'dev 种子：当前 RTP 已为 r，建议黄时应拦截降级', 'dev-seed', NOW()),
  (1006, 'injury',  '2026-09-18', 'DEV_SEED_RTP_RISK', '踝关节扭伤 II 度（演示）',
   'dev 种子：未录入康复/复查，用于触发 ATTENTION 采纳黄', 'dev-seed', NOW());

-- ---------- PHV（|maturity_offset| <= 0.5 且 180 天内） ----------
INSERT INTO apms_phv_record
  (athlete_id, gender, measure_date, decimal_age, height, sit_height, weight, leg_length,
   maturity_offset, predicted_phv_age, mirwald_version, create_by, create_time)
VALUES
  (1009, '0', '2026-09-20', 14.3200, 168.2, 88.4, 55.6, 79.8,
   0.2000, 14.1200, 'dev-seed-1.0', 'dev-seed', NOW()),
  (1010, '0', '2026-09-25', 14.6100, 171.0, 89.8, 58.2, 81.2,
   -0.3000, 14.9100, 'dev-seed-1.0', 'dev-seed', NOW());

-- ---------- 复检日（逾期 / 临近 / 逾期+健康因子组合） ----------
UPDATE apms_rtp_status SET next_review_date = '2026-09-25' WHERE athlete_id = 1010; -- 逾期 10 天
UPDATE apms_rtp_status SET next_review_date = '2026-09-21' WHERE athlete_id = 1011; -- 逾期 14 天
UPDATE apms_rtp_status SET next_review_date = '2026-10-12' WHERE athlete_id = 1012; -- 7 天后到期

-- ---------- 规则校准（仅 dev 演示黄/红双档） ----------
UPDATE apms_rtp_risk_rule SET weight = 3.00, update_by = 'dev-seed', update_time = NOW()
 WHERE rule_code = 'INJURY_OPEN' AND weight = 1.00;

-- ======================================================================
-- == 清理段（演示结束后执行；也可整段重跑本文件，开头的清理会先执行） ==
-- ======================================================================
-- DELETE FROM apms_medical_record WHERE institution = 'DEV_SEED_RTP_RISK';
-- DELETE FROM apms_phv_record     WHERE create_by = 'dev-seed';
-- UPDATE apms_rtp_status SET next_review_date = NULL
--  WHERE athlete_id IN (1010, 1011, 1012);
-- DELETE FROM apms_rtp_risk_snapshot WHERE snapshot_date = '2026-10-05';
-- UPDATE apms_rtp_risk_rule SET weight = 1.00, update_by = 'admin', update_time = NOW()
--  WHERE rule_code = 'INJURY_OPEN' AND update_by = 'dev-seed';
