# APMS 列表页交互统一 实施计划

## 背景与决策（已与用户对齐）

用户审计了花名册、指标库、医疗康复、预警中心、测试任务等页面的六类交互不一致问题。经三路代码实地核查（结论修正了部分体感）与四项决策问答，确定：

1. **表单弹窗**：保持居中 el-dialog（详情仍用右侧抽屉），只统一标题、按钮文案与顺序。
2. **操作列**：行操作 ≤3 个全部平铺文字链（危险操作红色）；>3 个时主操作平铺、其余收 ⋮ 菜单。
3. **空状态**：roster-kit 统一增加灰色线性 SVG 图标。
4. **范围**：全部 APMS 列表页（growth/dispatch/comboDispatch 为纯嵌入壳，随子页自动继承，无需改动）。

## 调查结论（现状事实）

- **搜索**：花名册（250ms）、indicator/medical/testTask/testModel/testResult/report（300ms watch）、phv/bodyMeasure/comboScore（computed 本地即筛）已符合「即搜」。唯一不符：`RtpWarningPanel.vue` 姓名框仅回车触发、下拉勾选 watch 无防抖。
- **弹窗按钮**：roster 批次页面普遍手写「确 定/取 消/保 存/关 闭/返 回/登 记」（字间空格），phv/rtp 系无空格；athlete 新建/编辑弹窗按钮顺序颠倒（确定在左）。确认框标题在 `plugins/modal.js` 硬编码「系统提示」，全站 20+ 处 `$modal.confirm`。
- **操作列**：单字「删」（comboModel 组成项、report）、「改」（testTask 子表）与「删除/编辑」并存；花名册在训 tab 为「查看档案 → + ⋮（编辑/离队）」、离队 tab 为「查看 → + ⋮（编辑/退役/重入队）」；其余页 0~3 个平铺链接。
- **首列**：复选（athlete 在训/indicator/testModel/comboModel，其中 **testTask 有复选无表头全选**）、真序号 #（phv/bodyMeasure/comboScore）、伪序号实为数据库 id（testResult/report）、主体列（medical/warning）并存。
- **分页**：RkPager 组件（athlete/phv/bodyMeasure/comboScore）、页内手写 `.rk-pager`（indicator/testTask/testResult/comboModel/testModel/report，视觉同款）、**RtpWarningPanel 独家用全局 `<pagination>`（el-pagination 外观，唯一明显异类）**。
- **空状态**：结构统一为 rk-empty/rp-empty 两行文字，但无图标；弹窗/抽屉内小空态各自定义（tr-mini-empty/cm-comp-empty/tm-field-empty/re-empty 等）。

## 统一规范（本次落地口径）

| 维度 | 规范 |
|---|---|
| 搜索触发 | 一律「输入/选择即搜」：本地数组用 computed；服务端查询用 watch 300ms 防抖；不设「搜索」按钮，保留「重置」；文本框不额外绑回车（顺手删除冗余 @keyup.enter） |
| 操作列 | ≤3 个：全部平铺 rk-link，危险动作加 is-danger；>3 个：主操作（查看/编辑）平铺，其余收 ⋮；文案统一「查看/编辑/删除」（禁单字「删/改」），花名册长文案按「查看/编辑/离队/退役/重入队」缩短 |
| 确认框 | `$modal.confirm(content, title)` 支持第二参数标题（默认仍「系统提示」，系统管理页零影响）；APMS 所有写操作确认传动作名（如「队员离队」「删除指标」「移出任务」） |
| 表单弹窗 | 保持 el-dialog；标题=功能名（现状已满足）；按钮文案一律**无空格**：取消/确定/保存/关闭/返回/登记；顺序统一**取消在左、主按钮在右** |
| 表格首列 | 有批量操作→复选框（必须有表头全选/半选）；无批量→主体列（人员/名称）打头，去掉装饰性 # 序号列；testResult/report 显示数据库 id 的伪 # 列删除；空态 colspan 同步调整 |
| 分页 | RtpWarningPanel 的全局 `<pagination>` 换成与其他页同款的 rk-pager（优先 RkPager 组件，服务端分页 props 已支持）；其余手写 rk-pager 视觉一致，不做纯代码层收敛（降风险） |
| 空状态 | roster-kit `.rk-empty` 顶部加统一灰色线性 SVG（空盒子图标）；花名册 `.rp-empty` 加同款；弹窗/抽屉小空态套用同一图标（小号）与两行文案结构 |
| 抽屉底栏 | 新增 roster-kit `.rk-drawer-foot` 统一 md-/rt-/rw- 三套私有底栏（左对齐操作区）；分段内的行内操作不下沉到底栏 |

## 修改文件清单

### 基础设施（2 文件）
- `ruoyi-ui/src/plugins/modal.js`：confirm（及 alert/prompt 视便利）第二/第三参支持自定义 title，向后兼容。
- `ruoyi-ui/src/assets/styles/roster-kit.scss`：`.rk-empty` 图标样式（::before 内联 SVG mask）、`.rk-drawer-foot`。

### 批次 1：花名册（2 文件）
- `views/apms/athlete/index.vue`：操作列在训 tab 三动作平铺（缩短文案）、离队 tab 查看/编辑平铺 + ⋮（退役/重入队）；confirm 三处加标题；3 个弹窗按钮去空格、新建/编辑弹窗按钮顺序对调；防抖 250→300；删冗余回车（若有）。
- `views/apms/athlete/components/AthleteDetailPanel.vue`：4 处 confirm 加标题；4 个弹窗按钮去空格；`.rp-empty` 图标。
- AthleteDetailDrawer 如有底栏按钮纳入 `.rk-drawer-foot`。

### 批次 2：预警（2 文件）
- `views/apms/rtpWarning/RtpWarningPanel.vue`：姓名搜索纳入 300ms 防抖 watch（去回车专用逻辑）、下拉/勾选补 300ms 防抖；`<pagination>` → RkPager；2 处 confirm + 2 处 $prompt 标题动作化（prompt 已有标题，核对）；采纳弹窗按钮文案规范。
- `views/apms/rtp/RtpStatusPanel.vue`：弹窗按钮无空格化（已基本符合，核对）；confirm 标题；抽屉底栏换 `.rk-drawer-foot`。

### 批次 3：配置三页（3 文件）
- `views/apms/indicator/index.vue`：弹窗按钮去空格（含参考范围弹窗）；5 处 confirm 标题；操作文案已合规；空态图标。
- `views/apms/testModel/index.vue`：弹窗按钮去空格×2；confirm 标题×2；删文本框冗余回车；「删」→「删除」（字段表）。
- `views/apms/comboModel/index.vue`：弹窗按钮去空格×2；confirm×2 标题；组成项单字「删」→「删除」。

### 批次 4：测试域（5 文件）
- `views/apms/testTask/index.vue`：复选列表头补全选/半选（参照 indicator 范式，当前页语义）；confirm×3 标题；5 个弹窗按钮去空格；子表「改」→「编辑」；分页保持。
- `views/apms/testResult/index.vue`：去伪 id 的 # 列（主体列打头）；confirm 标题；空态图标。
- `views/apms/comboScore/index.vue` + `ComboScoreReport.vue`：去序号 # 列；「关 闭」去空格；confirm 标题。
- `components/ResultEntryDialog/index.vue`：「取 消」「关 闭」去空格；小空态统一；confirm 标题。
- `components/DeviceAccessDialog/index.vue`：「关 闭」去空格。

### 批次 5：台账/医疗（5 文件）
- `views/apms/medical/index.vue`：confirm×2 标题；弹窗按钮去空格；抽屉底栏换 `.rk-drawer-foot`。
- `views/apms/phv/index.vue`：去序号 # 列；两个推导弹窗「关 闭」去空格；confirm 标题。
- `views/apms/bodyMeasure/index.vue` + `components/MeasureCyclePanel.vue` + `components/CycleDetailDialog.vue`（+AthleteMeasureDrawer 视底栏情况）：去序号 #；「取 消/保 存/关 闭/返 回」去空格；confirm 标题。
- `views/apms/report/index.vue`：去伪 id # 列；单字「删」→「删除」；弹窗「取 消」去空格；confirm×2 标题。

## 不做的事（边界）

- 不动 API、后端、SQL、路由、菜单；不改任何业务逻辑（校验规则、写接口、权限指令、保护口径、全量/分页口径）。
- 表单弹窗不转抽屉；详情抽屉不分段改造。
- 手写但视觉同款的 `.rk-pager` 不做组件化收敛（仅 RtpWarningPanel 换可见异类）。
- growth/dispatch/comboDispatch 嵌入壳不改。
- 调查发现 ReadOnlyBlock 对 append-to-body 浮层的遮挡隐患与本次交互规范无关，仅在汇报中提示，不顺带修改。

## 实施顺序与依赖

1. 基础设施先行（modal.js、roster-kit），后续批次直接消费。
2. 批次 1~5 内部页面互相独立，按上述顺序执行；每批改完 GetDiagnostics 0 错误。
3. 全部完成后统一 `npm run build:prod` 一次；页面视觉与交互由用户浏览器验收（遵循不频繁 headless 的偏好）。

## 验证

- 每批：GetDiagnostics 0 错误；去列/改 colspan 后核对空态行宽度。
- 总验：`vite build:prod` 成功；curl 取改动模块编译无 Invalid end tag。
- 用户验收清单：①各页输入即搜/重置；②操作列文案与收纳；③确认框标题动作化；④弹窗按钮无空格、顺序一致；⑤testTask 全选/半选/批量删除；⑥预警页分页样式与其他页一致；⑦空状态图标；⑧窄屏无横向溢出（重点：花名册操作列平铺后左栏宽度，scrollWidth<=clientWidth，必要时缩短文案）。

## 风险与应对

- **花名册左栏宽度**：在训 tab 三动作平铺可能挤宽操作列。先做，窄栏实测；超长则文案缩短为「查看/编辑/离队」并允许该列不折行 + 整表横向滚动兜底。
- **modal.js 全局改动**：默认标题保持「系统提示」，仅新增可选参数，系统管理页行为不变。
- **RtpWarningPanel 换分页**：保持服务端 pageNum/pageSize/回调口径，仅替换组件，删空页回退逻辑对齐。
- **去 # 列**：所有引用该列的 colspan/列宽/索引渲染同步修改；testResult/report 的 id 若被 key 使用则保留数据字段仅删视觉列。
- **弹窗数量多**：只动模板按钮文案与顺序，不碰 form/rules/事件绑定，逐弹窗打开抽查回填。
