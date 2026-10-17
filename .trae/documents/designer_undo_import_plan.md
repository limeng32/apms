# 登录页设计器：撤销/重做 + 导入来源强校验 实施计划

> 状态：**规划待批，未动代码**。评审通过并明确「开始执行」后再改文件。
> 范围：仅登录页设计器前端 + 登录页配置保存接口的来源校验；不改数据库表结构、不改 SQL 补丁、不改公开配置接口。

## 1. 背景

登录页设计器（`系统管理 → 登录页设计`）当前所有控件直接写同一个响应式对象 `localConfig`，只有「当前草稿 vs 已保存快照」的 `dirty` 比较，没有历史，改错只能手动调回。同时「导入 JSON」存在两个隐患：

1. 跨站导入（业务站文件导进展示站）目前只弹警告、仍可放行，容易误覆盖另一站点配置；
2. 当前站存在未保存草稿时导入，会直接 PUT 覆盖数据库并静默替换草稿，无拦截。

本期目标：

- 为设计器增加**按内容页签分区**的撤销/重做（节点 + 游标模型）；
- 导入本身作为**可撤销的一步**：导入前后状态按页签分别入栈，变化页签可回退到导入前；
- 导入/导出**绑定当前编辑站点**，跨站与无来源文件**严格拒绝**；
- 当前站有未保存草稿时**禁止导入**（仅提示，先去保存或撤销）。

## 2. 已确认决策（与用户逐条对齐）

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 撤销/重做历史的站点作用域 | **不做分站保留**。切换业务站/展示站时历史清空，以载入的新站配置为基线；历史只在「同一站、同一次页面会话」有效 |
| D2 | 撤销/重做历史的页签作用域 | **按 4 个内容页签分区独立记录**，撤销只回滚当前页签拥有的字段，不影响其他页签 |
| D3 | 导入的历史行为 | **导入可撤销，且按页签分别成步**。导入执行固定序列（见 §6.1）：确认已保存 → 清栈 → 各页签压入「导入前状态」节点 → 导入新 JSON 并保存 → 各页签压入「导入后状态」节点。在发生变化的页签可撤销回导入前该页签配置（只改本地，重新保存才回写数据库） |
| D4 | 导入/导出的站点选择 | **作用当前顶栏站点**（恢复为单按钮，不再用下拉选目标站）；要操作另一站先切换顶栏 |
| D5 | 跨站导入 | **严格拒绝**：文件 `meta.entry` 与当前站不一致 → 不执行（后端 400 + 前端预判） |
| D6 | 旧文件（无 `meta.entry`） | **严格拒绝**：提示在对应站点重新导出；不留确认放行口子 |
| D7 | 当前站有未保存草稿时点导入 | **禁止执行**：仅弹「取消」提示，不提供「先保存/放弃草稿」分支；用户先保存或用撤销回到已保存状态后再导入 |

## 3. 现状调研（关键文件与事实）

- 设计器页：[index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/system/loginConfig/index.vue)
  - `localConfig`（ref，`mergeWithDefaults` 后的完整配置）是唯一编辑对象；`entry`（portal/showcase）为当前站点；`activeTab` 为内容页签。
  - 内容页签（4 个）：`content` 文案、`appearance` 外观、`layout` 浏览器端布局、`mobileLayout` 移动端布局。
  - 写入路径：文案/外观大量 `v-model`；布局经 [LoginLayoutFields.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login/LoginLayoutFields.vue) 上抛 `patch`/`logo-*` 事件，父组件写 `editRoots`；Logo 拖拽走 `onLogoOffset`（pointermove 高频）；色板 `applyPalette`；上传 `onLogoUploaded/onBgUploaded/onFaviconUploaded`；以及 `copyFromPortal`、`resetDefault`、导入、保存。
  - 现有导入/导出：已改为两个下拉（`onImportCommand/onExportCommand`），导出经 GET 后端 + `mergeWithDefaults` 产出完整结构并带 `meta = { source, entry, exportedAt }`；导入读取 `meta.entry` 做跨站警告（本期改为严格拒绝），提交前删除 `meta`。
  - 脏状态：`dirty = JSON.stringify(localConfig) !== savedSnapshot.value`（`savedSnapshot` 已为 ref）；保存按钮、`switchEntry`、`onBeforeRouteLeave`、`beforeunload` 都消费它。
- 后端保存：[ApmsLoginConfigManageController.java](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/ApmsLoginConfigManageController.java) `PUT /system/login/config?entry=` → [ApmsLoginConfigServiceImpl.saveConfig](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/ApmsLoginConfigServiceImpl.java)，目前 `validate(config)` 白名单校验后**整份原样存储**，不读 `meta`。
- 前端 API：[loginConfig.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/api/loginConfig.js) `updateLoginConfig(data, entry)`。
- 依赖：项目已含 `@vueuse/core`，但本期**不使用** `useManualRefHistory`（理由见 §5）。

## 4. 页签字段归属（分区表）

页签撤销栈只记录下列叶子路径；`brand`、`layout` 按叶子**互斥切分**：

| scope | 配置路径 |
|---|---|
| `content` | `brand.name`、`brand.browserTitle`、`brand.subTitle`、`hero.*`、`form.*`、`footer.*` |
| `appearance` | `colors.*`、`typography.*`、`layout.cardRadius`、`animation.entrance` |
| `layout`（桌面） | `layout.template`、`layout.splitRatio`、`layout.showBrandOnMobile`、`background.*`、`brand.logo`、`brand.logoClient`、`brand.logoSpace`、`brand.favicon` |
| `mobileLayout`（移动） | `mobile.*` |

约束：所有可编辑叶子必须恰好归属一个 scope，无遗漏、无交叉；`version` 不归属任何 scope（不可编辑，提交时保留）。

## 5. 撤销/重做详细设计

### 5.1 数据结构（节点 + 游标）

新增 `ruoyi-ui/src/views/system/loginConfig/useConfigHistory.js`，纯逻辑 composable（框架无关，便于 Node 桩测）。

每个 scope 维护一条**节点数组 + 游标**（而非 past/future 双栈，以便精确表达「导入前后各压一个节点」的确定序列）：

- `nodes[scope]: string[]`：该 scope 的状态节点序列，每个节点是「该 scope 拥有叶子组成的子对象」JSON（提取 `pickScope(fullConfig, scope)`，非整份配置，避免改文案把外观也记一步）；`nodes[0]` 为基线，末尾为最新。
- `index[scope]: number`：当前所处节点下标。
- 上限 50 节点（超出丢弃最旧非当前节点，基线随之前移）。
- 不变量：当前实际配置 == `applyScope` 还原的 `nodes[index]`；`canUndo = index > 0`；`canRedo = index < nodes.length-1`。
- 暴露：`undo()`、`redo()`（内部先 `flushPending(当前scope)`）、`canUndo/canRedo`（按当前 activeTab）、`schedulePush(scope)`（4 个独立 watcher 回调）、`flushPending(scope)`、`clearAllTimers()`、`beginImportSession(before, after)`、`resetAll()`、`seed(config)`（载入后建单节点基线）。

### 5.2 普通编辑如何成节点（每个 scope 独立监听 + 防抖）

不做"一个 deep watcher + 路径 diff 判定归属"——Vue 深层 watcher 回调里 `newVal/oldVal` 通常是同一对象引用，拿不到可靠的旧值与变更路径；且 `copyFromPortal()`/`resetDefault()` 会**一次替换整份配置、同时命中多个 scope**，单 watcher 难以正确拆步。改为**每个 scope 一个独立的快照监听**：

```js
SCOPES.forEach((s) => {
  watch(
    () => JSON.stringify(pickScope(localConfig.value, s)),
    () => schedulePush(s)
  )
})
```

- 监听源是该 scope 叶子的 JSON 字符串，天然只对本页签字段敏感、也天然拿到"变/没变"；无需 oldValue 与路径 diff。
- `schedulePush(s)`：对该 scope 启动/重置 **500ms 防抖**；持续键入、Logo 拖拽高频 pointermove 期间只重置定时器，停顿后成 1 个节点。
- 停顿后成节点：丢弃 `index` 之后的 redo 尾节点（undo 分叉语义），把新快照追加到 `nodes`，`index=末尾`；与当前节点相同则跳过。
- `resetDefault()` 一次改 4 个 scope → 4 个监听各自触发、各自记一个节点（符合"按页签分别记录"）。
- `restoring` 标志：undo/redo/loadData/导入回填期间置 true，`schedulePush` 直接 return，避免程序化赋值成空步。

**防抖结算（必须）**：

- `undo()`/`redo()` 执行前先 `flushPending(activeScope)`：把该 scope 尚未入栈的 500ms 内编辑立即结算成节点，再移动游标——否则"刚拖完滑块立刻点撤销"会因定时器未触发而无反应。
- `resetAll()`、`loadData`、`beginImportSession` 前先 `clearAllTimers()`，取消全部待执行防抖，杜绝切站/导入后旧定时器污染新站点或新基线。

### 5.3 undo/redo 写回

- undo（当前 scope `index>0`）：`index--`，把 `nodes[index]` 仅写回该 scope 的叶子（`applyScope`），其它页签字段原样保留。
- redo（`index<末尾`）：`index++` 后同样只写回该 scope。
- 写回期 `restoring=true`，不触发新节点；全局副作用（主题色/字体/圆角/标签标题/favicon）由现有 App.vue watcher 与登录页 applyHead 自动跟随。

### 5.4 交互

- 顶栏「保存」左侧新增两个图标按钮：撤销 `RefreshLeft`、重做 `RefreshRight`；`disabled` 绑当前 scope 的 `canUndo/canRedo`；tooltip 标注 `Ctrl/⌘+Z`、`Ctrl/⌘+Shift+Z`（macOS tooltip 显示 ⌘）。
- 快捷键：`keydown` 监听，**焦点在 `input/textarea/[contenteditable]` 时不拦截**（让浏览器原生文字撤销生效）；非输入态 `Ctrl/⌘+Z` → undo、`Ctrl/⌘+Shift+Z` 或 `Ctrl+Y` → redo；阻止默认冒泡。
- 切内容页签：历史与按钮各自独立，不清空。

### 5.5 各动作对历史的影响

- **切换站点**（`loadData` 成功后）：`resetAll()`，4 个 scope 各以载入配置为单节点基线（D1）。
- **导入**：调用 `beginImportSession(before, after)`，按 §6.1 固定序列建立「导入前/导入后」两节点（D3）。
- **从业务站复制 / 恢复默认**：只改本地草稿，防抖自动追加节点，可撤销。
- **保存**：不改动节点；但当草稿回退到与已保存不同（如导入后 undo）时 `dirty=true`、保存按钮变亮。
- **页面刷新/关闭**：历史仅存内存，不持久化（本期不做 localStorage 历史）。

### 5.6 为什么不用 @vueuse `useManualRefHistory`

手动模式需在每个写入点 `commit()`（拖拽/上传/数十个 v-model 极易漏）；deep clone 与「非提交期间追踪」在高频拖拽+程序化回填场景边界较多（同类实践出现 undo 一次后异常、redo 失效）。自写约 120 行，机制透明，且快照口径与现有 `dirty`/导入导出完全一致。

## 6. 导入/导出收紧详细设计

### 6.1 前端（index.vue）

- 顶栏「导入 JSON/导出 JSON」由下拉**改回单按钮**，作用当前 `entry`（D4）；按钮旁或 tooltip 明示当前站点名。
  - 导出文件名维持：业务站 `apms-login-aoti-<时间>.json`、展示站 `apms-login-www-<时间>.json`；文件内 `meta.entry` 分别为 `portal`/`showcase`。
- 导入前置校验顺序（任一不过均不发请求）：
  1. **草稿拦截（D7）**：若 `dirty === true` → `$modal.alert`（仅「知道了/取消」）：「当前业务站/展示站有未保存修改，请先保存或撤销后再导入」，直接中止，不打开/不处理文件。
  2. 文件必须是 JSON 对象。
  3. **来源校验（D5/D6）**：读取 `meta.entry`；不存在或不是 `portal/showcase` → 拒绝「文件缺少有效来源标识，仅支持本站点重新导出的配置文件」；与当前 `entry` 不一致 → 拒绝「该文件属于{另一站}，不能导入{本站}」。
  4. 通过后再走现有「覆盖确认」二次确认 → 执行下方**导入固定序列**。
- 跨站操作入口本身已不存在（按钮只针对当前站），来源校验作为内容级硬保险。

#### 导入固定序列（D3，先落库成功，最后才整体替换历史）

核心原则：**服务端 PUT 成功前，不动 localConfig、不动 savedSnapshot、不动历史栈**；任何前置/网络/校验失败都让本地完全保持原状（仍可继续编辑、原有撤销记录仍在）。

设当前站已保存配置为 `C0`（前置 D7 保证其 == 本地草稿 == 数据库），文件解析并剥离 `meta` 后的配置为 `C1`：

1. **确保保存状态**：断言 `dirty === false`（前置已拦，防御性复核），不满足中止；同时 `clearAllTimers()` 取消待入栈防抖。
2. **读取并解析**：`C0 = mergeWithDefaults(GET 当前站)`、`C1 = mergeWithDefaults(剥离 meta 后的文件)`；在内存完成来源校验/JSON 校验，**不发写请求、不改任何状态**。
3. **PUT 落库**：`restoring=true` 下 `updateLoginConfig(C1, entry)`。
   - **失败 → 立即结束**：不执行后续任何步骤；localConfig、savedSnapshot、四 scope 历史栈**全部原样保留**，弹错误提示。
4. **PUT 成功后更新本地**：`localConfig = C1`（以接口回读/本地合并为准）、`savedSnapshot = JSON.stringify(C1)`（dirty=false）。
5. **最后整体替换历史**：`beginImportSession(C0, C1)`——内部一次性 `resetAll()` 后重建：每 scope 先以 `pickScope(C0,s)` 为节点0；仅当 `pickScope(C1,s)` 与节点0不同才追加为节点1并 `index=1`，相同则该 scope 保持单节点（撤销禁用）。结束 `restoring=false`。

语义结果：

- 导入失败：数据库、本地草稿、已保存快照、撤销历史**四者全部不变**，无任何半完成状态。
- 导入成功：在「确实变化」的页签撤销 1 次回到导入前该页签配置；重做回导入后；无变化页签撤销按钮禁用。
- 撤销只改本地草稿（`dirty=true`），**不自动回写数据库**；再点「保存」才落库——撤销期间数据库始终是导入后的 C1。
- 「从业务站复制/恢复默认」不走本序列（不立即落库），仅普通成节点。

### 6.1b 切换站点：先加载成功，再整体切换（修复既有错站风险）

现状缺陷：`switchEntry` 先 `entry.value = target` 再异步 `loadData(target)`。若目标站 GET 失败，顶栏已显示新站、`localConfig` 却仍是旧站配置，此时编辑/保存会把**旧站配置写进新站**（比导入误操作风险更高）。

改为「先取数、成功后一次性原子切换」：

```text
switchEntry(target):
  未保存拦截（沿用现有 dirty 二次确认，取消则不动）
  loading=true
  try:
    data = await getManagedLoginConfig(target)   // 先请求，期间 entry 仍是旧站
  catch:
    msgError('切换失败：未能加载{目标站}配置，仍停留在{当前站}')
    return                                       // entry/localConfig/历史全部不变
  // —— 只有加载成功才执行下面的切换 ——
  clearAllTimers()
  restoring = true
  entry.value = target
  localConfig.value = mergeWithDefaults(data)
  savedSnapshot.value = JSON.stringify(localConfig.value)
  resetAll(); seed(localConfig.value)            // 新站单节点基线
  restoring = false
```

要点：

- 加载失败时**四个状态都不动**：`entry`（顶栏 radio）、`localConfig`、`savedSnapshot`、历史栈，用户仍在原站、可继续操作。
- 切换与载入合并为一次 `restoring` 窗口，避免四 scope watcher 因整份替换弹出一串节点；载入完成后用 `seed` 直接建基线。
- radio 仍用单向 `:model-value`，失败时因 `entry` 未变，按钮自然回退，无需手动复位。
- 初次 `onMounted` 的 `loadData()` 同理走「成功才赋值」（初始为默认配置，失败保持默认并提示，不影响入口）。

### 6.2 后端（强约束，防绕过）

- `saveConfig(config, operator, entry)` 在 `validate` 之前读取顶层 `meta`：
  - `meta` 非对象/缺 `entry` 字段 → `throw ServiceException("配置文件缺少来源标识，无法导入")`（严格，D6）；
  - `meta.entry` 归一化（portal/default ↔ default；showcase ↔ showcase）后与 `resolveConfigKey(entry)` 的目标 key 比较，不一致 → `throw ServiceException("该配置属于其他站点，禁止导入当前站点")`（D5）。
- 通过后从存储 Map/JSON 中**移除 `meta` 再校验与落库**（meta 永不入库、不污染公开配置与页面渲染）。
- 影响面：设计器「保存」按钮路径当前不带 `meta`。为保持「保存」可用且不被新规则误拦，由前端在保存时统一补上 `meta.entry = 当前entry`（见下），后端据此校验；导入与保存走同一强约束。
  - 前端 `save()` 的 `updateLoginConfig` 调用：提交前附加 `meta.entry`（不写回 localConfig、不入导出基线以外的地方——实际导出 meta 已存在；保存时在请求体临时附加）。
  - 不新增 SQL：`apms_login_config.config_json` 仍只存纯配置；历史行无 meta，不经过 PUT 即可继续被 GET 读取，不受影响。
- 错误以 400/ServiceException 返回，前端 request 拦截器弹后端 msg；前端本地预判给出同样语义的即时提示。

### 6.3 部署脚本关系澄清

[deploy-uat.sh](file:///Users/limeng/Documents/trae_projects/apms/deploy/deploy-uat.sh)/[deploy.sh](file:///Users/limeng/Documents/trae_projects/apms/deploy/deploy.sh) 的「登录页配置备份/恢复」直接读写数据库行（`config_json`，无 meta），**不经过 HTTP 导入接口**，因此严格来源校验不影响部署恢复链路。

## 7. 改动清单

前端：

1. **新增** `ruoyi-ui/src/views/system/loginConfig/useConfigHistory.js`：分区历史纯逻辑（`pickScope/applyScope`、4 scope 的 nodes/index、**4 个独立 scope 快照 watcher**、`schedulePush/flushPending/clearAllTimers`、undo/redo、`seed`、`beginImportSession(before,after)`、`resetAll`、restoring 屏蔽）。
2. [index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/system/loginConfig/index.vue)：
   - 接入 history（4 watcher + activeTab + 快捷键 + 两个按钮，undo/redo 前 flushPending）；
   - **`switchEntry` 改为先 GET 成功再原子切换**（§6.1b）；`loadData` 失败不改 entry/localConfig/历史；
   - 导入/导出下拉改单按钮（作用当前站）；
   - 导入前置 dirty 拦截、来源严格校验、剥离 meta；PUT 成功后才更新本地并 `beginImportSession`（§6.1）；
   - 保存请求临时附加 `meta.entry`；`loadData` 成功后 `seed` 建基线。
3. 不改 LoginLayoutFields/LoginRenderer/LoginFormFields 等子组件结构（历史对它们透明）。

后端：

4. [ApmsLoginConfigServiceImpl.java](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/ApmsLoginConfigServiceImpl.java)：保存前 meta 来源校验 + 剥离 meta。
5. （可选，不建议新增）错误码沿用通用 ServiceException → 400，不新增枚举。

不改：数据库表/SQL、公开 GET 接口、nginx、部署脚本、JSON 配置字段结构。

## 8. 测试与验收

纯逻辑桩测（Node + esbuild，沿用项目既有方式）：

- scope 提取/写回：改 `colors.accent` 只影响 appearance 子树；undo 后 colors 还原，文案/logo 不变。
- 防抖归并：连续多次写入停顿后只入 1 步；拖拽等价序列 1 步。
- flushPending：写入后未满 500ms 立即 undo，先结算再回退，撤销有效（不会空撤）。
- resetDefault 一次改 4 scope：4 个 watcher 各记 1 节点，互不混入。
- clearAllTimers：seed/beginImportSession 后旧定时器不再触发污染。
- undo/redo 多步、到边界按钮禁用、redo 后再编辑清空 future。
- resetAll：模拟 loadData 后各 scope 单节点、canUndo=false。
- 复制/恢复默认可撤销一步。
- 导入会话（beginImportSession）：仅外观/布局变化时，对应 scope nodes=[前,后]、index=1 且 canUndo/canRedo 正确；未变化 scope 保持单节点、canUndo=false；undo 后该 scope 回到 C0 且其它 scope 不变；PUT 失败时历史完全不被改动。
- 导入校验：缺 meta、meta.entry 非法、跨站、同站 四种输入的判定；dirty=true 时中止。
- 后端：`mvn` 下用现有 headless 风格补 `saveConfig` 单测/或 curl 验证 400（缺 meta / 跨站），同站通过且落库 JSON 不含 meta。

手工验收（UAT）：

- 四页签分别改→各自撤销互不串；刚拖完滑块立刻撤销能立即生效；输入框内 Ctrl+Z 只撤文字；切站历史清空。
- **切换失败**：断网/后端异常时点切展示站，顶栏仍停留业务站、配置仍是业务站、保存仍写业务站（不错站）。
- 业务站有未保存修改时导入被拦；保存后可导入；展示站文件导入业务站被拒；旧文件被拒；导入过程中模拟 PUT 失败：本地草稿/快照/历史均不变、可继续编辑；同站导入成功后，在变化页签可撤销回导入前（保存按钮变亮，不自动改数据库）。
- 保存请求带正确 meta，正常保存不受影响；GET 公开配置中永远无 meta。

构建门禁：`npm run build:prod`、IDE GetDiagnostics 0 错误、`mvn clean package -DskipTests`（后端改动）。

## 9. 风险与回滚

- 风险点：4 个 scope watcher 各自 `JSON.stringify` 快照的开销——配置 < 8KB、仅在变更时序列化 + 500ms 防抖，拖拽高频 pointermove 也只 stringify 本 scope 子串，实测无压力；低端机若卡顿再改 rAF 合帧。
- 风险点：页签归属漏字段导致某处改动不可撤销——以「配置默认值叶子全集 vs scope 归属表」做一次自动 diff 校验纳入桩测，保证每个可编辑叶子都被覆盖。
- 风险点：防抖定时器跨切换/导入串扰——由 `clearAllTimers()` + undo/redo 前 `flushPending()` 双重收口（已列为桩测项）。
- 风险点：切换/导入时序竞态——统一「请求成功后才原子切换/落库成功后才替换历史」，失败保持原状（已列手工验收）。
- 回滚：纯前后端增量，回退这几个文件即可；数据库与配置 JSON 无变更，无需 SQL 回滚。

## 10. 实施顺序（建议一次评审通过后按序执行）

1. **switchEntry/loadData 先成功后切换**（独立小改，先消除错站风险，不依赖历史模块）。
2. 后端 meta 来源校验 + 前端保存/导入同步改造（打通强约束）。
3. `useConfigHistory` 纯逻辑（4 watcher/防抖结算/seed/beginImportSession）+ 桩测。
4. index.vue 接入历史 UI/快捷键；导入接入「PUT 成功后 beginImportSession」序列。
5. 构建/桩测/UAT 验收。
