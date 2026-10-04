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

| 代码 | 规则 | 数据来源 | 默认触发条件 | 级别 |
|---|---|---|---|---|
| `REVIEW_OVERDUE` | RTP 复检逾期 | `apms_rtp_status.next_review_date` | 复检日 < 今天 | 高(3) |
| `REVIEW_SOON` | 复检临近 | 同上 | 0 ≤ 距今天数 ≤ `reviewSoonDays`(14) | 低(1) |
| `INJURY_OPEN` | 伤病 / 手术未闭环 | `apms_medical_record` | `injuryWindowDays`(45) 天内有 injury/surgery，且其后无更晚的 rehabilitation/checkup 记录；surgery=高，injury=中 | 中/高 |
| `PHV_PEAK` | 身高突增峰期 | 最新 `apms_phv_record` | `|maturity_offset| ≤ phvPeakBand`(0.5) 且记录日距今 ≤ `phvFreshDays`(180) | 低(1) |
| `TEST_DECLINE` | 关键体测异常 / 下滑 | `apms_test_result(_value)` + 指标评级 | 最新最佳成绩落入 POOR/ATTENTION 区间；**或**同一指标最近两次最佳成绩按方向恶化 ≥ `declineRatio`(8%)；仅关键指标白名单 | 中(2) |

### 2.1 规则细则

- **无数据即静默**：缺生日 / 缺成绩 / 缺评级数据的因子不产生提示，不制造「正常」噪声。
- **伤病闭环推断（折中）**：医疗表没有闭环字段，定义为——某 injury/surgery 之后存在 `record_date` 更晚的 rehabilitation 或 checkup 记录，则视为已闭环；超过 `closureWindowDays`(90) 的旧伤不再提示。抽屉中必须标注「未检测到康复 / 复查记录，请人工核实」。
- **体测下滑优先用评级**：有 `indicator_ref_level` 数据时按评级判定；无评级数据时退化到「同指标最近两次最佳成绩环比」；两者都不满足该规则静默。
- **关键指标白名单**：`TEST_DECLINE.params.indicatorCodes` 初始取速度 / 耐力 / RSA 类指标 code，避免噪声指标全量报警。
- `REVIEW_OVERDUE` 与 `REVIEW_SOON` 互斥（同一天只可能命中其一）。

### 2.2 评分与建议级别

```
因子分 = severity(低1/中2/高3) × weight(默认 1.00，可配)
总分   = Σ 因子分

total = 0                → NONE（不生成提示）
total ≥ scoreInfo(3)     → INFO      关注
total ≥ scoreAttention(6)→ ATTENTION 建议黄（限制参训评估）
total ≥ scoreWarning(9)，或含任一 severity=3 的因子
                         → WARNING   建议红（停训 / 就医评估）
```

阈值 `scoreInfo / scoreAttention / scoreWarning` 存规则配置（一期可放全局参数行或常量类，后续做配置页）。所有输出文案带「建议 / 供参考」字样。

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
  suggested_level varchar(16) NOT NULL COMMENT 'NONE/INFO/ATTENTION/WARNING',
  factors         json NOT NULL COMMENT '因子明细[{code,severity,weight,title,detail,refData}]',
  status          varchar(10) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/ACCEPTED/DISMISSED/EXPIRED',
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

状态机：`ACTIVE`（当日待处理）→ `ACCEPTED`（已采纳并更新 RTP）/ `DISMISSED`（已忽略）；次日扫描开始时未处理的昨日 ACTIVE 置 `EXPIRED`。

### 3.2 `apms_rtp_risk_rule`（规则与阈值配置）

```sql
CREATE TABLE apms_rtp_risk_rule (
  id           bigint NOT NULL AUTO_INCREMENT,
  rule_code    varchar(40) NOT NULL,
  rule_name    varchar(100) NOT NULL,
  enabled      char(1) NOT NULL DEFAULT '1',
  severity     tinyint NOT NULL DEFAULT 1 COMMENT '1低 2中 3高',
  weight       decimal(4,2) NOT NULL DEFAULT 1.00,
  params       json DEFAULT NULL COMMENT '阈值参数（窗口天数/下滑率/指标白名单等）',
  update_by    varchar(64) DEFAULT '',
  update_time  datetime DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (rule_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4 COMMENT='RTP预警规则配置';
```

5 条规则的种子 `params` 建议：

```json
REVIEW_SOON   { "reviewSoonDays": 14 }
INJURY_OPEN   { "injuryWindowDays": 45, "closureWindowDays": 90 }
PHV_PEAK      { "phvPeakBand": 0.5, "phvFreshDays": 180 }
TEST_DECLINE  { "declineRatio": 0.08, "indicatorCodes": ["..."] }
```

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
- 因子结构（落库到 `factors` JSON，前端直接渲染）：

```json
{
  "code": "REVIEW_OVERDUE",
  "severity": 3,
  "weight": 1.00,
  "title": "RTP复检已逾期",
  "detail": "复检日 2026-09-20，已逾期 14 天",
  "refData": { "nextReviewDate": "2026-09-20", "daysOverdue": 14 }
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
  - `DISMISS`：置状态 + 处理人 / 时间 / 理由；
  - `ACCEPT`：只负责把快照标记为「采纳流程已发起」；**真正写红黄绿由前端再调现有 `POST /apms/rtp/update`**，强制保留人工确认动作，成功后再置 `ACCEPTED`。RTP 变更继续写 `apms_rtp_log`，审计链完整。

### 4.5 Controller `ApmsRtpRiskController`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/apms/rtp-risk/list` | `apms:rtpRisk:list` | 待办列表（DataScope `deptAlias`，筛选 级别/状态/队伍/姓名） |
| GET | `/apms/rtp-risk/athlete/{athleteId}/latest` | `apms:rtpRisk:query` | 运动员详情页当前建议 |
| GET | `/apms/rtp-risk/rules` | `apms:rtpRisk:query` | 规则配置（一期只读） |
| POST | `/apms/rtp-risk/{id}/handle` | `apms:rtpRisk:handle` | body: `{action: ACCEPT|DISMISS, remark}` |
| POST | `/apms/rtp-risk/scan` | `apms:rtpRisk:scan` | 手动全量扫描 |

### 4.6 Quartz

`rtpRiskTask.scanDaily()` 委托 Service，与 `RyTask` 完全同模式；`scanOne` 不走定时任务，由业务事件直接调 Service。

## 5. 前端设计

### 5.1 新页面 `ruoyi-ui/src/views/apms/rtpWarning/index.vue`

沿用 roster-kit 花名册风格。

- 页头：标题「RTP 风险预警」+「立即扫描」按钮（`apms:rtpRisk:scan`，二次确认 + loading）；
- KPI 卡带：待处理总数、高 / 中 / 低各多少；
- 筛选：级别（高/中/低 tab）、状态（待处理/已处理）、队伍、姓名；
- 列表列：
  - 队员（头像用统一的 `ageAvatarColor` + `GenderBadge` + 名字 / 队伍两行）；
  - 建议级别徽标（WARNING 红 / ATTENTION 橙 / INFO 蓝）；
  - 风险分；
  - 触发因子（多个 chip，悬浮 tooltip 显示 `detail`）；
  - 快照日期；状态；操作；
- 行点击 → 抽屉：
  - 因子明细卡：每条规则的标题、人话原因、参考数据、级别；
  - 底部操作：
    - **采纳并更新 RTP**：打开现有 RTP 编辑弹窗（预填建议级别 + 因子汇总原因），保存调 `/apms/rtp/update`，成功后调 `/rtp-risk/{id}/handle` 置 ACCEPTED；
    - **忽略**（必填理由，调 handle DISMISS）；
    - 关闭。
- 新增 `src/api/apms/rtpRisk.js`；演示模式补 mock handler 与种子规则。

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
