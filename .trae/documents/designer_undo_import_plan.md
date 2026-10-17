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
- 暴露：`undo()`、`redo()`、`canUndo/canRedo`（按当前 activeTab）、`pushFromWatch(scope)`（防抖驱动）、`beginImportSession(before, after)`、`resetAll()`。

### 5.2 普通编辑如何成节点（防抖）

- `watch(localConfig, { deep:true })` 监听改动 → 按变化路径判定 scope（一次深层变更只命中一个 scope；色板/上传等同属一个页签）→ 对该 scope 启动 **500ms 防抖**。
- 停顿后成节点：丢弃 `index` 之后的 redo 尾节点（标准 undo 分叉语义），把「编辑后的该 scope 稳定快照」追加到 `nodes`，`index = 末尾`。
- 持续键入、Logo 拖拽的高频 pointermove 仅重置定时器，一次连续操作 = 1 个节点，无需 pointerup 特判。
- 待提交快照与当前节点相同则跳过；undo/redo/loadData 的程序化回填期间用一个 `restoring` 标志屏蔽 watch 成节点，避免空步（比"靠相等性去重"更确定）。

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

#### 导入固定序列（D3，严格按此顺序，任一步失败整体中止且不动历史）

设当前站已保存配置为 `C0`（前置 D7 保证其 == 本地草稿 == 数据库），文件解析并剥离 `meta` 后的配置为 `C1`：

1. **确保保存状态**：再次断言 `dirty === false`（前置已拦，防御性复核），不满足直接中止。
2. **清栈**：`resetAll()` 内部先清空 4 个 scope 的 `nodes/index`。
3. **压入导入前节点**：以 `C0` 对每个 scope 建节点——`nodes[s] = [pickScope(C0, s)]`、`index[s] = 0`。
4. **导入并保存**：`restoring=true` 期间 `updateLoginConfig(C1, entry)` PUT 落库；成功后 `localConfig = mergeWithDefaults(C1 回读/本地合并)`、`savedSnapshot = 当前`（dirty 回 false）。
5. **压入导入后节点**：以导入后配置 `C1'`（回显值）对每个 scope 追加节点——仅当 `pickScope(C1', s)` 与节点0不同才 `push` 并令 `index[s]=1`；相同则该 scope 保持单节点（该页签无变化，撤销按钮禁用）。结束后 `restoring=false`。

语义结果：

- 在「导入确实改变了」的页签，撤销 1 次回到导入前该页签配置；重做回到导入后。无变化的页签撤销按钮本就禁用。
- 撤销只改本地草稿（`dirty=true`），**不自动回写数据库**；用户需再点「保存」才会把回退结果落库——数据库在撤销期间始终是导入后的 C1，安全边界清晰。
- 「从业务站复制/恢复默认」不走本序列（它们不立即落库），仅普通成节点。

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

1. **新增** `ruoyi-ui/src/views/system/loginConfig/useConfigHistory.js`：分区历史纯逻辑（`pickScope/applyScope`、4 scope 的 nodes/index、undo/redo、防抖成节点、`beginImportSession(before,after)`、`resetAll`、restoring 屏蔽）。
2. [index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/system/loginConfig/index.vue)：
   - 接入 history（watch + activeTab + 快捷键 + 两个按钮）；
   - 导入/导出下拉改单按钮（作用当前站）；
   - 导入前置：dirty 拦截、来源严格校验、剥离 meta；通过后执行 §6.1 五步固定序列（含 beginImportSession）；
   - 保存请求临时附加 `meta.entry`；
   - `loadData` 成功后 `resetAll()`。
3. 不改 LoginLayoutFields/LoginRenderer/LoginFormFields 等子组件结构（历史对它们透明）。

后端：

4. [ApmsLoginConfigServiceImpl.java](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/apms/impl/ApmsLoginConfigServiceImpl.java)：保存前 meta 来源校验 + 剥离 meta。
5. （可选，不建议新增）错误码沿用通用 ServiceException → 400，不新增枚举。

不改：数据库表/SQL、公开 GET 接口、nginx、部署脚本、JSON 配置字段结构。

## 8. 测试与验收

纯逻辑桩测（Node + esbuild，沿用项目既有方式）：

- scope 提取/写回：改 `colors.accent` 只影响 appearance 子树；undo 后 colors 还原，文案/logo 不变。
- 防抖归并：连续多次写入停顿后只入 1 步；拖拽等价序列 1 步。
- undo/redo 多步、到边界按钮禁用、redo 后再编辑清空 future。
- resetAll：模拟 loadData 后各 scope 单节点、canUndo=false。
- 复制/恢复默认可撤销一步。
- 导入会话（beginImportSession）：仅外观/布局变化时，对应 scope nodes=[前,后]、index=1 且 canUndo/canRedo 正确；未变化 scope 保持单节点、canUndo=false；undo 后该 scope 回到 C0 且其它 scope 不变；PUT 失败时历史完全不被改动。
- 导入校验：缺 meta、meta.entry 非法、跨站、同站 四种输入的判定；dirty=true 时中止。
- 后端：`mvn` 下用现有 headless 风格补 `saveConfig` 单测/或 curl 验证 400（缺 meta / 跨站），同站通过且落库 JSON 不含 meta。

手工验收（UAT）：

- 四页签分别改→各自撤销互不串；输入框内 Ctrl+Z 只撤文字；切站历史清空。
- 业务站有未保存修改时导入被拦；保存后可导入；展示站文件导入业务站被拒；旧文件被拒；同站文件导入成功并落库后，在发生变化的页签可撤销回导入前（撤销后保存按钮变亮，不自动改数据库）。
- 保存请求带正确 meta，正常保存不受影响；GET 公开配置中永远无 meta。

构建门禁：`npm run build:prod`、IDE GetDiagnostics 0 错误、`mvn clean package -DskipTests`（后端改动）。

## 9. 风险与回滚

- 风险点：deep watch 高频（拖拽）性能——JSON 子树序列化 + 500ms 防抖，配置 < 8KB，实测无压力；上线后若低端机卡顿可再改为 rAF 合帧。
- 风险点：页签归属漏字段导致某处改动不可撤销——以「配置默认值叶子全集 vs scope 归属表」做一次自动 diff 校验纳入桩测，保证每个可编辑叶子都被覆盖。
- 回滚：纯前后端增量，回退这几个文件即可；数据库与配置 JSON 无变更，无需 SQL 回滚。

## 10. 实施顺序（建议一次评审通过后按序执行）

1. 后端 meta 来源校验 + 前端保存/导入同步改造（先打通强约束，避免历史功能在旧导入语义上返工）。
2. `useConfigHistory` 纯逻辑 + 桩测。
3. index.vue 接入历史 UI/快捷键/重置时机。
4. 构建/桩测/UAT 验收。
