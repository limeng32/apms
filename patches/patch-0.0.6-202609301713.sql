-- patch-0.0.6-202609301713.sql 赛季整队晋升：新增晋升留痕表 apms_athlete_promotion_log
-- =====================================================================
-- 背景：青训梯队按赛季 cut-off（默认每年 1 月 1 日，界面可改）整队晋升。
--   执行批处理时仅更新 apms_athlete.primary_team_id，历史测试成绩/评级不重算。
--   本表记录每次晋升的批次与人员流向，供审计与回溯。
-- 变更：
--   1. 新建 apms_athlete_promotion_log（CREATE TABLE IF NOT EXISTS，幂等）
--   2. 不修改任何既有表结构与业务数据
-- 幂等：可重复执行；表已存在时跳过
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS apms_athlete_promotion_log (
    id            bigint       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    batch_no      varchar(32)  NOT NULL                 COMMENT '批次号（P+cutoff日期+时分秒，如 P20270101-171300）',
    cutoff_date   date         NOT NULL                 COMMENT '赛季 cut-off 日期（该日周岁判定档位）',
    athlete_id    bigint       NOT NULL                 COMMENT '运动员ID',
    athlete_name  varchar(50)  DEFAULT NULL             COMMENT '运动员姓名（冗余，便于审计）',
    from_team_id  bigint       DEFAULT NULL             COMMENT '晋升前队伍（sys_dept）',
    to_team_id    bigint       DEFAULT NULL             COMMENT '晋升后队伍（sys_dept）',
    season_age    int          DEFAULT NULL             COMMENT 'cut-off 日周岁',
    create_by     varchar(64)  DEFAULT ''               COMMENT '操作人',
    create_time   datetime     DEFAULT NULL             COMMENT '执行时间',
    PRIMARY KEY (id),
    KEY idx_batch_no (batch_no),
    KEY idx_athlete_id (athlete_id),
    KEY idx_cutoff_date (cutoff_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='赛季整队晋升记录（只追加，不修改历史成绩）';
