# APMS 运动员管理系统 — 详细设计

> 基于若依（RuoYi-Vue）框架二次开发，覆盖一期项目边界全部业务能力。

---

## 一、系统架构

### 1.1 技术基线

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vue 3 + Element Plus + Vite | 若依 RuoYi-Vue3 脚手架 |
| 后端 | Spring Boot 4.x + MyBatis + PageHelper | RuoYi-Vue 3.9.2 脚手架 |
| 数据库 | MySQL 8.0 | utf8mb4 字符集 |
| 缓存 | Redis 7.x | 会话、字典、限流 |
| 文件存储 | 本地 / NAS | 医疗附件、导入文件 |
| 部署 | Nginx + systemd | 前端静态 + 后端 JAR |

### 1.1.1 移动端策略

一期不开发独立 APP 或 H5 子站，采用 **PC 前端响应式适配**方案：

- 现有 Vue 3 + Element Plus 前端通过媒体查询适配手机浏览器访问
- 体能师/康复师用手机浏览器直接访问系统，无需安装
- 后端 API 完全复用，无额外接口开发成本
- demo prototype 已验证移动端布局可行（侧边栏抽屉化、卡片折行、表格横滚）
- 将来给运动员/家长开放独立流程时，再评估是否拆独立 H5 子站

### 1.2 模块规划

在若依 `ruoyi-admin` 下新增 `apms` 业务包，结构：

```
com.ruoyi.apms
├── controller     # 接口层
├── service        # 业务层
├── domain         # 实体
├── mapper         # 数据访问
├── enums          # 枚举（RTP状态、任务状态等）
├── algorithm      # 算法实现（PHV、RSA等）
├── dto            # 传输对象
└── config         # APMS 专属配置
```

前端在 `src/views/apms/` 下新增页面，复用若依的 `@/components` 通用组件。

---

## 二、业务模块与页面映射

### 2.1 模块总览

| 模块 | 对应 demo 页面 | 后端 Controller | 前端路由 |
|------|---------------|-----------------|---------|
| 工作台 | index.html | ApmsDashboardController | /apms/dashboard |
| 队员档案 | profile.html | ApmsAthleteController | /apms/athlete |
| 健康与医疗 | health.html | ApmsHealthController | /apms/health |
| 生长发育 | phv.html | ApmsPhvController | /apms/phv |
| 指标矩阵 | matrix.html | ApmsIndicatorController | /apms/indicator |
| 测试模型 | models.html | ApmsTestModelController | /apms/test-model |
| 测试任务 | tasks.html | ApmsTaskController | /apms/task |
| 分析报告 | report.html | ApmsReportController | /apms/report |
| 组织机构 | org.html | 复用 RuoYi sys_dept | /apms/org |
| 角色权限 | rbac.html | 复用 RuoYi sys_role/menu | /apms/rbac |

### 2.2 菜单挂载

在 `sys_menu` 表中新增 APMS 顶级目录，按 demo 侧边栏四大分组挂载子菜单：

```
APMS（顶级目录）
├── 日常管理
│   ├── 工作台
│   └── 队员档案
├── 科研测试
│   ├── 指标矩阵
│   ├── 测试模型
│   ├── 测试任务
│   └── 分析报告
├── 健康与安全
│   ├── 健康与医疗
│   └── 生长发育
└── 环境
    ├── 组织机构
    └── 角色权限
```

### 2.3 角色与权限设计

复用若依 `sys_role` + `sys_menu` 的 RBAC 机制，新增 5 个预置角色：

| 角色 | 角色Key | 权限范围 |
|------|---------|---------|
| 体能师 | apms_coach | 档案查看、测试任务管理、结果录入、报告查看 |
| 康复师 | apms_rehab | 档案查看、RTP 状态修改、医疗附件管理、报告查看 |
| 队医 | apms_doctor | 档案查看、医疗附件管理、RTP 查看（不可改）、报告查看 |
| 主教练 | apms_head_coach | 全部查看、报告查看/导出、不可修改测试结果 |
| 科研人员 | apms_researcher | 全部查看、指标/模型配置、组合模型管理、报告查看 |

RTP 状态修改按钮仅对 `apms_rehab` 角色可见；测试结果录入仅对 `apms_coach` 和 `apms_researcher` 可见。

---

## 三、数据库设计

在 `ry-vue` 数据库中新增 APMS 业务表，表名前缀 `apms_`。复用若依的 `sys_dept`（机构/队伍/小组）和 `sys_role`（角色），但 **`sys_user` 仅用于系统登录账号，运动员实体独立存在于 `apms_athlete` 表中**，两者通过可空的 `user_id` 关联。

> **sys_dept 使用约定**：若依 `sys_dept` 的树形结构天然适配"机构 → 队伍 → 小组"层级。APMS 给 `sys_dept` 新增一列 `dept_type varchar(2)`（配合 `sys_dict_data` 管理值：10=机构、20=队伍、30=训练小组、40=科研小组、50=恢复小组），显式区分层级语义，不靠树深度推断。运动员的主队伍归属用 `primary_team_id` 指向 `sys_dept`（dept_type=20），多小组归属通过 `apms_athlete_group` 带时间窗口的独立记录追踪。

#### sys_dept 扩展字段

> 在若依 `sys_dept` 表上新增一列，不改原有结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| dept_type | varchar(2) | 10=机构、20=队伍、30=训练小组、40=科研小组、50=恢复小组 |

字典数据初始化（`sys_dict_type` + `sys_dict_data`）：

```sql
-- 字典类型
INSERT INTO sys_dict_type VALUES (NULL, '部门类型', 'apms_dept_type', 'N', '0', 'admin', sysdate(), '', NULL, 'APMS 组织层级');

-- 字典数据
INSERT INTO sys_dict_data VALUES
(NULL, 1, '机构',     '10', 'apms_dept_type', '', 'info',    'Y', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 2, '队伍',     '20', 'apms_dept_type', '', 'success', 'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 3, '训练小组', '30', 'apms_dept_type', '', 'primary', 'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 4, '科研小组', '40', 'apms_dept_type', '', 'warning', 'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 5, '恢复小组', '50', 'apms_dept_type', '', 'danger',  'N', '0', 'admin', sysdate(), '', NULL, NULL);
```

```sql
-- 字典类型：医疗记录类型
INSERT INTO sys_dict_type VALUES (NULL, '医疗记录类型', 'apms_medical_type', 'N', '0', 'admin', sysdate(), '', NULL, 'APMS 医疗附件分类');

-- 字典数据
INSERT INTO sys_dict_data VALUES
(NULL, 1, 'MRI检查',      'MRI',  'apms_medical_type', '', 'danger',  'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 2, 'CT检查',       'CT',   'apms_medical_type', '', 'warning', 'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 3, '超声检查',     'US',   'apms_medical_type', '', 'info',     'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 4, 'X光检查',      'XRAY', 'apms_medical_type', '', 'info',     'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 5, '血液检验',     'LAB',  'apms_medical_type', '', 'primary',  'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 6, '康复评估',     'REHAB','apms_medical_type', '', 'success',  'N', '0', 'admin', sysdate(), '', NULL, NULL),
(NULL, 7, '其他',         'OTHER','apms_medical_type', '', '',         'N', '0', 'admin', sysdate(), '', NULL, NULL);
```

### 3.1 组织与运动员

#### apms_athlete — 运动员主实体

> APMS 独立实体，一人一档的核心标识。**不依赖 `sys_user`**——运动员无需系统登录账号即可建档。
> 仅当未来需要给运动员开放移动端/家长端时，才通过 `user_id` 关联 `sys_user`。

| 字段 | 类型 | 说明 |
|------|------|------|
| athlete_id | bigint PK AI | 运动员ID（自增，APMS 独立主键） |
| user_id | bigint NULL | 关联 sys_user（仅在需要登录账号时填写，默认 NULL） |
| name | varchar(50) | 姓名 |
| gender | char(1) | 性别（0男 1女） |
| birthday | date | 出生日期 |
| phone | varchar(20) | 联系电话（可选） |
| primary_team_id | bigint | 所属主队伍（sys_dept，队伍层级） |
| jersey_no | varchar(8) | 球衣号码 |
| position | varchar(20) | 位置（前锋/中前卫/守门员等） |
| status | char(1) | 状态（0正常 1离队 2退役） |
| create_by | varchar(64) | 创建人（系统操作员） |
| create_time | datetime | 创建时间 |
| update_by | varchar(64) | 更新人 |
| update_time | datetime | 更新时间 |

#### apms_athlete_group — 运动员-小组归属（带历史追踪）

> 运动员的小组归属是可追踪的历史记录，而非简单的多对多关系。
> 同一运动员可多次进出同一小组（如康复组 → 退出 → 再次进入），每条记录独立。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| athlete_id | bigint | 运动员ID |
| dept_id | bigint | 小组ID（sys_dept，小组层级） |
| group_type | varchar(20) | 类型（training/research/recovery） |
| join_date | date | 加入日期 |
| leave_date | date NULL | 离开日期（NULL=当前在组） |
| status | char(1) | 0=在组 1=已离组 |
| create_by | varchar(64) | 操作人 |
| create_time | datetime | 创建时间 |

### 3.2 基础体态测量

#### apms_body_measure — 体态测量记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| athlete_id | bigint | 运动员ID |
| measure_date | date | 测量日期 |
| height | decimal(5,1) | 站立身高 cm |
| weight | decimal(5,1) | 体重 kg |
| sit_height | decimal(5,1) | 坐高 cm |
| body_fat_rate | decimal(4,1) | 体脂率 %（可选） |
| waist | decimal(5,1) | 腰围 cm（可选） |
| data_source | varchar(20) | 来源（manual/csv/import） |
| create_by | varchar(64) | 操作人 |
| create_time | datetime | 录入时间 |

### 3.3 RTP 参训状态

#### apms_rtp_status — 当前 RTP 状态

> 每个运动员一条当前状态记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| athlete_id | bigint UQ | 运动员ID（唯一） |
| status | char(1) | g=正常 y=限制 r=不建议 |
| reason | varchar(500) | 标记原因 |
| training_limit | varchar(500) | 训练限制说明 |
| next_review_date | date | 下次复核日期 |
| updated_by | varchar(64) | 操作人 |
| updated_time | datetime | 操作时间 |

#### apms_rtp_log — RTP 状态变更日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| athlete_id | bigint | 运动员ID |
| from_status | char(1) | 变更前状态 |
| to_status | char(1) | 变更后状态 |
| reason | varchar(500) | 变更原因 |
| training_limit | varchar(500) | 训练限制 |
| operator_id | bigint | 操作人（sys_user） |
| operator_name | varchar(64) | 操作人姓名 |
| operate_time | datetime | 操作时间 |

### 3.4 PHV 生长发育

#### apms_phv_record — PHV 测量与计算记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| athlete_id | bigint | 运动员ID |
| gender | char(1) | 性别（0男 1女） |
| measure_date | date | 测量日期 |
| decimal_age | decimal(4,2) | 精确年龄（0.01岁） |
| height | decimal(5,1) | 站立身高 cm |
| sit_height | decimal(5,1) | 坐高 cm |
| weight | decimal(5,1) | 体重 kg |
| father_height | decimal(5,1) | 父亲身高 cm |
| mother_height | decimal(5,1) | 母亲身高 cm |
| leg_length | decimal(5,1) | 腿长（身高-坐高，计算值） |
| -- 以下为算法输出 -- | | |
| maturity_offset | decimal(4,2) | 成熟度偏移 |
| predicted_phv_age | decimal(4,2) | 预计PHV年龄 |
| predicted_adult_height | decimal(5,1) | 预测成年身高 |
| mirwald_version | varchar(20) | Mirwald 公式版本 |
| khamis_version | varchar(20) | Khamis-Roche 公式版本 |
| input_snapshot | text | 完整输入快照（JSON） |
| create_by | varchar(64) | 操作人 |
| create_time | datetime | 计算时间 |

### 3.5 指标矩阵

#### apms_indicator — 指标库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| category | varchar(20) | 分类（形态/机能/素质/筛查） |
| name | varchar(50) | 指标名称 |
| unit | varchar(20) | 单位 |
| data_type | varchar(20) | 数据类型（number/decimal/text/select） |
| ref_min | decimal(14,4) | 参考下限（可选） |
| ref_max | decimal(14,4) | 参考上限（可选） |
| collection_method | varchar(20) | 采集方式（manual/device/csv） |
| status | char(1) | 0=启用 1=停用 |
| version | varchar(20) | 有效版本 |
| create_time | datetime | 创建时间 |

#### apms_indicator_ref — 参考范围（按性别/年龄组/队伍）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| indicator_id | bigint | 指标ID |
| gender | char(1) | 适用性别 |
| age_group | varchar(20) | 年龄组（如 U16/U18） |
| dept_id | bigint | 适用队伍（0=全机构） |
| ref_min | decimal(14,4) | 参考下限 |
| ref_max | decimal(14,4) | 参考上限 |
| model_version | varchar(20) | 参考口径版本 |

### 3.6 测试模型

#### apms_test_model — 测试模型库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| category | varchar(20) | 分类（耐力/速度耐力/敏捷/带球敏捷/组合） |
| name | varchar(50) | 模型名称 |
| code | varchar(30) | 模型编码（如 YOYO_IR1） |
| protocol | text | 测试规程描述 |
| is_combo | char(1) | 是否组合模型 |
| algo_version | varchar(20) | 算法版本 |
| status | char(1) | 0=启用 1=停用 |
| create_time | datetime | 创建时间 |

#### apms_test_model_field — 模型记录字段定义

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| model_id | bigint | 模型ID |
| field_key | varchar(30) | 字段Key（如 total_distance） |
| field_name | varchar(50) | 显示名（如 完成总距离） |
| unit | varchar(20) | 单位 |
| data_type | varchar(20) | 数据类型 |
| required | char(1) | 是否必填 |
| sort_order | int | 排序 |

#### apms_combo_model — 组合模型

> 组合模型本身的主表，定义归一化方法、计算公式和版本。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| model_id | bigint | 关联 apms_test_model.id |
| normalization_method | varchar(30) | 归一化方法（z_score / percentile / custom） |
| formula | text | 计算公式描述（人读文档，不用于动态执行） |
| ref_version | varchar(20) | 参考组口径版本 |
| algo_version | varchar(20) | 算法版本 |

> `formula` 仅作人读注释，实际计算由 `normalization_method` + `apms_combo_component`（权重 + 方向）编程实现，不做动态公式解析。

#### apms_combo_component — 组合模型组成项

> 每行一个组成指标及其权重，清晰的树状归属。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| combo_model_id | bigint | 关联 apms_combo_model.id |
| indicator_id | bigint | 关联 apms_indicator.id |
| weight | decimal(5,2) | 权重（如 0.50） |
| direction | char(1) | 0=越大越好（功率） 1=越小越好（冲刺时间） |
| sort_order | int | 排序 |

> `direction` 直接影响 Z 分计算：
> - direction=0（越大越好）：Z = (x - μ) / σ
> - direction=1（越小越好）：Z = -(x - μ) / σ
>
> 不翻转会导致冲刺快的运动员得分反而低。

### 3.7 测试任务

#### apms_test_task — 测试任务

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| task_name | varchar(100) | 任务名称 |
| target_dept_id | bigint | 目标小组 |
| tester_id | bigint | 主测责任人（sys_user） |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |
| status | varchar(20) | pending/in_progress/completed |
| create_by | varchar(64) | 创建人 |
| create_time | datetime | 创建时间 |

> **不存 `total_count` / `done_count`**，完成人数和完成率实时计算：
> ```sql
> -- 目标人数
> SELECT COUNT(*) FROM apms_task_member WHERE task_id = ?
> -- 已测人数（以结果表为准）
> SELECT COUNT(DISTINCT athlete_id) FROM apms_test_result WHERE task_id = ?
> ```
> 本系统规模不大（几十到几百名运动员），MySQL 聚合无压力，避免三处状态不一致。

#### apms_task_indicator — 任务关联指标

| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | bigint | 任务ID |
| indicator_id | bigint | 指标ID |
| model_id | bigint | 测试模型ID（可选） |
| PK | (task_id, indicator_id) | 联合主键 |

#### apms_task_member — 任务成员

> `status` 反映运动员在本任务中的完成进度，三态而非二元。
> 一个任务可含多项指标（身高、体重、30m、RSA），部分完成不算"已测"。

| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | bigint | 任务ID |
| athlete_id | bigint | 运动员ID |
| status | varchar(20) | pending=未测 partial=部分完成 completed=全部完成 |
| PK | (task_id, athlete_id) | 联合主键 |

> `status` 由录入结果时自动推算：该运动员在本任务应测指标中已录入结果的比例决定 pending/partial/completed。
> 任务卡片上的完成率 = `COUNT(status='completed') / COUNT(*)`，实时计算不存库。

### 3.8 测试结果

#### apms_test_result — 测试结果主记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| task_id | bigint NULL | 任务ID（可为空——支持不走任务流程直接补录体态/单项测量） |
| athlete_id | bigint | 运动员ID |
| model_id | bigint NULL | 测试模型ID（可为空——体态测量不一定对应某个测试模型） |
| measure_date | date | 测试日期 |
| data_source | varchar(20) | 来源（manual/csv/device） |
| raw_payload | json NULL | 原始设备 payload（保留导入时的完整原始数据，不作规范化用途） |
| create_by | varchar(64) | 录入人 |
| create_time | datetime | 录入时间 |

#### apms_test_result_value — 规范化测试结果值

> 核心设计：数字按数字存，文本按文本存，不做 varchar 化。
> 趋势分析、AVG/MAX/MIN、参考范围判断、组合计算均直接基于 `numeric_value` 操作。
> **业务约束：`indicator_id` 和 `field_id` 不能同时为 NULL**——至少有一个非空，用于标识该值的来源。
>
> **多次试测**：专项测试（30m 冲刺、CMJ、伊利诺伊等）常有多次试测取最佳成绩，每行一条试测记录。
> 与 RSA 的 `apms_test_result_rep`（同一次 attempt 内部的多趟 reps）是不同维度。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| result_id | bigint | 关联 apms_test_result.id |
| indicator_id | bigint NULL | 关联 apms_indicator.id（如该值对应已注册指标） |
| field_id | bigint NULL | 关联 apms_test_model_field.id（如该值对应模型字段定义） |
| field_key | varchar(30) | 字段Key（冗余，便于无 field_id 时查询） |
| field_name | varchar(50) | 字段名（冗余，便于展示） |
| numeric_value | decimal(14,4) NULL | 数值型结果（身高、时间、距离、功率等） |
| text_value | varchar(500) NULL | 文本型结果（终止阶段、主观描述等） |
| unit | varchar(20) | 单位 |
| is_derived | char(1) | 0=原始录入值 1=算法派生值（如 RSA 衰减率） |
| attempt_no | int NULL | 第几次试测（1/2/3…，NULL=无试测概念如体态） |
| is_valid | char(1) | 0=有效 1=无效（如抢跑、犯规） |
| is_selected | char(1) | 0=否 1=选中（取最佳成绩时标记哪条被采纳） |
| invalid_reason | varchar(200) | 无效原因（如"抢跑"、"犯规"，is_valid=1 时填写） |

> **试测数据使用约定**：
> - 趋势分析和组合计算只取 `is_valid=0 AND is_selected=1` 的值
> - 示例：张三 30m 冲刺 3 次试测，attempt 2 成绩 4.25s 被选中 → 组合计算和趋势只用 4.25
> - `attempt_no` 为 NULL 表示该指标无试测概念（如身高只测一次），直接取 `numeric_value`

#### apms_test_result_rep — 原始多次/多趟数据

> 用于 RSA 等需要保留每次原始成绩的场景。每趟成绩单独一行，支持多趟统计。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| result_id | bigint | 关联 apms_test_result.id |
| field_key | varchar(30) | 字段Key（如 sprint_time） |
| rep_no | int | 第几次/趟 |
| value | decimal(14,4) | 原始值（数字） |
| unit | varchar(20) | 单位 |

### 3.9 医疗附件

#### apms_medical_record — 医疗记录

> 轻量级医疗事件归档，每个记录可挂多个附件。
> 定位为"临床医疗检查结果归档"，不是完整 EMR。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| athlete_id | bigint | 运动员ID |
| record_type | varchar(30) | 记录类型（MRI/CT/超声/X光/血液检验/康复评估/其他） |
| record_date | date | 检查/记录日期 |
| institution | varchar(100) | 来源机构 |
| title | varchar(200) | 记录标题（如"右膝MRI检查报告"） |
| remark | varchar(500) | 备注（病情摘要、医生建议等，可选） |
| create_by | varchar(64) | 创建人 |
| create_time | datetime | 创建时间 |

#### apms_medical_file — 医疗附件

> 挂在医疗记录下，一条记录可关联多个附件文件。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| record_id | bigint | 关联 apms_medical_record.id |
| file_name | varchar(200) | 文件名 |
| file_path | varchar(500) | 存储路径 |
| file_size | bigint | 文件大小（字节） |
| file_ext | varchar(10) | 扩展名（PDF/JPG/PNG） |
| upload_by | varchar(64) | 上传人 |
| upload_time | datetime | 上传时间 |

> 改动说明：`file_type` 和 `source` 上移到 `apms_medical_record` 的 `record_type` 和 `institution`；附件表只管文件本身，不再重复存储业务语义。

### 3.10 报告

#### apms_report — 报告记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| report_type | varchar(20) | individual/team |
| athlete_id | bigint | 运动员ID（个人报告） |
| dept_id | bigint | 队伍ID（团队报告） |
| task_id | bigint | 关联任务ID |
| template_version | varchar(20) | 模板版本 |
| content_snapshot | text | 内容快照（JSON） |
| file_path | varchar(500) | PDF 文件路径 |
| generate_by | varchar(64) | 生成人 |
| generate_time | datetime | 生成时间 |

### 3.11 表关系总览

```
sys_user（系统登录账号）    sys_dept（机构 → 队伍 → 小组，树形结构）
    │                          │
    │ user_id (NULL)            │ primary_team_id
    │                          │
    └────→ apms_athlete ←──────┘
              │      ↑
              │      └── apms_athlete_group ──── sys_dept（小组）
              │           （带 join_date / leave_date / status）
              │
    ┌─────────┼──────────────┐──────────────┐
    │         │              │              │
    ▼         ▼              ▼              ▼
 apms_body_  apms_rtp_   apms_phv_    apms_medical_
 measure     status/log  record       file
    │
    │
    ▼
 apms_test_task ──── apms_task_indicator ──── apms_indicator
    │                                    ──── apms_test_model
    │                                               │
    ├── apms_task_member                       apms_test_model_field
    │
    └── apms_test_result ── apms_test_result_value（规范化值，numeric/text 分列）
                         ── apms_test_result_rep（多趟原始成绩）
                              │
                              ▼
                         apms_report
```

**关键设计决策**

| 概念 | 表 | 说明 |
|------|-----|------|
| 系统操作员 | `sys_user` | 体能师、康复师、队医等可登录系统的人员 |
| 运动员 | `apms_athlete` | 被管理的运动员，拥有独立的 `athlete_id` |
| 可选关联 | `apms_athlete.user_id → sys_user.user_id` | 仅在运动员需要登录时才建立，默认 NULL |
| 主队伍 | `apms_athlete.primary_team_id → sys_dept` | 运动员所属主队伍（唯一），与小组归属分离 |
| 小组归属 | `apms_athlete_group` | 独立记录，带 `join_date`/`leave_date`/`status`，支持历史追踪 |

---

## 四、算法实现设计

### 4.1 Mirwald 成熟度偏移

- 输入：年龄、站立身高、坐高、体重、性别
- 腿长 = 站立身高 - 坐高（计算值，不单独录入）
- 男女公式不同（见知识库 `algorithm/mirwald.md`）
- 输出：成熟度偏移（decimal）、预计PHV年龄 = 当前年龄 - 偏移
- 实现类：`MirwaldCalculator`，版本号 `mirwald-v1`
- 必须保存：算法ID、算法版本、性别、全部输入值、测量日期、输出值、计算时间

### 4.2 Khamis-Roche 预测成年身高

- 输入：年龄、性别、当前身高、体重、父亲身高、母亲身高
- **当前状态**：用户需求未给出可直接落地的完整系数表，算法标记为 `NOT_CONFIGURED`
- **实施策略**：实现 `KhamisRocheCalculator` 类和数据库 schema，但 `calculate()` 在参数确认前直接拒绝计算（抛出 `AlgorithmNotConfiguredException`），不产生任何假数字
- 界面显示：「成年身高预测算法待业务方确认参数后启用」，不展示任何预测值
- 待业务方确认系数表后，填入参数、切换状态为 `READY`，才正式计算
- 版本号 `khamis-roche-v1-pending`，参数确认后升版为 `khamis-roche-v1`

### 4.3 RSA 冲刺衰减率

- 输入：每趟冲刺时间 t1...tn，冲刺次数 n
- 总时间 = Σti，最佳 = min(ti)，平均 = Σti/n
- Sdec = (总时间 - 最佳×n) / (最佳×n) × 100%
- 实现类：`RsaDecayCalculator`，版本号 `rsa-decay-v1`
- **禁止只保存 Sdec 而丢弃原始单趟成绩**

### 4.4 组合指数

- 将不同测试结果按权重转换为标准分后合成
- Z 分 = (实际值 - 参考组均值) / 参考组标准差
- T 分 = 50 + 10 × Z（标准 T-score，非自定义 0～100 分）
- 组合分 = Σ(T 分 × 权重)
- 实现类：`ComboScoreCalculator`
- 展示原始值、T 分、组合分，保证可复核

> **T 分值域与 demo 数据对齐**：标准 T 分范围大致 20～80（±3σ 覆盖 99.7%），报告页柱状图值域设为 20～80。
> demo [mock.js](file:///prototype/assets/mock.js) 中现有的 90/82/56/91/75 是旧的 0～100 风格，开发时替换为 T 分值。

> **参考组统计量来源**：μ 和 σ 不是算法参数，而是数据参数。
> - 从 `apms_test_result_value` 按同队伍、同年龄组、同指标的历史数据实时聚合计算
> - 设最低样本量门槛：N < 5 时不计算 T 分，界面显示「样本不足，无法生成标准分」
> - 门槛值写入 `apms_combo_model` 的配置或系统参数项，不硬编码
> - 系统上线初期数据不足属正常状态，不造假、不降门槛

### 4.5 算法版本管理

所有算法实现统一接口：

```java
public enum AlgorithmStatus {
    READY,            // 参数已确认，可正式计算
    NOT_CONFIGURED    // 参数未确认，拒绝计算
}

public interface AlgorithmCalculator<I, O> {
    String getAlgorithmId();
    String getVersion();
    AlgorithmStatus getStatus();
    O calculate(I input);   // NOT_CONFIGURED 时抛出 AlgorithmNotConfiguredException
    AlgorithmSnapshot snapshot(I input, O output);
}
```

每次计算保存完整快照（输入、输出、版本、时间），不可事后篡改。

当前各算法状态：

| 算法 | 版本 | 状态 |
|------|------|------|
| Mirwald 成熟度偏移 | mirwald-v1 | READY |
| Khamis-Roche 成年身高 | khamis-roche-v1-pending | NOT_CONFIGURED |
| RSA 衰减率 | rsa-decay-v1 | READY |
| 组合指数（T 分） | combo-tscore-v1 | READY |

---

## 五、接口设计

### 5.1 工作台

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/dashboard | GET | 在队人数、进行中任务、RTP汇总、本周新测量 |

### 5.2 运动员档案

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/athlete/list | GET | 运动员列表（含RTP状态） |
| /apms/athlete/{id} | GET | 运动员详情（基础信息+体态+最新专项表现+RTP限制） |
| /apms/athlete | POST | 新增运动员 |
| /apms/athlete | PUT | 修改运动员信息 |
| /apms/athlete/{id}/body-measures | GET | 历次体态记录 |
| /apms/athlete/{id}/body-measure | POST | 录入体态测量 |
| /apms/athlete/import | POST | 模板批量导入 |

### 5.3 RTP 参训状态

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/health/rtp/{athleteId} | GET | 查看当前RTP状态 |
| /apms/health/rtp | PUT | 修改RTP状态（康复师权限） |
| /apms/health/rtp/{athleteId}/logs | GET | 状态变更日志 |
| /apms/health/rtp/summary | GET | 全队RTP汇总（红黄绿计数） |
| /apms/health/medical/{athleteId}/records | GET | 医疗记录列表（含附件） |
| /apms/health/medical/record | POST | 新建医疗记录 |
| /apms/health/medical/record/{id} | PUT | 修改医疗记录 |
| /apms/health/medical/record/{id} | DELETE | 删除医疗记录（级联删除附件文件） |
| /apms/health/medical/record/{recordId}/files | GET | 某条记录下的附件列表 |
| /apms/health/medical/record/{recordId}/upload | POST | 上传附件到指定医疗记录 |
| /apms/health/medical/file/{fileId} | DELETE | 删除单个附件 |

### 5.4 PHV 生长发育

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/phv/{athleteId}/records | GET | 历次PHV测量记录 |
| /apms/phv/calculate | POST | 录入数据并计算（保存输入+输出+版本） |
| /apms/phv/{athleteId}/trend | GET | 成长趋势折线数据 |

### 5.5 指标矩阵

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/indicator/list | GET | 指标列表（按分类） |
| /apms/indicator | POST | 新增指标 |
| /apms/indicator | PUT | 修改指标 |
| /apms/indicator/{id}/refs | GET | 参考范围列表 |
| /apms/indicator/{id}/ref | POST | 配置参考范围 |

### 5.6 测试模型

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/test-model/list | GET | 模型列表 |
| /apms/test-model/{id} | GET | 模型详情（含字段定义） |
| /apms/test-model | POST | 新增模型 |
| /apms/test-model/{id}/fields | PUT | 配置记录字段 |
| /apms/test-model/combo | POST | 新增组合模型 |

### 5.7 测试任务

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/task/list | GET | 任务看板列表 |
| /apms/task/{id} | GET | 任务详情（含成员完成情况） |
| /apms/task | POST | 创建任务 |
| /apms/task/{id}/indicators | PUT | 配置任务指标 |
| /apms/task/{id}/members | PUT | 配置任务成员 |
| /apms/task/{id}/result | POST | 录入测试结果（自动更新进度） |
| /apms/task/{id}/import | POST | CSV批量导入结果 |

### 5.8 分析报告

| 接口 | 方法 | 说明 |
|------|------|------|
| /apms/report/individual/{athleteId} | GET | 个人报告数据 |
| /apms/report/team/{deptId} | GET | 团队报告数据 |
| /apms/report/individual/{athleteId}/trend | GET | 趋势折线数据 |
| /apms/report/export | POST | 导出PDF |
| /apms/report/history | GET | 报告生成记录 |

---

## 六、前端页面设计

### 6.1 页面与 demo 对照

每个页面保持 demo 的布局结构，将 mock 数据替换为 API 调用。

#### 工作台 `/apms/dashboard`

- 4 张统计卡（在队队员、进行中任务、限制/不建议参训、本周新测量）
- 快捷入口（队员档案、新建任务、RTP复核、生成报告）
- 近期任务进度条
- RTP 分布饼图

#### 队员档案 `/apms/athlete`

- 左侧：队员列表（可按队伍/姓名筛选）
- 右侧：选中队员的档案详情
  - 头卡：姓名、号码、位置、RTP 状态徽章、大号编号
  - 基础体态卡：身高、体重、坐高、测量日期
  - 最新专项表现卡：Yo-Yo/RSA/伊利诺伊/CMJ 指标
  - RTP 参训限制卡：当前状态、训练限制、复核日期
  - 快捷跳转：PHV、测试记录、报告、医疗附件

#### 健康与医疗 `/apms/health`

- 顶部筛选：运动员 + 赛季
- RTP 总览：红/黄/绿三色统计卡
- 状态变更时间线：from→to、原因、操作人、时间
- 状态修改弹窗：原因、训练限制、下次复核日期（康复师可见）
- 医疗附件列表：文件名、类型、日期、来源、下载

#### 生长发育 `/apms/phv`

- 运动员选择 + 测量日期筛选
- 输入表单：年龄、身高、坐高、体重、父母身高
- 计算结果卡：成熟度偏移、预计PHV年龄、预测成年身高、身高占比
- 成长趋势折线图

#### 指标矩阵 `/apms/matrix`

- 四类指标卡片（身体形态/机能/素质/筛查）
- 每项指标：勾选框、名称、采集方式
- 底部：已选指标 → 下发任务按钮

#### 测试模型 `/apms/test-model`

- 模型卡片网格：名称、分类、规程、字段数
- 详情展开：记录字段表、参考区间说明
- 组合模型标记

#### 测试任务 `/apms/task`

- 任务卡片列表：名称、队伍、主测人、时间窗口、状态
- 进度条：已测/目标、完成率
- 成员级完成情况：姓名、号码、位置、已测/未测

#### 分析报告 `/apms/report`

- 报告类型切换（个人/团队）
- 个人报告：
  - 抬头：运动员信息、报告编号、日期
  - 多维表现概览柱状图（标准分）
  - 核心指标卡：当前值、单位、参考范围
  - 专业人员记录
  - 近5次测试历史表
  - PDF 导出按钮
- 团队报告：队员对比表 + 指标分布

### 6.2 通用组件复用

| 若依组件 | APMS 用途 |
|---------|----------|
| Pagination | 队员列表、任务列表分页 |
| RightToolbar | 列表页工具栏（搜索、刷新、列设置） |
| FileUpload | 医疗附件上传、CSV导入 |
| DictSelect | RTP状态、任务状态、指标分类等 |
| ImageUpload | 运动员头像 |
| DateRangeSelect | 任务时间窗口 |

### 6.3 前端目录结构

```
src/views/apms/
├── dashboard/index.vue       # 工作台
├── athlete/
│   ├── index.vue             # 列表 + 档案详情
│   └── components/           # 档案子组件
├── health/
│   ├── index.vue             # 健康与医疗
│   └── rtp-dialog.vue        # RTP 修改弹窗
├── phv/index.vue             # 生长发育
├── indicator/index.vue       # 指标矩阵
├── test-model/index.vue      # 测试模型
├── task/index.vue            # 测试任务
├── report/
│   ├── individual.vue        # 个人报告
│   └── team.vue              # 团队报告
├── org/index.vue             # 组织机构（复用 dept）
└── rbac/index.vue            # 角色权限（复用 role）
```

---

## 七、实施阶段规划

### 第一阶段：基础数据层（组织 + 运动员 + 体态）

- 数据库建表（apms_athlete, apms_athlete_group, apms_body_measure）
- 菜单与角色初始化 SQL
- 运动员 CRUD + 模板导入
- 体态测量录入与历史查询
- 工作台统计卡数据接口

### 第二阶段：RTP + PHV（健康与生长发育闭环）

- RTP 状态管理与变更日志
- PHV 测量录入 + Mirwald 计算
- Khamis-Roche 占位实现（待系数确认）
- 成长趋势折线图
- 医疗附件上传与权限控制

### 第三阶段：测试闭环（指标 + 模型 + 任务 + 结果）

- 指标矩阵库 CRUD
- 测试模型库 + 字段定义
- 测试任务创建与进度看板
- 测试结果录入（手工 + CSV）
- RSA 衰减率计算
- 组合指数计算

### 第四阶段：报告与趋势

- 个人综合报告模板
- 团队报告模板
- 趋势折线分析
- PDF 导出
- 报告版本记录

### 第五阶段：部署与验收

- 服务器部署（39.97.246.69）
- 全链路联调
- 验收清单逐项确认

---

## 八、验收对照表

| 验收项 | 对应模块 | 对应 demo 页面 |
|--------|---------|---------------|
| 运动员档案可完整关联各类数据 | 运动员档案 | profile.html |
| RTP 状态可按权限维护并留痕 | 健康与医疗 | health.html |
| PHV 可按确认公式计算 | 生长发育 | phv.html |
| 指标可配置、任务可下发 | 指标矩阵 + 测试任务 | matrix.html + tasks.html |
| 测试结果可录入并更新进度 | 测试任务 | tasks.html |
| 组合结果可计算和复核 | 测试模型 + 测试结果 | models.html |
| 趋势和报告可展示并导出 PDF | 分析报告 | report.html |
| 权限能够隔离不同角色操作 | 角色权限 | rbac.html |
| 系统可在采购方环境部署运行 | 部署 | — |

---

## 九、测试策略

### 9.1 算法单元测试

为每个已确认公式准备 **golden cases**（固定输入 → 固定正确输出），代码改动后一跑即知公式有没有被改坏。

| 算法 | 测试用例 | 说明 |
|------|---------|------|
| Mirwald（男） | 身高 175 / 体重 65 / 坐高 92 / 年龄 14.2 → 预期 PHV 值 | 验证成熟度偏移计算 |
| Mirwald（女） | 身高 162 / 体重 52 / 坐高 86 / 年龄 12.8 → 预期 PHV 值 | 性别系数不同 |
| RSA 衰减率 | 7 趟成绩 [4.31, 4.42, 4.50, 4.48, 4.55, 4.61, 4.70] → 预期衰减率 | 验证公式：((sum(best) - sum(actual)) / (best × N)) × 100 |
| 组合指数 | 两个指标值 + 权重 + direction → 预期 T 分 + 组合分 | 验证 Z 分方向翻转 + 加权 |

Khamis-Roche 不写 golden case（NOT_CONFIGURED 状态下 `calculate()` 直接拒绝，无数字输出）。

### 9.2 业务测试

| 场景 | 验证点 |
|------|--------|
| RTP 只能康复师修改 | 非康复师角色调用修改接口返回 403 |
| RTP 日志正确追加 | 每次状态变更后 `apms_rtp_log` 新增一条，旧记录不变 |
| 任务进度正确 | `apms_task_member.status` 与 `apms_test_result` 实际数据一致（pending/partial/completed） |
| CSV 重复导入 | 同一 task_id + athlete_id 重复导入时提示已存在，不产生重复数据 |
| 多次试测最佳成绩 | 3 次 attempt 中 `is_selected=1` 的那条是最优有效值，无效成绩不参与 |

### 9.3 安全测试

| 场景 | 验证点 |
|------|--------|
| 未登录不能下载医疗附件 | 无 token 访问 `/apms/medical/file/download` 返回 401 |
| 无医疗权限不能下载 | 有 token 但角色无 `apms:medical:list` 权限返回 403 |
| 越权访问其他队伍运动员 | 体能师 A 查询体能师 B 队伍的运动员列表返回空 |

### 9.4 验收测试

对照项目边界验收项，逐页手动走查：

| 验收项 | 测试路径 | 对应 demo |
|--------|---------|-----------|
| 数字档案 | 新建运动员 → 录入体态 → 查看档案页数据完整 | profile.html |
| RTP | 修改 RTP 状态 → 查看日志 → 验证权限隔离 | health.html |
| PHV | 录入身高体重坐高 → Mirwald 计算结果正确 → Khamis 显示"待启用" | phv.html |
| 指标/任务 | 配置指标 → 创建任务 → 分配运动员 → 录入结果 → 进度更新 | matrix.html + tasks.html |
| 专项测试 | 录入 30m 冲刺 3 次试测 → 最佳成绩自动标记 → RSA 7 趟衰减率计算 | models.html |
| 趋势 | 同一运动员多次录入 → 折线图正确渲染 → 参考区间标注 | report.html |
| PDF 导出 | 生成个人报告 → 下载 PDF → 内容与页面一致 | report.html |
