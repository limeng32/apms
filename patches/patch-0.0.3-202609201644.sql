-- =====================================================================
-- patch: 0.0.3 变更：登录页可配置化 M1 —— 新建 apms_login_config 配置表
-- ---------------------------------------------------------------------
-- 适用库：apms（生产）/ apms-uat（UAT）/ apms-dev（dev），deploy 按 apms_db_version 去重
-- 幂等性：CREATE TABLE IF NOT EXISTS，可重复执行
-- 说明  ：M1 不插入任何种子数据。默认值唯一真相源在前端 login.defaults.js；
--         表中无配置行时 GET /login/config 返回 {}，由前端与默认值深度合并。
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `apms_login_config` (
  `id`           bigint(20)   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_key`   varchar(64)  NOT NULL DEFAULT 'default' COMMENT '配置标识（单例=default，预留多主题）',
  `config_name`  varchar(100)          DEFAULT '默认配置' COMMENT '配置名称',
  `config_json`  longtext     NOT NULL COMMENT '登录页配置 JSON（完整配置对象）',
  `schema_ver`   int(11)      NOT NULL DEFAULT 1 COMMENT '配置结构版本号（用于字段迁移，非历史版本）',
  `status`       char(1)               DEFAULT '0' COMMENT '状态（0正常 1停用）',
  `create_by`    varchar(64)           DEFAULT '' COMMENT '创建者',
  `create_time`  datetime              COMMENT '创建时间',
  `update_by`    varchar(64)           DEFAULT '' COMMENT '更新者',
  `update_time`  datetime              COMMENT '更新时间',
  `remark`       varchar(500)          DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录页页面配置表';
