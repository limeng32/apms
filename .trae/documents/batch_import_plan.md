# 测试成绩 / 体态测量 批量导入（Excel+CSV · 预览两阶段）实施计划

## 背景与决策（已与用户对齐）

1. 文件格式：**xlsx / xls / csv 全支持**（后端 POI 5.5.1 已就绪，前端零新依赖）
2. 流程：**上传 → 预览校验 → 确认入库** 两阶段
3. 范围：**体态测量 + 测试成绩**
4. 扫码枪/手持设备本次不做

## 现状事实（含本轮代码核查确认的三个坑）

- 成绩 CSV 导入后端已存在但为孤儿：`POST /apms/test-result/import/csv` + [CsvResultImportProvider](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/CsvResultImportProvider.java)；前端 CsvImportDialog 零引用；无预览、有错整批回滚；成绩 dataSource 现状写 `CSV_IMPORT`。
- 体态测量无导入接口；dataSource 实际取值小写族：`manual`/`cycle`/`task`/`CSV_IMPORT`/`DEVICE:xxx`。

**坑 1（已核实）：upsert 会静默覆盖当天已有记录。**
[ApmsBodyMeasureMapper.xml#L68-L76](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/resources/mapper/apms/ApmsBodyMeasureMapper.xml#L68-L76) 的 selectByUniqueKey 在 sourceTaskId/sourceSessionKey 为空时只按 `athlete_id + measure_date` 命中。导入直调 upsert 会把当天 manual/task/cycle 记录更新掉，且 UPDATE 不带 source/cycle 字段（null 不参与 SET），形成"数值被覆盖、来源仍挂任务/周期"的混合记录。→ **导入禁止走 upsert**。

**坑 2（已核实）：运动员姓名匹配是 LIKE 模糊 + 取第一条。**
XML `a.name LIKE CONCAT('%', #{name}, '%')`，[CsvResultImportProvider#L224-L241](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/CsvResultImportProvider.java#L224-L241) 重名取第一条，输入部分姓名会匹配错人。→ **新导入自建精确 resolver**。

**坑 3（已核实）：导入链路无 DataScope。**
@DataScope 是方法注解 AOP（@annotation 切点，任意 Spring bean 方法可用），把 SQL 片段写入 BaseEntity.params.dataScope。apms 多数 mapper XML 有 `${params.dataScope}` 占位，但 **ApmsAthleteMapper.xml 完全没有占位符**（花名册列表的 @DataScope 目前实际不生效——既有问题，不在本次范围内修）。→ **resolver 自带 scope 片段的新查询**。

- 数值双层校验已上线：[InputRangeValidator](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/InputRangeValidator.java)（字典 hard/warn）。
- RedisCache 封装无 setIfAbsent，但可注入 RedisTemplate 做原子操作；任务成员校验有 `ApmsTaskMemberMapper.selectByTaskAndAthlete(taskId, athleteId)`。

## 总体设计

**两阶段草稿**：preview 上传 → 解析+校验（不入库）→ 草稿存 Redis（10 分钟 TTL）→ 返回展示数据+token；commit 仅回传 token → 原子消费 → 逐行入库 → 成功/跳过/失败明细。
**提交语义**：error 行跳过、ok/warn 行入库；**一行一个事务**（行内多列要么全成功要么整行回滚），单行失败不影响下一行。

### D. 行级原子性（ResultImportRowWriter）

成绩一行可含 HEIGHT/WEIGHT/SPRINT 等多个指标列，而 `ApmsTestResultServiceImpl.add()` 自身是独立 `@Transactional`——在 Facade 里直接循环调用，前两列成功第三列失败会产生半行数据。为此新增独立 bean：

- `service/apms/import/ResultImportRowWriter.java`（@Component，**必须跨类调用以走 Spring 代理**，禁止 Facade 自调用事务方法）：
  - `@Transactional(rollbackFor = Exception.class) writeRow(List<AddBody> items)`：顺序调用 `testResultService.add()`，默认传播 REQUIRED，全部加入**同一个行事务**；任一列抛异常 → 整行回滚（含 add 内部的 autoSelectBest/REP/任务进度/体态同步/PHV 全部回滚）。
- Facade 对每一行调用一次 writer.writeRow，try/catch 收集该行失败原因后继续下一行（下一行是全新事务）。
- 体态侧一行只 upsert 一条记录，天然单行单事务，无需 RowWriter。

### E. 成绩导入一期只支持 INDICATOR（MODEL 列跳过并明示）

现有 CsvResultImportProvider 虽能识别 model.code 列，但把单元格写成 `fieldKey="result"` 单值；而 `prepareModelValues()` 按 `apms_test_model_field` 的具体 field_key/必填/数据类型强校验，多字段模型 commit 必失败。一期不做 MODEL：

- **预览阶段**：表头识别为 model.code 的列一律标 `ignore`（灰），在 warnings 汇总明示「模型类指标（MODEL_CODE）暂不支持批量导入，相关列已跳过；请在测试任务中手工录入」。不阻断同一文件内 INDICATOR 数据导入。
- **模板**：成绩 xlsx/csv 模板只生成 INDICATOR 列（改造现有模板构建，任务模板仅取任务内指标型测试项）。
- commit 草稿不包含任何 MODEL 列数据。
- 后续 MODEL 导入单独设计 `MODEL_CODE.field_key` 多列格式（每个模型字段一列），本期不实现。

## 关键强约束（本轮审查三条意见的落地）

### A. 体态冲突策略（不静默覆盖，不用 upsert）

- **preview 逐行冲突检查**：新增 `ApmsBodyMeasureMapper.selectConflictOnDate(athleteId, measureDate)`（查同队员同日期全部记录，返回 id+data_source，LIMIT 若干）。
  - 当天已有 `manual` / `cycle` / `task`（含 DEVICE 等非 import）记录 → 该行 **error**："该队员当天已有{来源}记录，未导入"，不可提交。
  - 当天已有 `import` 记录 → 默认同样 error；预览页提供勾选框「**允许覆盖此前【批量导入】的数据**」(overwriteImport)，勾选后这些行变 warn 可提交。
  - 当天无记录 → 新增。
- **commit 走两条新的专用方法（IApmsBodyMeasureService 新增），禁止走 upsert**：
  - `importInsert(m)`：dataSource 固定 `'import'`、sourceTaskId/sourceSessionKey/cycleId 固定 null；insert 前再查一次冲突（防 preview 后新增），冲突则该行失败。
  - `importUpdateImported(id, m)`：`UPDATE ... WHERE id=? AND data_source='import'`，只 SET 五个数值列+measureDate+update_time，**不触碰 source_task_id/source_session_key/cycle_id/data_source**；影响行数 0（已被改成其他来源）则该行失败。
- 成绩侧 dataSource 新导入写 `'import'`；旧 /import/csv 维持 `CSV_IMPORT` 不动。

### B. commit token 一次性消费（后端幂等，不依赖前端按钮）

- draft key=`import:draft:{domain}:{uuid}`，值含 userId/domain/overwriteImport/rows，TTL 10 分钟。
- commit 用 RedisTemplate 原子状态机：
  1. `GET draft`：不存在 → 查 `import:done:{token}`：有→**直接返回首次结果**（幂等）；有 `import:processing:{token}`→报"导入处理中，请勿重复提交"；都没有→"草稿不存在或已过期，请重新上传"。
  2. 校验 userId == 当前登录人、domain 与接口一致，不匹配拒绝。
  3. `DEL draft`（Redis DEL 原子，并发双击只有一个返回 true）→ 成功方设置 `processing`（SETNX，TTL 10min）→ 执行入库 → 写 `done`（结果快照，TTL 10min）→ 删 processing。
- 第二次提交在完成后拿到首次结果；执行中拿到"处理中"提示；成绩不会因双击产生重复 attempt。

### C. 运动员精确 resolver + DataScope（preview/commit 双重校验）

- 新增 `ApmsAthleteMapper.selectImportCandidates(ApmsAthlete q)`：独立简单 SQL，`FROM apms_athlete a`，条件为 `a.athlete_id=?` 或 `a.name = ?`（**精确等值，禁止 LIKE**），并拼接 `<if test="params.dataScope...">AND ${params.dataScope}</if>`（deptAlias=a, deptField=primary_team_id）。
- 新增 service 方法标 `@DataScope(deptAlias="a", deptField="primary_team_id")` 调用该 mapper（切面把 scope 写入入参实体 params；admin 超管切面自动跳过、super data_scope=全部数据放行）。
- 解析规则（每行）：
  1. athlete_id 填了数字 → 精确查 id；查不到/不在 scope → **error**（不说"还是否按姓名"，避免越权探测）。
  2. id 空 → name 必填，按精确等值查 scope 内：0 人 error"匹配不到队员（请核对姓名或填写运动员编号）"；>1 人 error"姓名重名（N 人），请填写 athlete_id"；恰好 1 人命中。
- **commit 提交前用草稿中的 athleteId 再跑一次 scope 校验**（权限可能在 preview 后变化）。
- **任务绑定（成绩）**：
  - 散录入口（testResult 页）：taskId 只能为空；即使文件含 task_id 列也**拒绝**（报错"散录批量导入不允许指定任务"）。
  - 任务入口（后续从任务详情发起时）：taskId 来自接口参数；preview 校验：任务存在且在当前用户 DataScope（testTask list 已有 scope 占位）、运动员是任务成员（`selectByTaskAndAthlete`，非成员行 error）、指标列属于该任务测试项中的 INDICATOR 项（不属于的列 error；MODEL 项列 ignore）。本期前端只做散录入口，但后端规则一次做全。

## 后端改动（ruoyi-system / ruoyi-admin）

1. **新增** `service/apms/import/TabularFileReader.java`：`List<String[]> read(InputStream, fileName)`；CSV 分支搬入现有手写状态机（引号/BOM/#说明行规则保留），Excel 分支 POI `WorkbookFactory + DataFormatter`；上限 10MB / 1000 数据行，超限抛带中文说明的异常。
2. **重构** `CsvResultImportProvider`：表头/行解析主体抽为 `parseRows(List<String[]>, taskId)`（逻辑零变更），CSV Provider 变薄读 CSV；`ITestResultImportProvider.ImportResult` 及 Row 实现 Serializable，Row 补 athleteName。旧 `/import/csv`、importAll 保留不动。
3. **新增** `service/apms/import/AthleteImportResolver.java`（@Component）：实现约束 C 的精确+scope 解析；preview 与 commit 共用。
4. **新增** `service/apms/import/ImportDraftStore.java`（@Component）：preview 存草稿、commit 原子消费（约束 B），RedisTemplate 状态机 draft/processing/done。
5. **修改** `InputRangeValidator.java`：新增只读分类（不影响现有拦截）：体态 `Map<String,String> classifyBodyFields(...)`、成绩 `String classifyIndicatorByCode(code, BigDecimal)`，供预览标色复用同一字典口径。
6. **新增** `service/apms/import/ResultImportRowWriter.java`（约束 D）：跨 bean 的行事务包装。
7. **新增** `service/apms/import/ResultImportFacade.java`：
   - preview：读取→parseRows（**仅接受 INDICATOR 列；MODEL 列标 ignore+warning（约束 E）**）→resolver 匹配人（scope）→指标列任务归属校验→数值单元格四级分类（ok/warn/error/ignore，成绩指标未配置区间字典时仅查数字格式，日期沿用现有白名单）→存草稿（仅指标数据）→返回预览体。
   - commit：消费 token→人再校验 scope→过滤 error/ignore→**每行经 ResultImportRowWriter.writeRow 一事务写多列**，dataSource='import'→逐行成功/失败汇总写 done。
8. **新增** `service/apms/import/BodyMeasureImportService.java`：preview（读取→resolver→日期→冲突检查 A→5 字段区间分类→草稿）；commit（消费 token→scope 复检→按冲突结论 importInsert / importUpdateImported(A)→汇总）。
9. **修改** `IApmsBodyMeasureService` / Impl / Mapper：新增 importInsert、importUpdateImported、selectConflictOnDate。
10. **新增** `service/apms/import/ImportTemplates.java`：XLSX 模板（POI XSSF：表头加粗/冻结/列宽，预填在训队员 id+姓名；**成绩模板只含启用 INDICATOR 列（E）**，任务模板仅任务内指标项）；CSV(BOM) 模板沿用现有服务并补体态 CSV。
11. **Controller**：
   - ApmsTestResultController 新增 `POST /import/preview`、`POST /import/commit`；`GET /import/template` 加 `format=csv|xlsx`（默认 xlsx）。
   - ApmsBodyMeasureController 新增 `POST /import/preview`（multipart file）、`POST /import/commit`（{token,overwriteImport}）、`GET /import/template?format=`。
   - 权限：成绩 preview/commit=`apms:testResult:add`、模板=`apms:testResult:list`；体态 preview/commit=`apms:body:edit`、模板=`apms:body:list`。
12. 预览返回体（两域同构）：
    `{ token, domain, summary:{total,valid,warn,error}, headers:[{key,label}], ignoredColumns:[], rows:[{lineNo,athleteId,athleteName,matched,date,cells:[{key,raw,status,message}],rowError}], warnings:[], allowOverwriteImport:bool }`

## 前端改动（ruoyi-ui）

13. **新增** `components/ImportPreviewDialog/index.vue`（两域通用）：
    - 步骤①：选文件（.xlsx/.xls/.csv，10MB）+ 下载模板（默认 xlsx，可切 csv）+ 格式说明（明确"一格一值，多次测试填多行"；姓名重名需填编号）。
    - 步骤②：统计条（可导入 N / 警告 M / 错误 K）；预览表黄=warn、红=error、灰=ignore；错误明细折叠区；体态且存在 import 旧数据时显示「允许覆盖此前批量导入的数据」勾选；确认按钮文案"导入 N 条有效数据（K 条错误将跳过）"，K>0 时需二次理解（按钮旁明示）。
    - 步骤③：成功/跳过/失败计数 + 失败明细（行号+原因），完成 emit success。
    - props：title/previewUrl/commitUrl/templateUrl/templateParams/extraForm/allowOverwriteOption。
14. **新增** `api/apms/batchImport.js`：previewImport(url, formData)、commitImport(url, body)。
15. **修改** testResult/index.vue：页头加「批量导入」（v-hasPermi apms:testResult:add），接通用弹窗（散录：不传 taskId），成功刷新。
16. **修改** bodyMeasure/index.vue：页头加「批量导入」（v-hasPermi apms:body:edit），成功后 loadList/loadCycleNames。
17. 旧 CsvImportDialog 不删；其格式说明并入新弹窗。

## 不做

- 无 SQL/菜单补丁（复用现有权限点）；不修 athlete 列表 @DataScope 占位符缺失的既有问题（仅新导入查询自带 scope）。
- CSV 单元格逗号多趟（现状未真正拆趟；模板明确多测分行）；不做草稿续期；不改设备/扫码链路。

## 实施顺序

1. AthleteImportResolver + mapper 精确 scope 查询（先打通人的解析）
2. InputRangeValidator 只读分类 + TabularFileReader
3. ImportDraftStore（token 状态机）
4. 成绩：parser 重构（INDICATOR-only, MODEL→ignore）+ ResultImportRowWriter 行事务 + Facade + Controller + 仅指标列模板
5. 体态 Service（冲突/专用 insert/update）+ Controller + 模板
6. mvn -q compile -pl ruoyi-admin -am
7. 前端 batchImport api + 通用弹窗 + 两页接入
8. vite build + GetDiagnostics

## 验证

- 后端 mvn 编译；前端 build:prod + 诊断 0 错误。
- 用户验收（真实小样本）：
  ① xlsx 模板下载/预填队员正常 ② 正常文件全绿入库 ③ 身高 24(红,跳过)/999(黄,可确认) ④ 部分姓名匹配不到→红；构造重名→红并提示填 id ⑤ 非 scope 队员 id→匹配失败 ⑥ 体态同队员同日期：manual 记录存在→冲突红；import 记录默认冲突、勾选后覆盖且来源/周期字段不串 ⑦ token 双击提交不产生重复成绩 ⑧ 散录文件带 task_id 被拒 ⑨ 旧 /import/csv 仍可用 ⑩ 同一行构造一个指标列非法：该行整体不入库（其他正常行正常入库），无半行数据 ⑪ 文件含 model.code 列：该列灰显跳过并有提示，指标列正常导入 ⑫ 下载的模板只含指标列。

## 风险与应对

- parser 重构回归：整体搬迁不改语义，旧接口保留对照。
- xlsx 数字/日期：DataFormatter 取字符串走同一日期白名单，预览显示原值。
- 导入期间被他人抢先建当天记录：importInsert 前再查冲突，冲突行失败并在明细说明。
- Redis 不可用：preview 直接报错，不落本地临时文件。
- scope 切面参数：service 方法必须以 BaseEntity（ApmsAthlete）为入参，实施时用单参数方法保证切面注入。
