# APMS API 手册

> **基地址**：`http://{host}:{port}/api`  
> **认证方式**：Bearer JWT（登录后从 `Authorization: Bearer ${token}` 传入）  
> **响应外壳**：`{ code: number, msg: string, data: any }` 或 `{ code, msg, total, rows }`（分页列表）

---

## 0. 通用约定

### 分页列表响应
```json
{ "code": 200, "msg": "操作成功", "total": 15, "rows": [ {...} ] }
```

### 单条/无分页响应
```json
{ "code": 200, "msg": "操作成功", "data": { ... } }
```

### 分页参数（URL query）
| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `pageNum` | int | 1 | 页码 |
| `pageSize` | int | 10 | 每页条数 |

### 数据隔离
athlete / test-result / combo-score / dashboard.overview / body-measure 等主要模块带 `@DataScope(deptAlias=...)`，RuoYi 数据权限框架按当前登录用户的队伍范围自动过滤。

### 错误响应
```json
{ "code": 500, "msg": "具体中文描述（如：level=GOOD(3.5~4.0) 与 level=FAIR(3.8~4.2) 区间重叠）" }
```

---

## 1. 登录

### POST /login
- **请求体**：`{ "username": "admin", "password": "admin123" }`
- **响应**：`{ "code": 200, "msg": "操作成功", "token": "eyJhbGciOi...", ... }`
- **说明**：获取 JWT，后续请求放 `Authorization: Bearer ${token}`

---

## 2. 运动员管理 `/apms/athlete`

### GET /list
分页查询运动员列表。
- **Query**：`pageNum`, `pageSize`, `athleteId`, `name`, `gender`(M/F), `teamId`, `status`(0=在队/1=离队)
- **响应 rows[0]**：

| 字段 | 类型 | 说明 |
|---|---|---|
| athleteId | Long | 运动员 ID（主键） |
| name | String | 姓名 |
| gender | String | M / F |
| birthday | Date | 生日 yyyy-MM-dd |
| age | Integer | 系统自动计算 |
| jerseyNo | Integer | 球衣号码（同队唯一） |
| position | String | 场上位置 |
| primaryTeamId | Long | 所属队伍 ID |
| teamName | String | JOIN 解析的队伍名 |
| phone | String | 电话 |
| predictedAdultHeight | BigDecimal | Khamis-Roche 预测成年身高 (cm) |
| adultHeightAlgo | String | 算法标识，如 `khamis-roche-v1` |
| adultHeightCalcDate | Date | 预测计算日期 |
| status | String | "0" 在队 / "1" 离队 |

### GET /{athleteId}
按 ID 查单个运动员，响应 `{ data: {...}, code, msg }`。

### POST /
新增运动员。请求体：`ApmsAthlete` 字段（不含 `version`/`createBy` 等系统字段）。

### PUT /
修改运动员。请求体：`ApmsAthlete`。

### DELETE /{athleteIds}
批量删（逗号分隔 ID 列表）。实际是逻辑删除：把 `status` 改为 `'1'` + 关闭所有 athlete_group 当前记录。

### GET /check_jersey_no
同队球衣号码唯一性校验。**Query**：`teamId`, `jerseyNo`, `athleteId?`（排除自己）

---

## 3. 运动员分组 `/apms/athlete-group`

| 端点 | 方法 | 说明 |
|---|---|---|
| `/athlete/{athleteId}` | GET | 某运动员的所有分组历史 |
| `/athlete/{athleteId}/current` | GET | 某运动员当前所在组 |
| `/dept/{deptId}` | GET | 某组当前所有在组成员 |
| `/join` | POST | 运动员加入某组。Body：`{ athleteId, deptId }` |
| `/leave/{athleteId}` | POST | 运动员离队（关闭所有当前记录） |

---

## 4. 体态测量 `/apms/body-measure`

### GET /list
分页查询所有体态测量记录。

### GET /athlete/{athleteId}
某运动员的历史体态测量列表，按 `measureDate DESC`。

### GET /athlete/{athleteId}/latest
某运动员最新一条体态测量（`measureDate` 最大）。

### GET /{id}
按 ID 查单条。

### POST /upsert
**按 `(athleteId, measureDate, sourceSessionKey)` 唯一键 upsert**。不存在则 insert，存在则 update。  
Body：`ApmsBodyMeasure` 字段。**成功后自动触发 PHV + Khamis-Roche**。

| 字段 | 类型 | 说明 |
|---|---|---|
| athleteId | Long | 必填 |
| measureDate | Date | 必填 yyyy-MM-dd |
| height | BigDecimal | cm |
| weight | BigDecimal | kg |
| sitHeight | BigDecimal | 坐高 cm（PHV 必须） |
| dataSource | String | manual / csv / device |
| sourceTaskId | Long | 关联任务（CSV 导入自动填） |
| sourceSessionKey | String | 同次测量的 batch key（CSV 导入） |

### POST /
新增（非 upsert 模式，可能产生重复）。

### PUT /
修改。

### DELETE /{id}
删除。**自动级联删关联 PHV 记录**（`apms_phv_record.source_measure_id`）。

---

## 5. 体能指标库 `/apms/indicator`

### GET /list
分页查询。**Query**：`code`, `name`, `category`, `status`

### GET /{id}
按 ID 查单条，响应内含 `refs[]`（参考值分组，内含 `levels[]`）。

### POST /
新增指标。Body 关键字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| code | String | 必填，唯一。如 `SPRINT_30M` |
| name | String | 中文名，如 `30米冲刺` |
| category | String | 形态/素质/机能 |
| unit | String | cm / s / kg |
| evaluationDirection | String | HIGHER_BETTER / LOWER_BETTER / RANGE_BEST / REFERENCE_ONLY |
| collectionMethod | String | manual / device |

### PUT /
修改。

### DELETE /{ids}
批量删。

---

### 参考值分组（Ref）

| 端点 | 方法 | 说明 |
|---|---|---|
| `/ref/list/{indicatorId}` | GET | 某指标的所有 ref 分组，含 `levels[]` |
| `/ref` | POST | 新增 ref。Body：`{ indicatorId, gender, ageGroup, refMin, refMax, deptId? }` |
| `/ref` | PUT | 修改 ref |
| `/ref/{refId}` | DELETE | 删 ref（级联删 levels） |

**ref 字段含义**：按 `gender + ageGroup` 切分参考值分组，每组有 `refMin`/`refMax`（正常范围），内部再切 levels（优秀/良好/...）。

---

### 等级（Level）

| 端点 | 方法 | 说明 |
|---|---|---|
| `/level/list/{refId}` | GET | 某 ref 下的所有 level |
| `/level` | POST | 新增 level |
| `/level` | PUT | 修改 level |
| `/level/{levelId}` | DELETE | 删 level |

**Body**：`{ refId, level: "GOOD"|"POOR"|"EXCELLENT"... , minValue, maxValue }`

**写入前校验**（`IndicatorRefLevelValidator`）：
1. 同 ref 内 level 名称不能重复
2. 每条 `minValue < maxValue`
3. 两两区间不重叠
4. 如果首尾都明确（有 MIN 和 MAX），中间不能有空洞

校验失败返回：`{ code: 500, msg: "level=X(...) 与 level=Y(...) 区间重叠" }`

---

## 6. 测试模型库 `/apms/test-model`

### GET /list / GET /{id} / POST / PUT / DELETE /{ids}
标准 CRUD。关键字段：

| 字段 | 说明 |
|---|---|
| code | 如 `YOYO_IR1`、`RSA_10X20` |
| name | 中文名 |
| category | 耐力/速度/速度耐力 |
| isCombo | "0" 单一指标 / "1" 组合模型 |
| algoVersion | 算法版本标识 |
| protocol | 测试流程说明 |

### Field（模型字段）

| 端点 | 说明 |
|---|---|
| `/field/list/{modelId}` | 某模型的所有 field |
| `/field` POST / PUT / DELETE /{fieldId} | CRUD |

**Field 字段**：`fieldKey`（如 `shuttle_level`）、`fieldName`、`dataType`、`isRequired`、`unit`、`sortOrder`

---

## 7. 测试任务 `/apms/test-task`

### GET /list
分页列表。每行内含 `items[]` + `members[]`（聚合子表）。

关键字段：`id`, `taskName`, `startDate`, `endDate`, `status`(pending/in_progress/completed), `targetDeptId`, `progressPercent`, `memberTotal/memberCompleted/memberPartial/memberPending`, `items[]`, `members[]`

### GET /{id}
详情，同 `list` 行结构但 items/members 完整。

### POST / PUT / DELETE /{ids}
任务本体 CRUD。

---

### Test Item（测试项）

| 端点 | 方法 | 说明 |
|---|---|---|
| `/item/list/{taskId}` | GET | 某任务的测试项列表 |
| `/item` | POST | 新增 |
| `/item` | PUT | 修改 |
| `/item/{itemId}` | DELETE | 删除 |

**Body**：`{ taskId, itemType: "INDICATOR"|"MODEL", indicatorId?, modelId?, isRequired: "1"|"0", directionOverride?, sortOrder }`

**响应 data[0] keys**：`id, taskId, itemType, indicatorId, indicatorCode, indicatorName, indicatorDirection, modelId, modelCode, modelName, modelCategory, sortOrder, isRequired`

---

### Test Member（参测队员）

| 端点 | 方法 | 说明 |
|---|---|---|
| `/member/list/{taskId}` | GET | 某任务的队员列表 |
| `/member/enroll` | POST | 单个登记。Body：`{ taskId, athleteId }` |
| `/member/batch-enroll?taskId={taskId}` | POST | 批量登记。Body：JSON 数组 `[athleteId, athleteId, ...]` |
| `/member/status` | PUT | 手动改状态。Body：`{ taskId, athleteId, status }` status=pending/partial/completed |
| `/member` | DELETE | 移除队员。Query：`taskId`, `athleteId` |

**响应 data[0] keys**：`taskId, athleteId, athleteName, athleteGender, athleteTeam, status`

---

## 8. 测试结果 `/apms/test-result`

### GET /list
分页查询。**Query**：`taskId`, `athleteId`, `indicatorId`, `modelId`, `isSelected`, `isValid`, `sessionKey`, `dataSource`

### GET /{id}
单条详情。响应内含 `values[]`（每个 field 级数值 + 派生值）+ `reps[]`（派生字段）。

### GET /by-task-member?taskId=&athleteId=
某运动员在某任务下的**所有 attempt 列表**（同一 taskItemId 多条 attempt）。用于前端 Attempt history 展示。

### POST /
手动添加一条结果。Body：

```json
{
  "result": {
    "taskId": 1,
    "taskItemId": 1,
    "athleteId": 1001,
    "indicatorId": 3,
    "modelId": null,
    "sessionKey": "S1",
    "measureDate": "2026-09-18",
    "attemptNo": 1,
    "dataSource": "MANUAL"
  },
  "values": [
    { "fieldKey": "height_cm", "numericValue": 178.5, "unit": "cm", "indicatorId": 3 }
  ]
}
```

**自动触发**：BodyMeasureSync → PHV tryAutoCalculate → Khamis-Roche → RSA 衰减率 → autoSelectBest → TaskProgress recalculate

### PUT /
修改。

### DELETE /{id}
删单条。

### DELETE /task/{taskId}
删整任务的所有结果。

### POST /auto-select?taskItemId=&athleteId=
对同一 athlete + taskItem 的多条 attempt 重新自动选最佳。按 `indicator.evaluationDirection` 决定方向（HIGHER_BETTER → 最大，LOWER_BETTER → 最小）。

### POST /select-attempt/{resultId}
**手动指定**某条 attempt 为选中。同组其他 attempt 的 `isSelected` 自动清零。响应：`{ code: 200, msg: "操作成功" }`

### POST /import/csv
**CSV 批量导入**。

- **请求**：`multipart/form-data`，字段名 `file`
- **CSV 格式**（UTF-8）：

```
athlete_id,measure_date,session_key,HEIGHT,WEIGHT,SPRINT_30M,VJUMP,RSA_10X20
1001,2026-09-18,S1,178.5,72.3,4.85,55.2,3.2
1006,2026-09-18,S1,182.0,78.5,4.60,60.5,3.0
```

- **列匹配**：CSV header 自动匹配 `indicator.code` 或 `test-model.code`（大小写不敏感）
- **响应**：

```json
{
  "code": 200,
  "msg": "操作成功",
  "writtenResultCount": 8,
  "rowsProcessed": 2,
  "errorRows": [ { "row": 3, "reason": "indicator XXX 未配置" } ],
  "warnings": [ "列 'extra_col' 未匹配到指标" ]
}
```

---

## 9. RTP（运动风险预警）`/apms/rtp`

### GET /status/{athleteId}
某运动员的 RTP 当前状态。

### GET /status/list
所有运动员的 RTP 状态列表。响应 data[0]：`{ athleteId, athleteName, athleteTeam, status(green/yellow/red), reason, trainingLimit, nextReviewDate }`

### GET /log/{athleteId}
某运动员的 RTP 状态变更历史（log）。响应 data[0]：`{ fromStatus, toStatus, reason, operateTime }`

### POST /update
手动更新某运动员 RTP 状态。Body：`{ athleteId, status, reason, trainingLimit, nextReviewDate }`

### POST /clear/{athleteId}
清除 RTP 状态（回到未评估）。

---

## 10. PHV（青少年成熟度）`/apms/phv`

### GET /list
分页查询所有 PHV 记录。

### GET /athlete/{athleteId}
某运动员的 PHV 历史。响应 data[0]：

| 字段 | 说明 |
|---|---|
| predictedAdultHeight | 预测成年身高 |
| predictedPhvAge | 预测 PHV 年龄 |
| maturityOffset | decimalAge − predictedPhvAge（正=已过 PHV，负=未到） |
| mirwaldVersion | Mirwald 公式版本，如 `mirwald-v1` |
| khamisVersion | Khamis-Roche 版本，如 `khamis-roche-v1` |
| sourceMeasureId | 关联的 `body_measure.id` |

### GET /athlete/{athleteId}/latest
最新一条 PHV 记录。

### POST /calculate
**手动触发 Mirwald + Khamis-Roche** 计算。Body：`{ athleteId }`。内部自动查最新 body_measure（需要 height + sitHeight + weight + birthday）。

### POST /calculate-direct
直接传入参数计算（跳过 body_measure 依赖）。Body：`{ athleteId, height, sitHeight, weight, birthday }`

### DELETE /{id}
删 PHV 记录。

---

## 11. 组合体能评分 `/apms/combo-score`

### GET /list
分页查询。带 `@DataScope` 队伍隔离。响应 data[0]：

| 字段 | 说明 |
|---|---|
| comboScore | BigDecimal，范围大致 -3 ~ +3 的 z-score 意义 |
| refSnapshot | JSON 快照，含 components[]（每个有 indicatorId, normalized, weightedScore, valid） |
| algoVersion | 如 `composite-fitness-v1` |

### GET /{id}
单条详情。

### POST /calculate
批量计算某组合模型下所有队员的组合分。Body：`{ comboModelId, taskId }`

响应：

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "totalAthletes": 5,
    "successCount": 4,
    "skipCount": 1,
    "items": [ { athleteId, athleteName, comboScore, comboGrade } ],
    "algoVersion": "composite-fitness-v1"
  }
}
```

**T-Score 转换**：`T = 50 + 10 × Z`，Z = (raw − μ) / σ。μ/σ 优先取**同队伍 + 同性别 + (ageGroup 暂 null) ≥ 5 条真实数据**，不足 5 条回退 ref_min/ref_max 代理。

### DELETE /{id}
删单条。

---

## 12. 组合模型库 `/apms/combo-model`

### GET /list / GET /{id} / POST / PUT / DELETE /{ids}
标准 CRUD。关键字段：`algoVersion`, `formula`（如 `SUM(w_i * z_i)`）, `normalizationMethod`（Z_SCORE/MINMAX）, `components[]`

### Component（组合成分）

| 端点 | 说明 |
|---|---|
| `/component/list/{comboModelId}` | 成分列表 |
| `/component` POST / PUT / DELETE /{componentId} | CRUD |

**Component 字段**：`indicatorId, indicatorCode, indicatorName, weight, directionOverride, sortOrder`

---

## 13. Dashboard `/apms/dashboard`

### GET /stats
**看板统计 + 任务摘要 + RTP 关注名单**。

**响应 data.stats**：

| 字段 | 类型 | 说明 |
|---|---|---|
| athleteCount | int | 总运动员数 |
| teamList | String | 已归一的队伍列表 "201 / 200" |
| taskInProgressCount | int | 进行中任务 |
| taskPendingCount | int | 未开始任务 |
| taskCompletedCount | int | 已完成任务 |
| rtpGreenCount | int | RTP=green 的运动员数 |
| rtpYellowCount | int | RTP=yellow |
| rtpRedCount | int | RTP=red |
| rtpNotAssessedCount | int | **未评估 RTP 的人数** = athleteCount − 有 rtp_status 记录的 |
| bodyMeasureWeekCount | int | 最近 7 天有体态测量的人数 |
| phvWeekCount | int | 最近 7 天有 PHV 记录的人数 |

**响应 data.taskList**（最多 5 条进行中任务）：`[{ taskId, taskName, completedCount, totalCount, progress, teamName }]`

**响应 data.rtpList**（关注名单，最多 6 人）：`[{ athleteId, athleteName, jerseyNo, position, status }]` — status ∈ `yellow / red / none(未评估)`

### GET /overview
**完整概览数据（雷达图/散点图/排行榜用）**。

响应 data：

| 子结构 | 说明 |
|---|---|
| summary | `{ totalAthletes, avgComboScore, highPerformer, needAttention, phvRecords, testTasks }` |
| comboScoreRanking | TOP 10 组合分排行 |
| indicatorRadar | 某运动员的指标雷达（component normalized + weightedScore） |
| phvScatter | 所有运动员的 PHV 散点（decimalAge × predictedPhvAge） |
| taskCompletion | 各任务完成情况 |
| teamDistribution | 队伍人数分布 Map |

---

## 14. 医疗记录 `/apms/medical`

| 端点 | 说明 |
|---|---|
| GET /list | 分页列表（ApmsMedicalRecord） |
| GET /{id} | 单条，内含 files[] |
| POST | 新增。Body：`{ record: {...}, files: MultipartFile[] }` |
| PUT | 修改 |
| DELETE /{id} | 删记录（级联删 files） |
| GET /file/download/{fileId} | 下载附件（返回二进制流） |
| DELETE /file/{fileId} | 删附件 |

**Record 关键字段**：`athleteId`, `recordType`(injury/surgery/illness/other), `diagnosis`, `treatment`, `recordDate`, `files[]`

---

## 15. 报告 `/apms/report`

### GET /list / GET /{id} / DELETE /{id}
标准 CRUD（报告生成后只能删，不能改）。

### POST /generate
**生成 PDF 报告**（iText 5）。

- **请求**：Query 参数
  - `reportType`: `"TEAM_SUMMARY"` / `"ATHLETE_DETAIL"` / `"MEDICAL"`
  - `athleteId?`: 运动员详情时必填
  - `deptId?`: 队伍汇总时选填
  - `taskId?`: 某任务相关报告选填
- **响应**：生成的报告对象，含 `filePath`（相对 `profilePath`）和 `contentSnapshot`（JSON 快照）

### GET /download/{id}
**下载 PDF 文件**。返回 `application/pdf` 流。

---

## 16. 版本信息 `/apms/version`

### GET /
返回当前部署版本号 + 构建时间（从 `version.properties` 读取）。