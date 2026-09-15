-- ============================================================
-- P3 测试结果 — 种子数据
-- 1. indicator_ref + indicator_ref_level （REP 参照系）
-- 2. test_result + test_result_value + test_result_rep
-- ============================================================

SET NAMES utf8mb4;

-- ================ Part 1: 参照系 ================
-- 3 个核心指标 × 男 × U18 基准群体
INSERT INTO apms_indicator_ref (id, indicator_id, gender, age_group, dept_id, ref_min, ref_max, model_version) VALUES
(1, 3, 'M', 'U18', 0, 3.5000, 5.0000, 'v1.0'),   -- SPRINT_30M
(2, 4, 'M', 'U18', 0, 30.0000, 80.0000, 'v1.0'),  -- VJUMP
(3, 5, 'M', 'U18', 0, 0.0000, 20.0000, 'v1.0');   -- RSA_10X20

-- 4 级分档（数值区间，Service 层按 direction 判断优劣）
-- SPRINT_30M (LOWER_BETTER) → 越小越好
INSERT INTO apms_indicator_ref_level (ref_id, level, min_value, max_value) VALUES
(1, 'Excellent', 3.5000, 3.9000),  -- 顶级
(1, 'Good',      3.9000, 4.2000),  -- 良好
(1, 'Normal',    4.2000, 4.5000),  -- 正常
(1, 'Poor',      4.5000, 5.0000);  -- 需加强

-- VJUMP (HIGHER_BETTER) → 越大越好
INSERT INTO apms_indicator_ref_level (ref_id, level, min_value, max_value) VALUES
(2, 'Excellent', 65.0000, 80.0000),
(2, 'Good',      55.0000, 65.0000),
(2, 'Normal',    45.0000, 55.0000),
(2, 'Poor',      30.0000, 45.0000);

-- RSA_10X20 Sdec (LOWER_BETTER) → 越小越好
INSERT INTO apms_indicator_ref_level (ref_id, level, min_value, max_value) VALUES
(3, 'Excellent', 0.0000, 3.0000),
(3, 'Good',      3.0000, 6.0000),
(3, 'Normal',    6.0000, 10.0000),
(3, 'Poor',      10.0000, 20.0000);


-- ================ Part 2: 测试结果 ================
-- Task #1 (冬季体能测试) 成员: 刘子轩(1005), 周泽霖(1008), 孙宇辰(1007), 张志远(1001)
-- Task Item:
--   #1 SPRINT_30M (INDICATOR, indicator_id=3)
--   #2 VJUMP       (INDICATOR, indicator_id=4)
--   #3 RSA_10X20   (INDICATOR, indicator_id=5)
--   #4 YOYO_IR1    (MODEL, model_id=1)

-- -------- 刘子轩 (1005) — 全面良好 --------
-- Sprint 3.95s → Good
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(1, 1, 1, 1005, 3, NULL, 'T1-A1005-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(1, 1, 3, 'result', '30米冲刺成绩', 3.9500, 's', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(1, 1, 'result', 2, 3.9500, 's');  -- Good=2

-- VJUMP 62cm → Good (第二档)
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(2, 1, 2, 1005, 4, NULL, 'T1-A1005-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(2, 2, 4, 'result', '纵跳高度', 62.0000, 'cm', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(2, 2, 'result', 2, 62.0000, 'cm');  -- Good=2

-- RSA Sdec 4.2% → Good
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source, raw_payload) VALUES
(3, 1, 3, 1005, 5, NULL, 'T1-A1005-S1', '2024-12-12', 1, '1', '1', 'manual', '{"sprint_times":[4.12,4.08,4.15,4.20,4.18,4.22,4.25,4.20,4.30,4.28]}');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(3, 3, 5, 'sdec', 'Sdec衰减率', 4.2000, '%', '1'),
(4, 3, 5, 'best_time', '最佳冲刺', 4.0800, 's', '1'),
(5, 3, 5, 'mean_time', '平均冲刺', 4.1980, 's', '1');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(3, 3, 'sdec', 2, 4.2000, '%');  -- Good=2

-- YOYO IR1 MODEL
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(4, 1, 4, 1005, NULL, 1, 'T1-A1005-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, model_id, field_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
-- field_id 引用 model_field 表: shuttle_distance=1, level_reached=2, total_shuttles=3, total_distance=4, estimated_vo2max=5
(6, 4, 1, 1, 'shuttle_distance', '折返距离', 20.0000, 'm', '0'),
(7, 4, 1, 2, 'level_reached', '达到级别', 16.0000, '', '0'),
(8, 4, 1, 3, 'total_shuttles', '总Shuttle数', 40.0000, '', '0'),
(9, 4, 1, 4, 'total_distance', '总距离', 1600.0000, 'm', '1'),
(10, 4, 1, 5, 'estimated_vo2max', '估算VO₂max', 52.3000, 'ml/kg/min', '1');


-- -------- 周泽霖 (1008) — 顶尖 --------
-- Sprint 3.72s → Excellent (第1档)
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(5, 1, 1, 1008, 3, NULL, 'T1-A1008-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(11, 5, 3, 'result', '30米冲刺成绩', 3.7200, 's', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(4, 5, 'result', 1, 3.7200, 's');

-- VJUMP 71cm → Excellent
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(6, 1, 2, 1008, 4, NULL, 'T1-A1008-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(12, 6, 4, 'result', '纵跳高度', 71.0000, 'cm', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(5, 6, 'result', 1, 71.0000, 'cm');

-- RSA Sdec 2.1% → Excellent
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(7, 1, 3, 1008, 5, NULL, 'T1-A1008-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(13, 7, 5, 'sdec', 'Sdec衰减率', 2.1000, '%', '1');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(6, 7, 'sdec', 1, 2.1000, '%');


-- -------- 孙宇辰 (1007) — 中等 --------
-- Sprint 4.31s → Normal (第3档)
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(8, 1, 1, 1007, 3, NULL, 'T1-A1007-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(14, 8, 3, 'result', '30米冲刺成绩', 4.3100, 's', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(7, 8, 'result', 3, 4.3100, 's');

-- VJUMP 48cm → Normal (第3档)
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(9, 1, 2, 1007, 4, NULL, 'T1-A1007-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(15, 9, 4, 'result', '纵跳高度', 48.0000, 'cm', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(8, 9, 'result', 3, 48.0000, 'cm');


-- -------- 张志远 (1001) — 良好 --------
-- VJUMP 58cm → Good (第2档)
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(10, 1, 2, 1001, 4, NULL, 'T1-A1001-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(16, 10, 4, 'result', '纵跳高度', 58.0000, 'cm', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(9, 10, 'result', 2, 58.0000, 'cm');

-- RSA Sdec 5.8% → Good
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(11, 1, 3, 1001, 5, NULL, 'T1-A1001-S1', '2024-12-12', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(17, 11, 5, 'sdec', 'Sdec衰减率', 5.8000, '%', '1');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(10, 11, 'sdec', 2, 5.8000, '%');


-- -------- 多 attempt 示例：陈嘉宇 (1004) Sprint 试了3次 --------
-- attempt_no=2 最佳 3.88s (Good), is_selected='1'; 其他两次 is_selected='0'
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(12, 1, 1, 1004, 3, NULL, 'T1-A1004-S1', '2024-12-13', 1, '1', '0', 'manual'),
(13, 1, 1, 1004, 3, NULL, 'T1-A1004-S1', '2024-12-13', 2, '1', '1', 'manual'),
(14, 1, 1, 1004, 3, NULL, 'T1-A1004-S1', '2024-12-13', 3, '1', '0', 'manual');
INSERT INTO apms_test_result_value (id, result_id, indicator_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
(18, 12, 3, 'result', '第1次', 4.0200, 's', '0'),
(19, 13, 3, 'result', '第2次(最佳)', 3.8800, 's', '0'),
(20, 14, 3, 'result', '第3次', 3.9600, 's', '0');
INSERT INTO apms_test_result_rep (id, result_id, field_key, rep_no, value, unit) VALUES
(11, 12, 'result', 2, 4.0200, 's'),   -- 未选中也存REP，展示用
(12, 13, 'result', 2, 3.8800, 's'),   -- 选中
(13, 14, 'result', 2, 3.9600, 's');


-- -------- Task #3 CMJ 力量测试 (task_item_id=9: model_id=3 T_TEST) --------
-- 刘子轩 (1005) T-Test
INSERT INTO apms_test_result (id, task_id, task_item_id, athlete_id, indicator_id, model_id, session_key, measure_date, attempt_no, is_valid, is_selected, data_source) VALUES
(15, 3, 9, 1005, NULL, 3, 'T3-A1005-S1', '2024-12-18', 1, '1', '1', 'manual');
INSERT INTO apms_test_result_value (id, result_id, model_id, field_id, field_key, field_name, numeric_value, unit, is_derived) VALUES
-- T_TEST fields: time=20, trial_count=21, best_time=22
(21, 15, 3, 20, 'time', '完成时间', 9.8000, 's', '0'),
(22, 15, 3, 21, 'trial_count', '测试次数', 3.0000, '', '0'),
(23, 15, 3, 22, 'best_time', '最佳时间', 9.5000, 's', '1');


-- ================ 验证种子 ================
SELECT 'indicator_ref:' AS info;
SELECT r.id, i.code, r.gender, r.age_group FROM apms_indicator_ref r JOIN apms_indicator i ON r.indicator_id = i.id;
SELECT 'indicator_ref_level:' AS info;
SELECT COUNT(*) AS total_levels FROM apms_indicator_ref_level;
SELECT 'test_result:' AS info;
SELECT COUNT(*) AS total_results FROM apms_test_result;
SELECT 'test_result_value:' AS info;
SELECT COUNT(*) AS total_values FROM apms_test_result_value;
SELECT 'test_result_rep:' AS info;
SELECT COUNT(*) AS total_reps FROM apms_test_result_rep;

-- 按 athlete + item 查看是否有多 attempt
SELECT t.athlete_id, a.name, t.task_item_id, t.attempt_no, t.is_selected
FROM apms_test_result t JOIN apms_athlete a ON t.athlete_id = a.athlete_id
WHERE t.task_id = 1 ORDER BY a.name, t.task_item_id, t.attempt_no;
