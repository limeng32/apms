# APMS 业务表索引扩容规划（全量评估）

## 一、调研方法

1. 从 `apms-dev` 真实库导出全部 27 张 `apms_*` 表现有索引（建表脚本未入库，以库为准）与表行数；
2. 通读 `ruoyi-admin/.../mapper/apms/` 全部 29 个 Mapper XML 的 WHERE / JOIN / ORDER BY；
3. 对每个有疑点的查询在 dev 库跑 **EXPLAIN**，以 `type/key/Extra` 实测确认全表扫描或 filesort。

当前最大表仅 61 行，本次属**预防性扩容**。结论按优先级分三档：P0 本次补丁 / P1 观察后再加 / 维持现状。

## 二、全量表评估矩阵

### P0 —— EXPLAIN 已证实 filesort 或全表，本次补

| 表（现量级/增长性） | 高频查询 | 现有索引 | EXPLAIN 实测 | 处置 |
|---|---|---|---|---|
| apms_phv_record（11/人×次） | 取最新 PHV：`athlete_id=? ORDER BY measure_date DESC,id DESC LIMIT 1`；按人列表同排序 | idx_athlete_id 单列、idx_source_measure_id | idx_athlete_id + **Using filesort** | 新建 `(athlete_id, measure_date)`，删 idx_athlete_id |
| apms_medical_record（14/持续） | 台账默认列表 `ORDER BY record_date DESC,id DESC`；按运动员查看 `athlete_id=? ORDER BY record_date…` | idx_athlete_id、idx_record_type | 默认列表 **type=ALL + filesort**；按人 **filesort** | 新建 `(athlete_id, record_date)` + `(record_date)`，删 idx_athlete_id |
| apms_test_result（44/高增长，每名队员每次测试多行） | dashboard 按任务聚合 `task_id=?`；台账列表四列排序 `ORDER BY task_id,athlete_id,task_item_id,attempt_no`；`task_id=? AND athlete_id=?` | idx_task_id、idx_athlete_id、idx_task_item_id、idx_measure_date、idx_session_key、idx_athlete_task_item | 命中 idx_task_id 但四列排序 **Using filesort** | 新建 `(task_id, athlete_id, task_item_id, attempt_no)`，删 idx_task_id |
| apms_report（14/持续累积） | 报告中心列表 `report_type=?` | idx_athlete_id、idx_task_id、idx_dept_id | **type=ALL** | 新建 `(report_type)` |

### P1 —— 当前 filesort 但表小/增速慢，先观察，到阈值再加

| 表 | 查询 | 现状 | 建议触发条件 | 候选索引 |
|---|---|---|---|---|
| apms_test_task（10/年增数十） | 默认列表 `ORDER BY start_date DESC,id DESC` | type=ALL + filesort（无过滤时） | 任务数 > 500 或列表明显变慢 | `(start_date)` |
| apms_combo_score（5/人×模型，百级） | dashboard TOP10 `ORDER BY combo_score DESC` | filesort | 队员数 > 500 或加模型维度筛选时 | 视当时过滤条件定（很可能是 `(combo_model_id, combo_score)`），现在单列序会过时，故不提前加 |
| apms_test_result 自由成绩 | `task_item_id IS NULL AND athlete_id=? ORDER BY measure_date` | idx_athlete_id + filesort | 散录成绩上千行 | `(athlete_id, measure_date)`（与 PHV 同型，届时评估） |

### 维持现状 —— 已健康或属小字典表（19 张）

| 表 | 依据 |
|---|---|
| apms_body_measure | `(athlete_id, measure_date)` 实测 `Backward index scan; Using index`，完美；另有 cycle_id / source_* 索引 |
| apms_rtp_risk_snapshot（增长最快） | `(snapshot_date,status)` 对列表与过期扫描实测 **Using index 覆盖**；`uk_athlete_date` 覆盖个人最新反向扫描；idx_dept 备用 |
| apms_task_member | 主键 `(task_id, athlete_id)` 最左前缀覆盖按任务/状态查询；按姓名排序 JOIN athlete，每任务仅几十行 |
| apms_test_result_value / _rep | 全部读写带 result_id（idx_result_id）；z-score 批量统计实测 v 走 idx_indicator_id、r 走主键 eq_ref |
| apms_task_item | task_id/indicator_id/model_id 外键列均有索引 |
| apms_combo_component / combo_model | 外键列索引齐全，配置小表 |
| apms_indicator / test_model / test_model_field | code/status/category/model_id 索引齐全；`name LIKE '%..%'` 为前导通配模糊，BTree 无法走索引，表小全表可接受，**不上 FULLTEXT** |
| apms_athlete | primary_team_id/status/user_id 索引齐；列表 `name LIKE '%..%'` 同属前导通配，队员百级全表可接受；ORDER BY 主键 |
| apms_athlete_group | athlete_id/dept_id/status 索引齐，小组小表 |
| apms_measure_cycle | status/target_dept 索引齐，年增数个 |
| apms_rtp_status / rtp_log | uk_athlete_id、idx_athlete_id 覆盖 |
| apms_rtp_risk_rule / indicator_ref / ref_level | uk_code/uk_ref_level/idx_ref_id 等唯一与外键索引齐 |
| apms_medical_file | idx_record_id 覆盖 |
| apms_db_version / login_config | uk_patch_name / uk_config_key |

## 三、本次补丁方案（P0）

新建 `patches/patch-0.0.7-<时间戳>.sql`，遵循项目幂等规范（information_schema 守卫 + PREPARE，可重复执行）：

```sql
CREATE INDEX idx_athlete_measuredate ON apms_phv_record (athlete_id, measure_date);
DROP INDEX idx_athlete_id ON apms_phv_record;

CREATE INDEX idx_athlete_recorddate ON apms_medical_record (athlete_id, record_date);
CREATE INDEX idx_record_date       ON apms_medical_record (record_date);
DROP INDEX idx_athlete_id ON apms_medical_record;

CREATE INDEX idx_task_athlete_item_attempt
  ON apms_test_result (task_id, athlete_id, task_item_id, attempt_no);
DROP INDEX idx_task_id ON apms_test_result;

CREATE INDEX idx_report_type ON apms_report (report_type);
```

**关于 3 个 DROP**：`(athlete_id, measure_date)` 最左前缀 = 旧 athlete_id 单列；`(task_id, athlete_id, …)` 最左前缀 = 旧 task_id 单列——旧索引被完全覆盖，删除可减少写入维护成本、避免优化器误选。其余既有索引（含 test_result 的 idx_athlete_id/idx_athlete_task_item/idx_task_item_id/idx_measure_date/idx_session_key、medical 的 idx_record_type）全部保留。
> 若你希望零风险只加不删，审批时告知，我去掉 3 条 DROP（代价是少量冗余索引）。

## 四、实施步骤

1. 写补丁文件：5 CREATE + 3 DROP，每条 information_schema 判存在后 PREPARE 执行；头部注释写明覆盖关系；
2. 附验收 EXPLAIN（注释形式）；不改任何 Java/XML（索引对应用透明）；
3. 落盘后由你在 dev 库手动执行或随 deploy.sh 应用，我不直接执行 DDL。

## 五、验证（应用后）

- 上述 4 条 EXPLAIN 分别命中新索引且 Extra 无 filesort；
- information_schema 确认 5 个新索引存在、3 个旧索引已删、无重复；
- 回归：测试结果台账分页、dashboard、PHV 台账、医疗台账、报告中心列表功能与耗时正常。

## 六、非索引的增长风险（本补丁不解决，提示备查）

1. **apms_rtp_risk_snapshot 每日每人一行，增速第一**：索引已最优但体积会持续膨胀，需独立的保留/归档策略补丁（定期清理 30 天前 EXPIRED/ACCEPTED/DISMISSED 行），建议另开任务。
2. **dashboard overview 全表内存聚合**：controller 把 test_result/medical/phv/task/athlete 全量 `selectList()` 拉进 Java 统计，无 WHERE 故**索引帮不上**；数千行后接口变慢，届时应改为 SQL 聚合（COUNT/GROUP BY）。列技术债。

## 七、风险

纯二级索引增删，MySQL 8 INPLACE 在线 DDL 不阻塞读写；不动表结构与代码；补丁幂等。唯一理论风险点是 3 个 DROP，覆盖关系已逐一核对，亦可按你要求改为只加不删。
