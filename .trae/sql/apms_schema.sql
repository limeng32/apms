-- ============================================================
-- APMS 运动员管理系统 — 数据库建表脚本
-- 基于 RuoYi-Vue 3.9.2 / Spring Boot 4.x / MySQL 8.0
-- 所有 INSERT 显式写列名，不依赖表字段顺序
-- ============================================================

-- ------------------------------------------------------------
-- 0. sys_dept 扩展字段（在若依原表上 ALTER）
-- ------------------------------------------------------------
-- dept_type 已在初始化时创建，如未创建请取消注释：
-- ALTER TABLE sys_dept ADD COLUMN dept_type varchar(2) DEFAULT NULL COMMENT 'APMS部门类型：10=机构 20=队伍 30=训练小组 40=科研小组 50=恢复小组';

-- ------------------------------------------------------------
-- 1. 字典数据初始化
-- ------------------------------------------------------------

-- 部门类型
INSERT IGNORE INTO sys_dict_type (
    dict_name, dict_type, status, create_by, create_time, remark
) VALUES (
    '部门类型', 'apms_dept_type', '0', 'admin', sysdate(), 'APMS 组织层级'
);

INSERT IGNORE INTO sys_dict_data (
    dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark
) VALUES
(1, '机构',     '10', 'apms_dept_type', '', 'info',    'Y', '0', 'admin', sysdate(), NULL),
(2, '队伍',     '20', 'apms_dept_type', '', 'success', 'N', '0', 'admin', sysdate(), NULL),
(3, '训练小组', '30', 'apms_dept_type', '', 'primary', 'N', '0', 'admin', sysdate(), NULL),
(4, '科研小组', '40', 'apms_dept_type', '', 'warning', 'N', '0', 'admin', sysdate(), NULL),
(5, '恢复小组', '50', 'apms_dept_type', '', 'danger',  'N', '0', 'admin', sysdate(), NULL);

-- 医疗记录类型
INSERT IGNORE INTO sys_dict_type (
    dict_name, dict_type, status, create_by, create_time, remark
) VALUES (
    '医疗记录类型', 'apms_medical_type', '0', 'admin', sysdate(), 'APMS 医疗附件分类'
);

INSERT IGNORE INTO sys_dict_data (
    dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark
) VALUES
(1, 'MRI检查',  'MRI',  'apms_medical_type', '', 'danger',  'N', '0', 'admin', sysdate(), NULL),
(2, 'CT检查',   'CT',   'apms_medical_type', '', 'warning', 'N', '0', 'admin', sysdate(), NULL),
(3, '超声检查', 'US',   'apms_medical_type', '', 'info',    'N', '0', 'admin', sysdate(), NULL),
(4, 'X光检查',  'XRAY', 'apms_medical_type', '', 'info',    'N', '0', 'admin', sysdate(), NULL),
(5, '血液检验', 'LAB',  'apms_medical_type', '', 'primary', 'N', '0', 'admin', sysdate(), NULL),
(6, '康复评估', 'REHAB','apms_medical_type', '', 'success', 'N', '0', 'admin', sysdate(), NULL),
(7, '其他',     'OTHER','apms_medical_type', '', '',         'N', '0', 'admin', sysdate(), NULL);


-- ============================================================
-- 一、组织与运动员
-- ============================================================

-- ------------------------------------------------------------
-- 1.1 运动员主实体
-- ------------------------------------------------------------
CREATE TABLE apms_athlete (
    athlete_id      bigint       NOT NULL AUTO_INCREMENT  COMMENT '运动员ID（APMS独立主键）',
    user_id         bigint       DEFAULT NULL             COMMENT '关联sys_user（需登录账号时填，默认NULL）',
    name            varchar(50)  NOT NULL                 COMMENT '姓名',
    gender          char(1)      NOT NULL                 COMMENT '性别（0男 1女）',
    birthday        date         DEFAULT NULL             COMMENT '出生日期',
    phone           varchar(20)  DEFAULT NULL             COMMENT '联系电话',
    primary_team_id bigint       NOT NULL                 COMMENT '所属主队伍（sys_dept，dept_type=20）',
    jersey_no       varchar(8)   DEFAULT NULL             COMMENT '球衣号码',
    position        varchar(20)  DEFAULT NULL             COMMENT '位置（前锋/中前卫/守门员等）',
    status          char(1)      DEFAULT '0'              COMMENT '状态（0正常 1离队 2退役）',
    create_by       varchar(64)  DEFAULT ''               COMMENT '创建人',
    create_time     datetime     DEFAULT NULL             COMMENT '创建时间',
    update_by       varchar(64)  DEFAULT ''               COMMENT '更新人',
    update_time     datetime     DEFAULT NULL             COMMENT '更新时间',
    PRIMARY KEY (athlete_id),
    KEY idx_user_id (user_id),
    KEY idx_primary_team_id (primary_team_id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运动员主实体（独立于sys_user）';

-- ------------------------------------------------------------
-- 1.2 运动员-小组归属（带历史追踪）
-- ------------------------------------------------------------
CREATE TABLE apms_athlete_group (
    id            bigint       NOT NULL AUTO_INCREMENT  COMMENT '自增',
    athlete_id    bigint       NOT NULL                COMMENT '运动员ID',
    dept_id       bigint       NOT NULL                COMMENT '小组ID（sys_dept，dept_type=30/40/50）',
    join_date     date         NOT NULL                COMMENT '加入日期',
    leave_date    date         DEFAULT NULL            COMMENT '离开日期（NULL=当前在组）',
    status        char(1)      DEFAULT '0'             COMMENT '0=在组 1=已离组',
    create_by     varchar(64)  DEFAULT ''              COMMENT '操作人',
    create_time   datetime     DEFAULT NULL            COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_athlete_id (athlete_id),
    KEY idx_dept_id (dept_id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运动员-小组归属历史';


-- ============================================================
-- 二、基础体态测量
-- ============================================================

CREATE TABLE apms_body_measure (
    id                   bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    athlete_id          bigint        NOT NULL                COMMENT '运动员ID',
    measure_date        date          NOT NULL                COMMENT '测量日期',
    height              decimal(5,1)  DEFAULT NULL            COMMENT '站立身高 cm',
    weight              decimal(5,1)  DEFAULT NULL            COMMENT '体重 kg',
    sit_height          decimal(5,1)  DEFAULT NULL            COMMENT '坐高 cm',
    body_fat_rate       decimal(4,1)  DEFAULT NULL            COMMENT '体脂率 %',
    waist               decimal(5,1)  DEFAULT NULL            COMMENT '腰围 cm',
    data_source         varchar(20)  DEFAULT NULL            COMMENT '来源（manual/csv/import/task）',
    source_task_id      bigint        DEFAULT NULL            COMMENT '来源任务ID（任务流程录入时指向apms_test_task.id）',
    source_session_key  varchar(50)  DEFAULT NULL            COMMENT '来源测量会话Key（指向apms_test_result.session_key）',
    create_by           varchar(64)  DEFAULT ''              COMMENT '操作人',
    create_time         datetime     DEFAULT NULL            COMMENT '录入时间',
    PRIMARY KEY (id),
    KEY idx_athlete_date (athlete_id, measure_date),
    KEY idx_source_session_key (source_session_key),
    KEY idx_source_task_id (source_task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='体态测量记录（唯一业务真源）';


-- ============================================================
-- 三、RTP 参训状态
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 当前 RTP 状态（新建运动员不自动插入，无记录=未评估）
-- ------------------------------------------------------------
CREATE TABLE apms_rtp_status (
    id               bigint       NOT NULL AUTO_INCREMENT  COMMENT '自增',
    athlete_id       bigint       NOT NULL                COMMENT '运动员ID（唯一）',
    status           char(1)      NOT NULL                COMMENT 'g=正常 y=限制 r=不建议',
    reason           varchar(500) DEFAULT NULL            COMMENT '标记原因',
    training_limit   varchar(500) DEFAULT NULL            COMMENT '训练限制说明',
    next_review_date date         DEFAULT NULL            COMMENT '下次复核日期',
    updated_by       varchar(64)  DEFAULT ''             COMMENT '操作人',
    updated_time     datetime     DEFAULT NULL            COMMENT '操作时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_athlete_id (athlete_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='当前RTP状态';

-- ------------------------------------------------------------
-- 3.2 RTP 状态变更日志
-- ------------------------------------------------------------
CREATE TABLE apms_rtp_log (
    id               bigint       NOT NULL AUTO_INCREMENT  COMMENT '自增',
    athlete_id       bigint       NOT NULL                COMMENT '运动员ID',
    from_status      char(1)      DEFAULT NULL            COMMENT '变更前状态',
    to_status        char(1)      NOT NULL                COMMENT '变更后状态',
    reason           varchar(500) DEFAULT NULL            COMMENT '变更原因',
    training_limit   varchar(500) DEFAULT NULL            COMMENT '训练限制',
    next_review_date date         DEFAULT NULL            COMMENT '当时计划的下次复核日期',
    operator_id      bigint       NOT NULL                COMMENT '操作人（sys_user）',
    operator_name    varchar(64)  DEFAULT NULL            COMMENT '操作人姓名',
    operate_time     datetime     DEFAULT NULL            COMMENT '操作时间',
    PRIMARY KEY (id),
    KEY idx_athlete_id (athlete_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RTP状态变更日志';


-- ============================================================
-- 四、PHV 生长发育
-- ============================================================

CREATE TABLE apms_phv_record (
    id                     bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    athlete_id             bigint        NOT NULL                COMMENT '运动员ID',
    source_measure_id      bigint        DEFAULT NULL            COMMENT '关联apms_body_measure.id（原始测量事实来源）',
    gender                 char(1)      NOT NULL                COMMENT '性别（0男 1女）',
    measure_date           date         NOT NULL                COMMENT '测量日期',
    decimal_age            decimal(6,4) NOT NULL                COMMENT '精确年龄（0.0001岁）',
    height                 decimal(5,1) NOT NULL                COMMENT '站立身高 cm（快照副本）',
    sit_height             decimal(5,1) NOT NULL                COMMENT '坐高 cm（快照副本）',
    weight                 decimal(5,1) NOT NULL                COMMENT '体重 kg（快照副本）',
    father_height          decimal(5,1) DEFAULT NULL            COMMENT '父亲身高 cm',
    mother_height          decimal(5,1) DEFAULT NULL            COMMENT '母亲身高 cm',
    leg_length             decimal(5,1) NOT NULL                COMMENT '腿长（身高-坐高，计算值）',
    maturity_offset        decimal(8,4) DEFAULT NULL            COMMENT '成熟度偏移',
    predicted_phv_age      decimal(6,4) DEFAULT NULL            COMMENT '预计PHV年龄',
    predicted_adult_height decimal(5,1) DEFAULT NULL            COMMENT '预测成年身高',
    mirwald_version        varchar(20)  DEFAULT NULL            COMMENT 'Mirwald公式版本',
    khamis_version         varchar(20)  DEFAULT NULL            COMMENT 'Khamis-Roche公式版本',
    input_snapshot         json         DEFAULT NULL            COMMENT '完整输入快照（算法当时使用的全部输入值）',
    create_by              varchar(64)  DEFAULT ''              COMMENT '操作人',
    create_time            datetime     DEFAULT NULL            COMMENT '计算时间',
    PRIMARY KEY (id),
    KEY idx_athlete_id (athlete_id),
    KEY idx_source_measure_id (source_measure_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PHV测量与计算记录';


-- ============================================================
-- 五、指标矩阵
-- ============================================================

-- ------------------------------------------------------------
-- 5.1 指标库
-- ------------------------------------------------------------
CREATE TABLE apms_indicator (
    id                   bigint       NOT NULL AUTO_INCREMENT COMMENT '自增',
    code                 varchar(50)  NOT NULL                COMMENT '稳定业务编码（HEIGHT/WEIGHT/SPRINT_30M等）',
    category             varchar(20)  DEFAULT NULL            COMMENT '分类（形态/机能/素质/筛查）',
    name                 varchar(50)  NOT NULL                COMMENT '指标名称（可改）',
    unit                 varchar(20)  DEFAULT NULL            COMMENT '单位',
    data_type            varchar(20)  DEFAULT NULL            COMMENT '数据类型（number/decimal/text/select）',
    evaluation_direction varchar(20)  NOT NULL                COMMENT '评价方向：HIGHER_BETTER/LOWER_BETTER/RANGE_BEST/REFERENCE_ONLY',
    collection_method    varchar(20)  DEFAULT NULL            COMMENT '采集方式（manual/device/csv）',
    status               char(1)     DEFAULT '0'             COMMENT '0=启用 1=停用',
    version              varchar(20)  DEFAULT NULL            COMMENT '有效版本',
    create_time          datetime     DEFAULT NULL            COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_code (code),
    KEY idx_category (category),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指标库';

-- ------------------------------------------------------------
-- 5.2 参考范围（按性别/年龄组/队伍）
-- ------------------------------------------------------------
CREATE TABLE apms_indicator_ref (
    id           bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    indicator_id bigint        NOT NULL                COMMENT '指标ID',
    gender       char(1)       DEFAULT NULL            COMMENT '适用性别',
    age_group    varchar(20)   DEFAULT NULL            COMMENT '年龄组（如U16/U18）',
    dept_id      bigint        DEFAULT 0               COMMENT '适用队伍（0=全机构）',
    ref_min      decimal(14,4) DEFAULT NULL            COMMENT '简单参考下限',
    ref_max      decimal(14,4) DEFAULT NULL            COMMENT '简单参考上限',
    model_version varchar(20)  DEFAULT NULL            COMMENT '参考口径版本',
    PRIMARY KEY (id),
    KEY idx_indicator_id (indicator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指标参考范围（按性别/年龄组/队伍）';

-- ------------------------------------------------------------
-- 5.3 参考范围三级判定
-- ------------------------------------------------------------
CREATE TABLE apms_indicator_ref_level (
    id          bigint        NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    ref_id      bigint        NOT NULL                COMMENT '关联 apms_indicator_ref.id',
    level       varchar(10)   NOT NULL                COMMENT '评级：GOOD / NORMAL / ATTENTION',
    min_value   decimal(14,4) DEFAULT NULL            COMMENT '下限（NULL = 负无穷）',
    max_value   decimal(14,4) DEFAULT NULL            COMMENT '上限（NULL = 正无穷）',
    PRIMARY KEY (id),
    KEY idx_ref_id (ref_id),
    CONSTRAINT uk_ref_level UNIQUE (ref_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指标参考范围三级判定';


-- ============================================================
-- 六、测试模型
-- ============================================================

-- ------------------------------------------------------------
-- 6.1 测试模型库
-- ------------------------------------------------------------
CREATE TABLE apms_test_model (
    id           bigint      NOT NULL AUTO_INCREMENT COMMENT '自增',
    category     varchar(20) DEFAULT NULL            COMMENT '分类（耐力/速度耐力/敏捷/带球敏捷/组合）',
    name         varchar(50) NOT NULL                COMMENT '模型名称',
    code         varchar(30) DEFAULT NULL            COMMENT '模型编码（如YOYO_IR1）',
    protocol     text                                COMMENT '测试规程描述（人读）',
    is_combo     char(1)     DEFAULT '0'             COMMENT '1=组合模型 0=否',
    algo_version varchar(20) DEFAULT NULL            COMMENT '算法版本',
    status       char(1)     DEFAULT '0'             COMMENT '0=启用 1=停用',
    create_time  datetime    DEFAULT NULL            COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_code (code),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试模型库';

-- ------------------------------------------------------------
-- 6.2 模型记录字段定义
-- ------------------------------------------------------------
CREATE TABLE apms_test_model_field (
    id          bigint      NOT NULL AUTO_INCREMENT COMMENT '自增',
    model_id    bigint      NOT NULL                COMMENT '模型ID',
    field_key   varchar(30) NOT NULL                COMMENT '字段Key（如total_distance）',
    field_name  varchar(50) DEFAULT NULL            COMMENT '显示名',
    unit        varchar(20) DEFAULT NULL            COMMENT '单位',
    data_type   varchar(20) DEFAULT NULL            COMMENT '数据类型',
    is_required char(1)     DEFAULT '0'             COMMENT '1=必填 0=选填',
    sort_order  int         DEFAULT 0               COMMENT '排序',
    PRIMARY KEY (id),
    KEY idx_model_id (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型记录字段定义';

-- ------------------------------------------------------------
-- 6.3 组合模型（主表）
-- ------------------------------------------------------------
CREATE TABLE apms_combo_model (
    id                   bigint      NOT NULL AUTO_INCREMENT COMMENT '自增',
    model_id             bigint      NOT NULL                COMMENT '关联 apms_test_model.id',
    normalization_method varchar(30) DEFAULT NULL            COMMENT '归一化方法（z_score/percentile/custom）',
    formula              text                                COMMENT '计算公式描述（人读，不用于动态执行）',
    ref_version          varchar(20) DEFAULT NULL            COMMENT '参考组口径版本',
    algo_version         varchar(20) DEFAULT NULL            COMMENT '算法版本',
    PRIMARY KEY (id),
    KEY idx_model_id (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组合模型主表';

-- ------------------------------------------------------------
-- 6.4 组合模型组成项
-- ------------------------------------------------------------
CREATE TABLE apms_combo_component (
    id                 bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    combo_model_id     bigint        NOT NULL                COMMENT '关联 apms_combo_model.id',
    indicator_id       bigint        NOT NULL                COMMENT '关联 apms_indicator.id',
    weight             decimal(5,2)  NOT NULL                COMMENT '权重（如0.50）',
    direction_override char(1)       DEFAULT NULL            COMMENT '覆盖方向（NULL=继承indicator；0=越大越好 1=越小越好）',
    sort_order         int           DEFAULT 0               COMMENT '排序',
    PRIMARY KEY (id),
    KEY idx_combo_model_id (combo_model_id),
    KEY idx_indicator_id (indicator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组合模型组成项';

-- ------------------------------------------------------------
-- 6.5 组合得分计算记录（带参考快照）
-- ------------------------------------------------------------
CREATE TABLE apms_combo_score (
    id                bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    combo_model_id    bigint        NOT NULL                COMMENT '关联 apms_combo_model.id',
    athlete_id        bigint        NOT NULL                COMMENT '运动员ID',
    trigger_result_id bigint        DEFAULT NULL            COMMENT '触发本次计算的结果ID（手工重算时NULL）',
    combo_score       decimal(14,4) NOT NULL                COMMENT '组合分最终值',
    ref_snapshot      json          DEFAULT NULL            COMMENT '各指标参考统计量快照+组成项来源result_id',
    algo_version      varchar(20)   DEFAULT NULL            COMMENT '算法版本',
    calculated_at     datetime      DEFAULT NULL            COMMENT '计算时间',
    PRIMARY KEY (id),
    KEY idx_combo_model_athlete (combo_model_id, athlete_id),
    KEY idx_athlete_id (athlete_id),
    KEY idx_trigger_result_id (trigger_result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组合得分计算记录';


-- ============================================================
-- 七、测试任务
-- ============================================================

-- ------------------------------------------------------------
-- 7.1 测试任务
-- ------------------------------------------------------------
CREATE TABLE apms_test_task (
    id             bigint       NOT NULL AUTO_INCREMENT COMMENT '自增',
    task_name      varchar(100) NOT NULL                COMMENT '任务名称',
    target_dept_id bigint       NOT NULL                COMMENT '目标小组',
    tester_id      bigint       NOT NULL                COMMENT '主测责任人（sys_user）',
    start_date     date         DEFAULT NULL            COMMENT '开始日期',
    end_date       date         DEFAULT NULL            COMMENT '结束日期',
    status         varchar(20)  DEFAULT 'pending'       COMMENT 'pending/in_progress/completed',
    create_by      varchar(64)  DEFAULT ''              COMMENT '创建人',
    create_time    datetime     DEFAULT NULL            COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_status (status),
    KEY idx_target_dept_id (target_dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试任务';

-- ------------------------------------------------------------
-- 7.2 任务测试项
-- ------------------------------------------------------------
CREATE TABLE apms_task_item (
    id           bigint      NOT NULL AUTO_INCREMENT COMMENT '自增',
    task_id      bigint      NOT NULL                COMMENT '任务ID',
    item_type    varchar(10) NOT NULL                COMMENT 'INDICATOR=单指标 / MODEL=测试模型',
    indicator_id bigint      DEFAULT NULL            COMMENT '关联apms_indicator.id（item_type=INDICATOR时填）',
    model_id     bigint      DEFAULT NULL            COMMENT '关联apms_test_model.id（item_type=MODEL时填）',
    is_required  char(1)     DEFAULT '0'             COMMENT '1=必测 0=选测',
    sort_order   int         DEFAULT 0               COMMENT '排序',
    PRIMARY KEY (id),
    KEY idx_task_id (task_id),
    KEY idx_indicator_id (indicator_id),
    KEY idx_model_id (model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务测试项';

-- ------------------------------------------------------------
-- 7.3 任务成员
-- ------------------------------------------------------------
CREATE TABLE apms_task_member (
    task_id     bigint      NOT NULL                COMMENT '任务ID',
    athlete_id  bigint      NOT NULL                COMMENT '运动员ID',
    status      varchar(20) DEFAULT 'pending'       COMMENT 'pending=未测 partial=部分完成 completed=全部完成',
    PRIMARY KEY (task_id, athlete_id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务成员';


-- ============================================================
-- 八、测试结果
-- ============================================================

-- ------------------------------------------------------------
-- 8.1 测试结果主记录（一次 attempt）
-- ------------------------------------------------------------
CREATE TABLE apms_test_result (
    id             bigint       NOT NULL AUTO_INCREMENT COMMENT '自增',
    task_id        bigint       DEFAULT NULL            COMMENT '任务ID（可空——支持不走任务流程直接补录）',
    task_item_id   bigint       DEFAULT NULL            COMMENT '关联apms_task_item.id（任务流程下录入时必填）',
    athlete_id     bigint       NOT NULL                COMMENT '运动员ID',
    model_id       bigint       DEFAULT NULL            COMMENT '测试模型ID',
    indicator_id   bigint       DEFAULT NULL            COMMENT '主指标ID（单指标测试时填写）',
    session_key    varchar(50)  DEFAULT NULL            COMMENT '测量会话Key（同一次现场测量共享；用于聚合体态类多result到一条body_measure）',
    measure_date   date         NOT NULL                COMMENT '测试日期',
    attempt_no     int          DEFAULT NULL            COMMENT '第几次试测（NULL=无试测概念如体态）',
    is_valid       char(1)      DEFAULT '1'             COMMENT '1=有效 0=无效',
    is_selected    char(1)      DEFAULT '0'             COMMENT '0=否 1=选中（取最佳成绩时标记）',
    invalid_reason varchar(200) DEFAULT NULL            COMMENT '无效原因（is_valid=0时填写）',
    data_source    varchar(20)  DEFAULT 'manual'        COMMENT '来源（manual/csv/device）',
    raw_payload    json         DEFAULT NULL            COMMENT '原始设备payload（保留导入时完整原始数据）',
    create_by      varchar(64)  DEFAULT ''              COMMENT '录入人',
    create_time    datetime     DEFAULT NULL            COMMENT '录入时间',
    PRIMARY KEY (id),
    KEY idx_task_id (task_id),
    KEY idx_task_item_id (task_item_id),
    KEY idx_athlete_id (athlete_id),
    KEY idx_session_key (session_key),
    KEY idx_measure_date (measure_date),
    KEY idx_athlete_task_item (athlete_id, task_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试结果主记录（一次attempt）';

-- ------------------------------------------------------------
-- 8.2 规范化测试结果值
-- ------------------------------------------------------------
CREATE TABLE apms_test_result_value (
    id               bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    result_id        bigint        NOT NULL                COMMENT '关联 apms_test_result.id',
    indicator_id     bigint        DEFAULT NULL            COMMENT '关联 apms_indicator.id',
    field_id         bigint        DEFAULT NULL            COMMENT '关联 apms_test_model_field.id',
    field_key        varchar(30)   DEFAULT NULL            COMMENT '字段Key（冗余）',
    field_name       varchar(50)   DEFAULT NULL            COMMENT '字段名（冗余）',
    numeric_value    decimal(14,4) DEFAULT NULL            COMMENT '数值型结果',
    text_value       varchar(500)  DEFAULT NULL            COMMENT '文本型结果',
    unit             varchar(20)   DEFAULT NULL            COMMENT '单位',
    is_derived       char(1)       DEFAULT '0'             COMMENT '0=原始录入值 1=算法派生值',
    algorithm_id     varchar(30)   DEFAULT NULL            COMMENT '算法ID（is_derived=1时填）',
    algorithm_version varchar(20)  DEFAULT NULL            COMMENT '算法版本（is_derived=1时填）',
    PRIMARY KEY (id),
    KEY idx_result_id (result_id),
    KEY idx_indicator_id (indicator_id),
    KEY idx_field_id (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规范化测试结果值';

-- ------------------------------------------------------------
-- 8.3 原始多次/多趟数据（RSA 等）
-- ------------------------------------------------------------
CREATE TABLE apms_test_result_rep (
    id          bigint        NOT NULL AUTO_INCREMENT COMMENT '自增',
    result_id   bigint        NOT NULL                COMMENT '关联 apms_test_result.id',
    field_key   varchar(30)   NOT NULL                COMMENT '字段Key（如sprint_time）',
    rep_no      int           NOT NULL                COMMENT '第几次/趟',
    value       decimal(14,4) NOT NULL                COMMENT '原始值',
    unit        varchar(20)   DEFAULT NULL            COMMENT '单位',
    PRIMARY KEY (id),
    KEY idx_result_id (result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='原始多次/多趟数据';


-- ============================================================
-- 九、医疗附件
-- ============================================================

-- ------------------------------------------------------------
-- 9.1 医疗记录
-- ------------------------------------------------------------
CREATE TABLE apms_medical_record (
    id           bigint       NOT NULL AUTO_INCREMENT COMMENT '自增',
    athlete_id   bigint       NOT NULL                COMMENT '运动员ID',
    record_type  varchar(30)  NOT NULL                COMMENT '记录类型（MRI/CT/US/XRAY/LAB/REHAB/OTHER）',
    record_date  date         NOT NULL                COMMENT '检查/记录日期',
    institution  varchar(100) DEFAULT NULL            COMMENT '来源机构',
    title        varchar(200) DEFAULT NULL            COMMENT '记录标题',
    remark       varchar(500) DEFAULT NULL            COMMENT '备注',
    create_by    varchar(64)  DEFAULT ''              COMMENT '创建人',
    create_time  datetime     DEFAULT NULL            COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_athlete_id (athlete_id),
    KEY idx_record_type (record_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='医疗记录';

-- ------------------------------------------------------------
-- 9.2 医疗附件
-- ------------------------------------------------------------
CREATE TABLE apms_medical_file (
    id           bigint       NOT NULL AUTO_INCREMENT COMMENT '自增',
    record_id    bigint       NOT NULL                COMMENT '关联 apms_medical_record.id',
    file_name    varchar(200) NOT NULL                COMMENT '文件名',
    file_path    varchar(500) NOT NULL                COMMENT '存储路径',
    file_size    bigint       DEFAULT 0               COMMENT '文件大小（字节）',
    file_ext     varchar(10)  DEFAULT NULL            COMMENT '扩展名',
    upload_by    varchar(64)  DEFAULT ''              COMMENT '上传人',
    upload_time  datetime     DEFAULT NULL            COMMENT '上传时间',
    PRIMARY KEY (id),
    KEY idx_record_id (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='医疗附件';


-- ============================================================
-- 十、报告
-- ============================================================

CREATE TABLE apms_report (
    id               bigint       NOT NULL AUTO_INCREMENT COMMENT '自增',
    report_type      varchar(20)  NOT NULL                COMMENT 'individual/team',
    athlete_id       bigint       DEFAULT NULL            COMMENT '运动员ID（个人报告）',
    dept_id          bigint       DEFAULT NULL            COMMENT '队伍ID（团队报告）',
    task_id          bigint       DEFAULT NULL            COMMENT '关联任务ID',
    template_version varchar(20)  DEFAULT NULL            COMMENT '模板版本',
    content_snapshot longtext                              COMMENT '内容快照（JSON）',
    file_path        varchar(500) DEFAULT NULL            COMMENT 'PDF文件路径',
    generate_by      varchar(64)  DEFAULT ''              COMMENT '生成人',
    generate_time    datetime     DEFAULT NULL            COMMENT '生成时间',
    PRIMARY KEY (id),
    KEY idx_athlete_id (athlete_id),
    KEY idx_dept_id (dept_id),
    KEY idx_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报告记录';
