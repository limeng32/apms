# 测试成绩 / 体态测量 批量导入（Excel+CSV · 预览两阶段）实施计划

## 背景与决策（已与用户对齐）

1. 文件格式：**xlsx / xls / csv 全支持**（后端 POI 5.5.1 已就绪，前端零新依赖）
2. 流程：**上传 → 预览校验（异常标红/错误行/匹配结果）→ 确认入库** 两阶段
3. 范围：**体态测量 + 测试成绩**
4. 扫码枪/手持设备本次不做（扫码枪=键盘输入天然兼容现有录入框；SmartSpeed 推送已有）

## 现状事实（调研结论）

- 成绩 CSV 导入后端已存在但为孤儿：`POST /apms/test-result/import/csv`（[ApmsTestResultController](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/apms/ApmsTestResultController.java#L132-L152)）+ [CsvResultImportProvider](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/CsvResultImportProvider.java)（手写 CSV 状态机、ID 优先姓名兜底匹配、表头 code 匹配指标/模型），前端 [CsvImportDialog](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/components/CsvImportDialog/index.vue) **零引用**，且无预览、有错整批回滚；模板 GET 已存在（UTF-8 BOM CSV，可预填任务队员/测试项）。
- 体态测量**无任何导入接口**，仅 JSON 周期批量（measure-cycle/{id}/batch）。
- 运动员匹配现有口径：athlete_id 数字优先，空/查不到时按 athlete_name 精确匹配（重名取第一条）。
- 数值双层校验已上线：[InputRangeValidator](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/InputRangeValidator.java) 读字典 hard/warn 区间（apms_measure_range / apms_indicator_range）；成绩 add/update、体态 upsert 已有硬限兜底。
- RedisCache 可存对象+TTL；ruoyi-common 含 POI；前端有 file-saver、无前端解析库（解析全部在后端）。

## 总体设计

**服务端草稿模式（不二次传文件）**：
- preview：上传文件 → 后端按扩展名选读取器 → 解析+校验 → 草稿存 Redis（key `import:draft:{domain}:{uuid}`，TTL 10 分钟）→ 返回**展示就绪**的预览数据（含 token）
- commit：前端只回传 token → 后端取草稿逐行入库 → 返回成功/跳过/失败计数与明细
- 提交语义：**错误行跳过、有效行入库、警告行经用户确认后入库**（比现状的整批回滚体验好）；逐行独立事务（复用现有 service.add/upsert 代理），单行失败不影响其他行

**预览单元格四级状态**：`ok` 正常 / `warn` 超合理区间（黄，可提交）/ `error` 硬限/非数字/日期错/人匹配不到（红，跳过不可提交）/ `ignore` 未识别列（灰，提示）

## 文件清单与改动

### 后端（ruoyi-system / ruoyi-admin）

1. **新增** `service/apms/import/TabularFileReader.java`
   统一表格读取：`List<String[]> read(InputStream, String fileName)`。CSV 分支搬入现有 CSV 状态机代码（引号/BOM/#说明行跳过规则保留）；Excel 分支用 POI `WorkbookFactory + DataFormatter`（自动处理 xlsx/xls、数字/日期单元格）。首行/表头规则由调用方处理。

2. **重构** `CsvResultImportProvider` / `ITestResultImportProvider`
   - 抽出 `AbstractTabularResultParser`：把现有 parse(InputStream) 的「表头解析+行解析」主体改为 `parseRows(List<String[]>, taskId)`（逻辑零变更，仅入参从流变成矩阵）；CSV Provider 变薄（读 CSV→parseRows）。
   - ImportResult Row 增加可序列化与预览字段（athleteName、lineNo 已有），ImportResult 实现 Serializable。
   - 保留旧 `POST /import/csv` 与旧 importAll 不动（向后兼容，虽然前端无引用）。

3. **新增** `service/apms/import/ResultImportFacade.java`（@Service）
   - `preview(MultipartFile, taskId)`：TabularFileReader 读取（按扩展名）→ parseRows → 每行补 athleteName；逐单元格分类：数值格式（BigDecimal）+ `InputRangeValidator` 暴露的 classify（按指标编码字典 apms_indicator_range，未配置=仅数字检查）；错误行/警告汇总；草稿存 Redis。
   - `commit(token)`：取草稿，过滤 error 行，逐行调 `IApmsTestResultService.add`（复用 autoSelectBest/REP/进度/体态同步/PHV 全链路），收集每行成功/失败 → `{committed, skipped, failed, failedDetails[]}`。
   - 行数上限 1000、文件上限 10MB（超限在 preview 报错）。

4. **新增** `service/apms/import/BodyMeasureImportService.java`（@Service）
   - 列约定：`athlete_id, athlete_name, measure_date, height, weight, sit_height, body_fat_rate, waist`（表头大小写/下划线驼峰都兼容；中文名行 `#` 开头可忽略）。
   - preview：TabularFileReader → ID/姓名匹配运动员（复用 AthleteMapper）→ 日期校验（沿用成绩导入日期白名单）→ 5 字段逐格分类（复用 InputRangeValidator 的体态区间分类）→ 草稿 Redis。
   - commit：过滤 error 行，逐行构造 ApmsBodyMeasure（dataSource='MANUAL'，周期外导入 cycleId=null）调 `measureService.upsert`（自动触发 PHV/KR），逐行收集结果。
   - 模板：生成在训队员预填行（athlete_id+name，数值列空），CSV(UTF-8 BOM) 与 XLSX 两种。

5. **新增** `service/apms/import/ImportTemplates.java`
   POI XSSF 生成 xlsx 模板（表头加粗、冻结首行、列宽、第二行中文示例/说明）；CSV 模板生成（BOM）复用成绩现有模板服务并补体态；成绩模板增加 `format=xlsx` 支持（现有模板服务只产 CSV，新增 xlsx 产物，列拼装逻辑复用 [TestResultTemplateServiceImpl](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/TestResultTemplateServiceImpl.java)）。

6. **修改** `InputRangeValidator.java`
   新增只读分类方法（不改现有拦截逻辑）：`Map<String,String> classifyBody(ApmsBodyMeasure)`（key→ok/warn/hard-low/...）、`String classifyIndicatorByCode(String code, BigDecimal v)`，供两个 Facade 预览复用同一套字典口径。

7. **修改** Controller
   - `ApmsTestResultController`：新增 `POST /apms/test-result/import/preview`（multipart file+taskId）、`POST /apms/test-result/import/commit`（body {token}）；`GET /import/template` 增加 `format=csv|xlsx`（默认 xlsx）。
   - `ApmsBodyMeasureController`：新增 `POST /apms/body-measure/import/preview`、`POST /apms/body-measure/import/commit`、`GET /apms/body-measure/import/template?format=`。
   - 权限复用：成绩 `apms:testResult:add` / 模板下载 `apms:testResult:list`；体态 `apms:body:edit`（preview 也用 edit，导入本质是写操作）。

8. preview 返回体（两域同构，前端组件通用）：
   ```
   { token, domain, summary:{total, valid, warn, error},
     headers:[{key,label}], ignoredColumns:[...],
     rows:[{lineNo, athleteId, athleteName, matched:bool, date,
            cells:[{key, raw, status, message}], rowError:null|""}],
     warnings:[...], errorRows:[...] }
   ```

### 前端（ruoyi-ui）

9. **新增** `components/ImportPreviewDialog/index.vue`（通用导入弹窗，两域复用）
   - 步骤条：① 选文件（accept .xlsx,.xls,.csv，单文件 10MB）+「下载导入模板」链接（xlsx 默认，可切 csv）+ 格式说明；② 预览表（固定列 行号/运动员/日期 + 动态指标列，单元格黄底=warn、红底=error、删除线灰=ignore；顶部统计条 N 行可导入/M 警告/K 错误；错误行默认折叠区列出），底部「上一步/确认导入（仅导入 N 条有效数据）」；③ 结果页（成功 X / 跳过 Y / 失败 Z + 失败明细，完成后 emit success）。
   - props：`title`、`previewUrl`、`commitUrl`、`templateUrl`、`extraForm`（taskId）；token 等全部走返回数据。
10. **新增** `api/apms/batchImport.js`：`previewImport(url, file, form)`（FormData POST，返回 JSON）、`commitImport(url, token)`（JSON POST）。
11. **修改** `views/apms/testResult/index.vue`：页头（或现有工具区）加「批量导入」按钮（v-hasPermi apms:testResult:add），挂载通用弹窗（previewUrl=`/apms/test-result/import/preview`，taskId 不传——散录批量）；成功后刷新列表。把孤儿 CsvImportDialog 的「格式示例」说明内容并入新弹窗第一步，**不删除**旧组件文件。
12. **修改** `views/apms/bodyMeasure/index.vue`：页头加「批量导入」按钮（v-hasPermi apms:body:edit），弹窗指向 body-measure 三个接口；成功后 loadList + loadCycleNames。

### 不做

- 无 SQL/菜单补丁（复用现有按钮权限点）。
- 不支持 CSV 单元格内逗号多趟（现状实现本身未真正拆趟，模板明确"一格一值，多次测试分行"）。
- 不改扫码枪/设备链路；不删旧 CsvImportDialog 与旧 /import/csv。
- 预览草稿 10 分钟过期需重新上传（不做续期）。

## 实施顺序

1. TabularFileReader + InputRangeValidator 分类方法（基础设施）
2. 成绩侧：抽象 parser 重构 → ResultImportFacade → Controller → 模板 xlsx
3. 体态侧：BodyMeasureImportService → Controller → 模板
4. mvn compile 后端验证
5. 前端 batchImport api + ImportPreviewDialog 通用组件
6. testResult / bodyMeasure 接入口
7. vite build + GetDiagnostics

## 验证

- 后端：`mvn -q compile -pl ruoyi-admin -am`
- 前端：GetDiagnostics 0 错误 + `npm run build:prod`
- 用户浏览器验收（用真实小样本）：
  ① 模板下载（xlsx 打开列名/预填队员正常）② 正常文件预览全绿→提交入库计数正确 ③ 身高 24/999 分别红/黄、错误行不计入可导入数、提交后黄行入库红行跳过 ④ athlete_id 留空写姓名可匹配；写错姓名报匹配失败 ⑤ 成绩 CSV 旧链路 /import/csv 仍可用 ⑥ 体态导入后 PHV/趋势数据联动、列表异常标红。

## 风险与应对

- **parser 重构回归**：现有 CSV 解析逻辑整体搬迁不改语义，旧 /import/csv 保留作回归对照；单测缺失情况下以"旧 CSV 经新链路解析结果一致"为验收。
- **xlsx 日期/数字格式**：统一 DataFormatter 取字符串后走与 CSV 相同的日期白名单；预览暴露原值，异常用户可见。
- **重名匹配**：沿用"取第一条"，预览显示匹配到的 ID+姓名供人工核对；提示"重名请改用 athlete_id"。
- **草稿序列化**：ImportResult 及其内部类实现 Serializable；Redis 不可用时 preview 直接报"会话缓存不可用"，不落本地文件。
- **大文件**：硬上限 10MB / 1000 数据行，超限 preview 阶段明确报错。
- **部分成功语义**：提交结果必须清晰展示 成功/跳过/失败 三类计数，避免用户误以为整批成功。
