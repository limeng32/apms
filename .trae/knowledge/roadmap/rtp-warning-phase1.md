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

**核心设计：两个维度分离**

- `severity`（健康风险严重度 1/2/3）：参与加权评分，回答「这件事对健康有多大风险」；
- `urgency`（流程紧迫度 1/2/3）：**只用于待办排序**，回答「多快该处理」，不参与健康评分、不影响建议级别；
- `forceWarning`（布尔）：是否为「可直接建议红色」的健康危急因子。

流程类提醒（复检逾期 / 临近）紧迫但不代表健康恶化：`urgency` 高、`forceWarning=false`；真正的健康危急因子（未闭环手术等）才 `forceWarning=true`。

| 代码 | 规则 | 数据来源 | 默认触发条件 | severity | urgency | forceWarning |
|---|---|---|---|---|---|---|
| `REVIEW_OVERDUE` | RTP 复检逾期 | `apms_rtp_status.next_review_date` | 复检日 < 今天 | 3 | 3 | **false** |
| `REVIEW_SOON` | 复检临近 | 同上 | 0 ≤ 距今天数 ≤ `reviewSoonDays`(14) | 1 | 2 | false |
| `INJURY_OPEN` | 伤病 / 手术未闭环 | `apms_medical_record` | `injuryWindowDays`(45) 天内有 injury/surgery，且其后无更晚的 rehabilitation/checkup 记录 | surgery=3 / injury=2 | surgery=3 / injury=2 | surgery **true** / injury false |
| `PHV_PEAK` | 身高突增峰期 | 最新 `apms_phv_record` | `|maturity_offset| ≤ phvPeakBand`(0.5) 且记录日距今 ≤ `phvFreshDays`(180) | 1 | 1 | false |
| `TEST_DECLINE` | 关键体测异常 / 下滑 | `apms_test_result(_value)` + 指标评级 | 最新最佳成绩落入 POOR/ATTENTION 区间；**或**同一指标最近两次最佳成绩按方向恶化 ≥ `declineRatio`(8%)；仅关键指标白名单 | 2 | 2 | false |

> 说明：`REVIEW_OVERDUE` 虽 `severity=3`（使其在汇总中有足够权重、单独出现即为 INFO 级提示），但 `forceWarning=false`，因此**绝不会**仅因逾期就给出「建议红 / 停训就医」；它通过 `urgency=3` 排在待办最前面。是否把复检类因子的 severity 也调低（使其不参与健康分）可在规则表配置，一期保留上述默认。

### 2.1 规则细则

- **无数据即静默**：缺生日 / 缺成绩 / 缺评级数据的因子不产生提示，不制造「正常」噪声。
- **伤病闭环推断（折中）**：医疗表没有闭环字段，定义为——某 injury/surgery 之后存在 `record_date` 更晚的 rehabilitation 或 checkup 记录，则视为已闭环；超过 `closureWindowDays`(90) 的旧伤不再提示。抽屉中必须标注「未检测到康复 / 复查记录，请人工核实」。
- **体测下滑优先用评级**：有 `indicator_ref_level` 数据时按评级判定；无评级数据时退化到「同指标最近两次最佳成绩环比」；两者都不满足该规则静默。
- **关键指标白名单**：`TEST_DECLINE.params.indicatorCodes` 初始取速度 / 耐力 / RSA 类指标 code，避免噪声指标全量报警。
- `REVIEW_OVERDUE` 与 `REVIEW_SOON` 互斥（同一天只可能命中其一）。

### 2.2 评分与建议级别

```
因子分 = severity(健康严重度 1/2/3) × weight(默认 1.00，可配)
总分   = Σ 因子分
待办优先级 todoPriority = max(urgency)   // 仅排序用，不参与定级

total = 0                → NONE（不生成提示）
total ≥ scoreInfo(3)     → INFO       关注
total ≥ scoreAttention(6)→ ATTENTION  建议黄（限制参训评估）
total ≥ scoreWarning(9)，或「存在任一 forceWarning=true 的因子」
                         → WARNING    建议红（停训 / 就医评估）
```

关键区别：

- **红色建议只可能由健康危急因子触发**（总分极高，或 `forceWarning=true`）；
- **复检逾期**：`forceWarning=false` → 最高只会因累计分到 ATTENTION，单独出现时为 INFO，但 `todoPriority=3` 置顶并标红「逾期 N 天」的流程徽标（区别于健康级别的红色建议）；
- 待办列表默认排序：`todoPriority DESC, suggested_level DESC, snapshot_date ASC`，逾期项天然排最前。

阈值 `scoreInfo / scoreAttention / scoreWarning` 存规则配置（一期可放全局参数行或常量类，后续做配置页）。所有输出文案带「建议 / 供参考」字样。

### 2.3 建议级别 → RTP 状态的映射（强约束，不可写成三色一一对应）

**预警系统只提示风险，永远不建议 green。** `suggested_level` 与 RTP 状态写入的映射是：

| suggested_level | 含义 | 是否产生 RTP 状态建议 | 采纳动作 |
|---|---|---|---|
| `INFO` | 仅关注 | **否** | 只能「已知悉 / 忽略」，不预填、不写任何 RTP 状态 |
| `ATTENTION` | 建议限制 | 是 → 建议 **yellow** | 采纳时预填 yellow（仍需人工确认提交） |
| `WARNING` | 建议停训 / 就医评估 | 是 → 建议 **red** | 采纳时预填 red（仍需人工确认提交） |

明确禁止：

- **禁止 `INFO → green`**：例如仅命中 `PHV_PEAK` 得到 INFO，不代表该运动员「适合正常参训」；
- **禁止预警建议导致状态降级**：采纳是「风险升级动作」，只能写入 yellow/red，**不允许把已有 yellow/red 改成 green**。green 只能来自康复师在 RTP 模块的主动评估（康复完成、综合判断正常），与风险预警无关。

实现约束：

1. `handle(... ACCEPT)` 仅当 `suggested_level ∈ {ATTENTION, WARNING}` 时可用；INFO 快照不返回「采纳并更新 RTP」按钮，只返回「已知悉 / 忽略」；
2. 后端 `handle` 对 ACCEPT 的目标状态做白名单校验：ATTENTION 只接受 `y`、WARNING 只接受 `r`，收到 `g` 一律拒绝；
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
  risk_score      decimal(5,2) NOT NULL DEFAULT 0,
  todo_priority   tinyint NOT NULL DEFAULT 0 COMMENT '待办优先级=max(因子urgency)，仅排序用',
  suggested_level varchar(16) NOT NULL COMMENT 'NONE/INFO/ATTENTION/WARNING',
  factors         json NOT NULL COMMENT '因子明细[{code,severity,urgency,forceWarning,weight,title,detail,refData}]',
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
  severity     tinyint NOT NULL DEFAULT 1 COMMENT '健康风险严重度 1低 2中 3高（参与评分）',
  urgency      tinyint NOT NULL DEFAULT 1 COMMENT '流程紧迫度 1低 2中 3高（仅待办排序）',
  force_warning char(1) NOT NULL DEFAULT '0' COMMENT '是否可直接建议红色（健康危急因子）',
  weight       decimal(4,2) NOT NULL DEFAULT 1.00,
  params       json DEFAULT NULL COMMENT '阈值参数（窗口天数/下滑率/指标白名单等）',
  update_by    varchar(64) DEFAULT '',
  update_time  datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RTP预警规则配置';
```

5 条规则的种子取值（列 + `params`）：

| rule_code | severity | urgency | force_warning | params |
|---|---|---|---|---|
| REVIEW_OVERDUE | 3 | 3 | 0 | `{}` |
| REVIEW_SOON | 1 | 2 | 0 | `{ "reviewSoonDays": 14 }` |
| INJURY_OPEN | 动态：surgery 取 3/injury 取 2（引擎按记录类型覆盖） | 同 severity | surgery 时覆盖为 1 | `{ "injuryWindowDays": 45, "closureWindowDays": 90 }` |
| PHV_PEAK | 1 | 1 | 0 | `{ "phvPeakBand": 0.5, "phvFreshDays": 180 }` |
| TEST_DECLINE | 2 | 2 | 0 | `{ "declineRatio": 0.08, "indicatorCodes": ["..."] }` |

> `INJURY_OPEN` 的 severity/urgency/forceWarning 由引擎在命中时按记录子类型（surgery vs injury）在规则表默认值基础上覆盖，避免拆成两条规则；覆盖结果仍写入快照 `factors` 明细，可追溯。

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
- 汇总产出三件事：`riskScore = Σ severity×weight`、`todoPriority = max(urgency)`、`forceWarningHit = 任一因子 forceWarning=true`，定级规则见 2.2；
- 因子结构（落库到 `factors` JSON，前端直接渲染）：

```json
{
  "code": "REVIEW_OVERDUE",
  "severity": 3,
  "urgency": 3,
  "forceWarning": false,
  "weight": 1.00,
  "title": "RTP复检已逾期",
  "detail": "复检日 2026-09-20，已逾期 14 天（流程待办，不代表健康风险升高）",
  "refData": { "nextReviewDate": "2026-09-20", "daysOverdue": 14 }
}
```

健康危急因子示例（`INJURY_OPEN` 命中 surgery 时覆盖）：

```json
{
  "code": "INJURY_OPEN",
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
  3. 逐条 `evaluate`，结果为 NONE 也 upsert（便于次日对比，列表只查非 NONE）；
  4. 返回 `{total, withRisk, byLevel}` 统计；
- `scanOne(athleteId)`：事件驱动增量重算（医疗新增、PHV 自动计算、RTP 更新后调用）。参照 PHV 的 `tryAutoCalculate` 模式：异常只记日志，不阻断主业务；
- `handle(snapshotId, action, remark)`：
  - `ACK`（已知悉，**仅 INFO 可用**）：置状态 + 留痕，不触碰 RTP 状态；
  - `DISMISS`（忽略，任意级别可用，需理由）：置状态 + 处理人 / 时间 / 理由；
  - `ACCEPT`（**仅 ATTENTION / WARNING 可用**）：只负责把快照 ACTIVE → ACCEPTED 并留痕。调用前由前端先完成 RTP 更新（见 5.1 时序），后端在此仍做级别 / 目标状态白名单（ATTENTION→`y`、WARNING→`r`，拒绝 `g`）与「不降级」校验作为兜底；INFO 快照调用 ACCEPT 直接返回业务错误。

> **不设「采纳中」中间状态，也不做分布式事务。** 采纳是两次独立 HTTP 调用（见 5.1），存在「RTP 已更新成功但 ACCEPT 标记失败、快照仍 ACTIVE」的小概率异常窗口；一期接受该窗口，前端在第二步失败时提示「RTP 已更新，待办关闭失败，请重试」并允许再次点击 ACCEPT（后端 ACCEPT 设计为幂等：已 ACCEPTED 再调返回成功/幂等），不为此引入 Saga/事务消息。

### 4.5 Controller `ApmsRtpRiskController`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/apms/rtp-risk/list` | `apms:rtpRisk:list` | 待办列表（DataScope `deptAlias`，筛选 级别/状态/队伍/姓名） |
| GET | `/apms/rtp-risk/athlete/{athleteId}/latest` | `apms:rtpRisk:query` | 运动员详情页当前建议 |
| GET | `/apms/rtp-risk/rules` | `apms:rtpRisk:query` | 规则配置（一期只读） |
| POST | `/apms/rtp-risk/{id}/handle` | `apms:rtpRisk:handle` | body: `{action: ACK|ACCEPT|DISMISS, remark}`；动作与级别、目标状态的合法性由后端按 2.3 校验 |
| POST | `/apms/rtp-risk/scan` | `apms:rtpRisk:scan` | 手动全量扫描 |

### 4.6 Quartz

`rtpRiskTask.scanDaily()` 委托 Service，与 `RyTask` 完全同模式；`scanOne` 不走定时任务，由业务事件直接调 Service。

## 5. 前端设计

### 5.1 新页面 `ruoyi-ui/src/views/apms/rtpWarning/index.vue`

沿用 roster-kit 花名册风格。

- 页头：标题「RTP 风险预警」+「立即扫描」按钮（`apms:rtpRisk:scan`，二次确认 + loading）；
- KPI 卡带：待处理总数、WARNING / ATTENTION / INFO 各多少、其中「复检逾期」待办数（流程维度单独统计，便于队务催办）；
- 筛选：建议级别（WARNING/ATTENTION/INFO）、状态（待处理/已处理）、队伍、姓名，另设「仅看复检逾期」快捷开关；
- 列表列（默认按 `todoPriority DESC, suggested_level DESC, snapshot_date ASC` 排序）：
  - 队员（头像用统一的 `ageAvatarColor` + `GenderBadge` + 名字 / 队伍两行）；
  - 建议级别徽标（WARNING 红 / ATTENTION 橙 / INFO 蓝）——**健康建议维度**；
  - 待办优先级 / 流程标记：复检逾期类显示独立的「逾期 N 天」红色流程徽标（与健康红色建议视觉区分，如加描边/时钟图标），避免被误读为建议停训；
  - 风险分；
  - 触发因子（多个 chip，悬浮 tooltip 显示 `detail`）；
  - 快照日期；状态；操作；
- 行点击 → 抽屉：
  - 因子明细卡：每条规则的标题、人话原因、参考数据、级别；
  - 底部操作按级别区分：
    - **INFO**：只有「已知悉」（ACK）和「忽略」（DISMISS，必填理由），**没有**「采纳并更新 RTP」按钮；
    - **ATTENTION / WARNING**：
      - **采纳并更新 RTP**：见下方 5.1 时序；若当前已是更严格状态，按钮置灰并提示无需下调；
      - **忽略**（必填理由，handle DISMISS）；
    - 关闭。
- 新增 `src/api/apms/rtpRisk.js`；演示模式补 mock handler 与种子规则。

#### 5.1 「采纳并更新 RTP」调用时序（统一口径，无中间状态）

```
用户点「采纳并更新 RTP」（仅 ATTENTION/WARNING）
        ↓
弹出现有 RTP 编辑弹窗（ATTENTION 仅 yellow / WARNING 仅 red，green 不出现，预填因子汇总原因）
        ↓
人工确认状态、原因、训练限制、复检日
        ↓
POST /apms/rtp/update          ← 第 1 步：写 RTP（事务内写 apms_rtp_log）
        ↓ 成功
POST /apms/rtp-risk/{id}/handle  body: { action: 'ACCEPT' }   ← 第 2 步：快照 ACTIVE → ACCEPTED
        ↓
刷新待办（该条消失 / 标记已采纳）
```

- 顺序固定为**先 RTP 更新、后标记快照**；快照表不设「采纳中」状态；
- 第 1 步失败：快照保持 ACTIVE，弹窗停留，可修改后重试，无副作用；
- 第 1 步成功、第 2 步失败（网络抖动等小概率窗口）：RTP 实际已更新，但待办仍在。前端提示「RTP 已更新，待办关闭失败，请重试」，「采纳」按钮可再次点击；由于 RTP 已达建议状态，第 2 步重试是幂等的（后端对已 ACCEPTED 快照再调 ACCEPT 返回成功），不会重复写 RTP；
- 不为该窗口引入分布式事务 / Saga / 本地消息表，一期按上述「提示 + 幂等重试」处理。

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
- **流程紧迫 ≠ 健康风险**：复检类因子只能产生流程待办（高 urgency），不能单独触发 WARNING；UI 上流程徽标与健康级别徽标视觉分离，防止康复师把「逾期未复检」误读为「建议停训」；
- **预警永不建议 green、永不降级**：INFO 不映射任何 RTP 状态（仅知悉/忽略），ATTENTION→yellow、WARNING→red；系统不存在任何把 green 作为建议值的路径，green 只能由康复师在 RTP 模块主动评估产生；后端对采纳动作做级别白名单与「不降级」双重校验，前端限制只是体验层，最终以后端校验为准；
- 扫描异常不影响医疗 / PHV / RTP 主写入链路（事件增量调用 try/catch 包裹）。

## 9. 交付物与实施顺序

1. SQL 补丁：2 张表 + 5 条规则种子 + 菜单 / 权限 + sys_job；
2. 后端：domain/mapper/xml + 评估引擎 + JUnit 单测（构造因子组合验证定级与互斥规则）；
3. 扫描服务 / Controller / Quartz task；在医疗、PHV、RTP 写入点接入 `scanOne`；
4. 前端：api + 预警待办页 + 详情页横幅 + mock；
5. 联调：手动 scan → 待办 → 采纳（落 RTP + 日志）→ 忽略（留痕）→ 次日 EXPIRED 全链路。

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
