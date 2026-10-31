-- ======================================================================
-- patch-1.0-261031125227
-- RPA 助手（伪 RPA）审计表
--   apms_assistant_log：每轮问答一条记录，终态 success/error/aborted。
--   message_id 由后端生成并唯一，作为并发回调重复落库的第二道防线。
-- 幂等：CREATE TABLE IF NOT EXISTS，可重复执行。
-- ======================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS apms_assistant_log (
  id           bigint        NOT NULL AUTO_INCREMENT COMMENT '主键',
  session_id   varchar(64)   NOT NULL COMMENT '会话ID',
  message_id   varchar(64)   NOT NULL COMMENT '单条消息ID（后端生成，唯一）',
  user_id      bigint        NOT NULL COMMENT '用户ID',
  user_name    varchar(64)   DEFAULT NULL COMMENT '用户名',
  question     varchar(1000) NOT NULL COMMENT '用户问题（入库前已校验长度）',
  answer       mediumtext    COMMENT '完整回答',
  intent       varchar(64)   DEFAULT NULL COMMENT '命中意图',
  action_json  json          DEFAULT NULL COMMENT '下发动作',
  provider     varchar(20)   NOT NULL DEFAULT 'pseudo' COMMENT 'provider',
  status       varchar(20)   NOT NULL DEFAULT 'success' COMMENT 'success/error/aborted',
  error_msg    varchar(500)  DEFAULT NULL COMMENT '错误信息',
  create_time  datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_message_id (message_id),
  KEY idx_user_time (user_id, create_time),
  KEY idx_session (session_id),
  CONSTRAINT chk_assistant_status CHECK (status IN ('success','error','aborted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RPA助手审计日志';

-- 验收查询（手工执行）：
-- SELECT id, session_id, message_id, user_id, intent, status, create_time
--   FROM apms_assistant_log ORDER BY id DESC LIMIT 20;
