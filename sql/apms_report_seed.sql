-- ============================================================
-- P5 PDF 报告 — 种子数据（3 条已生成报告 + 模拟 JSON 快照）
-- 真实部署通过 POST /apms/report/generate 生成
-- ============================================================

SET NAMES utf8mb4;
TRUNCATE TABLE apms_report;

-- Report #1: 周泽霖 单人综合报告（已通过 Service generate 生成）
INSERT INTO apms_report (id, report_type, athlete_id, dept_id, task_id, template_version, content_snapshot, file_path, generate_by, generate_time, create_by, create_time) VALUES
(1, 'INDIVIDUAL', 1008, NULL, NULL, 'v1.0',
 '{"athlete":{"name":"周泽霖","gender":"M","birthday":"2006-05-12","jerseyNo":"8","position":"Forward"},"rtpStatus":{"status":"g","reason":null},"results":[{"itemType":"INDICATOR","itemCode":"SPRINT_30M","itemName":"30米冲刺","direction":"LOWER_BETTER","mainValue":3.72,"repNo":1,"repLevel":"Excellent"},{"itemType":"INDICATOR","itemCode":"VJUMP","itemName":"纵跳高度","direction":"HIGHER_BETTER","mainValue":71.0,"repNo":1,"repLevel":"Excellent"},{"itemType":"INDICATOR","itemCode":"RSA_10X20","itemName":"RSA 10x20m Sdec","direction":"LOWER_BETTER","mainValue":2.1,"repNo":1,"repLevel":"Excellent"}],"medicalRecent":[],"summary":"All selected tests rated Excellent"}',
 'report/20260916_115800_周泽霖_individual.pdf',
 'admin', '2026-09-16 11:58:00', 'admin', NOW());

-- Report #2: Task #1 冬季体能测试 任务报告
INSERT INTO apms_report (id, report_type, athlete_id, dept_id, task_id, template_version, content_snapshot, file_path, generate_by, generate_time, create_by, create_time) VALUES
(2, 'TASK', NULL, NULL, 1, 'v1.0',
 '{"taskId":1,"taskName":"冬季体能测试 · U18","taskDate":"2024-12-10 ~ 2024-12-20","summary":"8/12 completed members. Excellent performance from 周泽霖 across all 3 indicators."}',
 'report/20260916_120000_Task_1_task.pdf',
 'admin', '2026-09-16 12:00:00', 'admin', NOW());

-- Report #3: U18 梯队 队伍汇总
INSERT INTO apms_report (id, report_type, athlete_id, dept_id, task_id, template_version, content_snapshot, file_path, generate_by, generate_time, create_by, create_time) VALUES
(3, 'TEAM', NULL, 201, NULL, 'v1.0',
 '{"deptId":201,"deptName":"U18 梯队","athleteCount":12,"completedMembers":8,"outstandingPerformers":["周泽霖","刘子轩"],"attentionNeeded":["孙宇辰 - 左手腕拉伤恢复中"]}',
 'report/20260916_120200_U18_team.pdf',
 'admin', '2026-09-16 12:02:00', 'admin', NOW());

SELECT COUNT(*) AS reports FROM apms_report;
