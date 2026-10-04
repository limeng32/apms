---
id: roadmap.rtp-warning-phase1
title: RTP风险预警一期详细设计（规则引擎·待办闭环）
capability: rtp
scope: roadmap
phase: phase-1-design
status: proposed
authority: 60
conflict_group: rtp-decision-mode
sources:
- document: 用户需求
  sections:
  - 动态健康状态预警（RTP）
  - 训练负荷监控与周期化管理
tags:
- RTP
- 风险预警
- 规则引擎
- 待办
- Quartz
relations:
- product.rtp
- domain.rtp
- roadmap.acwr
---

# RTP 风险预警 · 第一期详细设计

> 版本：设计稿（未实现）
> 范围：在不采集训练负荷的前提下，用现有医疗 / PHV / 体测 / RTP 复检数据，做**规则驱动的风险提示 + 人工确认闭环**。
> 与二期（ACWR / sRPE 训练负荷预警，见 `roadmap/acwr.md`）的边界：一期不引入任何日常训练负荷数据。

## 1. 目标与边界

### 1.1 做什么

系统每日自动扫描现有数据，产出**分级风险提示**，在独立「RTP 风险预警 / 预警待办」页展示因子明细；康复师可：

- **采纳**：跳转到 RTP 状态编辑（人工确认后写入红黄绿）；
- **忽略**：填写理由后关闭该提示。

全过程留痕，系统只给「建议」，不自动改变 `apms_rtp_status`。

### 1.2 不做什么

- 不自动修改红 / 黄 / 绿状态（坚持 `product.rtp` 确定的「人工确认」边界）；
- 不做训练负荷、ACWR、sRPE、TRIMP（属二期，依赖训练负荷采集）；
- 不输出医学诊断、不停训、不生成训练处方；
- 不做统计 / 机器学习模型（数据量不足，且不可解释）。

### 1.3 现状数据底座（已核实）

| 数据 | 表 | 一期可用点 |
|---|---|---|
| RTP 当前状态 | `apms_rtp_status` | `next_review_date` 复检日、当前 g/y/r |
| RTP 变更流水 | `apms_rtp_log` | 采纳建议后仍写此表，审计链复用 |
| 医疗档案 | `apms_medical_record` | `record_type` ∈ injury/illness/surgery/rehabilitation/checkup；**无「是否痊愈」字段**，闭环需推断 |
| PHV | `apms_phv_record` | 最新 `maturity_offset`、`measure_date` |
| 测试成绩 | `apms_test_result` / `apms_test_result_value` | 最佳成绩 `is_selected=1`、`numeric_value`；指标方向 `apms_indicator.evaluation_direction` |
| 指标评级 | `apms_indicator_ref` / `apms_indicator_ref_level` | GOOD/NORMAL/ATTENTION/POOR 等区间 |
| 运动员 | `apms_athlete` | 在训 `status='0'`、生日、主属队伍（DataScope） |
| 定时任务 | `ruoyi-quartz`（`RyTask` 模式 + `sys_job`） | 每日全量扫描 |

## 2. 预警规则

默认 5 条，阈值 / 权重 / 开关全部存 `apms_rtp_risk_rule`，可按机构校准。

**核心设计：三个维度分离，且先按类别切开**

- `kind`（因子类别）：**HEALTH（健康因子）/ PROCESS（流程因子）**。这是第一道闸门——
  - 只有 **HEALTH** 因子进入 `riskScore` 和黄 / 红建议计算；
  - **PROCESS** 因子健康分贡献恒为 0，**只**产生流程待办、影响 `todoPriority`，永远不可能抬高或压低黄 / 红建议；
- `severity`（健康风险严重度 1/2/3）：仅对 HEALTH 因子有意义，参与加权评分；PROCESS 规则该列固定 0（不参与评分）；
- `urgency`（流程紧迫度 1/2/3）：**只用于待办排序**，回答「多快该处理」；
- `forceWarning`（布尔）：仅 HEALTH 因子可置 true，「可直接建议红色」的健康危急因子。

流程类提醒（复检逾期 / 临近）属于 PROCESS：再紧迫也只是待办优先级，不代表健康恶化，**不向 riskScore 加一分**；真正的健康因子（未闭环伤病、PHV、体测）属于 HEALTH；未闭环手术等危急项才 `forceWarning=true`。

| 代码 | kind | 规则 | 默认触发条件 | severity（仅HEALTH计分） | urgency | forceWarning |
|---|---|---|---|---|---|---|
| `REVIEW_OVERDUE` | **PROCESS** | RTP 复检逾期 | 复检日 < 今天 | 0（不计分） | 3 | false |
| `REVIEW_SOON` | **PROCESS** | 复检临近 | 0 ≤ 距今天数 ≤ `reviewSoonDays`(14) | 0（不计分） | 2 | false |
| `INJURY_OPEN` | HEALTH | 伤病 / 手术未闭环 | `injuryWindowDays`(45) 天内有 injury/surgery，且其后无更晚的 rehabilitation/checkup 记录 | surgery=3 / injury=2 | surgery=3 / injury=2 | surgery **true** / injury false |
| `PHV_PEAK` | HEALTH | 身高突增峰期 | `|maturity_offset| ≤ phvPeakBand`(0.5) 且记录日距今 ≤ `phvFreshDays`(180) | 1 | 1 | false |
| `TEST_DECLINE` | HEALTH | 关键体测异常 / 下滑 | 最新最佳成绩落入 POOR/ATTENTION 区间；**或**同一指标最近两次最佳成绩按方向恶化 ≥ `declineRatio`(8%)；仅关键指标白名单 | 2 | 2 | false |

> 这样即使一个运动员同时「复检逾期」+ 命中 PHV_PEAK：health riskScore 也只有 PHV 的 1 分（INFO），逾期的 3 分 urgency 只让待办置顶，绝不会把建议从 INFO 推到 ATTENTION/WARNING。

### 2.1 规则细则

- **无数据即静默**：缺生日 / 缺成绩 / 缺评级数据的因子不产生提示，不制造「正常」噪声。
- **伤病闭环推断（折中）**：医疗表没有闭环字段，定义为——某 injury/surgery 之后存在 `record_date` 更晚的 rehabilitation 或 checkup 记录，则视为已闭环；超过 `closureWindowDays`(90) 的旧伤不再提示。抽屉中必须标注「未检测到康复 / 复查记录，请人工核实」。
- **体测下滑优先用评级**：有 `indicator_ref_level` 数据时按评级判定；无评级数据时退化到「同指标最近两次最佳成绩环比」；两者都不满足该规则静默。
- **关键指标白名单**：`TEST_DECLINE.params.indicatorCodes` 初始取速度 / 耐力 / RSA 类指标 code，避免噪声指标全量报警。
- `REVIEW_OVERDUE` 与 `REVIEW_SOON` 互斥（同一天只可能命中其一）。

### 2.2 评分与建议级别

```
healthScore = Σ [仅 kind=HEALTH 的因子] (severity × weight)
              PROCESS 因子一律不计入（即使 urgency 再高）
forceWarningHit = 存在任一 (kind=HEALTH 且 forceWarning=true) 的因子
todoPriority = max(所有因子 urgency)   // HEALTH + PROCESS 一起取最大，仅排序用

# 建议级别只由健康因子决定：
存在 forceWarningHit            → WARNING   建议红（停训 / 就医评估）
healthScore ≥ scoreWarning(9)   → WARNING
healthScore ≥ scoreAttention(6) → ATTENTION 建议黄（限制参训评估）
healthScore ≥ scoreInfo(3)，
  或命中任一 HEALTH 因子        → INFO      健康关注
healthScore = 0 且仅命中 PROCESS 因子
                                → INFO（流程待办，标记 processOnly=true，riskScore=0）
无任何因子                      → NONE（不生成待办）
```

关键区别：

- **黄色 / 红色建议只由健康因子决定**，流程因子（复检逾期 / 临近）对 `healthScore` 贡献恒为 0，不可能单独或叠加地影响黄 / 红；
- **纯流程提醒**（如只有复检逾期）也产生待办：级别显示为 INFO，但带独立的 **`processOnly` 流程标记**（`riskScore=0`），与健康 INFO 视觉区分，置顶显示「逾期 N 天」；
- 待办列表默认排序：`todoPriority DESC, suggested_level DESC, snapshot_date ASC`，逾期项凭 urgency=3 置顶，与健康级别无关。

阈值 `scoreInfo / scoreAttention / scoreWarning` 存规则配置（一期可放全局参数行或常量类，后续做配置页）。所有输出文案带「建议 / 供参考」字样。

### 2.3 建议级别 → RTP 状态的映射（强约束，不可写成三色一一对应）

**预警系统只提示风险，永远不建议 green。** `suggested_level` 与 RTP 状态写入的映射是：

| suggested_level | 含义 | 是否产生 RTP 状态建议 | 采纳动作 |
|---|---|---|---|
| `INFO` | 健康关注（HEALTH）或纯流程提醒（PROCESS，`processOnly=true`） | **否** | 只能「已知悉 / 忽略」，不预填、不写任何 RTP 状态 |
| `ATTENTION` | 建议限制 | 是 → 建议 **yellow** | 采纳时预填 yellow（仍需人工确认提交） |
| `WARNING` | 建议停训 / 就医评估 | 是 → 建议 **red** | 采纳时预填 red（仍需人工确认提交） |

明确禁止：

- **禁止 `INFO → green`**：例如仅命中 `PHV_PEAK` 得到 INFO，不代表该运动员「适合正常参训」；
- **禁止预警建议导致状态降级**：采纳是「风险升级动作」，只能写入 yellow/red，**不允许把已有 yellow/red 改成 green**。green 只能来自康复师在 RTP 模块的主动评估（康复完成、综合判断正常），与风险预警无关。

实现约束：

1. 采纳**不是两次 HTTP，而是单个本地事务接口**（见 4.4 与 5.1）；
2. 后端在采纳接口内对目标状态做白名单校验：ATTENTION 只接受 `y`、WARNING 只接受 `r`，收到 `g` 一律拒绝；
3. 采纳时若运动员当前 RTP 已是更高级别（如当前 red、本次建议 yellow），后端不降级，前端给出「当前为更严格状态，无需下调」提示；是否由红转黄由康复师走常规 RTP 评估完成；
4. 前端 RTP 编辑弹窗从预警进入时，状态单选框不提供 green 选项（或 green 禁用并提示「green 需在 RTP 模块主动评估」）。

## 3. 数据库设计

一个 SQL 补丁，两张新表 + 菜单 / 权限 / 定时任务种子。

### 3.1 `apms_rtp_risk_snapshot`（每日风险快照）

```sql
CREATE TABLE apms_rtp_risk_snapshot (
  id              bigint NOT NULL AUTO_INCREMENT,
  athlete_id      bigint NOT NULL,
  dept_id         bigint DEFAULT NULL COMMENT '扫描时主属队伍（筛选/DataScope）',
  snapshot_date   date NOT NULL COMMENT '快照日期',
  risk_score      decimal(5,2) NOT NULL DEFAULT 0 COMMENT '健康分=仅HEALTH因子加权和；纯流程待办为0',
  todo_priority   tinyint NOT NULL DEFAULT 0 COMMENT '待办优先级=max(所有因子urgency)，仅排序用',
  process_only    char(1) NOT NULL DEFAULT '0' COMMENT '1=纯流程待办（无健康因子，不计RTP建议）',
  process_flags   json DEFAULT NULL COMMENT '命中的流程因子码，如["REVIEW_OVERDUE"]',
  suggested_level varchar(16) NOT NULL COMMENT 'NONE/INFO/ATTENTION/WARNING（INFO含健康关注与纯流程两种，由process_only区分）',
  factors         json NOT NULL COMMENT '因子明细[{code,kind,severity,urgency,forceWarning,weight,title,detail,refData}]',
  status          varchar(10) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/ACKED/ACCEPTED/DISMISSED/EXPIRED',
  handled_by      varchar(64) DEFAULT NULL,
  handled_time    datetime DEFAULT NULL,
  handle_remark   varchar(500) DEFAULT NULL,
  create_by       varchar(64) DEFAULT '',
  create_time     datetime DEFAULT NULL,
  update_time     datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_athlete_date (athlete_id, snapshot_date),
  KEY idx_date_status (snapshot_date, status),
  KEY idx_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RTP风险预警每日快照';
```

状态机：`ACTIVE`（当日待处理）→ `ACKED`（INFO 已知悉）/ `ACCEPTED`（ATTENTION/WARNING 已采纳并更新 RTP）/ `DISMISSED`（已忽略）；次日扫描开始时未处理的昨日 ACTIVE 置 `EXPIRED`。

### 3.2 `apms_rtp_risk_rule`（规则与阈值配置）

```sql
CREATE TABLE apms_rtp_risk_rule (
  id           bigint NOT NULL AUTO_INCREMENT,
  rule_code    varchar(40) NOT NULL,
  rule_name    varchar(100) NOT NULL,
  enabled      char(1) NOT NULL DEFAULT '1',
  kind         varchar(10) NOT NULL DEFAULT 'HEALTH' COMMENT 'HEALTH健康因子(计分)/PROCESS流程因子(不计分,仅待办)',
  severity     tinyint NOT NULL DEFAULT 0 COMMENT '健康严重度1低2中3高（仅HEALTH参与评分；PROCESS固定0）',
  urgency      tinyint NOT NULL DEFAULT 1 COMMENT '紧迫度1低2中3高（仅待办排序）',
  force_warning char(1) NOT NULL DEFAULT '0' COMMENT 'HEALTH因子是否可直接建议红色；PROCESS恒为0',
  weight       decimal(4,2) NOT NULL DEFAULT 1.00 COMMENT '权重（仅HEALTH计分使用）',
  params       json DEFAULT NULL COMMENT '阈值参数（窗口天数/下滑率/指标白名单等）',
  update_by    varchar(64) DEFAULT '',
  update_time  datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RTP预警规则配置';
```

5 条规则的种子取值（列 + `params`）：

| rule_code | kind | severity | urgency | force_warning | params |
|---|---|---|---|---|---|
| REVIEW_OVERDUE | **PROCESS** | 0（不计分） | 3 | 0 | `{}` |
| REVIEW_SOON | **PROCESS** | 0（不计分） | 2 | 0 | `{ "reviewSoonDays": 14 }` |
| INJURY_OPEN | HEALTH | 动态：surgery 取 3/injury 取 2（引擎按记录类型覆盖） | surgery=3/injury=2 | surgery 时覆盖为 1 | `{ "injuryWindowDays": 45, "closureWindowDays": 90 }` |
| PHV_PEAK | HEALTH | 1 | 1 | 0 | `{ "phvPeakBand": 0.5, "phvFreshDays": 180 }` |
| TEST_DECLINE | HEALTH | 2 | 2 | 0 | `{ "declineRatio": 0.08, "indicatorCodes": ["..."] }` |

> 规则表对 PROCESS 行强制约束：`kind='PROCESS'` 时引擎忽略其 severity/weight/forceWarning（按 0 分处理），只取 urgency；防止后续有人误把流程规则 severity 调高又间接污染健康分。
> `INJURY_OPEN` 的 severity/urgency/forceWarning 由引擎在命中时按记录子类型（surgery vs injury）在 HEALTH 规则默认值基础上覆盖，避免拆成两条规则；覆盖结果仍写入快照 `factors` 明细，可追溯。

### 3.3 补丁与种子

- 文件：`patches/patch-0.0.6-<时间戳>.sql`，建表用 `information_schema` 幂等判断，规则用 `INSERT ... SELECT WHERE NOT EXISTS`，与现有补丁风格一致；
- 菜单：父菜单 2200，名称「RTP 风险预警」，路由 `apms/rtpWarning/index`，权限标识 `apms:rtpRisk:list`；按钮权限 `apms:rtpRisk:query / handle / scan`；
- Quartz：`sys_job` 插入任务
  - `job_name`：RTP风险每日扫描
  - `invoke_target`：`rtpRiskTask.scanDaily`
  - `cron`：`0 0 7 * * ?`（每日 07:00）
  - 默认启用，可在「系统监控-定时任务」中停用 / 改 cron。

## 4. 后端设计

### 4.1 包与类（沿用现有 apms 扁平包风格）

| 类型 | 类 |
|---|---|
| Domain | `ApmsRtpRiskSnapshot`、`ApmsRtpRiskRule` |
| Mapper + XML | `ApmsRtpRiskSnapshotMapper(.xml)`、`ApmsRtpRiskRuleMapper(.xml)` |
| 评估引擎 | `RtpRiskEvaluator`（无状态 Service，纯计算，可单测） |
| Service | `IRtpRiskService` / `ApmsRiskServiceImpl` |
| Controller | `ApmsRtpRiskController`（`/apms/rtp-risk`） |
| Quartz Task | `ruoyi-quartz` 内 `@Component("rtpRiskTask")` |

### 4.2 Mapper 关键方法

- Snapshot：`upsertSnapshot`（依赖唯一键 `uk_athlete_date`）、`selectActiveList(query)`（DataScope）、`selectByAthleteAndDate`、`expireBefore(date)`；
- Rule：`selectAllEnabled()`（引擎当天缓存一次）。

### 4.3 评估引擎 `RtpRiskEvaluator`

```
List<RiskFactor> evaluate(athleteId)   // 依次跑启用的规则
Result summarize(List<RiskFactor>)     // 加权求和 + 定级
```

- 规则按 `rule_code` 组织为策略（`Map<code, Rule>` 或独立方法），阈值全部从规则表读取，禁止硬编码；
- **计分前先按 `kind` 过滤**：
  - `healthScore = Σ(kind=HEALTH) severity×weight`；PROCESS 因子跳过，不累加；
  - `forceWarningHit = any(kind=HEALTH && forceWarning)`；
  - `todoPriority = max(所有因子 urgency)`；
  - `processFlags = [PROCESS 因子的 code]`；`processOnly = health 因子数=0 && processFlags 非空`；
- 汇总输出：`riskScore / suggested_level / todoPriority / processOnly / processFlags`（定级见 2.2），纯流程时 `riskScore=0、processOnly=true、suggested_level=INFO`；
- 因子结构（落库到 `factors` JSON，前端直接渲染）：

```json
{
  "code": "REVIEW_OVERDUE",
  "kind": "PROCESS",
  "severity": 0,
  "urgency": 3,
  "forceWarning": false,
  "weight": 1.00,
  "title": "RTP复检已逾期",
  "detail": "复检日 2026-09-20，已逾期 14 天（流程待办，不参与健康风险评分）",
  "refData": { "nextReviewDate": "2026-09-20", "daysOverdue": 14 }
}
```

健康危急因子示例（`INJURY_OPEN` 命中 surgery 时覆盖）：

```json
{
  "code": "INJURY_OPEN",
  "kind": "HEALTH",
  "severity": 3,
  "urgency": 3,
  "forceWarning": true,
  "weight": 1.00,
  "title": "术后未检测到康复/复查记录",
  "detail": "2026-08-30 有手术记录，其后无康复或复查记录，建议停训就医评估",
  "refData": { "recordType": "surgery", "recordDate": "2026-08-30" }
}
```

### 4.4 扫描服务

- `scanDaily()`：
  1. `expireBefore(今天)`：昨日未处理 ACTIVE → EXPIRED；
  2. 取全部在训运动员（`status='0'`）；
  3. 逐条 `evaluate`，结果为 NONE 也 upsert（便于次日对比）；列表待办条件：`suggested_level != 'NONE'`，即「有 HEALTH 因子」**或**「processOnly 纯流程待办」都入列；
  4. 返回 `{total, withRisk, byLevel}` 统计；
- `scanOne(athleteId)`：事件驱动增量重算（**医疗新增、PHV 自动计算后调用；RTP 更新不在此处触发**——常规 `/apms/rtp/update` 不触发扫描，预警采纳路径在 accept 事务 afterCommit 内自行触发，避免重复/竞争）。参照 PHV 的 `tryAutoCalculate` 模式：异常只记日志，不阻断主业务；
  - 重算规则：**当日快照已处于终态（ACCEPTED/ACKED/DISMISSED）时不覆盖**，仅当存在 ACTIVE 快照或无快照时才 upsert；
  - `scanDaily` 每日负责先把昨日终态/未处理快照置 EXPIRED，再为当天生成新快照，因此「人工已处理的当天不被重算覆盖、次日重新评估」的语义成立。
- `ack(snapshotId, remark)`（**仅 INFO 可用**，对应 `processOnly` 或健康 INFO）：快照 ACTIVE → ACKED + 留痕，不触碰 RTP；
- `dismiss(snapshotId, remark)`（任意级别可用，需理由）：快照 → DISMISSED + 处理人 / 时间 / 理由；
- **`acceptAndApplyRtp(snapshotId, rtpForm)`（核心，仅 ATTENTION / WARNING 可用）**——单个本地事务方法，一次完成闭环，避免「两次 HTTP + 自动重扫」的竞争（详见下）。

#### acceptAndApplyRtp 事务设计（P0：消除采纳与 scanOne 竞争）

问题背景：若沿用「先 `/apms/rtp/update`（其内触发 scanOne upsert 当日快照）再 ACCEPT 旧快照」的两步方案，复检日一更新、逾期因子消失，第二步面对的可能已是重算后的 NONE/INFO 快照，闭环断裂。因此合并为**同库本地事务**（非 Saga、非分布式事务）：

```
POST /apms/rtp-risk/{id}/accept   body = { status, reason, trainingLimit, nextReviewDate }

@Transactional(rollbackFor = Exception.class)
acceptAndApplyRtp(snapshotId, rtpForm):
  1. SELECT 快照 FOR UPDATE（行锁，锁定该 athlete 当日快照）
  2. 校验：快照存在、status=ACTIVE、suggested_level ∈ {ATTENTION,WARNING}
  3. 校验目标状态白名单：ATTENTION→y / WARNING→r（拒绝 g）；不降级校验
  4. 更新/插入 apms_rtp_status（复用现有 upsert 逻辑，记录更新人）
  5. INSERT apms_rtp_log（from→to，复用现有留痕字段）
  6. UPDATE 快照：ACTIVE → ACCEPTED（handled_by/time/remark、记录采纳的 rtpForm）
  —— 同一事务提交（RTP、log、snapshot 原子可见）——
7. 事务提交后（TransactionSynchronization afterCommit）再触发 scanOne(athleteId)：
   当日快照已是 ACCEPTED，重算结果写入「次日/新的待办判定」或仅刷新统计，不再覆盖本次 ACCEPTED 结论
```

要点：

- 步骤 1–6 在**一个数据库事务**里，要么全成功要么全回滚，不存在「RTP 改了但待办没关」的中间态；
- 用 `SELECT ... FOR UPDATE` 锁定快照行，串行化同一运动员的并发采纳 / 扫描，彻底消除 upsert 竞争；
- **scanOne 移到事务 afterCommit**，且扫描逻辑跳过「当日已 ACCEPTED/ACKED/DISMISSED」快照（人工已处理的当天结论不被自动重算覆盖），只在次日定时扫描时置 EXPIRED 并重算；
- 接口幂等：快照已非 ACTIVE（重复点击 / 重试）时直接返回当前状态，不重复写 RTP / log；
- 该接口同时需要 `apms:rtpRisk:handle` 与 `apms:rtp:edit` 权限（在同一调用内完成风险采纳与 RTP 写入）。

### 4.5 Controller `ApmsRtpRiskController`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/apms/rtp-risk/list` | `apms:rtpRisk:list` | 待办列表（DataScope `deptAlias`，筛选 级别/状态/队伍/姓名） |
| GET | `/apms/rtp-risk/athlete/{athleteId}/latest` | `apms:rtpRisk:query` | 运动员详情页当前建议 |
| GET | `/apms/rtp-risk/rules` | `apms:rtpRisk:query` | 规则配置（一期只读） |
| POST | `/apms/rtp-risk/{id}/ack` | `apms:rtpRisk:handle` | body: `{remark}`；仅 INFO，标记已知悉 |
| POST | `/apms/rtp-risk/{id}/dismiss` | `apms:rtpRisk:handle` | body: `{remark}`；忽略（必填理由） |
| POST | `/apms/rtp-risk/{id}/accept` | `apms:rtpRisk:handle` + `apms:rtp:edit` | body: `{status, reason, trainingLimit, nextReviewDate}`；**单接口本地事务**：写 RTP+log+快照置 ACCEPTED，见 4.4 |
| POST | `/apms/rtp-risk/scan` | `apms:rtpRisk:scan` | 手动全量扫描 |

### 4.6 Quartz

`rtpRiskTask.scanDaily()` 委托 Service，与 `RyTask` 完全同模式；`scanOne` 不走定时任务，由业务事件直接调 Service。

## 5. 前端设计

### 5.1 新页面 `ruoyi-ui/src/views/apms/rtpWarning/index.vue`

沿用 roster-kit 花名册风格。

- 页头：标题「RTP 风险预警」+「立即扫描」按钮（`apms:rtpRisk:scan`，二次确认 + loading）；
- KPI 卡带：待处理总数、WARNING / ATTENTION / 健康 INFO 各多少、纯流程待办（复检逾期 / 临近）单独统计，便于队务催办；
- 筛选：建议级别（WARNING/ATTENTION/健康 INFO/流程提醒）、状态（待处理/已处理）、队伍、姓名，另设「仅看复检逾期」快捷开关；
- 列表列（默认按 `todoPriority DESC, suggested_level DESC, snapshot_date ASC` 排序）：
  - 队员（头像用统一的 `ageAvatarColor` + `GenderBadge` + 名字 / 队伍两行）；
  - 级别徽标——分两类视觉：
    - 健康建议：WARNING 红 / ATTENTION 橙 / 健康 INFO 蓝；
    - **流程提醒**（`processOnly=true`）：中性灰蓝 + 时钟图标（如「逾期 14 天」），不用健康红 / 橙色，避免被误读为停训建议；
  - 风险分（纯流程待办显示 0 或「—」）；
  - 触发因子（chip 按 kind 区分颜色：HEALTH 暖色 / PROCESS 中性色，悬浮 tooltip 显示 `detail`）；
  - 快照日期；状态；操作；
- 行点击 → 抽屉：
  - 因子明细卡：每条规则的标题、人话原因、参考数据、级别；
  - 底部操作按级别区分：
    - **INFO**：只有「已知悉」（ACK）和「忽略」（DISMISS，必填理由），**没有**「采纳并更新 RTP」按钮；
    - **ATTENTION / WARNING**：
      - **采纳并更新 RTP**：见下方 5.1 时序；若当前已是更严格状态，按钮置灰并提示无需下调；
      - **忽略**（必填理由，调 `/dismiss`）；
    - 关闭。
- 新增 `src/api/apms/rtpRisk.js`；演示模式补 mock handler 与种子规则。

#### 5.1 「采纳并更新 RTP」调用时序（单接口、本地事务、无竞争）

```
用户点「采纳并更新 RTP」（仅 ATTENTION/WARNING）
        ↓
弹出 RTP 编辑弹窗（ATTENTION 仅 yellow / WARNING 仅 red，green 不出现，预填因子汇总原因）
        ↓
人工确认状态、原因、训练限制、复检日
        ↓
POST /apms/rtp-risk/{id}/accept        ← 唯一一次 HTTP
     body = { status, reason, trainingLimit, nextReviewDate }
        ↓ 后端单事务：锁快照行 → 校验 → 写 RTP → 写 rtp_log → 快照置 ACCEPTED（一起提交）
        ↓ 事务 afterCommit：再 scanOne（已 ACCEPTED 当日快照不被覆盖）
刷新待办（该条原子地消失 / 标记已采纳）
```

- 前端只发**一次**请求，不再先调 `/apms/rtp/update` 再调 handle；
- 后端在同一本地事务内完成 RTP 写入、日志、快照收尾，前端无需处理「两步部分成功」窗口，也不需要「采纳中」中间状态；
- 请求失败（校验拒绝 / 网络错误 / 事务回滚）：RTP 与快照都不变，弹窗停留，可修改后重试；
- 重复提交（双击 / 超时重试）由后端按快照状态幂等处理；
- 因为复检日更新导致逾期因子消失这类情况，发生在「快照已 ACCEPTED 之后」的 afterCommit 重扫中，不影响本次闭环。

### 5.2 运动员详情页

RTP Tab 顶部增加「当前系统建议」横幅（复用 `rk-banner tone-amber/red`），展示级别与因子数，点击跳转预警待办；只读，不改变现有交互。

## 6. 权限设计

| 权限点 | 含义 |
|---|---|
| `apms:rtpRisk:list` | 菜单与列表 |
| `apms:rtpRisk:query` | 因子明细 / 规则查询 |
| `apms:rtpRisk:handle` | 采纳 / 忽略（建议仅授权康复师角色） |
| `apms:rtpRisk:scan` | 手动触发扫描 |

采纳闭环需同时具备 `apms:rtpRisk:handle` 与既有 `apms:rtp:edit`（实际状态写入仍受 RTP 权限校验）。

## 7. 触发与时效

- **定时全量**：每天 07:00（sys_job，可停用 / 改 cron）；
- **事件增量**：医疗记录新增、PHV 自动计算、RTP 状态更新后调 `scanOne`，当日即更新；
- 快照按日 upsert + 旧 ACTIVE 置 EXPIRED，待办不堆积，每天看到的都是最新结论；
- 已 ACCEPTED / DISMISSED 的当日快照不被扫描覆盖（保留人工处理结果）。

## 8. 边界与异常处理

- 缺数据（生日 / 成绩 / 评级）→ 对应规则静默；
- 伤病闭环为推断结果，UI 明确提示人工核实；
- 评分阈值、权重、窗口天数、指标白名单全部配置化，初始值仅为建议默认，上线后用机构数据校准；
- 建议文案统一「建议 / 供参考」，不作为医学诊断或单独选材 / 停训依据（与 `product.rtp`、`domain.rtp` 一致）；
- **流程紧迫 ≠ 健康风险（双层隔离）**：① 规则分 `kind=PROCESS/HEALTH`，流程因子**不进 healthScore**（不是靠 severity 设小、也不是靠 forceWarning 兜底，而是计分入口直接排除），无论 urgency 多高都不可能直接或间接影响黄 / 红；② 流程因子只贡献 `todoPriority` 与独立的流程徽标；UI 上流程提醒与健康级别徽标视觉分离，防止康复师把「逾期未复检」误读为「建议停训」；
- **预警永不建议 green、永不降级**：INFO 不映射任何 RTP 状态（仅知悉/忽略），ATTENTION→yellow、WARNING→red；系统不存在任何把 green 作为建议值的路径，green 只能由康复师在 RTP 模块主动评估产生；后端对采纳动作做级别白名单与「不降级」双重校验，前端限制只是体验层，最终以后端校验为准；
- 扫描异常不影响医疗 / PHV / RTP 主写入链路（事件增量调用 try/catch 包裹）；
- **采纳闭环原子化**：采纳为单接口单本地事务（RTP + rtp_log + 快照 ACCEPTED 一起提交），快照行 `FOR UPDATE`，从根本上消除「先更新 RTP 触发重扫、再 ACCEPT 旧快照」的竞争；scanOne 只在事务 afterCommit 执行且不覆盖当日终态快照，无需 Saga / 分布式事务 / 「采纳中」状态。

## 9. 交付物与实施顺序

1. SQL 补丁：2 张表 + 5 条规则种子 + 菜单 / 权限 + sys_job；
2. 后端：domain/mapper/xml + 评估引擎 + JUnit 单测，单测必须覆盖：
   - **PROCESS 隔离**：仅 REVIEW_OVERDUE → riskScore=0、processOnly=true、INFO、todoPriority=3；逾期 + PHV_PEAK → riskScore 仍为 1（不被逾期推高）；逾期 + 多健康因子组合时黄/红阈值只由健康分决定；
   - forceWarning（术后未闭环）→ WARNING；普通 injury → 按健康分定级；
   - REVIEW_OVERDUE/SOON 互斥；阈值边界（含 scoreInfo/Attention/Warning 临界值）；
3. 扫描服务 / Controller / Quartz task；在**医疗新增、PHV 自动计算**写入点接入 `scanOne`（RTP 常规更新不接入，采纳路径在 accept 事务 afterCommit 内处理）；
4. 前端：api + 预警待办页 + 详情页横幅 + mock；
5. 联调：手动 scan → 待办 → **accept 单接口原子闭环（RTP + 日志 + ACCEPTED 同事务）** → ACK / DISMISS（留痕）→ 采纳后 scanOne 不覆盖当日结论 → 次日 EXPIRED 重算 全链路；并发：对同一快照重复 accept 验证行锁与幂等。

量级预估：约 2–3 人日（后端约 12 个文件、前端约 5 个文件、补丁 1 个）。

## 10. 待确认决策

1. 伤病闭环窗口默认值（未康复 45 天提示 / 90 天过期）是否采用，还是一期改为「有 injury/surgery 且无任何后续 rehabilitation/checkup 即提示，不限天数」；
2. `TEST_DECLINE` 是否纳入一期（需先维护关键指标白名单），或 1.0 先上复检逾期、未闭环伤病、PHV 峰期 3 条确定性最高的规则，体测下滑放 1.1；
3. 每日扫描时间 07:00 是否合适。

## 11. 与二期（ACWR）的衔接

一期的规则引擎、快照表、待办与采纳闭环、Quartz 机制在二期直接复用；二期只需：

- 新增 `training_load`（sRPE / 设备负荷）数据采集；
- 新增 ACWR / 周负荷变化率规则与因子；
- 规则配置增加权重，无需改交互框架。
