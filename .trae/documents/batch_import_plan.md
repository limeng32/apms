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
  - 入参 DTO 在 **ruoyi-system 层定义**（不能用 ruoyi-admin 的 Controller 内部类 AddBody，避免模块反向依赖）：`service/apms/import/ResultImportItem.java { ApmsTestResult result; List<ApmsTestResultValue> values; }`；HTTP 层的 `ApmsTestResultController.AddBody` 仅用于接口入参，Facade 内部组装 system 层 DTO。
  - `@Transactional(rollbackFor = Exception.class) writeRow(List<ResultImportItem> items)`：顺序调用 `testResultService.add(item.result, item.values)`，默认传播 REQUIRED，全部加入**同一个行事务**；任一列抛异常 → 整行回滚（含 add 内部的 autoSelectBest/REP/任务进度/体态同步/PHV 全部回滚）。
- Facade 对每一行调用一次 writer.writeRow，try/catch 收集该行失败原因后继续下一行（下一行是全新事务）。
- 体态侧一行只写一条记录，由专用 importInsert/importUpdateImported 完成，无需 RowWriter。

### E. 成绩导入一期只支持 INDICATOR（MODEL 列跳过并明示）

现有 CsvResultImportProvider 虽能识别 model.code 列，但把单元格写成 `fieldKey="result"` 单值；而 `prepareModelValues()` 按 `apms_test_model_field` 的具体 field_key/必填/数据类型强校验，多字段模型 commit 必失败。一期不做 MODEL：

- **预览阶段**：表头识别为 model.code 的列一律标 `ignore`（灰），在 warnings 汇总明示「模型类指标（MODEL_CODE）暂不支持批量导入，相关列已跳过；请在测试任务中手工录入」。不阻断同一文件内 INDICATOR 数据导入。
- **模板**：成绩 xlsx/csv 模板只生成 INDICATOR 列（改造现有模板构建，任务模板仅取任务内指标型测试项）。
- commit 草稿不包含任何 MODEL 列数据。
- 后续 MODEL 导入单独设计 `MODEL_CODE.field_key` 多列格式（每个模型字段一列），本期不实现。

## 关键强约束（本轮审查三条意见的落地）

### A. 体态冲突策略（不静默覆盖，不用 upsert；冲突状态随草稿走，覆盖策略随提交走）

- **preview 逐行冲突检查**：新增 `ApmsBodyMeasureMapper.selectConflictOnDate(athleteId, measureDate)`（查同队员同日期全部记录，返回 id+data_source）。行状态三分支：
  - 当天已有 `manual`/`cycle`/`task`/DEVICE 等非 import 记录 → **error**（"该队员当天已有{来源}记录"），不可提交。
  - 当天已有 `data_source='import'` 记录 → 行打标 **IMPORT_CONFLICT**（携带 existingId、existingSource），默认计入"将跳过"；预览页据此显示「允许覆盖此前批量导入的数据」勾选。
  - 当天无记录 → 正常新增行。
- **draft 只存行的冲突标记与 existingId，不存覆盖决定**；commit 请求体 `{token, overwriteImport}`：
  - IMPORT_CONFLICT + overwriteImport=false → **skipped**（计入跳过明细）。
  - IMPORT_CONFLICT + overwriteImport=true → **重新查一次冲突**（防 preview 后记录变化）：仅当 existingId 此刻仍是 `data_source='import'` 才执行覆盖；已变为其他来源 → 该行 **failed**。
  - 无冲突行 → 新增（与 overwriteImport 无关）。
- **commit 走两条专用方法（IApmsBodyMeasureService 新增），禁止走 upsert**：
  - `importInsert(m)`：dataSource 固定 `'import'`、sourceTaskId/sourceSessionKey/cycleId 固定 null；insert 前再查一次冲突（防 preview 后新增），冲突则该行失败。
  - `importUpdateImported(id, m)`：**新增一条固定列的专用 Mapper 语句**（现有 update 是动态全字段、会触碰 data_source/source，不能复用）：`UPDATE apms_body_measure SET height,sit_height,weight,body_fat_rate,waist WHERE id=? AND data_source='import'`——只 SET 五个数值列（measure_date 即冲突键必然相同，不写；**该表无 update_time/update_by 列，禁止写**），不触碰 data_source/source_task_id/source_session_key/cycle_id/create_*；影响行数 0（已被改成其他来源）则该行失败。
- **后处理链三入口共用**：现有 upsert 成功后会触发 `phvService.tryAutoCalculate(athleteId)` 与 `tryKhamisRoche(athleteId)`（均 try/catch 吞异常）。在 Impl 中抽出私有 `afterMeasureSaved(Long athleteId)` 承载该链，`upsert` / `importInsert` / `importUpdateImported` 写成功后统一调用——**不复制逻辑**，保证批量导入后 PHV、预测成年身高随数据更新。
- 成绩侧 dataSource 新导入写 `'import'`；旧 /import/csv 维持 `CSV_IMPORT` 不动。

### B. commit token 一次性消费（后端幂等，不依赖前端按钮）

- draft key=`import:draft:{domain}:{uuid}`，值含 userId/domain/rows（**不含 overwriteImport——用户在看到预览后才勾选，草稿创建时无从得知**），TTL 10 分钟。
- commit 用 RedisTemplate 原子状态机：
  1. `GET draft`：不存在 → 查 `import:done:{token}`：有→**直接返回首次结果**（幂等）；有 `import:processing:{token}`→报"导入处理中，请勿重复提交"；都没有→"草稿不存在或已过期，请重新上传"。
  2. 校验 userId == 当前登录人、domain 与接口一致，不匹配拒绝。
  3. `DEL draft`（Redis DEL 原子，并发双击只有一个返回 true）→ 成功方设置 `processing`（SETNX，TTL 10min）→ 执行入库 → 写 `done`（结果快照，TTL 10min）→ 删 processing。
- 第二次提交在完成后拿到首次结果；执行中拿到"处理中"提示；成绩不会因双击产生重复 attempt。

### C. 运动员精确 resolver + DataScope（preview/commit 双重校验）

- 新增 `ApmsAthleteMapper.selectImportCandidates(ApmsAthlete q)`：独立简单 SQL，`FROM apms_athlete a`，条件为 `a.athlete_id=?` 或 `a.name = ?`（**精确等值，禁止 LIKE**），并拼接 `<if test="params.dataScope...">AND ${params.dataScope}</if>`（deptAlias=a, deptField=primary_team_id）。
- 新增 service 方法标 `@DataScope(deptAlias="a", deptField="primary_team_id")` 调用该 mapper（切面把 scope 写入入参实体 params；admin 超管切面自动跳过、super data_scope=全部数据放行）。
- 解析规则（输入为 parseRows 产出的原始串，resolver 不接触任何旧匹配结果）：
  1. athleteIdRaw 填了数字 → 精确查 id；查不到/不在 scope → **error**（不回退姓名猜测，避免越权探测/错配）；ID 与姓名同时填时以 ID 命中人为准，姓名仅在预览中作核对展示（不一致时给 warn 提示）。
  2. id 空 → athleteNameRaw 必填，按精确等值查 scope 内：0 人 error"匹配不到队员（请核对姓名或填写运动员编号）"；>1 人 error"姓名重名（N 人），请填写 athlete_id"；恰好 1 人命中。
- **commit 提交前用草稿中的 athleteId 再跑一次 scope 校验**（权限可能在 preview 后变化）。
- **任务绑定（成绩）**：
  - 散录入口（testResult 页）：taskId 只能为空；即使文件含 task_id 列也**拒绝**（报错"散录批量导入不允许指定任务"）。
  - 任务入口（后续从任务详情发起时）：taskId 来自接口参数；preview 校验：任务存在且在当前用户 DataScope（testTask list 已有 scope 占位）、运动员是任务成员（`selectByTaskAndAthlete`，非成员行 error）、指标列属于该任务测试项中的 INDICATOR 项（不属于的列 error；MODEL 项列 ignore）。本期前端只做散录入口，但后端规则一次做全。

## 后端改动（ruoyi-system / ruoyi-admin）

1. **新增** `service/apms/import/TabularFileReader.java`：`List<String[]> read(InputStream, fileName)`；CSV 分支搬入现有手写状态机（引号/BOM/#说明行规则保留），Excel 分支 POI `WorkbookFactory + DataFormatter`；上限 10MB / 1000 数据行，超限抛带中文说明的异常。
2. **重构** `CsvResultImportProvider`：**parseRows 必须是纯解析，禁止内置人员匹配**——
   - `parseRows(List<String[]>, taskId)` 只产出：表头映射（code→indicator/model）、`athleteIdRaw`（athlete_id 列原始串）、`athleteNameRaw`（athlete_name 列原始串）、measureDate、sessionKey、各指标列原始值。Row 新增 `String athleteIdRaw / athleteNameRaw`（保留原 `athleteId` 字段供旧链路填充）。
   - 旧 `resolveAthleteId()`（数字 ID 优先→LIKE 姓名→多人取第一条）改名为 `legacyResolveAthlete(ImportResult)` 原样保留；**旧 `/import/csv` 链路 = parseRows → legacyResolveAthlete → persist，行为完全不变**。
   - **新 preview 链路 = parseRows → AthleteImportResolver**（精确 ID/精确姓名/scope/重名拦截），resolver 直接消费两个 raw 字段，旧 LIKE 结果永远不会进入新链路，杜绝"张三被 LIKE 错配成 1001 后再被精确校验放行"。
   - CSV Provider 变薄为：TabularFileReader 读 CSV → parseRows；`ImportResult`/Row 实现 Serializable。
3. **新增** `service/apms/import/AthleteImportResolver.java`（@Component）：实现约束 C 的精确+scope 解析；preview 与 commit 共用。
4. **新增** `service/apms/import/ImportDraftStore.java`（@Component）：preview 存草稿、commit 原子消费（约束 B），RedisTemplate 状态机 draft/processing/done。
5. **修改** `InputRangeValidator.java`：新增只读分类（不影响现有拦截）：体态 `Map<String,String> classifyBodyFields(...)`、成绩 `String classifyIndicatorByCode(code, BigDecimal)`，供预览标色复用同一字典口径。
6. **新增** `service/apms/import/ResultImportRowWriter.java`（约束 D）：跨 bean 的行事务包装。
7. **新增** `service/apms/import/ResultImportFacade.java`：
   - preview：读取→**纯 parseRows**（不做人匹配）→消费 Row.athleteIdRaw/athleteNameRaw 走 AthleteImportResolver 精确匹配（scope；ID 与姓名同时存在时以 ID 为准、姓名仅作核对展示）→仅接受 INDICATOR 列，MODEL 列标 ignore+warning（约束 E）→指标列任务归属校验→数值单元格四级分类（ok/warn/error/ignore，成绩指标未配置区间字典时仅查数字格式，日期沿用现有白名单）→存草稿（仅指标数据+已解析 athleteId）→返回预览体。
   - commit：消费 token→人再校验 scope→过滤 error/ignore→**每行经 ResultImportRowWriter.writeRow 一事务写多列**，dataSource='import'→逐行成功/失败汇总写 done。
8. **新增** `service/apms/import/BodyMeasureImportService.java`：preview（读取→resolver→日期→冲突检查 A→5 字段区间分类→行打 conflict 标记→草稿，**不存 overwriteImport**）；commit(token, overwriteImport)（消费 token→scope 复检→按 A：IMPORT_CONFLICT 依参数 skip 或重查后 importUpdateImported，无冲突 importInsert→成功/跳过/失败汇总）。
9. **修改** `IApmsBodyMeasureService` / Impl / Mapper(+XML)：新增 importInsert、importUpdateImported（固定五列专用 update 语句）、selectConflictOnDate；Impl 抽 `afterMeasureSaved(athleteId)` 供 upsert 与两个导入入口共用后处理链。
10. **新增** `service/apms/import/ImportTemplates.java`：XLSX 模板（POI XSSF：表头加粗/冻结/列宽，预填在训队员 id+姓名；**成绩模板只含启用 INDICATOR 列（E）**，任务模板仅任务内指标项）；CSV(BOM) 模板沿用现有服务并补体态 CSV。
11. **Controller**：
   - ApmsTestResultController 新增 `POST /import/preview`、`POST /import/commit`；`GET /import/template` 加 `format=csv|xlsx`（默认 xlsx）。
   - ApmsBodyMeasureController 新增 `POST /import/preview`（multipart file）、`POST /import/commit`（{token,overwriteImport}）、`GET /import/template?format=`。
   - 权限：成绩 preview/commit=`apms:testResult:add`、模板=`apms:testResult:list`；体态 preview/commit=`apms:body:edit`、模板=`apms:body:list`。
12. 预览返回体（两域同构）：
    `{ token, domain, summary:{total,valid,warn,error,importConflict}, headers:[{key,label}], ignoredColumns:[], rows:[{lineNo,athleteId,athleteName,matched,date,cells:[{key,raw,status,message}],rowError, conflict:null|{type:'IMPORT_CONFLICT',existingId,existingSource}}], warnings:[] }`
    - 体态 IMPORT_CONFLICT 行默认计入 importConflict/跳过数；前端勾选仅作为 commit 的 overwriteImport 参数，不回写草稿。

## 前端改动（ruoyi-ui）

13. **新增** `components/ImportPreviewDialog/index.vue`（两域通用）：
    - 步骤①：选文件（.xlsx/.xls/.csv，10MB）+ 下载模板（默认 xlsx，可切 csv）+ 格式说明（明确"一格一值，多次测试填多行"；姓名重名需填编号）。
    - 步骤②：统计条（可导入 N / 警告 M / 错误 K / 将跳过含导入冲突 C）；预览表黄=warn、红=error、灰=ignore、蓝=IMPORT_CONFLICT（当天已有导入数据）；错误明细折叠区；存在 IMPORT_CONFLICT 行时显示「允许覆盖此前【批量导入】的数据」勾选，勾选后这些行并入可导入数（该选择只随 commit 请求提交，不修改预览）；确认按钮文案实时反映"导入 N 条（跳过 X 条）"。
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
  ① xlsx 模板下载/预填队员正常 ② 正常文件全绿入库 ③ 身高 24(红,跳过)/999(黄,可确认) ④ 部分姓名匹配不到→红；构造重名→红并提示填 id ⑤ 非 scope 队员 id→匹配失败 ⑥ 体态同队员同日期：manual/cycle/task 记录存在→冲突红不可提交；import 记录→蓝色 IMPORT_CONFLICT 默认跳过，勾选 overwriteImport 后提交才覆盖且来源/周期字段不串；不勾选提交该计入跳过；preview 后手工把来源改为 manual 再勾选提交→该行失败 ⑦ token 双击提交不产生重复成绩 ⑧ 散录文件带 task_id 被拒 ⑨ 旧 /import/csv 仍可用 ⑩ 同一行构造一个指标列非法：该行整体不入库（其他正常行正常入库），无半行数据 ⑪ 文件含 model.code 列：该列灰显跳过并有提示，指标列正常导入 ⑫ 下载的模板只含指标列。

## 风险与应对

- parser 重构回归：parseRows 仅搬解析、人员匹配下沉为 legacyResolveAthlete，旧 /import/csv 链路（parseRows→legacy→persist）逐段保留作对照，新旧两条人员解析路径严格不交叉。
- xlsx 数字/日期：DataFormatter 取字符串走同一日期白名单，预览显示原值。
- 导入期间被他人抢先建当天记录：importInsert 前再查冲突，冲突行失败并在明细说明。
- Redis 不可用：preview 直接报错，不落本地临时文件。
- scope 切面参数：service 方法必须以 BaseEntity（ApmsAthlete）为入参，实施时用单参数方法保证切面注入。
