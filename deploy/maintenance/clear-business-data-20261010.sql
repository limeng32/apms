-- ======================================================================
-- 【一次性运维脚本】清空生产环境业务测试数据（保留账号/权限/配置）
-- ----------------------------------------------------------------------
-- 适用库：APMS 生产库（apms）             编制日期：2026-10-10
--
-- ★★★ 危险操作，必须由人工在维护窗口手动执行，绝不接入 patches/ 自动补丁链 ★★★
--
-- 【执行前必做】
--   1. 全库备份（以下二选一，建议在服务器上以 root 用 /etc/apms/env.conf 的库账号）：
--        mkdir -p /opt/apms/backup/manual-clear-20261010
--        mysqldump -h<DB_HOST> -P<DB_PORT> -u<DB_USER> -p \
--          --single-transaction --no-tablespaces --triggers --routines --events \
--          --databases <DB_NAME> | gzip > \
--          /opt/apms/backup/manual-clear-20261010/apms-before-clear.sql.gz
--        gzip -t 上一步文件，确认非空且完整
--   2. 停后端，避免清理过程中有写入：
--        systemctl stop apms-backend
--   3. 执行本脚本，必须带确认变量，否则脚本立即语法错误中止（变量与脚本须在
--      同一连接，推荐管道方式；DB 连接参数取自 /etc/apms/env.conf）：
--        ( echo "SET @CONFIRM_CLEAR := 'YES-CLEAR-PROD-20261010';"; \
--          cat /opt/apms/clear-business-data-20261010.sql ) \
--          | mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}"
--      交互式等价：mysql ... 进入后
--        SET @CONFIRM_CLEAR := 'YES-CLEAR-PROD-20261010';
--        source /opt/apms/clear-business-data-20261010.sql
--      注意：脚本内含 DATABASE()='apms' 二次确认，若生产库名不是 apms 请先删除该段。
--   4. 启动后端：systemctl start apms-backend
--   5. Redis 业务缓存：重跑一次 bash deploy/build.sh 发版会按版本选择性清缓存
--      （保留 login_tokens 登录态）；若不发版，可手动清理见文件末尾说明。
--
-- 【保留不动】
--   账号/组织：sys_user, sys_role, sys_menu, sys_role_menu, sys_dept,
--             sys_role_dept, sys_post, sys_user_role, sys_user_post
--   系统配置：sys_dict_type, sys_dict_data, sys_config, sys_job,
--             apms_login_config, apms_db_version, gen_table, gen_table_column
--   业务配置库（手工搭建，无种子，清了无法恢复）：
--             apms_indicator, apms_indicator_ref, apms_indicator_ref_level,
--             apms_test_model, apms_test_model_field,
--             apms_combo_model, apms_combo_component, apms_rtp_risk_rule
--
-- 【清空并重置 AUTO_INCREMENT=1】
--   业务数据：运动员/分组/晋级日志、测量周期/体态/PHV、
--             测试任务/成员/项目、测试结果/数值/代表值、
--             组合评分、报告、医疗记录/文件、RTP 状态/日志/快照
--   日志公告：操作日志、登录日志、定时任务日志、通知公告及阅读记录
--
-- 【物理文件】本脚本只清数据库，uploadPath 下医疗附件/PDF/头像保留不删。
--   观察确认无问题后，另行备份清理，命令见文件末尾。
--
-- 【回滚】
--   gunzip -c /opt/apms/backup/manual-clear-20261010/apms-before-clear.sql.gz \
--     | mysql -h... -u... -p <DB_NAME>
-- ======================================================================

SET NAMES utf8mb4;

-- ===== 0. 防误执行闸门：未显式设置确认变量，立刻语法错误中止 =====
SET @confirm := IFNULL(@CONFIRM_CLEAR, '');
SET @guard_ddl := IF(@confirm = 'YES-CLEAR-PROD-20261010',
    'SELECT ''[GUARD] 确认变量正确，开始清理'' AS msg',
    'ABORT_MISSING_CONFIRM_VARIABLE_SET_@CONFIRM_CLEAR_FIRST');
PREPARE guard_stmt FROM @guard_ddl;
EXECUTE guard_stmt;
DEALLOCATE PREPARE guard_stmt;

-- 再确认目标库不是开发/UAT 惯用库名（生产库名应为 apms；如生产库名不同请删掉本段）
SET @dbguard := IF(DATABASE() = 'apms',
    'SELECT ''[GUARD] 当前库 apms，放行'' AS msg',
    'ABORT_UNEXPECTED_DATABASE_NAME_MUST_BE_apms');
PREPARE dbguard_stmt FROM @dbguard;
EXECUTE dbguard_stmt;
DEALLOCATE PREPARE dbguard_stmt;

-- ===== 1. 清理前行数快照（执行结果留档） =====
SELECT '==== 清理前 ====' AS phase;
SELECT 'apms_athlete' AS tbl, COUNT(*) AS cnt FROM apms_athlete
UNION ALL SELECT 'apms_athlete_group', COUNT(*) FROM apms_athlete_group
UNION ALL SELECT 'apms_athlete_promotion_log', COUNT(*) FROM apms_athlete_promotion_log
UNION ALL SELECT 'apms_measure_cycle', COUNT(*) FROM apms_measure_cycle
UNION ALL SELECT 'apms_body_measure', COUNT(*) FROM apms_body_measure
UNION ALL SELECT 'apms_phv_record', COUNT(*) FROM apms_phv_record
UNION ALL SELECT 'apms_test_task', COUNT(*) FROM apms_test_task
UNION ALL SELECT 'apms_task_member', COUNT(*) FROM apms_task_member
UNION ALL SELECT 'apms_task_item', COUNT(*) FROM apms_task_item
UNION ALL SELECT 'apms_test_result', COUNT(*) FROM apms_test_result
UNION ALL SELECT 'apms_test_result_value', COUNT(*) FROM apms_test_result_value
UNION ALL SELECT 'apms_test_result_rep', COUNT(*) FROM apms_test_result_rep
UNION ALL SELECT 'apms_combo_score', COUNT(*) FROM apms_combo_score
UNION ALL SELECT 'apms_report', COUNT(*) FROM apms_report
UNION ALL SELECT 'apms_medical_record', COUNT(*) FROM apms_medical_record
UNION ALL SELECT 'apms_medical_file', COUNT(*) FROM apms_medical_file
UNION ALL SELECT 'apms_rtp_status', COUNT(*) FROM apms_rtp_status
UNION ALL SELECT 'apms_rtp_log', COUNT(*) FROM apms_rtp_log
UNION ALL SELECT 'apms_rtp_risk_snapshot', COUNT(*) FROM apms_rtp_risk_snapshot
UNION ALL SELECT 'sys_oper_log', COUNT(*) FROM sys_oper_log
UNION ALL SELECT 'sys_logininfor', COUNT(*) FROM sys_logininfor
UNION ALL SELECT 'sys_job_log', COUNT(*) FROM sys_job_log
UNION ALL SELECT 'sys_notice', COUNT(*) FROM sys_notice
UNION ALL SELECT 'sys_notice_read', COUNT(*) FROM sys_notice_read;

-- ===== 2. 关闭外键检查后 TRUNCATE（MyBatis 库通常无物理外键，此为双保险） =====
SET FOREIGN_KEY_CHECKS = 0;

-- ---- 2.1 业务数据：先子后父（逻辑依赖顺序，FK_CHECKS=0 下顺序仅为可读性） ----
-- 测试结果链
TRUNCATE TABLE apms_test_result_value;
TRUNCATE TABLE apms_test_result_rep;
TRUNCATE TABLE apms_test_result;
TRUNCATE TABLE apms_task_item;
TRUNCATE TABLE apms_task_member;
TRUNCATE TABLE apms_test_task;
-- 组合评分（组合模型/组件是配置，保留）
TRUNCATE TABLE apms_combo_score;
-- 报告
TRUNCATE TABLE apms_report;
-- 医疗
TRUNCATE TABLE apms_medical_file;
TRUNCATE TABLE apms_medical_record;
-- 体态/PHV/测量周期
TRUNCATE TABLE apms_body_measure;
TRUNCATE TABLE apms_phv_record;
TRUNCATE TABLE apms_measure_cycle;
-- RTP 运行态（rtp_risk_rule 规则保留）
TRUNCATE TABLE apms_rtp_log;
TRUNCATE TABLE apms_rtp_risk_snapshot;
TRUNCATE TABLE apms_rtp_status;
-- 运动员主体及分组/晋级
TRUNCATE TABLE apms_athlete_promotion_log;
TRUNCATE TABLE apms_athlete_group;
TRUNCATE TABLE apms_athlete;

-- ---- 2.2 日志与公告（先阅读记录后公告） ----
TRUNCATE TABLE sys_notice_read;
TRUNCATE TABLE sys_notice;
TRUNCATE TABLE sys_oper_log;
TRUNCATE TABLE sys_logininfor;
TRUNCATE TABLE sys_job_log;

SET FOREIGN_KEY_CHECKS = 1;

-- ===== 3. 清理后校验：以上表必须全部为 0，保留表必须仍有数据 =====
SELECT '==== 清理后（业务/日志表，期望全 0）====' AS phase;
SELECT 'apms_athlete' AS tbl, COUNT(*) AS cnt FROM apms_athlete
UNION ALL SELECT 'apms_athlete_group', COUNT(*) FROM apms_athlete_group
UNION ALL SELECT 'apms_athlete_promotion_log', COUNT(*) FROM apms_athlete_promotion_log
UNION ALL SELECT 'apms_measure_cycle', COUNT(*) FROM apms_measure_cycle
UNION ALL SELECT 'apms_body_measure', COUNT(*) FROM apms_body_measure
UNION ALL SELECT 'apms_phv_record', COUNT(*) FROM apms_phv_record
UNION ALL SELECT 'apms_test_task', COUNT(*) FROM apms_test_task
UNION ALL SELECT 'apms_task_member', COUNT(*) FROM apms_task_member
UNION ALL SELECT 'apms_task_item', COUNT(*) FROM apms_task_item
UNION ALL SELECT 'apms_test_result', COUNT(*) FROM apms_test_result
UNION ALL SELECT 'apms_test_result_value', COUNT(*) FROM apms_test_result_value
UNION ALL SELECT 'apms_test_result_rep', COUNT(*) FROM apms_test_result_rep
UNION ALL SELECT 'apms_combo_score', COUNT(*) FROM apms_combo_score
UNION ALL SELECT 'apms_report', COUNT(*) FROM apms_report
UNION ALL SELECT 'apms_medical_record', COUNT(*) FROM apms_medical_record
UNION ALL SELECT 'apms_medical_file', COUNT(*) FROM apms_medical_file
UNION ALL SELECT 'apms_rtp_status', COUNT(*) FROM apms_rtp_status
UNION ALL SELECT 'apms_rtp_log', COUNT(*) FROM apms_rtp_log
UNION ALL SELECT 'apms_rtp_risk_snapshot', COUNT(*) FROM apms_rtp_risk_snapshot
UNION ALL SELECT 'sys_oper_log', COUNT(*) FROM sys_oper_log
UNION ALL SELECT 'sys_logininfor', COUNT(*) FROM sys_logininfor
UNION ALL SELECT 'sys_job_log', COUNT(*) FROM sys_job_log
UNION ALL SELECT 'sys_notice', COUNT(*) FROM sys_notice
UNION ALL SELECT 'sys_notice_read', COUNT(*) FROM sys_notice_read;

SELECT '==== 保留表（账号/配置，期望非空）====' AS phase;
SELECT 'sys_user' AS tbl, COUNT(*) AS cnt FROM sys_user
UNION ALL SELECT 'sys_role', COUNT(*) FROM sys_role
UNION ALL SELECT 'sys_menu', COUNT(*) FROM sys_menu
UNION ALL SELECT 'sys_dept', COUNT(*) FROM sys_dept
UNION ALL SELECT 'sys_dict_data', COUNT(*) FROM sys_dict_data
UNION ALL SELECT 'sys_config', COUNT(*) FROM sys_config
UNION ALL SELECT 'apms_indicator', COUNT(*) FROM apms_indicator
UNION ALL SELECT 'apms_test_model', COUNT(*) FROM apms_test_model
UNION ALL SELECT 'apms_combo_model', COUNT(*) FROM apms_combo_model
UNION ALL SELECT 'apms_rtp_risk_rule', COUNT(*) FROM apms_rtp_risk_rule
UNION ALL SELECT 'apms_login_config', COUNT(*) FROM apms_login_config;

SELECT '[DONE] 业务测试数据已清空，AUTO_INCREMENT 已重置为 1' AS result;

-- ======================================================================
-- 附：Redis 缓存（仅在不发版时手动执行；发版流程会自动选择性清理）
--   先 source /etc/apms/env.conf 获取 REDIS_HOST/REDIS_PORT/REDIS_PASS/REDIS_DB，
--   参考 deploy.sh flush_redis_keep：SCAN 删除非 login_tokens: 的 key。
--
-- 附：确认系统正常后，物理文件清理（务必先打包备份）：
--   cd /opt/apms/backend/uploadPath
--   tar czf /opt/apms/backup/manual-clear-20261010/uploadPath.tgz .
--   # 核对业务子目录（以实际结构为准，勿盲删）：
--   ls -la
--   # 确认后按需删除医疗附件/报告/导出等业务目录；avatar 为账号头像建议保留：
--   # rm -rf ./medical/* ./report/* ./export/* 2>/dev/null
-- ======================================================================
