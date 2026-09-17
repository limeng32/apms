-- =====================================================================
-- APMS 数据库版本管理表 (Flyway-lite 模式)
-- ---------------------------------------------------------------------
-- 首次部署时执行一次，之后 deploy.sh 会自动检测并应用 patches/ 下的增量脚本
-- =====================================================================

CREATE TABLE IF NOT EXISTS `apms_db_version` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT       COMMENT '自增主键',
    `patch_name`    VARCHAR(128) NOT NULL                      COMMENT 'patch 文件名，唯一标识，如 patch-0.0.2-0917143015.sql',
    `version`       VARCHAR(32)  NOT NULL                      COMMENT '语义版本号，如 0.0.2',
    `checksum`      VARCHAR(64)  DEFAULT NULL                  COMMENT '文件 SHA256，用于防篡改',
    `description`   VARCHAR(256) DEFAULT NULL                  COMMENT '本次变更简述',
    `applied_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '应用时间',
    `applied_by`    VARCHAR(64)  DEFAULT 'deploy.sh'           COMMENT '执行者',
    `execution_ms`  INT          DEFAULT NULL                  COMMENT '执行耗时(毫秒)',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_patch_name` (`patch_name`),
    KEY `idx_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APMS 数据库版本变更记录';

-- 初始化基线版本：当前所有表 + 种子数据视为 v0.0.1
INSERT INTO `apms_db_version` (`patch_name`, `version`, `description`, `applied_at`)
VALUES ('init-v0.0.1', '0.0.1', '初始化：23 张 apms_ 表 + 指标库/模型/任务/组合评分/PHV 种子数据', NOW())
ON DUPLICATE KEY UPDATE `patch_name` = `patch_name`;  -- 已存在则跳过，幂等
