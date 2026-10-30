# 运动员训练数据管理系统 — 详细设计

> 基于若依（RuoYi-Vue 3.9.2）框架二次开发，覆盖一期项目边界全部业务能力。
>
> **文档状态：v1.1（2026-10-30 按已上线实现校准）**
> v1.0 为实施前基线，模块名、菜单、路由与接口在实现期已收敛为「分组菜单 + 合并页」。
> 本文已同步现状；**实现事实以 `ruoyi-*` 代码、`patches/` 补丁与 `.trae/documents/` 为准**，
> 数据库变更只以 `patches/patch-<version>-<时间戳>.sql` 为部署源。

---

## 一、系统架构

### 1.1 技术基线

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Vue 3 + Element Plus + Vite | 若依 RuoYi-Vue3 脚手架 |
| 后端 | Java 17 + Spring Boot 4.1.0 + MyBatis XML + PageHelper | RuoYi-Vue 3.9.2 脚手架；工程不引入 MyBatis-Plus |
| 数据库 | MySQL 8.0 | utf8mb4 字符集 |
| 缓存 | Redis 7.x | 会话、字典、限流 |
| 文件存储 | 本地 / NAS | 医疗附件、导入文件 |
| 部署 | Nginx + systemd | 前端静态 + 后端 JAR |

### 1.1.1 移动端策略

Web/H5 采用同一 Vue 3 前端工程，PC 与移动浏览器使用响应式布局；不建设独立移动前端工程。

- 现有 Vue 3 + Element Plus 前端通过媒体查询适配手机浏览器访问
- 体能师/康复师用手机浏览器直接访问系统，无需安装
- 原则上复用现有 API，仅在移动场景确有必要时增加聚合接口
- demo prototype 已验证移动端布局可行（侧边栏抽屉化、卡片折行、表格横滚）
- 将来给运动员/家长开放独立流程时，再评估是否拆独立 H5 子站

### 1.2 模块规划

实现期未新建独立的 `com.ruoyi.apms` 工程，而是沿用若依分层：

```
ruoyi-admin     com.ruoyi.web.controller.apms          # 19 个 APMS Controller（含 VersionController）
ruoyi-system    com.ruoyi.system.domain.apms           # 实体
                com.ruoyi.system.mapper.apms           # Mapper 接口
                com.ruoyi.system.service.apms          # 业务服务与 impl
                com.ruoyi.system.util.apms             # Mirwald / Khamis-Roche / RSA / T 分 / AlgorithmStatus
                com.ruoyi.system.service.apms.batchimport # Excel/CSV 两阶段导入解析与校验
ruoyi-admin     resources/mapper/apms                   # MyBatis XML（30 份）
ruoyi-ui        src/views/apms                         # 18 个页面目录（含合并壳页）
```

前端页面统一复用若依 `@/components` 与 `src/assets/styles/roster-kit.scss`（花名册视觉规范）。

---

## 二、业务模块与页面映射

### 2.1 模块总览（已按上线实现校准）

| 一级分组 | 菜单/页面 | 前端组件 | 后端 Controller | 路由 |
|---------|----------|---------|-----------------|------|
| 总览 | 数据驾驶舱 | `apms/dashboard/index` | ApmsDashboardController | `/overview/cockpit`（`/index` 渲染同一组件） |
| 运动员 | 花名册（含运动员详情） | `apms/athlete/index`、`apms/athlete/detail.vue` | ApmsAthleteController、ApmsAthleteGroupController | `/athletes/roster`；详情 `/apms/athlete/detail/:athleteId` |
| 运动员 | 青训发育监控（合并页：体态测量 + PHV） | `apms/growth/index` | ApmsBodyMeasureController、ApmsPhvController | `/athletes/growth` |
| 测试 | 指标库与任务下发（合并页：指标 + 任务 + 结果） | `apms/dispatch/index` | ApmsIndicatorController、ApmsTestTaskController、ApmsTestResultController | `/testings/dispatch` |
| 测试 | 组合测试调度（合并页：测试模型 + 组合模型 + 组合评分） | `apms/comboDispatch/index` | ApmsTestModelController、ApmsComboModelController、ApmsComboScoreController | `/testings/combo-dispatch` |
| 健康 | 健康预警中心（合并页：RTP 状态 + RTP 风险预警） | `apms/healthAlert/index` | ApmsRtpController、ApmsRtpRiskController | `/healthcare/alert-center` |
| 健康 | 医疗康复 | `apms/medical/index` | ApmsMedicalController | `/healthcare/medical-care` |
| 分析 | 报告中心 | `apms/report/index` | ApmsReportController | `/analytics/report-center` |
| 系统 | 角色权限管理 / 组织架构 / 用户管理 | `system/role/index`、`system/dept/index`、`system/user/index` | RuoYi 原生 | `/sysmgr/role-acl`、`/sysmgr/org`、`/sysmgr/user` |
| 系统管理 | 登录页设计 | `system/loginConfig/index` | ApmsLoginConfigManageController（管理端）、ApmsLoginConfigController（公开端） | `/system/loginConfig` |

> **未进入导航但保留的独立页**：`bodyMeasure`、`phv`、`indicator`、`testTask`、`testResult`、`testModel`、`comboModel`、`comboScore`、`rtp`、`rtpWarning` 仍是独立页面组件，被合并壳页内嵌，同时保留旧链接直达能力（`getRouters` 只下发 2400 段菜单，旧 2200 段已隐藏但路由仍可注册）。
>
> **不再存在的模块**：早期设计中的 `apms/health`、`apms/task`、`apms/test-model`、`apms/org`、`apms/rbac` 均未实现，对应能力已合并到上表页面。

### 2.2 菜单挂载（2400 分组信息架构）

`sys_menu` 当前生效的是 2400 段分组树（2200 段旧平铺菜单已 `visible='1'` 隐藏）：

```
数据驾驶舱 2402（总览 2401）
运动员 2410
├── 花名册 2411                    → apms/athlete/index
└── 青训发育监控 2412（二级菜单）   → apms/growth/index（体态测量 + PHV）
测试 2420
├── 指标库与任务下发 2421（二级菜单）→ apms/dispatch/index（指标库 + 测试任务 + 测试结果）
└── 组合测试调度 2425（二级菜单）    → apms/comboDispatch/index（测试模型 + 组合模型 + 组合评分）
健康 2430
├── 健康预警中心 2431（二级菜单）    → apms/healthAlert/index（RTP 状态 + 风险预警）
└── 医疗康复 2434                   → apms/medical/index
分析 2440
└── 报告中心 2441                   → apms/report/index
系统 2450
├── 角色权限管理 2451               → system/role/index
├── 组织架构 2452                   → system/dept/index
└── 用户管理 2453                   → system/user/index
系统管理（menu_id=1）
└── 登录页设计 2300                 → system/loginConfig/index
```

- 合并页改造（patch-0.0.6-2610061640 / 2610061710）删除了三级菜单 2413/2414/2422/2423/2424/2426/2427/2432/2433 与 2415；按钮权限点（F 型）沿用 22xxx 段，按 `perms` 字符串授权，与菜单 ID 解耦。
- 专岗 `home_path` 统一为 `/overview/cockpit`（patch-0.0.7-261008170310）；前端守卫不再按角色分叉，登录后一律落地数据驾驶舱。


### 2.3 账号与角色设计（决策已冻结）

复用若依 `sys_role` + `sys_menu` 的 RBAC，账号分三层；D1–D11 决策全部冻结，权威方案见 [PERMISSION_DESIGN.md](./PERMISSION_DESIGN.md)。

| 层级 | 账号/角色 | 说明 | 权限边界 |
|------|----------|------|---------|
| 平台保留 | `admin`（userId=1，role_key=`admin`） | 交付方运维账号 | 全部菜单、菜单管理、系统监控、系统工具 |
| 客户超管 | `super`（userId=100，role_id=200） | 客户侧最高账号 | 2400 业务全菜单 + 用户/角色/部门/字典/参数/日志/登录页设计；**无菜单管理、系统监控、系统工具**；不可见 admin |
| 专岗 | `portal_coach` / `portal_tester` / `portal_medic` | 教练 / 测量员 / 队医，强制单角色 | 按分组授予读写权限，见下表 |

专岗写权限矩阵（patch-0.0.7-261007145310 冻结）：

| 专岗 | 默认入口 | 写权限（其余业务模块均为只读 list/query） |
|------|---------|------------------------------------------|
| 教练 `portal_coach` | `/overview/cockpit` | 运动员 add/edit/remove、体态 edit/remove、PHV edit/remove、组合评分 calculate/remove、报告 generate/remove |
| 测量员 `portal_tester` | `/overview/cockpit` | 指标库/测试模型/组合模型 add/edit/remove、测试任务 add/edit/remove、测试结果 add/edit/remove |
| 队医 `portal_medic` | `/overview/cockpit` | RTP edit/clear、RTP 风险 handle/scan、医疗记录 add/edit/remove、病历附件 remove |

公共只读：三个专岗均拥有各业务模块 list/query、病历附件下载、报告下载、部门树与测试人下拉。

> **导航模式现状**：专岗角色的 `portal_mode=1` 仍保留，但侧边栏已恢复渲染（patch-0.0.7-261007145310），仅标签页（TagsView）按 `portal_mode` 隐藏；admin/super 为 `portal_mode=0`，侧栏与标签页均显示。
>
> **权限校验双保险**：页面按钮用 `v-hasPermi` 隐藏，后端接口用 `@PreAuthorize` 拒绝；前端隐藏只是体验，接口权限点才是安全边界。

### 2.3.1 DataScope 实现方式

运动员独立存在于 `apms_athlete`，`primary_team_id` 指向 `sys_dept`。`@DataScope` 已挂在运动员、测试任务、测试结果、体态、PHV、医疗、报告、看板、风险预警等查询入口：

```java
@DataScope(
    deptAlias = "a",
    deptField = "primary_team_id"
)
public List<ApmsAthlete> selectAthleteList(ApmsAthlete a) { ... }
```

- **当前运行态**：admin、super 与三个专岗的 `data_scope` 均为 `1`（全部数据），且决策 D3 冻结“本期不做行级数据权限”，因此现网不做行级过滤。
- **未来启用**：把角色 `data_scope` 调为 2/3/4/5 即按注解生效，无需改业务代码。
- 医疗、测试、报告等运动员从属数据统一 JOIN 到 `apms_athlete.primary_team_id` 应用 DataScope，不另建数据权限体系（如 medical_file → medical_record → athlete.primary_team_id）。

> **DataScope 配置粒度约束（启用前必须遵守）**：由于 `primary_team_id` 指向“队伍”层级（`sys_dept.dept_type=20`），DataScope 实际权限粒度是**队伍级**。
> - **`sys_role_dept` 必须配置到“队伍”节点**（dept_type=20），不能配置到训练小组/科研小组/恢复小组（dept_type=30/40/50）
> - 原因：若依 DataScope 检查 `athlete.primary_team_id ∈ 角色配置的 dept 集合`，而运动员的 primary_team_id 是队伍级。如果把“康复组”配进 sys_role_dept，匹配的是 `primary_team_id = 康复组`，永远匹配不上（运动员 primary_team_id 是 U15 这样的队伍），康复师反而看不到任何运动员
> - **专项/康复/科研小组只用于业务分组**（`apms_athlete_group` 记录历史归属），**不作为数据权限节点**
> - 角色需要覆盖多支队伍时，在 sys_role_dept 中勾选多个“队伍”节点，而非勾选小组
> - 部门树配置示例：
>   ```
>   机构（dept_type=10）
>   └── U15 队（dept_type=20）  ← sys_role_dept 勾选这里
>       ├── 速度专项组（dept_type=30）  ← 不勾选，仅业务分组
>       └── 康复组（dept_type=50）       ← 不勾选，仅业务分组
>   ```

RTP 状态修改/清除由 `apms:rtp:edit` / `apms:rtp:clear` 控制（队医）；测试结果录入由 `apms:testResult:add/edit` 控制（测量员）；完整权限点矩阵见 PERMISSION_DESIGN §6。

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
INSERT INTO sys_dict_type (
    dict_name, dict_type, status, create_by, create_time, remark
) VALUES (
    '部门类型', 'apms_dept_type', 'N', '0', 'admin', sysdate(), 'APMS 组织层级'
);

-- 字典数据
INSERT INTO sys_dict_data (
    dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark
) VALUES
(1, '机构',     '10', 'apms_dept_type', '', 'info',    'Y', '0', 'admin', sysdate(), NULL),
(2, '队伍',     '20', 'apms_dept_type', '', 'success', 'N', '0', 'admin', sysdate(), NULL),
(3, '训练小组', '30', 'apms_dept_type', '', 'primary', 'N', '0', 'admin', sysdate(), NULL),
(4, '科研小组', '40', 'apms_dept_type', '', 'warning', 'N', '0', 'admin', sysdate(), NULL),
(5, '恢复小组', '50', 'apms_dept_type', '', 'danger',  'N', '0', 'admin', sysdate(), NULL);
```

```sql
-- 字典类型：医疗记录类型
INSERT INTO sys_dict_type (
    dict_name, dict_type, status, create_by, create_time, remark
) VALUES (
    '医疗记录类型', 'apms_medical_type', 'N', '0', 'admin', sysdate(), 'APMS 医疗附件分类'
);

-- 字典数据
INSERT INTO sys_dict_data (
    dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default, status, create_by, create_time, remark
) VALUES
(1, 'MRI检查',      'MRI',  'apms_medical_type', '', 'danger',  'N', '0', 'admin', sysdate(), NULL),
(2, 'CT检查',       'CT',   'apms_medical_type', '', 'warning', 'N', '0', 'admin', sysdate(), NULL),
(3, '超声检查',     'US',   'apms_medical_type', '', 'info',    'N', '0', 'admin', sysdate(), NULL),
(4, 'X光检查',      'XRAY', 'apms_medical_type', '', 'info',    'N', '0', 'admin', sysdate(), NULL),
(5, '血液检验',     'LAB',  'apms_medical_type', '', 'primary', 'N', '0', 'admin', sysdate(), NULL),
(6, '康复评估',     'REHAB','apms_medical_type', '', 'success', 'N', '0', 'admin', sysdate(), NULL),
(7, '其他',         'OTHER','apms_medical_type', '', '',        'N', '0', 'admin', sysdate(), NULL);
```

> **SQL 脚本工程约定**：所有 `INSERT` 语句必须显式写列名，不依赖表字段顺序。若依版本变动或字段顺序调整后脚本依然可用，避免"位置依赖"导致的插入错位。

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
| dept_id | bigint | 小组ID（sys_dept，小组层级；类型由 sys_dept.dept_type 决定） |
| join_date | date | 加入日期 |
| leave_date | date NULL | 离开日期（NULL=当前在组） |
| status | char(1) | 0=在组 1=已离组 |
| create_by | varchar(64) | 操作人 |
| create_time | datetime | 创建时间 |

### 3.2 基础体态测量

#### apms_body_measure — 体态测量记录

> 原始测量事实。PHV 计算时通过 `apms_phv_record.source_measure_id` 回溯到这条记录。
> 即使后续修正了身高数据，也能解释"2026年9月当时基于该测量值算出的 PHV 是多少"。
>
> **体态数据唯一业务真源**：`apms_body_measure` 是身高/体重/坐高的唯一真源。
> 当测试任务包含 HEIGHT/WEIGHT/SIT_HEIGHT 指标时，业务服务将同一次测量会话（session）下的多个 result 聚合 upsert 到一条 `apms_body_measure`；
> `apms_test_result_value` 记录任务上下文（哪个任务、哪个 attempt 录的），但不形成第二套独立体态事实。
> 运动员档案页、PHV 计算、趋势分析均从 `apms_body_measure` 读取，不从 `apms_test_result_value` 读体态数据。
>
> **测量会话（measure_session_key）**：解决"一个任务下 HEIGHT/WEIGHT/SIT_HEIGHT 三个 task_item 各产生独立 result，但实际是同一次体态测量"的聚合问题。
> - 一次现场测量生成一个 `session_key`（前端生成 UUID 或 `{taskId}-{yyyyMMddHHmm}-{seq}` 格式）
> - 同一 session 下的多个 `apms_test_result` 共享该 session_key
> - 业务服务按 session_key 聚合所有相关 result 的 value，统一 upsert 到一条 `body_measure`
>
> **同步/更新规则**：
> - 任务流程录入：按 `athlete_id + measure_date + source_task_id + source_session_key` 聚合 → 同 session 的 height/weight/sit_height 等字段合并到一条 body_measure（更新已有或新增）
> - 不同 session（如同日上下午各测一次）：各自独立成行，保留为不同 body_measure 记录
> - 非任务手工录入（`source_task_id=NULL, source_session_key=NULL`）：按 `athlete_id + measure_date` 判定是否更新；同日多次手工录入以最后一条为准
> - PHV 计算通过 `apms_phv_record.source_measure_id` 明确回溯到具体哪条 `body_measure`，不依赖隐式推断
> - 若需要从 body_measure 反查具体是哪几个 result 录入的，通过 `source_session_key` 反查 `apms_test_result.session_key` 即可，无需在 body_measure 上冗余存 result_id

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
| data_source | varchar(20) | 来源（manual/csv/import/task） |
| source_task_id | bigint NULL | 来源任务ID（任务流程录入时指向 apms_test_task.id；非任务录入为 NULL） |
| source_session_key | varchar(50) NULL | 来源测量会话Key（指向 apms_test_result.session_key；非任务录入为 NULL） |
| create_by | varchar(64) | 操作人 |
| create_time | datetime | 录入时间 |

### 3.3 RTP 参训状态

#### apms_rtp_status — 当前 RTP 状态

> 每个运动员一条当前状态记录。**新建运动员时不自动插入 RTP 状态记录**。

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

> **RTP 状态评估状态**：
> - `apms_rtp_status` 无记录 → **NOT_ASSESSED（未评估）**，页面显示"未评估"
> - 康复师首次评估后插入第一条记录，进入 `g/y/r` 三态
> - "未评估"与"允许完整训练（g）"语义不同：未评估表示康复师尚未介入，不代表医学上已确认可训练
> - 遵循"系统不做自动医学判断"原则，新建运动员不预置 `g` 状态
> - 数据驾驶舱「RTP 汇总」卡片中未评估运动员不计入绿/黄/红任一档，单独显示"未评估 N 人"

#### apms_rtp_log — RTP 状态变更日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| athlete_id | bigint | 运动员ID |
| from_status | char(1) | 变更前状态 |
| to_status | char(1) | 变更后状态 |
| reason | varchar(500) | 变更原因 |
| training_limit | varchar(500) | 训练限制 |
| next_review_date | date | 当时计划的下次复核日期 |
| operator_id | bigint | 操作人（sys_user） |
| operator_name | varchar(64) | 操作人姓名 |
| operate_time | datetime | 操作时间 |

> **RTP 变更事务**：更新 `apms_rtp_status` + 插入 `apms_rtp_log` 必须在同一事务内完成，确保当前状态和历史日志不脱节。

### 3.4 PHV 生长发育

#### apms_phv_record — PHV 测量与计算记录

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| athlete_id | bigint | 运动员ID |
| source_measure_id | bigint NULL | 关联 apms_body_measure.id（原始测量事实来源） |
| gender | char(1) | 性别（0男 1女） |
| measure_date | date | 测量日期 |
| decimal_age | decimal(6,4) | 精确年龄（0.0001岁） |
| height | decimal(5,1) | 站立身高 cm（快照副本） |
| sit_height | decimal(5,1) | 坐高 cm（快照副本） |
| weight | decimal(5,1) | 体重 kg（快照副本） |
| father_height | decimal(5,1) | 父亲身高 cm |
| mother_height | decimal(5,1) | 母亲身高 cm |
| leg_length | decimal(5,1) | 腿长（身高-坐高，计算值） |
| -- 以下为算法输出 -- | | |
| maturity_offset | decimal(8,4) | 成熟度偏移 |
| predicted_phv_age | decimal(6,4) | 预计PHV年龄 |
| predicted_adult_height | decimal(5,1) | 预测成年身高 |
| mirwald_version | varchar(20) | Mirwald 公式版本 |
| khamis_version | varchar(20) | Khamis-Roche 公式版本 |
| input_snapshot | json | 完整输入快照（算法当时使用的全部输入值） |
| create_by | varchar(64) | 操作人 |
| create_time | datetime | 计算时间 |

### 3.5 指标矩阵

#### apms_indicator — 指标库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| code | varchar(50) UQ | 稳定业务编码（HEIGHT/WEIGHT/CMJ_HEIGHT/SPRINT_30M/RSA_SDEC/YOYO_DISTANCE 等），代码、CSV、算法、报告均依赖此字段而非中文名 |
| category | varchar(20) | 分类（形态/机能/素质/筛查） |
| name | varchar(50) | 指标名称（可改，不影响关联） |
| unit | varchar(20) | 单位 |
| data_type | varchar(20) | 数据类型（number/decimal/text/select） |
| evaluation_direction | varchar(20) | 评价方向：HIGHER_BETTER / LOWER_BETTER / RANGE_BEST / REFERENCE_ONLY |
| collection_method | varchar(20) | 采集方式（manual/device/csv） |
| status | char(1) | 0=启用 1=停用 |
| version | varchar(20) | 有效版本 |
| create_time | datetime | 创建时间 |

> **`code` 是程序关联的唯一标识**，名称可改（如"30米冲刺"→"30m冲刺"），code 不变则所有关联不受影响。
>
> **`evaluation_direction` 四种取值**：
> | 取值 | 含义 | 示例 | 报告判定逻辑 |
> |------|------|------|-------------|
> | HIGHER_BETTER | 越大越好 | Yo-Yo 距离、CMJ 功率 | 值越高评级越高 |
> | LOWER_BETTER | 越小越好 | 30m 冲刺时间 | 值越低评级越高 |
> | RANGE_BEST | 在范围内最佳 | 体脂率 | 值落在 ref 区间内为正常 |
> | REFERENCE_ONLY | 仅参考不评级 | 身高 | 展示参考值但不输出评级 |
>
> 参考范围三级关系：`indicator` → `indicator_ref`（性别/年龄/队伍） → `ref_level`（GOOD/NORMAL/ATTENTION）。

#### apms_indicator_ref — 参考范围（按性别/年龄组/队伍）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| indicator_id | bigint | 指标ID |
| gender | char(1) | 适用性别 |
| age_group | varchar(20) | 年龄组（如 U16/U18） |
| dept_id | bigint | 适用队伍（0=全机构） |
| ref_min | decimal(14,4) | 简单参考下限（用于 RANGE_BEST 展示，不做三级判定） |
| ref_max | decimal(14,4) | 简单参考上限 |
| model_version | varchar(20) | 参考口径版本 |

#### apms_indicator_ref_level — 参考范围三级判定

> 报告需要输出「良好 / 正常 / 需关注」，单靠 ref_min/ref_max 只能表达一个范围。
> 三级规则按 direction 自动判定，不需要复杂规则引擎。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| ref_id | bigint | 关联 apms_indicator_ref.id |
| level | varchar(10) | GOOD / NORMAL / ATTENTION |
| min_value | decimal(14,4) NULL | 下限（NULL = 负无穷） |
| max_value | decimal(14,4) NULL | 上限（NULL = 正无穷） |

示例（30m 冲刺，direction=1 越小越好）：

```
GOOD       NULL ~ 4.20
NORMAL     4.20 ~ 4.50
ATTENTION  4.50 ~ NULL
```

示例（CMJ 功率，direction=0 越大越好）：

```
ATTENTION  NULL ~ 40.0
NORMAL     40.0 ~ 55.0
GOOD       55.0 ~ NULL
```

> 报告模块直接根据指标 evaluation_direction + 值落入的 level 输出评级，无需再回来改数据库。
>
> **区间边界规则：左闭右开 `[min_value, max_value)`**。
> 即 `min_value <= value < max_value` 属于该 level。
> 例如 `GOOD: NULL ~ 4.20` 和 `NORMAL: 4.20 ~ 4.50`，4.20 属于 NORMAL 不属于 GOOD。
> `max_value = NULL` 表示正无穷（上界不含）。
>
> **服务层校验规则**（`IndicatorRefService` 在创建/修改 ref_level 时执行，不依赖规则引擎）：
> - 三级 `GOOD / NORMAL / ATTENTION` 必须同时存在，缺一不可
> - 区间**连续不重叠**：相邻两级的边界值必须相等（上一级 `max_value` = 下一级 `min_value`）
>   - 正确：`GOOD [0,5) NORMAL [5,8) ATTENTION [8,NULL)`
>   - 错误：`GOOD [0,5) NORMAL [4,8)` — 重叠区间 4~5
>   - 错误：`GOOD [0,5) NORMAL [6,8)` — 空洞区间 5~6 无归属
> - 方向边界一致：`HIGHER_BETTER` 指标 GOOD 区间在高端（`min` 起于某值，`max=NULL`）；`LOWER_BETTER` 指标 GOOD 区间在低端（`min=NULL`，`max` 止于某值）
> - 校验失败抛出 `IndicatorRefInvalidException`，不写入数据库
> - 数据库唯一约束 `(ref_id, level)` 仅保证每种 level 一条，无法阻止区间重叠/空洞，故校验必须在 Service 层完成

建表语句：

```sql
CREATE TABLE apms_indicator_ref_level (
    id          bigint       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    ref_id      bigint       NOT NULL                COMMENT '关联 apms_indicator_ref.id',
    level       varchar(10)  NOT NULL                COMMENT '评级：GOOD / NORMAL / ATTENTION',
    min_value   decimal(14,4) DEFAULT NULL          COMMENT '下限（NULL = 负无穷）',
    max_value   decimal(14,4) DEFAULT NULL          COMMENT '上限（NULL = 正无穷）',
    PRIMARY KEY (id),
    KEY idx_ref_id (ref_id),
    CONSTRAINT uk_ref_level UNIQUE (ref_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='指标参考范围三级判定';
```

### 3.6 测试模型

#### apms_test_model — 测试模型库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK | 自增 |
| category | varchar(20) | 分类（耐力/速度耐力/敏捷/带球敏捷/组合） |
| name | varchar(50) | 模型名称 |
| code | varchar(30) | 模型编码（如 YOYO_IR1） |
| protocol | text | 测试规程描述（人读，体积小） |
| is_combo | char(1) | 1=组合模型 0=否 |
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
| is_required | char(1) | 1=必填 0=选填 |
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
| direction_override | char(1) NULL | 覆盖指标方向（NULL=继承 indicator.evaluation_direction；非 NULL 时 0=越大越好 1=越小越好） |
| sort_order | int | 排序 |

> **方向来源**：默认从 `indicator.evaluation_direction` 继承（HIGHER_BETTER→0, LOWER_BETTER→1），不重复存储。
> `direction_override` 仅在组合模型需要特殊覆盖时填写，默认 NULL。
>
> Z 分计算时方向判定：
> - 越大越好（direction=0）：Z = (x - μ) / σ
> - 越小越好（direction=1）：Z = -(x - μ) / σ
>
> 不翻转会导致冲刺快的运动员得分反而低。
> RANGE_BEST 和 REFERENCE_ONLY 的指标不参与组合模型。

#### apms_combo_score — 组合得分计算记录（带参考快照）

> 组合分每次计算时，将当时的 μ、σ、样本量等参考统计量**快照保存**，确保历史报告可复现。
> 9月算的 T 分不会被 12月新增数据改变。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| combo_model_id | bigint | 关联 apms_combo_model.id |
| athlete_id | bigint | 运动员ID |
| trigger_result_id | bigint NULL | 触发本次计算的结果ID（哪条结果录入/更新触发了重新计算；手工触发重算时可为 NULL） |
| combo_score | decimal(14,4) | 组合分最终值 |
| ref_snapshot | json | 各指标的参考统计量快照 + 组成项来源 result_id（见下方结构，是组合分的真实数据来源） |
| algo_version | varchar(20) | 算法版本 |
| calculated_at | datetime | 计算时间 |

> **`trigger_result_id` 语义说明**：
> - 该字段仅记录"哪条结果触发了本次组合分计算"，**不是组合分的数据来源**
> - 组合分的真实数据来源保存在 `ref_snapshot.components[].result_id` 和 `ref_snapshot.components[].result_value_id`，一个组合分可能由多个不同 result 组成（如 CMJ result #100 + 30m result #150）
> - 命名为 `trigger_result_id` 而非 `result_id` 是为避免误读为"组合分只基于一个测试结果"
> - 手工触发重算（如参考组口径调整后批量重算）时，没有单条触发结果，该字段为 NULL

`ref_snapshot` JSON 结构：

```json
{
  "components": [
    {
      "indicator_id": 101,
      "indicator_code": "SPRINT_30M",
      "indicator_name": "30m冲刺",
      "result_id": 150,
      "result_value_id": 1503,
      "mean": 4.56,
      "stddev": 0.21,
      "sample_size": 18,
      "reference_scope": "U15-male-2026",
      "direction": 1,
      "raw_value": 4.31,
      "z_score": 1.1905,
      "t_score": 61.90,
      "weight": 0.50
    },
    {
      "indicator_id": 102,
      "indicator_code": "CMJ_POWER",
      "indicator_name": "CMJ功率",
      "result_id": 100,
      "result_value_id": 1007,
      "mean": 50.0,
      "stddev": 8.0,
      "sample_size": 18,
      "reference_scope": "U15-male-2026",
      "direction": 0,
      "raw_value": 54.0,
      "z_score": 0.5000,
      "t_score": 55.00,
      "weight": 0.50
    }
  ]
}
```

> 重新查询历史报告时，直接读 `combo_score` 和 `ref_snapshot`，不重新计算，确保分数不会随数据库增长而漂移。

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
> -- 已完成人数（以 member.status 为准，与"有效+selected+required fields 完整"的完成定义一致）
> SELECT COUNT(*) FROM apms_task_member WHERE task_id = ? AND status = 'completed'
> -- 部分完成人数
> SELECT COUNT(*) FROM apms_task_member WHERE task_id = ? AND status = 'partial'
> ```
> **不使用** `SELECT COUNT(DISTINCT athlete_id) FROM apms_test_result WHERE task_id = ?` 作为"已测人数"——
> 该 SQL 会把只录了一个无效 attempt（`is_valid=0`）或只完成一项选测的运动员算成"已测"，与完成定义冲突。
> `member.status` 是由 `TaskProgressService.recalculate()` 根据严格完成定义推算的派生状态，任务卡片完成率必须基于该字段。

#### apms_task_item — 任务测试项

> 一个任务下发的测试项，可以是单指标或整个测试模型。
> MODEL 类型（如 RSA）算一个整体：完成一个 model 算完成，不需要三个 indicator 全写入。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| task_id | bigint | 任务ID |
| item_type | varchar(10) | INDICATOR=单指标 / MODEL=测试模型 |
| indicator_id | bigint NULL | 关联 apms_indicator.id（item_type=INDICATOR 时填写） |
| model_id | bigint NULL | 关联 apms_test_model.id（item_type=MODEL 时填写） |
| is_required | char(1) | 1=必测 0=选测 |
| sort_order | int | 排序 |

> **task_item 配置约束**（Service 层校验，不依赖数据库 CHECK）：
> - `item_type=INDICATOR` 时：`indicator_id` 必填、`model_id` 必为 NULL
> - `item_type=MODEL` 时：`model_id` 必填、`indicator_id` 必为 NULL
> - 同一 `task_id` 下不允许重复配置相同的 `indicator_id` 或 `model_id`（避免同一指标/模型在一个任务里被多次下发）
> - 违反约束时 Service 层抛出 `TaskItemConfigException`，不写入数据库

> **任务完成判定**（"完成"= 有有效成绩，不是"数据库里建过一行"）：
> - MODEL 项：至少存在一个 `is_valid=1 AND is_selected=1` 的 result，且该 result 下 `apms_test_model_field.is_required=1` 的字段均有值 → 完成
> - INDICATOR 项：至少存在一个 `is_valid=1` 的 result 且其 value 有 `numeric_value` 或 `text_value` → 完成
> - member.status = 所有 `is_required=1` 的 task_item 均完成 → completed；部分完成 → partial；无 → pending

#### apms_task_member — 任务成员

> `status` 反映运动员在本任务中的完成进度，三态而非二元。

| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | bigint | 任务ID |
| athlete_id | bigint | 运动员ID |
| status | varchar(20) | pending=未测 partial=部分完成 completed=全部完成 |
| PK | (task_id, athlete_id) | 联合主键 |

> `status` 由录入结果时自动推算：只看 `is_required=1`（必测）的 task_item 是否全部完成，`is_required=0`（选测）不计入判定。
> - 所有必测项完成 → completed
> - 部分完成 → partial
> - 无 → pending
>
> 任务卡片上的完成率 = `COUNT(status='completed') / COUNT(*)`，实时计算不存库。
>
> **`status` 是派生缓存字段**，事实来源是 task_item + test_result + result_value。
> 所有结果写操作（新增、修改、删除、CSV 导入、取消有效成绩、重新选择最佳 attempt）必须在同一事务内调用 `TaskProgressService.recalculate(taskId, athleteId)` 重新计算 status。
> 另提供 `TaskProgressService.recalculateAll(taskId)` 支持任务级批量重算。

### 3.8 测试结果

#### apms_test_result — 测试结果主记录（一次 attempt）

> **一行 = 一次试测尝试**。attempt_no / is_valid / is_selected 在此层定义，描述的是"这次尝试整体是否有效、是否被选中"，而不是其中某个字段。
> 体态测量等无试测概念的指标：attempt_no=NULL, is_valid=1, is_selected=1，只一行。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint PK AI | 自增 |
| task_id | bigint NULL | 任务ID（可为空——支持不走任务流程直接补录体态/单项测量） |
| task_item_id | bigint NULL | 关联 apms_task_item.id（明确归属哪个任务项；任务流程下录入时必填，直接补录时为空） |
| athlete_id | bigint | 运动员ID |
| model_id | bigint NULL | 测试模型ID（可为空——体态测量不一定对应某个测试模型） |
| indicator_id | bigint NULL | 主指标ID（可选，单指标测试时填写；MODEL 类型任务可不填，靠 value.indicator_id 标识具体指标） |
| session_key | varchar(50) NULL | 测量会话Key（同一次现场测量共享同一 key；用于聚合体态类多 result 到一条 body_measure；非聚合场景为 NULL） |
| measure_date | date | 测试日期 |
| attempt_no | int NULL | 第几次试测（1/2/3…，NULL=无试测概念如体态） |
| is_valid | char(1) | 1=有效 0=无效（如抢跑、犯规） |
| is_selected | char(1) | 0=否 1=选中（取最佳成绩时标记哪条被采纳） |
| invalid_reason | varchar(200) | 无效原因（如"抢跑"、"犯规"，is_valid=0 时填写） |
| data_source | varchar(20) | 来源（manual/csv/device） |
| raw_payload | json NULL | 原始设备 payload（保留导入时的完整原始数据，不作规范化用途） |
| create_by | varchar(64) | 录入人 |
| create_time | datetime | 录入时间 |

> **三层模型**：
> ```
> apms_test_result     = 一次 attempt（张三 30m 第2次试测）
>   ├── apms_test_result_value  = 这次 attempt 的字段结果（total_time=4.25）
>   └── apms_test_result_rep    = 这次 attempt 内部的多趟原始数据（RSA 7趟）
> ```
>
> **RSA 多轮场景**：RSA 测两轮时，每轮是一个独立 attempt（attempt_no=1 和 attempt_no=2），各自的 7 趟 reps 分别挂在对应 result_id 下，不会混淆。
>
> **试测数据使用约定**：
> - 趋势分析和组合计算只取 `is_valid=1 AND is_selected=1` 的 result
> - 示例：张三 30m 冲刺 3 次试测，result #102 attempt=2 成绩 4.25s 被选中 → 组合计算和趋势只用 4.25
>
> **`is_selected` 唯一选中规则**（Service 层事务保证，不依赖数据库唯一约束）：
> - **同一 `athlete_id + task_item_id` 下最多只能有一个 `is_selected=1` 的 attempt**
>   - 原因：趋势/组合模型取值靠 `is_valid=1 AND is_selected=1`，允许多选会导致"取哪条"不确定
> - **选中操作的事务规则**（`AttemptSelectionService.select(resultId)`）：
>   1. 校验目标 result 的 `is_valid=1`（无效 attempt 不能被选中）
>   2. 同 `athlete_id + task_item_id` 下其余所有 result 置 `is_selected=0`
>   3. 目标 result 置 `is_selected=1`
>   4. 同事务内调用 `TaskProgressService.recalculate(taskId, athleteId)`
> - **无效强制不选中**：`is_valid=0` 的 attempt 的 `is_selected` 强制为 0
>   - 标记 `is_valid=0` 时（如判定抢跑、犯规），同事务内将该 result 的 `is_selected` 置 0
>   - 若该 result 原本是选中状态，需提示"原选中成绩已失效，请重新选择"或自动选下一个最优有效 attempt
> - **无 task_item_id 的直接补录**（非任务流程）：不适用此规则，按 `athlete_id + indicator_id` 维度判定唯一选中
> - 体态类无 attempt 概念的指标（attempt_no=NULL）：`is_valid=1, is_selected=1`，唯一一行，不触发选中规则

#### apms_test_result_value — 规范化测试结果值

> 核心设计：数字按数字存，文本按文本存，不做 varchar 化。
> 趋势分析、AVG/MAX/MIN、参考范围判断、组合计算均直接基于 `numeric_value` 操作。
> **业务约束：`indicator_id` 和 `field_id` 不能同时为 NULL**——至少有一个非空，用于标识该值的来源。

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
| algorithm_id | varchar(30) NULL | 算法ID（is_derived=1 时填写，如 rsa-decay） |
| algorithm_version | varchar(20) NULL | 算法版本（is_derived=1 时填写，如 rsa-decay-v1） |

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
| content_snapshot | longtext | 内容快照（JSON，完整报告内容，可能较大） |
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
 apms_test_task ──── apms_task_item ──── apms_indicator (item_type=INDICATOR)
    │                                  ──── apms_test_model (item_type=MODEL)
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

### 3.12 实施期扩展表与字段（v1.0 基线之后新增）

> 以下结构不在 3.1–3.10 原始清单内，均由 `patches/` 补丁引入、部署时自动应用；`.trae/sql/apms_schema.sql` 仅作开发参考，不是部署源。

| 表 | 用途 | 引入补丁 |
|----|------|---------|
| `apms_athlete_promotion_log` | 赛季整队晋升执行留痕（只追加） | 0.0.6 系列 |
| `apms_measure_cycle` | 测量周期（周期批量测量与进度） | patch-0.0.6-202610041321 |
| `apms_rtp_risk_rule` | RTP 风险规则（kind/severity/urgency/params/开关） | patch-0.0.6-202610042315 |
| `apms_rtp_risk_snapshot` | 每日扫描的预警快照与处置状态 | patch-0.0.6-202610042315 |
| `apms_user_phone` | 登录手机号绑定（一号可绑多账号、账号内最多 3 号） | patch-0.0.9-261015134522 |
| `apms_login_config` | 登录页配置单例（`config_key='default'`，JSON） | patch-0.0.3-202609201644 |
| `apms_db_version` | 已应用补丁登记（部署脚本去重） | `patches/000-init-version-table.sql` |

关键字段扩展：

- `apms_athlete`：`last_team_id`（离队/退役队伍快照）、`predicted_adult_height`、`adult_height_algo`、`adult_height_calc_date`
- `apms_body_measure`：`cycle_id`（周期测量归属）
- `apms_task_item`：`collect_mode`（INPUT=人工/设备采集，DERIVED=系统计算）
- `apms_test_result_value`：`algo_id`（派生算法注册表 key）
- `apms_medical_record`：`body_site`（伤病部位，19 点位 + OTHER）
- `sys_role`：`portal_mode`、`home_path`（Portal 专岗字段；专岗 `portal_mode=1` 且 `home_path='/overview/cockpit'`，侧栏仍渲染、仅隐藏标签页）
- `sys_dept`：`dept_type`（10 机构 / 20 队伍 / 30 训练小组 / 40 科研小组 / 50 恢复小组）

> 全库当前共 30 张 `apms_*` 表：3.1–3.10 的 23 张 + 上表 7 张。

---

## 四、算法实现设计

### 4.1 Mirwald 成熟度偏移

- 输入：年龄、站立身高、坐高、体重、性别
- 腿长 = 站立身高 - 坐高（计算值，不单独录入）
- 男女公式不同（见知识库 `algorithm/mirwald.md`）
- 输出：成熟度偏移（decimal）、预计PHV年龄 = 当前年龄 - 偏移
- 实现类：`MirwaldCalculator`，版本号 `mirwald-v1`
- 必须保存：算法ID、算法版本、性别、全部输入值、测量日期、输出值、计算时间

### 4.2 Khamis-Roche 预测成年身高（实现已启用简化版）

- 实现类：`KhamisRocheCalculator`，版本号 `khamis-roche-v1`，状态 `READY`
- 采用 Sports Science Journal 2015 简化版（输入仅需年龄、性别、当前身高、体重），**不要求骨龄**；原始 2007 版需骨龄，未采用
- 输出预测成年身高（cm，1 位小数），保存在 `apms_athlete.predicted_adult_height` 与 `adult_height_algo` / `adult_height_calc_date`
- 触发：体态测量保存后 `tryKhamisRoche` 按最新测量自动重算；`GET /apms/phv/athlete/{athleteId}/adult-height` 回看计算口径与来源测量
- **`apms_phv_record.predicted_adult_height` 保持 NULL**：成年身高归属运动员主档，不混入每次 PHV 记录，避免同一字段两套口径
- 与 v1.0 基线差异：基线为 `NOT_CONFIGURED` 待业务确认；实现期已确认并启用简化版，父母身高当前不参与该公式

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
- **实现口径（当前）**：
  - `N ≥ 5`：使用同参考组真实 μ/σ（`is_selected=1` 的历史最佳成绩聚合）；
  - `N < 5`：以 `apms_indicator_ref` 的参考区间作代理归一化，快照中标注真实样本量，**不拒绝计算、不伪造样本**；
  - 报告与界面统一称“本队内部参考分”，不表述为行业常模。

> **T 分值域与 demo 数据对齐**：标准 T 分范围大致 20～80（±3σ 覆盖 99.7%），报告页柱状图值域设为 20～80。
> demo [mock.js](file:///prototype/assets/mock.js) 中的 90/82/56/91/75 是旧的 0～100 风格；上线实现与报告页已统一使用 T 分。

> **参考组统计量来源与快照**：μ 和 σ 不是算法参数，而是数据参数。
> - 从 `apms_test_result_value` 按同队伍、同年龄组、同指标的历史数据实时聚合计算
> - **计算后将 μ、σ、样本量、参考口径快照保存到 `apms_combo_score.ref_snapshot`**，历史报告直接读快照，不重新计算
> - 没有快照会导致：9月算的 T 分 = 63，12月队伍新增人后重新查询变成 58——同一历史记录分数自己变了，无法复现
> - 设样本量口径：`N ≥ 5` 使用真实 μ/σ；`N < 5` 使用参考区间代理归一化并在快照标注真实样本量
> - 门槛 `N=5` 当前为服务内常量，与一期口径一致；若后续可配置再迁到 `apms_combo_model` 或系统参数
> - N ≥ 5 是**一期内部实现门槛**，不是统计学上可靠的行业标准，仅适用于演示和队内标准化
> - 界面标注用「本队内部参考分」，**不叫「行业常模」**
> - 系统上线初期数据不足属正常状态，不伪造样本、不宣称统计可靠性

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
}
```

实现类同时提供静态 `calculate()` 供 Service 直接调用；接口用于未来工厂/注册表统一调度。快照责任在各业务服务（如 `apms_phv_record.input_snapshot`、`apms_combo_score.ref_snapshot`），不在接口层统一生成。

当前各算法状态：

| 算法 | 版本 | 状态 |
|------|------|------|
| Mirwald 成熟度偏移 | mirwald-v1 | READY |
| Khamis-Roche 成年身高 | khamis-roche-v1 | READY（2015 简化版，无骨龄输入） |
| RSA 衰减率 | rsa-decay-v1 | READY |
| 组合指数（T 分） | combo-tscore-v1 | READY |

### 4.6 设备结果接入扩展点（TestResultProvider）

> 数据模型已预留 `data_source=device` 和 `raw_payload`，但一期不做完整设备 SDK。
> 通过定义统一接口，一期实现 CSV Provider，未来按需扩展 Vald SmartSpeed 等设备 Provider，不改变核心结果处理流程。

```java
public interface TestResultProvider {
    /** Provider 唯一编码（如 csv / vald_smart_speed / hawk_eye） */
    String getProviderCode();

    /** 从数据源拉取待导入的测试结果（CSV 解析 / 设备 API 拉取 / 文件解析） */
    List<TestResultImportDto> fetch(TestResultRequest request);

    /** 校验导入数据合法性（字段完整性、指标匹配、单位换算） */
    default List<String> validate(List<TestResultImportDto> data) {
        return Collections.emptyList();
    }
}
```

一期实现的 Provider：

| Provider | 编码 | 数据源 | 说明 |
|----------|------|--------|------|
| CsvResultProvider | `csv` | 手工 CSV 文件 | 一期唯一实现，解析上传的 CSV，按 `task_id + athlete_id + task_item_id + attempt_no` 幂等写入 |

> **Provider 接口是能力预留，不是厂商兼容清单**。下表仅为示例，展示接口形态，**不构成对任何厂商的接入承诺**：
>
> | 示例 Provider（未实现） | 编码 | 数据源 | 状态 |
> |------------------------|------|--------|------|
> | ValdSmartSpeedProvider | `vald_smart_speed` | Vald SmartSpeed API | 示例/待验证，需厂商开放接口资料 + 联调验证后才正式接入 |
> | FutureDeviceProvider | `future_device` | 待定设备接口 | 示例占位，厂商未定 |
>
> **接入边界**：一期只做"手工 / CSV / 经验证的设备接口"三种来源。设备接入需先在 `apms_indicator.collection_method=device` 标记设备类指标，并通过 `raw_payload` 保留设备原始数据，规范化结果写入 `apms_test_result_value`。新设备接入需满足：
> 1. 厂商提供正式开放接口文档
> 2. 接口通过联调验证（字段映射、单位换算、数据完整性）
> 3. 实现 `TestResultProvider` 接口并注册到 `ProviderRegistry`
>
> 不满足上述条件的设备不写入正式 DESIGN Provider 清单。
>
> **实现现状（v1.1）**：xlsx/xls/csv 两阶段导入已上线（`/apms/test-result/import/preview|commit`、`/apms/body-measure/import/preview|commit`）；`ApmsDeviceController` 提供 `/apms/device/register|list|push|model-push` 作为设备结果推送入口；`ProviderRegistry` 仅注册 CSV 解析 Provider，尚未接入任何厂商实时 API。

### 4.7 RTP 风险规则引擎（一期已上线）

- 规则存 `apms_rtp_risk_rule`，扫描结果存 `apms_rtp_risk_snapshot`；`sys_job` 调用 `rtpRiskTask.scanDaily` 每日全量扫描（昨日 ACTIVE 置 EXPIRED），也支持手动扫描
- 一期 4 条规则：`REVIEW_OVERDUE`、`REVIEW_SOON`（PROCESS）；`INJURY_OPEN`、`PHV_PEAK`（HEALTH）；`TEST_DECLINE` 移到 1.1，阈值见 [rtp-warning-phase1.md](./knowledge/roadmap/rtp-warning-phase1.md)
- 健康分只累加 HEALTH 因子（severity），PROCESS 因子仅影响待办优先级（urgency），不改变黄/红建议
- 分级阈值 INFO 3 / ATTENTION 6 / WARNING 9 为引擎常量
- 处置：知悉 / 忽略 / 采纳；采纳只跳转 RTP 编辑，由人工确认后写 `apms_rtp_status`，**系统绝不自动改状态**

---

## 五、接口设计

### 5.1 数据驾驶舱与版本

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/dashboard/stats` | GET | 首页统计卡聚合 |
| `/apms/dashboard/overview` | GET | 数据驾驶舱总览（KPI/图表/最近任务/RTP 汇总） |
| `/apms/version` | GET | 当前部署版本 |

### 5.2 运动员与组织归属

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/athlete/list` | GET | 运动员列表（含 RTP 状态，`@DataScope`） |
| `/apms/athlete/rtpSummary` | GET | 全队 RTP 汇总（红/黄/绿/未评估） |
| `/apms/athlete/{athleteId}` | GET | 运动员详情（基础信息 + RTP + 最新表现） |
| `/apms/athlete` | POST / PUT | 新增 / 修改运动员 |
| `/apms/athlete/{athleteIds}` | DELETE | 删除（逗号分隔批量） |
| `/apms/athlete/rejoin` | PUT | 离队/退役人员重入队 |
| `/apms/athlete/promotion/preview` | POST | 赛季整队晋升预览 |
| `/apms/athlete/promotion/execute` | POST | 赛季整队晋升执行（写 `apms_athlete_promotion_log`） |
| `/apms/athlete-group/athlete/{athleteId}` | GET | 运动员小组归属历史 |
| `/apms/athlete-group/athlete/{athleteId}/current` | GET | 当前所属小组 |
| `/apms/athlete-group/dept/{deptId}` | GET | 小组当前成员 |
| `/apms/athlete-group/join` | POST | 加入小组 |
| `/apms/athlete-group/leave/{athleteId}` | POST | 离开小组 |

### 5.3 体态测量、测量周期与 PHV

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/body-measure/list` | GET | 体态记录列表 |
| `/apms/body-measure/athlete/{athleteId}` | GET | 某运动员历次体态 |
| `/apms/body-measure/athlete/{athleteId}/latest` | GET | 最新一条体态 |
| `/apms/body-measure/{id}` | GET | 单条体态 |
| `/apms/body-measure/upsert` | POST | 按业务唯一键 upsert（任务会话聚合） |
| `/apms/body-measure` | POST / PUT | 新增 / 修改 |
| `/apms/body-measure/{id}` | DELETE | 删除 |
| `/apms/body-measure/import/preview` | POST | 批量导入预览校验 |
| `/apms/body-measure/import/commit` | POST | 批量导入确认入库 |
| `/apms/body-measure/import/template` | GET | 导入模板下载 |
| `/apms/measure-cycle/list` | GET | 测量周期列表 |
| `/apms/measure-cycle/{id}` / `/{id}/progress` | GET | 周期详情 / 进度 |
| `/apms/measure-cycle` | POST / PUT | 新增 / 修改周期 |
| `/apms/measure-cycle/{id}` | DELETE | 删除周期 |
| `/apms/measure-cycle/{id}/batch` | POST | 周期批量生成测量任务 |
| `/apms/phv/list` | GET | PHV 记录列表 |
| `/apms/phv/athlete/{athleteId}` | GET | 运动员 PHV 历史 |
| `/apms/phv/athlete/{athleteId}/latest` | GET | 最新 PHV |
| `/apms/phv/{id}` | GET | 单条 PHV |
| `/apms/phv/calculate` | POST | 基于体态记录计算（Mirwald，写输入快照与版本） |
| `/apms/phv/calculate-direct` | POST | 直接输入参数计算 |
| `/apms/phv/athlete/{athleteId}/adult-height` | GET | 成年身高预测口径与来源测量回看 |
| `/apms/phv/{id}` | DELETE | 删除 PHV 记录 |

### 5.4 RTP 状态与风险预警

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/rtp/status/{athleteId}` | GET | 当前 RTP 状态（无记录=未评估） |
| `/apms/rtp/status/list` | GET | 全量状态（看板/KPI 用） |
| `/apms/rtp/log/{athleteId}` | GET | 状态变更日志 |
| `/apms/rtp/update` | POST | 评估处置（写状态 + 日志，事务） |
| `/apms/rtp/batch-update` | POST | 批量更新 |
| `/apms/rtp/clear/{athleteId}` | POST | 清除状态（回到未评估） |
| `/apms/rtp-risk/list` | GET | 预警列表（`@DataScope`） |
| `/apms/rtp-risk/stat` | GET | 预警统计 |
| `/apms/rtp-risk/{id}` | GET | 预警详情与因子明细 |
| `/apms/rtp-risk/athlete/{athleteId}/latest` | GET | 运动员最新预警 |
| `/apms/rtp-risk/rules` | GET | 规则配置查询 |
| `/apms/rtp-risk/{id}/ack` / `dismiss` / `accept` | POST | 知悉 / 忽略 / 采纳 |
| `/apms/rtp-risk/scan` | POST | 手动全量扫描 |

### 5.5 指标库与参考范围

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/indicator/list` / `/{id}` | GET | 指标列表 / 详情 |
| `/apms/indicator` | POST / PUT | 新增 / 修改指标 |
| `/apms/indicator/{ids}` | DELETE | 批量删除 |
| `/apms/indicator/ref/list/{indicatorId}` | GET | 参考范围列表 |
| `/apms/indicator/ref` | POST / PUT | 新增 / 修改参考范围 |
| `/apms/indicator/ref/{refId}` | DELETE | 删除参考范围 |
| `/apms/indicator/level/list/{refId}` | GET | 三级判定区间 |
| `/apms/indicator/level` | POST / PUT | 新增 / 修改评级区间 |
| `/apms/indicator/level/{levelId}` | DELETE | 删除评级区间 |

### 5.6 测试模型、组合模型与组合评分

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/test-model/algorithms` | GET | 已注册派生算法 |
| `/apms/test-model/list` / `/{id}` | GET | 模型列表 / 详情（含字段） |
| `/apms/test-model` | POST / PUT | 新增 / 修改模型 |
| `/apms/test-model/{ids}` | DELETE | 批量删除 |
| `/apms/test-model/field/list/{modelId}` | GET | 字段定义 |
| `/apms/test-model/field` | POST / PUT | 新增 / 修改字段 |
| `/apms/test-model/field/{fieldId}` | DELETE | 删除字段 |
| `/apms/combo-model/list` / `/{id}` | GET | 组合模型列表 / 详情 |
| `/apms/combo-model` | POST / PUT | 新增 / 修改 |
| `/apms/combo-model/{ids}` | DELETE | 批量删除 |
| `/apms/combo-model/component/list/{comboModelId}` | GET | 组成项 |
| `/apms/combo-model/component` | POST / PUT | 新增 / 修改组成项 |
| `/apms/combo-model/component/{componentId}` | DELETE | 删除组成项 |
| `/apms/combo-score/list` / `/{id}` | GET | 评分记录 / 详情（含快照） |
| `/apms/combo-score/calculate` | POST | 计算（写 `ref_snapshot`） |
| `/apms/combo-score/{id}` | DELETE | 删除评分记录 |

### 5.7 测试任务与测试结果

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/test-task/list` / `/{id}` | GET | 任务列表 / 详情 |
| `/apms/test-task` | POST / PUT | 创建 / 修改任务 |
| `/apms/test-task/{ids}` | DELETE | 批量删除 |
| `/apms/test-task/item/list/{taskId}` | GET | 任务测试项 |
| `/apms/test-task/item` | POST / PUT | 新增 / 修改测试项 |
| `/apms/test-task/item/{itemId}` | DELETE | 删除测试项 |
| `/apms/test-task/member/list/{taskId}` | GET | 成员完成情况 |
| `/apms/test-task/member/enroll` | POST | 单人报名 |
| `/apms/test-task/member/batch-enroll` | POST | 批量报名 |
| `/apms/test-task/member/status` | PUT | 更新成员状态 |
| `/apms/test-task/member` | DELETE | 移除成员 |
| `/apms/test-result/list` / `/{id}` | GET | 结果列表 / 详情 |
| `/apms/test-result/by-task-member` | GET | 按任务成员取录入上下文 |
| `/apms/test-result/by-free-group` | GET | 非任务自由补录分组 |
| `/apms/test-result` | POST / PUT | 新增 / 修改结果 |
| `/apms/test-result/batch-grid` | POST | 成绩网格批量登记 |
| `/apms/test-result/{id}` / `/batch` / `/task/{taskId}` | DELETE | 单条 / 批量 / 按任务删除 |
| `/apms/test-result/auto-select` | POST | 自动选最佳 attempt |
| `/apms/test-result/select-attempt/{resultId}` | POST | 手动选为最佳 |
| `/apms/test-result/import/preview` | POST | 成绩导入预览校验 |
| `/apms/test-result/import/commit` | POST | 成绩导入确认入库 |
| `/apms/test-result/import/csv` | POST | 旧版 CSV 直导（保留兼容） |
| `/apms/test-result/import/template` | GET | 导入模板下载 |

### 5.8 医疗康复

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/medical-record/list` | GET | 医疗记录列表（`@DataScope`） |
| `/apms/medical-record/site-stats` | GET | 伤病部位统计 |
| `/apms/medical-record/{id}` | GET | 详情（含附件） |
| `/apms/medical-record` | POST / PUT | 新增 / 修改（`{record, files}`） |
| `/apms/medical-record/{id}` | DELETE | 删除记录（级联文件） |
| `/apms/medical-record/file/download/{fileId}` | GET | 私有下载（鉴权 + DataScope + 流式） |
| `/apms/medical-record/file/{fileId}` | DELETE | 删除单个附件 |

> **医疗权限点（现行）**：`apms:medicalRecord:list/query/add/edit/remove`、`apms:medicalFile:download/remove`。
> **下载流程**：JWT → 权限点 → DataScope（fileId → medical_record → athlete.primary_team_id）→ 私有存储流式输出；医疗文件不进入 `/profile/**` 静态路径。

### 5.9 报告

| 接口 | 方法 | 说明 |
|------|------|------|
| `/apms/report/list` / `/{id}` | GET | 报告列表 / 详情（含 contentSnapshot） |
| `/apms/report/generate` | POST | 生成报告（个人/团队/任务） |
| `/apms/report/regenerate/{id}` | POST | 重新生成 |
| `/apms/report/download/{id}` | GET | 下载 PDF（鉴权 + DataScope） |
| `/apms/report/{id}` | DELETE | 删除报告 |

### 5.10 登录页配置与手机号

| 接口 | 方法 | 说明 |
|------|------|------|
| `/login/config` | GET（匿名） | 登录页公开配置，无配置行返回 `{}` |
| `/system/login/config` | GET / PUT | 设计器回显 / 保存（`system:loginconfig:query/edit`） |
| `/sms/code` | POST（匿名） | 发验证码（scene=login/bind，服务端频控） |
| `/login/sms` | POST（匿名） | 短信登录，多个活跃账号时返回选择令牌 |
| `/login/sms/select` | POST（匿名） | 多账号选择后兑换 token |
| `/system/user/profile/phone/list` / `bind` / `unbind/{id}` | GET/POST | 本人手机号查询 / 绑定 / 解绑 |
| `/system/user/phone/list/{userId}` / `bind` / `unbind/{id}` | GET/POST | 管理员代查 / 代绑 / 强解绑（按 D10 门禁） |

---

## 六、前端页面设计

### 6.1 页面形态（已上线实现）

所有业务页已按「花名册」视觉重构（`roster-kit.scss`），壳层统一：`rk-header → rk-filter → rk-table-card / rk-split-grid`；合并页是纯嵌入壳，子页自动继承同一套样式与权限。

#### 数据驾驶舱 `/overview/cockpit`（`/index` 同组件）

- KPI 带：在队人数、进行中任务、RTP 红/黄/绿、未评估、本周新测量
- 图表区：任务进度、RTP 风险分布、伤病台账摘要、PHV 发育阶段分布、健康预警、组合分 TOP10、PHV 散点、指标雷达、任务完成率
- 最近任务表、队伍分布 chips；支持深色「大屏模式」切换（详见 `documents/dashboard_bigscreen_plan.md`）

#### 花名册 `/athletes/roster`

- 左列筛选：队伍 / 在训状态 / 关键词（300ms 防抖）
- 表格：哈希首字头像 + 姓名/位置副行、RTP 徽章、体态摘要、行操作 ≤3 平铺
- 详情 `/apms/athlete/detail/:athleteId`：`rk-crumb → rk-profile → rk-banner → rk-tabs`，面板为小组归属 / 体态测量 / PHV / RTP 参训状态 / 组合评分

#### 青训发育监控 `/athletes/growth`（合并页）

- 上半：体态测量台账（KPI 带 + 全量本地过滤表 + 新增/编辑弹窗 + 批量导入）
- 下半：PHV 成熟度（双模式计算弹窗、趋势、成年身高口径回看）

#### 指标库与任务下发 `/testings/dispatch`（合并页）

- 指标库：主从双栏 + 参考范围/评级区间内联编辑
- 测试任务：主从双栏 + 测试项/成员管理 + 多选删除
- 测试结果：主从双栏 + attempt 子表 / 值网格 / REP 分级条 + 批量导入

#### 组合测试调度 `/testings/combo-dispatch`（合并页）

- 测试模型库：主从双栏 + 规程 banner + 字段表
- 组合模型库：主从双栏 + 公式卡 + 权重平衡条 + 内联权重编辑
- 组合评分：列表 + 计算入口 + 可打印快照报告弹窗

#### 健康预警中心 `/healthcare/alert-center`（合并页）

- RTP 状态管理：四列看板（未评估/绿/黄/红），HTML5 拖拽 + confirm 落库，右侧抽屉详情/时间线
- RTP 风险预警：分级待办列表、因子明细、知悉/忽略/采纳、规则说明

#### 医疗康复 `/healthcare/medical-care`

- 主从双栏：左记录列表（服务端分页）+ 右详情（类型 banner、附件卡、私有下载）
- 新增/编辑弹窗必须先 `getById` 回填，避免附件被清空

#### 报告中心 `/analytics/report-center`

- 主从双栏：类型 KPI + 类型渐变 banner + 文件状态条 + 暗色 JSON 快照卡 + 鉴权 blob 下载
- 生成弹窗按个人/团队/任务条件渲染，规则与单选校验在提交前执行

#### 系统页面

- 角色权限管理 / 组织架构 / 用户管理：复用 RuoYi 原生页，已按花名册风格重构（role / dept / user 三个标杆页）
- 登录页设计：`/system/loginConfig`，配置驱动 + 可视化设计器（撤销/重做、JSON 导入来源校验）

### 6.2 通用组件与视觉资产

| 资产 | 用途 |
|------|------|
| `src/assets/styles/roster-kit.scss` | 花名册壳层：`rk-header`、`rk-filter`、`rk-table`、`rk-split-grid`、`rk-kanban-grid`、`rk-kpi-grid`、`rk-pager`、`rk-status-badge` |
| `roster-style-pages` 技能 | 列表/详情/看板/主从/看板重构的范式与验收清单 |
| Element Plus | 弹窗、表单、日期、下拉、上传等交互控件（外壳统一 deep 收敛） |
| ECharts 5.6 | 驾驶舱图表（显式 import，按需最小化） |
| `RkPager` | 花名册统一分页器（部分页仍用页内 `.rk-pager` 同款样式） |

### 6.3 前端目录结构（实际）

```
src/views/apms/
├── dashboard/index.vue          # 数据驾驶舱
├── athlete/
│   ├── index.vue                # 花名册
│   ├── detail.vue               # 运动员详情
│   └── components/              # 档案子组件
├── growth/index.vue             # 合并壳：体态测量 + PHV
├── bodyMeasure/index.vue
├── phv/index.vue
├── dispatch/index.vue           # 合并壳：指标 + 任务 + 结果
├── indicator/index.vue
├── testTask/index.vue
├── testResult/index.vue
├── comboDispatch/index.vue      # 合并壳：测试模型 + 组合模型 + 组合评分
├── testModel/index.vue
├── comboModel/index.vue
├── comboScore/index.vue
├── healthAlert/index.vue        # 合并壳：RTP 状态 + 风险预警
├── rtp/index.vue
├── rtpWarning/index.vue
├── medical/index.vue
└── report/index.vue

src/api/apms/                    # 18 个业务 API 文件（athlete/athleteGroup/bodyMeasure/phv/
                                 # indicator/testModel/testTask/testResult/comboModel/comboScore/
                                 # rtp/rtpRisk/medical/report/measureCycle/batchImport/
                                 # dashboard/userPhone）
```

---

## 七、实施阶段规划

### 第一阶段：基础数据层（组织 + 运动员 + 体态）—— 已完成

- 数据库建表（apms_athlete, apms_athlete_group, apms_body_measure）
- 菜单与角色初始化 SQL
- 运动员 CRUD + 模板导入
- 体态测量录入与历史查询
- 数据驾驶舱统计卡数据接口

### 第二阶段：RTP + PHV（健康与生长发育闭环）—— 已完成

- RTP 状态管理、变更日志与四列看板
- PHV 测量录入 + Mirwald 计算（保存输入快照与版本）
- Khamis-Roche 简化版计算（`READY`，体态保存后自动更新运动员成年身高字段）
- 成长趋势与成年身高口径回看
- 医疗附件上传、私有下载与权限点

### 第三阶段：测试闭环（指标 + 模型 + 任务 + 结果）—— 已完成

- 指标矩阵库 CRUD + 参考范围/评级区间
- 测试模型库 + 字段定义 + 派生算法注册
- 测试任务创建、排期、成员与进度看板
- 测试结果录入（手工 / 批量网格 / xlsx-xls-csv 两阶段导入）
- RSA 衰减率计算、组合指数计算（含参考快照）
- 上线后追加：测量周期、设备结果推送入口、RTP 风险规则引擎、组合评分页面

### 第四阶段：报告与趋势 —— 已完成

- 个人综合报告模板
- 团队报告模板
- 趋势折线分析
- PDF 导出与鉴权下载
- 报告版本记录与内容快照

### 第五阶段：部署与验收 —— 已完成（持续运维）

- 采购方服务器 / 私有云部署（Nginx + systemd，`deploy/deploy.sh` / `deploy-uat.sh`）
- 全链路联调
- 验收清单逐项确认

---

## 八、验收对照表

| 验收项 | 对应模块 | 验收入口 |
|--------|---------|---------|
| 运动员档案可完整关联各类数据 | 运动员档案 | `/athletes/roster` → 运动员详情 |
| RTP 状态可按权限维护并留痕 | 健康预警中心 | `/healthcare/alert-center`（RTP 状态看板） |
| PHV 可按确认公式计算 | 青训发育监控 | `/athletes/growth`（体态 + PHV） |
| 指标可配置、任务可下发 | 指标库与任务下发 | `/testings/dispatch` |
| 测试结果可录入并更新进度 | 指标库与任务下发 | `/testings/dispatch`（任务 / 结果） |
| 组合结果可计算和复核 | 组合测试调度 | `/testings/combo-dispatch`（组合评分） |
| 趋势和报告可展示并导出 PDF | 报告中心 / 运动员详情 | `/analytics/report-center` |
| 权限能够隔离不同角色操作 | 账号与角色 | `/sysmgr/role-acl` + 手测回归说明书 |
| 系统可在采购方环境部署运行 | 部署 | `deploy/` 脚本 + systemd |

---

## 九、测试策略

### 9.1 算法单元测试

为每个已确认公式准备 **golden cases**（固定输入 → 固定正确输出）。预期值由**人工独立核算**，不抄自实现代码。

#### Mirwald（男）

| 输入 | 值 |
|------|-----|
| 身高 | 175 cm |
| 体重 | 65 kg |
| 坐高 | 92 cm |
| 年龄 | 14.2 岁 |
| 腿长 | 83 cm（计算值） |

手工核算：

```
偏移 = -9.236
  + 0.0002708 × (83 × 92)      = +2.0678
  - 0.001663 × (14.2 × 83)     = -1.9600
  + 0.007216 × (14.2 × 92)     = +9.4270
  + 0.02292 × (65 / 175 × 100) = +0.8513
= 1.1501
```

```java
assertEquals(1.1501, result.getOffset(), 0.0001);
assertEquals(13.05,  result.getPhvAge(), 0.01);
```

#### Mirwald（女）

| 输入 | 值 |
|------|-----|
| 身高 | 162 cm |
| 体重 | 52 kg |
| 坐高 | 86 cm |
| 年龄 | 12.8 岁 |
| 腿长 | 76 cm（计算值） |

手工核算：

```
偏移 = -9.376
  + 0.0001882 × (76 × 86)      = +1.2301
  + 0.0022 × (12.8 × 76)       = +2.1402
  + 0.005841 × (12.8 × 86)     = +6.4298
  - 0.002658 × (12.8 × 52)     = -1.7692
  + 0.07693 × (52 / 162 × 100) = +2.4694
= 1.1242
```

```java
assertEquals(1.1242, result.getOffset(), 0.0001);
assertEquals(11.68,  result.getPhvAge(), 0.01);
```

#### RSA 衰减率

7 趟成绩：`[4.31, 4.42, 4.50, 4.48, 4.55, 4.61, 4.70]`

手工核算：

```
总时间 = 4.31 + 4.42 + 4.50 + 4.48 + 4.55 + 4.61 + 4.70 = 31.57
最佳  = 4.31
n    = 7
Sdec = (31.57 - 4.31 × 7) / (4.31 × 7) × 100
    = (31.57 - 30.17) / 30.17 × 100
    = 1.40 / 30.17 × 100
    = 4.6404%
```

```java
assertEquals(4.6404, result.getSdec(), 0.0001);
```

#### 组合指数

| 指标 | 实际值 | evaluation_direction | direction_override | μ | σ | 权重 |
|------|--------|----------------------|--------------------|---|---|------|
| CMJ功率 | 54.0 W/kg | HIGHER_BETTER | NULL | 50.0 | 8.0 | 0.5 |
| 10m冲刺 | 1.78 s | LOWER_BETTER | NULL | 1.90 | 0.06 | 0.5 |

手工核算：

```
CMJ:  HIGHER_BETTER → direction=0（继承），不翻转
Z_A = (54.0 - 50.0) / 8.0 = 0.5000
T_A = 50 + 10 × 0.5 = 55.00

冲刺: LOWER_BETTER → direction=1（继承），翻转
Z_B = -(1.78 - 1.90) / 0.06 = 2.0000
T_B = 50 + 10 × 2.0 = 70.00

组合分 = 0.5 × 55.00 + 0.5 × 70.00 = 62.50
```

```java
assertEquals(55.00, result.getTScoreA(), 0.01);
assertEquals(70.00, result.getTScoreB(), 0.01);
assertEquals(62.50, result.getComboScore(), 0.01);
```

Khamis-Roche 已启用 2015 简化版（`READY`），当前未固化 golden case；回归时以体态保存后 `apms_athlete.predicted_adult_height`、`adult_height_algo` 与来源测量核对，不手抄实现输出。

### 9.2 业务测试

| 场景 | 验证点 |
|------|--------|
| RTP 仅授权角色可改 | 无 `apms:rtp:edit` 的账号调用 `/apms/rtp/update` 返回 403 |
| RTP 日志正确追加 | 每次状态变更后 `apms_rtp_log` 新增一条，旧记录不变；清除状态同样留痕 |
| 任务进度正确 | `apms_task_member.status` 与 result 实际数据一致（pending/partial/completed），且以必测项为准 |
| 两阶段导入 | preview 返回逐行校验结果；commit 对同队员同日冲突拒绝，不静默覆盖 manual/task 记录 |
| 多次试测最佳成绩 | 同一 `athlete_id + task_item_id` 最多一个 `is_selected=1`；无效 attempt 不可被选中 |
| 组合分可复现 | 重查历史评分读取 `ref_snapshot`，不随新数据变化；N<5 时快照标注真实样本量与代理口径 |
| RTP 风险处置 | 知悉/忽略/采纳均留痕；采纳只跳转编辑，不自动改 `apms_rtp_status` |

### 9.3 安全测试

| 场景 | 验证点 |
|------|--------|
| 未登录不能下载医疗附件 | 无 token 访问 `/apms/medical-record/file/download/{fileId}` 返回 401 |
| 无权限不能下载 | 有 token 但无 `apms:medicalFile:download` 返回 403 |
| 报告私有下载 | `/apms/report/download/{id}` 同样需要 `apms:report:download`，且不能当静态文件直链访问 |
| 专岗越权 | 教练调测试结果写接口、测量员调医疗删除、队医调报告生成均返回 403 |
| D9 提权 | super 直调角色接口提交 `system:*` / 不可委派菜单必须整体拒绝（见 PERMISSION_REGRESSION §3.5） |
| D10 对象边界 | super 不能查询/修改/授权/删除 admin 用户与 admin 角色 |
| 行级数据权限 | 当前 `data_scope=1` 不生效；启用后按“队伍级”验证跨队不可见 |

### 9.4 验收测试

对照项目边界验收项，逐页手动走查：

| 验收项 | 测试路径 | 验收入口 |
|--------|---------|---------|
| 数字档案 | 新建运动员 → 录入体态 → 查看档案页数据完整 | `/athletes/roster` |
| RTP | 修改 RTP 状态 → 查看日志 → 验证权限隔离 | `/healthcare/alert-center` |
| PHV | 录入身高体重坐高 → Mirwald 计算结果正确 → 成年身高字段更新 | `/athletes/growth` |
| 指标/任务 | 配置指标 → 创建任务 → 分配运动员 → 录入结果 → 进度更新 | `/testings/dispatch` |
| 专项测试 | 录入 30m 冲刺 3 次试测 → 最佳成绩自动标记 → RSA 7 趟衰减率计算 | `/testings/dispatch` |
| 趋势 | 同一运动员多次录入 → 趋势/参考区间正确 | 运动员详情 / 报告中心 |
| PDF 导出 | 生成个人报告 → 鉴权下载 PDF → 内容与页面一致 | `/analytics/report-center` |

### 9.5 自动化与回归资产

| 资产 | 用途 |
|------|------|
| `.trae/demo-tests/run.mjs` | 演示模式 Node 桩测（auth 四态、Demo Adapter、13 模块 mock 路由、下载守卫），不依赖无头浏览器 |
| `.trae/PERMISSION_REGRESSION.md` | 权限手测回归说明书（P0 冒烟、curl 提权、F1–F8 强制下线） |
| `.trae/skills/roster-style-pages` | 花名册页面重构范式与逐项浏览器验收清单 |
| `.trae/skills/rk-split-width-fix` | 主从双栏左栏宽度/横滚回归方法 |
| `patches/` | 数据库变更唯一部署源，部署脚本按 `apms_db_version` 去重应用 |
