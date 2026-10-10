# APMS 业务表索引扩容规划（全量评估 · 评审修订版）

## 一、调研方法

1. 从 `apms-dev` 真实库导出全部 27 张 `apms_*` 表现有索引与行数（建表脚本未入库，以库为准）；
2. 通读 `ruoyi-admin/.../mapper/apms/` 全部 Mapper XML 的 WHERE / JOIN / ORDER BY，并核对 Controller 上的 `@DataScope`；
3. 对高频查询在 dev 库跑 **EXPLAIN**（含真实 expireBefore UPDATE）实测；
4. 复核 Dashboard Controller 的实际取数路径。

当前最大表 61 行，本次属**预防性扩容**。

## 二、补丁索引（本次：4 个 CREATE，不 DROP）

按评审后的价值梯队：

### 第一梯队（明确消除 filesort）

| 表 | 新索引 | 依据（EXPLAIN 实测） |
|---|---|---|
| apms_test_result | `(task_id, athlete_id, task_item_id, attempt_no)` | dashboard 按任务聚合 + 结果台账四列排序现在 Using filesort；成绩表是高增长表 |
| apms_phv_record | `(athlete_id, measure_date)` | 取最新 PHV / 按人列表按日期倒序，现在 filesort；body_measure 同型索引已实测 Backward index scan |

### 第二梯队（消除全表/排序，价值明确）

| 表 | 新索引 | 依据与验收注意 |
|---|---|---|
| apms_medical_record | `(athlete_id, record_date)` | 按队员查病历按日期排序 filesort |
| apms_medical_record | `(record_date)` | 无过滤的台账默认列表现在 type=ALL + filesort。**注意**：普通康复师/队伍用户的真实 SQL 带 `@DataScope(deptAlias="a")`（条件落在 JOIN 的 apms_athlete 上），优化器可能为先走队伍过滤而不选该索引——验收必须**同时**跑 admin 与普通业务用户两种 SQL |

### 本次只 CREATE，不 DROP

新复合索引的最左前缀虽能覆盖旧单列索引（phv.idx_athlete_id、medical.idx_athlete_id、test_result.idx_task_id），但**"能覆盖"不等于物理等价**——四列复合索引更宽。当前仅几十行，没有为省几 KB 把加/删绑成一次动作的必要。策略：

- 本补丁只 CREATE；
- 观察一个版本（真实数据量下 EXPLAIN/慢查确认旧索引确实不再被选中）后，再出独立补丁 DROP 三个旧索引。

### 第三梯队 → 降 P1

- `apms_report(report_type)`：report_type 基数低（3~4 类）、当前 14 行，短中期无感知差异。**移出本次补丁**，数据量上来或报告列表变慢时再加。

## 三、P1 观察项（本次不加，附明确触发条件）

| 对象 | 候选 | 触发/验证方式 |
|---|---|---|
| **apms_rtp_risk_snapshot**（重点） | `(status, snapshot_date)` | 真实过期 SQL `UPDATE … SET status='EXPIRED' WHERE snapshot_date<? AND status='ACTIVE'`：日期是范围条件，现索引 `(snapshot_date,status)` 首列进范围后第二列无法继续收窄。dev 基线 32 行时优化器直接扫 PRIMARY（type=index 全索引扫）。该表每日每人一行、EXPIRED 累积最快。**历史数据积累后对真实 expireBefore 跑 `EXPLAIN ANALYZE`**，若出现"为更新少量 ACTIVE 而扫描大量历史 EXPIRED/ACCEPTED"，即补此反向索引（等值列 status 在前，直接定位 ACTIVE 再按日期范围）。优先级高于其他 P1 |
| apms_test_task | `(start_date)` | 任务 > 500 或列表变慢 |
| apms_combo_score | `(combo_model_id, combo_score)`（届时再定列序） | 队员 > 500 或列表加模型维度筛选 |
| apms_test_result 自由成绩 | `(athlete_id, measure_date)` | 散录成绩上千行 |
| apms_report | `(report_type)` | 报告上千或列表变慢 |

## 四、维持现状（19 张表，依据从略）

body_measure（复合索引实测覆盖扫描）、rtp_status/log（uk/外键覆盖）、task_member（主键最左前缀）、test_result_value/_rep（result_id 覆盖；z-score 批量统计实测 v 走 idx_indicator_id、r 走主键 eq_ref）、task_item、combo_component/model、indicator/test_model（LIKE 前导通配 BTree 无法走索引，表小不上 FULLTEXT）、athlete（name LIKE 同理）、athlete_group、measure_cycle、rtp_risk_rule、indicator_ref/ref_level、medical_file、db_version、login_config。

## 五、实施步骤

1. 新建 `patches/patch-0.0.7-<时间戳>.sql`：4 条 CREATE INDEX，全部 information_schema 守卫 + PREPARE（MySQL 8 不支持 CREATE INDEX IF NOT EXISTS），可重复执行；
2. 无任何 Java/XML 改动；
3. DDL 由用户在 dev 库手动执行或随 deploy.sh 应用。

## 六、验收（应用后）

- phv/medical(test_result)：三条 EXPLAIN 命中新复合索引且无 filesort；
- medical(record_date)：**分别**用 admin SQL 与带 DataScope 的普通用户 SQL 各跑一次 EXPLAIN。带 DataScope 场景若仍 filesort，不视为索引失败——"全局时间序"与"按队伍过滤"本就存在访问路径冲突，记录现象、按后续数据量再评估；
- information_schema 确认 4 个新索引存在；
- 回归：成绩台账/dashboard/PHV 台账/医疗台账列表功能正常。

## 七、非索引的增长风险（修订优先级表述）

1. **Dashboard 性能债（优先级高于小表索引）**，治理顺序：
   - ① 先消除 **N+1 与重复查询**：`overview()` 查全部 task 后 for 循环逐个再查一次 test_result；且 `scoreMapper.selectList(query)` 连续调用两遍，第一份 `allScores` 是**未被使用的死变量**（白查一次）。先修这两处，零表结构成本；
   - ② 再把 test_result/medical/phv 等的大表 Java 内存聚合改为 SQL 层 COUNT/GROUP BY；
   - ③ 最后才处理 P1 小表索引。
   - 说明：① 不在本补丁范围（属代码改动），建议索引补丁后单独做。
2. **rtp_risk_snapshot 保留策略**：不能简单按"30 天前 ACCEPTED/DISMISSED 一起清"实现。NONE/普通 EXPIRED 可短周期清理；**人工 ACK / ACCEPT / DISMISS 属决策留痕，应长期保留或归档**，策略需区分对待。另开任务设计。

## 八、风险

仅 CREATE 4 个二级索引，MySQL 8 INPLACE 在线 DDL 不阻塞读写；不动表结构与代码；补丁幂等。不 DROP 旧索引，无回退成本。
