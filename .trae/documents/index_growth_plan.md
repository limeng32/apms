# APMS 业务表索引扩容规划

## 一、调研方法与结论

数据量随业务增长后，索引应来自**真实查询条件**而非经验猜测。本次：

1. 从 `apms-dev` 库导出 27 张 `apms_*` 表现有索引（建表脚本未入库，以真实库为准）；
2. 逐个阅读 `ruoyi-admin/.../mapper/apms/*.xml` 的 WHERE / JOIN / ORDER BY；
3. 对高频查询在 dev 库跑 **EXPLAIN**，用 `type / key / Extra` 实测确认全表扫描与 filesort。

当前数据量都很小（最大表 61 行），所以这是**预防性扩容**：在表到几千/几万行之前把索引补齐，避免上线后被动加索引。

### EXPLAIN 已证实的缺口

| 表 | 查询 | 现状 | 问题 |
|---|---|---|---|
| apms_phv_record | `WHERE athlete_id=? ORDER BY measure_date DESC, id DESC LIMIT 1`（取最新 PHV，dashboard 分桶也全表扫） | idx_athlete_id | **Using filesort** |
| apms_medical_record | 列表默认 `ORDER BY record_date DESC, id DESC`（无 athlete 过滤） | 仅 idx_athlete_id / idx_record_type | **type=ALL 全表 + filesort** |
| apms_medical_record | `WHERE athlete_id=? ORDER BY record_date DESC, id DESC` | idx_athlete_id | **Using filesort** |
| apms_test_result | dashboard/列表：`WHERE task_id=? … ORDER BY task_id, athlete_id, task_item_id, attempt_no` | idx_task_id | 命中行但 **Using filesort**（4 列排序） |
| apms_report | 列表 `WHERE report_type=?` | 无 | type=ALL（14 行，持续累积） |

### EXPLAIN 证实已健康、无需动的表/查询

- `apms_body_measure`：`(athlete_id, measure_date)` 已覆盖，实测 `Backward index scan; Using index`；
- `apms_rtp_risk_snapshot`（每日每人一行，增长最快）：
  - 列表/过期扫描命中 `(snapshot_date, status)`，实测 **Using index**（覆盖索引）；
  - 个人最新命中 `uk_athlete_date(athlete_id, snapshot_date)`，反向扫描；
  - DataScope 有 idx_dept；
- `apms_task_member`：主键 `(task_id, athlete_id)` 最左前缀覆盖按任务查询；
- `apms_test_result_value/_rep`：所有读写都带 result_id，idx_result_id 覆盖；
- `apms_rtp_log`、`apms_task_item`、`apms_combo_component/model`、字典配置表：外键列索引齐全，且属小表。

### 评估后**不建议**加的索引

- `apms_combo_score(combo_score)`：dashboard TOP10 排序确实 filesort，但该表 = 队员数 × 模型数（百级），几百行排序代价可忽略；且未来列表大概率加模型过滤，单列序届时会变。暂不加。
- `apms_rtp_risk_snapshot(status, snapshot_date)`：现有 `(snapshot_date, status)` 对「等值日期+状态IN」「日期范围+ACTIVE」两条实际 SQL 都已走覆盖索引，再加是冗余。

## 二、本次补丁内容（P0，4 张表，5 个新索引）

新建一个 0.0.7 增量补丁 `patches/patch-0.0.7-<时间戳>.sql`（deploy.sh 自动应用，幂等，DDL 全部用 information_schema 守卫）：

```sql
-- 1) PHV：(运动员, 测量日期) 消除取最新时的 filesort
CREATE INDEX idx_athlete_measuredate ON apms_phv_record (athlete_id, measure_date);
DROP INDEX idx_athlete_id ON apms_phv_record;          -- 被新复合索引最左前缀完全覆盖

-- 2) 医疗记录：两个高频排序方向
CREATE INDEX idx_athlete_recorddate ON apms_medical_record (athlete_id, record_date);
CREATE INDEX idx_record_date ON apms_medical_record (record_date);  -- 无运动员过滤的默认列表
DROP INDEX idx_athlete_id ON apms_medical_record;      -- 被 idx_athlete_recorddate 覆盖

-- 3) 测试结果：(任务, 运动员, 测试项, 尝试序号) 消除 dashboard/列表 4 列 filesort
CREATE INDEX idx_task_athlete_item_attempt
  ON apms_test_result (task_id, athlete_id, task_item_id, attempt_no);
DROP INDEX idx_task_id ON apms_test_result;            -- 被新复合索引最左前缀覆盖

-- 4) 报告：按类型列表
CREATE INDEX idx_report_type ON apms_report (report_type);
```

### 为什么同时 DROP 三个旧单列索引

`(athlete_id, measure_date)` 的最左前缀 = athlete_id 单列；`(task_id, athlete_id, …)` 的最左前缀 = task_id 单列。旧索引被完全覆盖，保留只会增加 INSERT/UPDATE 维护成本与优化器选错的概率。DROP 全部幂等守卫（先查 information_schema 再执行），若你倾向保守也可以只加不删——**审批时请确认**，默认方案是加+删。

### 保留不动的既有索引（确认无冗余冲突）

- `apms_test_result` 的 idx_athlete_id（自由成绩录入按 athlete 单查）、idx_athlete_task_item、idx_task_item_id、idx_measure_date、idx_session_key 均保留；
- medical 的 idx_record_type（台账类型筛选）保留。

## 三、实施步骤

1. 新建补丁 SQL：5 条 CREATE INDEX + 3 条 DROP INDEX，每条都用 information_schema.statistics 判断存在性后 PREPARE 执行（与既有补丁同一幂等模式），头部注释写明用途与覆盖关系；
2. 补丁内置「验收 SQL」注释（EXPLAIN 复查 + 索引存在性查询），不自动执行；
3. 不改任何 Java/Mapper 代码——索引对应用透明；
4. 文件落盘后由你在 dev 库手动执行（或等 deploy.sh 应用），我不直接执行 DDL。

## 四、验证（补丁应用后）

- `EXPLAIN SELECT … FROM apms_phv_record WHERE athlete_id=1 ORDER BY measure_date DESC,id DESC LIMIT 1` → key=idx_athlete_measuredate，Extra 无 filesort；
- `EXPLAIN SELECT id FROM apms_medical_record ORDER BY record_date DESC,id DESC` → key=idx_record_date；
- `EXPLAIN SELECT r.id FROM apms_test_result r WHERE r.task_id=1 ORDER BY r.task_id,r.athlete_id,r.task_item_id,r.attempt_no` → key=新复合索引，无 filesort；
- `EXPLAIN SELECT id FROM apms_report WHERE report_type='INDIVIDUAL'` → key=idx_report_type；
- information_schema 确认 3 个旧单列索引已删除、无重复索引。

## 五、非索引的两个增长风险（本补丁不解决，仅提示）

1. **apms_rtp_risk_snapshot 无限累积**：规则引擎每天给每名队员写一行快照（即使当天无风险也可能产生 NONE/占位行，需确认扫描器逻辑），是增速最快的表。索引再好也挡不住体积膨胀，后续需要一个独立的保留策略补丁（如定期清理/归档 30 天前的 EXPIRED/ACCEPTED/DISMISSED 行）。建议另开任务评估。
2. **dashboard overview 全表内存聚合**：`ApmsDashboardController` 目前把 test_result、medical_record、phv_record、task、athlete 全量 `selectList()` 拉到 Java 内存做统计（本轮新增的 5 个聚合块也是）。这类查询无 WHERE，**索引帮不上**；表到数千行后接口会明显变慢。后续应改为 SQL 层 `COUNT/GROUP BY` 聚合或物化统计。当前数据量下无需处理，列为已知技术债。

## 六、风险

- **风险极低**：纯加/删二级索引，不改表结构、不改代码；MySQL online DDL（INPLACE，不阻塞读写）。
- DROP 索引是唯一有理论风险的动作：已逐一核对覆盖关系，且若应用确有仅按该单列且不关心排序的查询，复合索引最左前缀提供同等性能。若你希望零风险，可告知改为「只 CREATE 不 DROP」。
- 补丁幂等，可重复执行；执行失败不影响既有索引。
