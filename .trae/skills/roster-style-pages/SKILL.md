---
name: roster-style-pages
description: Reconstruct APMS ruoyi-ui (Vue3 + Element Plus) management list pages and record detail pages into the roster 花名册 style via roster-kit.scss. Use when the user asks to 按花名册风格重构/改造/美化 a 管理/列表/详情 page such as 菜单/岗位/字典/参数管理 or 运动员详情. Do not use for backend changes or new feature pages.
---

# 花名册风格列表页 / 详情页 / 看板页改造

把 RuoYi 原生 `app-container + el-form 查询 + el-row 按钮 + el-table + pagination` 的管理页、`el-tabs + el-descriptions + el-table` 的记录详情页，或「KPI 卡 + ECharts」的数据看板页，改造为 APMS demo「花名册」视觉。**纯前端改造，零后端改动。**

## 改造前必读（每次都要核对）

1. **样式包**：[roster-kit.scss](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/assets/styles/roster-kit.scss)，scoped style 内 `@use "../../../assets/styles/roster-kit.scss" as *;`（页面在 `src/views/<三级目录>/index.vue` 时是三级；路径层级按实际文件调整）。不要在页面里重造同名 token/class。
2. **标杆范例**（改前先读对应模式的页面，不要凭记忆写）：
   - 普通分页列表（全宽）：`src/views/system/role/index.vue`
   - 普通分页列表（左树双栏）：`src/views/system/user/index.vue`
   - 树形列表（保留 el-table）：`src/views/system/dept/index.vue`
   - 记录详情页（ProfileHeader + 多 Tab + 预警横幅）：`src/views/apms/athlete/detail.vue`
   - 数据看板页（KPI 带 + 2×2 ECharts + 汇总表）：`src/views/apms/dashboard/index.vue`
   - KPI 业务列表页（is-4 KPI 带 + 全量本地过滤 rk-table + 业务弹窗）：`src/views/apms/phv/index.vue`、`src/views/apms/bodyMeasure/index.vue`
   - 状态看板页（四列拖看看板 + HTML5 拖拽 confirm 落库 + el-drawer 详情/时间线）：`src/views/apms/rtp/index.vue`
   - 主从双栏页（rk-split-grid + 左服务端分页表/右详情卡 + KPI 带）：`src/views/apms/medical/index.vue`
   - testing 三页：`src/views/apms/testResult/index.vue`（主从 + 尝试子表/值网格/REP 分级条）、`src/views/apms/testTask/index.vue`（主从 + 原生 rk-tabs + 多选 + 5 业务弹窗）、`src/views/apms/comboScore/index.vue`（phv 式全量本地过滤 + 列排序三态 + 整体保留的可打印快照报告弹窗）
   - config 配置三页：`src/views/apms/indicator/index.vue`（主从 + 参考范围卡 + rk-table 评级内联编辑/实时区间校验）、`src/views/apms/testModel/index.vue`（主从 + 规程 banner + 字段表）、`src/views/apms/comboModel/index.vue`（主从 + 公式卡 + 权重平衡条 + 内联权重编辑）
   - 文档型主从页：`src/views/apms/report/index.vue`（主从 + 类型 KPI + 类型渐变 banner + 文件状态条 + 暗色 JSON 快照卡 + 鉴权 blob 下载）
3. 完整读一遍目标页现有 `<script>`，列出必须原样保留的逻辑清单（API、权限指令、字典、弹窗、路由跳转、保护口径），改造后逐条对照。

## 页面骨架

- 根节点仍保留 `class="app-container"`（依赖全局 20px padding），追加页面类（如 `rm-page`/`dm-page`）。
- 顺序：`rk-header`（标题 + `N 个XX` 副标题 + 右侧操作）→ `rk-filter` 筛选卡 → `rk-table-card`（表格 + 可选 `rk-pager`）。弹窗/drawer 保持在根 div 内。
- 全宽页 canvas 底色：页面类 `margin:-20px; padding:40px 16px 36px 40px; min-height:calc(100vh - 84px); background:$rk-canvas;`。**左/上 padding 必须补偿 20px**——侧栏与头部是 fixed 定位，负 margin 会让盒子钻到它们下面，只补 16px 会导致 hero 被遮挡（详见 references/skeletons.md 第 8 节，含几何量测验收）。
- 左树双栏页：不改 margin，仅 `:deep(.tree-sidebar-manage-wrap)` 与 `.tree-sidebar-content/.content-inner` 覆盖底色与 16px padding（参照 user 页）。

## 筛选卡

- 文本用原生 `<input class="rk-input">`、下拉用原生 `<select class="rk-select">`（字典项 `dict.label/dict.value`，首项 `<option value="">全部</option>`）；日期仍用 el-date-picker，外层 `rm-date-field` + deep 收敛 32px/10px 圆角（直接抄范例 CSS）。
- 右侧 `rk-btn-reset`。筛选项变化 300ms 防抖自动查询（watch + `clearTimeout/setTimeout(handleQuery)`）；resetQuery 必须显式清空每个字段，不能依赖 resetForm（原生控件无 ref 校验绑定）。

## 普通列表（role 模式）

- el-table → 原生 `<table class="rk-table">`；复选框、全选/半选/禁选、`openMenuId` 行菜单、自定义分页（PAGE_SIZE=12、页码省略号窗口、空页自动回退一页）整套 script 直接按 role 页复制改字段名。
- 主实体列用 `rk-person`（32/34px 哈希首字头像 `avatarColor()` + 主名/副行）；编码类字段用 `rk-mono` 或 `rk-soft-chip`；状态用可点击 `rk-status-badge`（先翻转行 status 再走原 confirm/API，取消 catch 里回滚）。
- 操作列：可编辑行给「编辑 →」+ ⋮ 菜单（删除/其他次要动作）；内置/保护行给 `rk-dash` 文字。
- 批量按钮只在 `ids.length` 时出现；「修改选中」`:disabled="single"`。删除成功后清空 ids。
- 列宽：窄屏 media query 隐藏次要列（role：≤1280 隐创建时间、≤1080 隐编号）；验证 `scrollWidth <= clientWidth`。

## 树形列表（dept 模式）

- **保留 el-table**（树能力不要手写），用 `class="dm-tree-table"` + `:deep()` 收敛：CSS 变量覆盖 `--el-table-*` 颜色、th 12px 灰字、cell padding、展开箭头配色；整块外面包 `rk-table-card`。
- 名称列自定义 cell：首字方块/圆头像 + 名称 ellipsis；状态用**非按钮** `rk-status-badge`（树表状态通常无行内切换）。
- 内联编辑控件（如 el-input-number 排序）保留，deep 收敛高度圆角；展开/折叠的 `refreshTable + isExpandAll` 重建法保留。
- 无分页；副标题计数递归 walk。

## 记录详情页（athlete 模式）

以 `src/views/apms/athlete/detail.vue` 为标杆。壳层 class 全在 roster-kit.scss「详情壳层」段（`.rk-detail-page/.rk-crumb/.rk-profile(-avatar/-name/-meta)/.rk-mini-stat(s)/.rk-banner/.rk-tabs/.rk-tab(-panel)/.rk-toolbar/.rk-card/-head/-body/.rk-desc-grid/.rk-rtp-panel`）。

- 顺序：`.rk-crumb`（← 列表名 / 记录名，点击回列表）→ `.rk-profile`（72px 头像 + 姓名行：状态徽章/soft-chip + meta 两行 + 右侧 `.rk-mini-stats` 关键指标 + 返回/主操作钮）→ `.rk-banner`（仅 y/r 等预警态渲染）→ `.rk-tabs`（原生按钮 + `v-show` 面板，不要用 el-tabs）→ 各面板内 `.rk-toolbar` + `rk-table`/`rk-card`。
- 头像取色与所属列表页同口径（运动员按年龄组 `GROUP_COLORS`，不要用列表的哈希色）。空值统一显示「—」。
- 多面板数据 `Promise.all` 一次 loadAll；主键以实际 API 为准（运动员是 `athleteId` 不是 id，`Number(route.params.athleteId)`）。
- 详情正确路由以 router/index.js 为准（运动员是 `/apms/athlete/detail/:athleteId`，`/apms/athlete/:id` 会 404）。
- 所有 el-dialog / $modal.confirm / el-dropdown / v-hasPermi 原样保留，只换外壳；新增弹窗打开时若有「带入最新一条值」逻辑必须保留。
- 页面滚动容器是 `.app-main`，验证滚顶/滚底时操作它，`window.scrollTo` 无效；侧栏折叠钮是 SVG，`el.click()` 不存在，用 `dispatchEvent(new MouseEvent('click',{bubbles:true}))`。
- **useDict 字典项字段是 `{label,value,elTagType,elTagClass}`**，没有 `type/listClass` 字段；取色用 `elTagType`。
- 浏览器内 fetch API 时 token 取 **cookie** `document.cookie.match(/Admin-Token=([^;]+)/)`（localStorage 没有），header `Authorization: Bearer <token>`。

## 数据看板页（dashboard 模式）

以 `src/views/apms/dashboard/index.vue` 为标杆。壳层 class 全在 roster-kit.scss「看板壳层（dashboard）」段，**先读该段确认 class 名再写**：`.rk-dash-page`（全幅 canvas 底，margin:-20px + 32/40px padding）→ `.rk-kpi-grid`（6 卡响应式 2/3/6 列）+ `.rk-kpi-card`（顶部 `.rk-kpi-accent` 3px 色条 + `-label/-value/-unit/-chip`）→ `.rk-chips-bar`（队伍分布白条）→ `.rk-chart-grid`（7fr/5fr，<1280px 单列）→ `.rk-chart-card/-head/-title/-sub/-actions/-body/-box(320px 高)/-empty/-foot` → `.rk-progress` + `.rk-progress-bar(tone-ok/warn/risk/gray)`。

- **原页 API 与 4 个图一个不换**：只重写外壳与 option 主题；汇总表 el-table→`rk-table`、el-progress→`rk-progress`、状态→`rk-status-badge`；日期空值「−」；百分比 clamp 0-100（原数据可能 selected>athlete，如 12/5）。
- **ECharts 主题对齐 demo**（chartConsts.ts/theme.ts），页面顶部固定常量直接抄：`C`（brand `#2563EB`/ok `#16A34A`/warn `#D97706`/risk `#DC2626`/violet `#8B5CF6`/cyan/indigo/slate）、`AXIS_LABEL={fontSize:11,color:'#94A3B8'}`、`SPLIT_LINE={lineStyle:{color:'#EEF2F7'}}`、`DARK_TOOLTIP`（`#0F172A` 圆角 10）、`LEGEND_TEXT`；轴 axisLine/axisTick 隐藏、柱圆角、正值/负值用 `echarts.graphic.LinearGradient` 分流配色。
- 雷达 splitNumber 用 5、min/max 按原业务（-2/3）保留；柱状计数轴 `minInterval:1`（消除 alignTicks/小数刻度警告）；只有 3 维度时雷达是三角形，属数据正常。
- 散点图点簇密集时：grid right 留 60px 防轴名/标签裁切，加 `labelLayout:{hideOverlap:true}`，细节靠深色 tooltip 承载。
- **resize 必须用 ResizeObserver 观察每个 chart-box，不要只监听 window resize**——侧栏折叠只改容器不触发 window resize，只听 window 会导致折叠后 canvas 不跟随（本批次实测 bug）。一个 observer observe 全部 box，回调直接 `chart.resize()`（observer 已按帧合批，无需再 rAF 节流）；`onBeforeUnmount` 里 disconnect + 每个 chart.dispose()。
- el-select 保留（如雷达切运动员），外层局部类 + `:deep()` 收敛成 30px/9px 小尺寸，不要为此引第三方控件。

## KPI 业务列表页（phv / bodyMeasure 模式）

业务台账类页面（记录数不大、接口全量返回）：在普通列表外壳之上加一条 4 卡 KPI 带，无分页、纯前端本地过滤。以 `src/views/apms/phv/index.vue`、`src/views/apms/bodyMeasure/index.vue` 为标杆。

- 壳层：`app-container > .rk-dash-page.rk-page.pm-page`（与看板同 canvas 满铺口径）→ `rk-header`（标题 + `N 条记录 · N 名队员 · 一句业务注脚` 副标题 + 右侧主操作按钮，`v-hasPermi` 原样挂在按钮上）→ `.rk-kpi-grid.is-4`（4 卡，≥1100px 四列，修饰已在 roster-kit.scss）→ `rk-filter` → `rk-table-card` 内原生 `rk-table`（**无 rk-pager**）。
- **全量加载 + computed 本地过滤**：原页若就是 `list({}).then(res => rawData = res.data)` 全量口径，保持不变，不要改成分页请求；KPI summary 也是前端 `buildSummary(rawData)` 实时算（总数/去重队员数/均值/偏移分级），不新增后端接口。空值「—」。
- KPI 卡的 `chip` 放业务注脚（如「Mirwald v2014.1」「按 DataScope 隔离」）或派生分级（早熟/晚熟倾向 tone-red/green/warn）；accent 随分级变色时在 computed 里按阈值返回色值。
- 筛选：文本原生 `input.rk-input` 即时 computed 过滤（非 watch 300ms 防抖——本地数组不需要）；重置就一个 `resetFilter` 清空 filters 对象字段。
- **部门树 → 原生 select**：原页用 el-tree-select 或需要按队伍过滤时，递归拍平成 `{deptId,deptName,depth}` 数组，option 文案用**全角空格 `'\u3000'.repeat(depth)` 缩进**（`&nbsp;` 在 option 文本里不可靠）；注意行数据里只有队伍名字符串（`athleteTeam`），过滤时 `flatDepts.find(deptId).deptName === row.athleteTeam` 按名字匹配，不是按 id。首项 `<option :value="null">全部队伍</option>`。
- **业务弹窗 100% 原样**：PHV 式双模式计算弹窗（radio 切 fromMeasure/direct）的运动员联动加载（真实状态名以源码为准，如 `currentAthleteMeasures`）、选择记录回填（fillFromMeasure）、decimalAge/父母身高自动带入、两种提交（`calculate` 用 params、`calculateDirect` 用 data 且补 gender）、结果 alert 预览，全部照抄只换外壳 class；upsert 弹窗的 `editForm` 字段、rules、按钮文案（如「保存」非「确定」）保持原样。
- 表格派生列（腿长=身高−坐高、BMI）保留原计算口径；来源/枚举用 tone-gray 等徽章映射表（SOURCE_META 之）；人列仍用 rk-person + 哈希头像。
- 死代码可删（如无引用的 handleRowClick），拿不准则保留。

## 状态看板页（rtp 模式）

业务状态从表格升级为「按状态分列 + 卡片拖拽流转」。以 `src/views/apms/rtp/index.vue` 为标杆，壳层 class 在 roster-kit.scss「看板」段：`.rk-kanban-grid`（4 列；≤1279px 2 列、≤760px 1 列）→ `.rk-kanban-col.tone-red/amber/green/gray`（列头 `.rk-kanban-head`：dot/title/count 胶囊/hint；体 `.rk-kanban-body`）→ `.rk-kanban-card`（inset 3px 左色边，hover -1px，`-top/-name/-sub/-reason/-limit/-foot`）→ `.rk-kanban-empty`。色调走 CSS 变量 `--rk-tone`，列计数胶囊与列头淡底由 color-mix 生成，不要手写每列颜色。

- 壳层：`app-container > .rk-dash-page.rk-page.xx-page` → rk-header（副标题给操作提示，如「全队 N 人 · 已评估 N 人 · 点击卡片…拖拽更新」）→ `.rk-kpi-grid.is-4`（各状态人数 + 未评估兜底列）→ rk-filter → `.rk-kanban-grid`（列宽由栅格自带，不接 --rk-split-* 变量；那是 split-grid 专用）。
- **全量本地口径**：`Promise.all` 拉状态全量 + 人员全量（pageSize 500）+ 部门树，左连接成 summary（无状态记录归「未评估」列，`r.status||'na'`）；筛选是 computed 即时过滤，不分页不防抖。
- **COLUMNS 常量数组**（key/title/tone/hint）驱动列渲染，`columnList(key)` 分组；禁止写死四套列模板。
- **HTML5 拖拽**（不要引 vuedraggable）：`:draggable="canEdit"`，`canEdit = checkPermi([...])`（从 `@/utils/permission` 导入，与 v-hasPermi 同权限点）；dragstart 存 dragId + `e.dataTransfer.setData`；dragover `preventDefault` + dragOverKey；dragleave 用 `relatedTarget && col.contains(relatedTarget)` 判定防子元素闪烁；drop：同列跳过 → **必须先 `$modal.confirm` 再落库**，取消则什么都不做（不落库不回滚）。
- 拖拽落库载荷与原页快捷操作同口径（如非 g 状态补默认 trainingLimit、清状态走独立 clear 接口）；成功后 msgSuccess + 全量重载；抽屉若正开着同一人则同步刷新其时间线。
- **详情放 el-drawer**（右侧 size 460px，`:with-header="false"` 自绘头部含 Close 图标）：`currentId` ref + `currentAthlete` computed 从全量列表查（loadAll 后自动不陈旧，不要把行对象快照塞抽屉）；内含状态面板（rk-rtp-panel，tone 跟状态，图标 CircleCheck/Warning/CircleClose/QuestionFilled 显式导入）、快捷操作按钮组（当前状态对应的那个按钮隐藏，v-hasPermi 原样）、el-timeline（deep 收敛 node/wrapper/timestamp，from→to 徽章）、危险操作（清除状态）放抽屉底部。
- 原编辑 el-dialog（radio + 条件字段：如非 g 才显示训练限制）、`$prompt` 快捷标记等交互全部保留，看板只是新增入口不替换原接口。
- scoped deep 收敛：el-drawer body padding 0、el-timeline 配色/尺寸；不要全局改。

## 主从双栏页（medical 模式）

左列表 + 右详情同屏联动的台账页。以 `src/views/apms/medical/index.vue` 为标杆，壳层 class 在 roster-kit.scss「主从双栏」段：`.rk-split-grid`（`grid-template-columns: minmax(0,var(--rk-split-l,1fr)) minmax(0,var(--rk-split-r,1fr))`，gap 16px，≤1279px 单列；页面上写 `style="--rk-split-l:11fr;--rk-split-r:13fr"`）。左 `rk-table-card`（rk-table + 服务端分页 rk-pager），右 `rk-card`（选中 banner + 分段详情 + 空态）。

- 壳层同 KPI 业务列表页（header → is-4 KPI → filter → split-grid）。**列表分页时 KPI 要单独发一次只读全量请求**（pageSize 500）前端统计，不新增后端接口；KPI 口径必须与接口逐一核对（总数用 total 而非 rows.length、去重 Set(id)、chip 派生人均值）。
- **服务端分页 vs 本地全量的取舍**：接口本身分页、总数可能 >10 时保留服务端分页（PAGE_SIZE=10 + rk-pager + 删空页回退），筛选用 watch 300ms 防抖；resetQuery 显式清字段 + **filterGuard 标志 + nextTick 防止 watcher 与手动 getList 双重请求**（重置只应产生 getList + loadStats 两个请求）。
- 行点击 `handleRowClick`：先置 `current=row` 立即响应，再异步 getById 拉完整详情覆盖（带「仍选中同一条才覆盖」判定防快速切换闪烁）；选中行 `.is-selected`（brand-50 底 + inset 3px brand 边）。
- 右卡 banner 用前端枚举 META 表驱动（如 TYPE_META：key → color/bg/label，非 useDict 时写死在页面），tone 经 style 传 CSS 变量 `--pm-tone/--pm-bg`；附件卡 `md-file-card`：类型图标 42px（pdf/img/doc/xls/file 五色）、文件名、大小日期 meta、下载/删除文字链；隐私标记 Lock + 「仅授权用户可下载」。
- **list 接口常常不回传子集合**（本项目 medical list 行 `files:null`，只有 getById 带 files）。两个致命点必须查：① 行内附件计数胶囊/KPI 附件统计不能用 `row.files`——loadStats 全量后对每条记录并发 getById 汇总（低频小表可接受，加 seq 防竞态）；② **编辑弹窗回填必须先 getById**，否则提交空数组配合后端「删旧增新」update 会静默清空全部附件（原页遗留数据丢失缺陷）。
- **私有下载端点的正确打开方式**：`window.open(相对路径)` 在 dev 下既缺 `/dev-api` 前缀（只有 /dev-api 走 vite proxy）又无法携带 Bearer，必失败。改为 `fetch(import.meta.env.VITE_APP_BASE_API + url, {headers:{Authorization:'Bearer '+getToken()}})` → blob → 临时 `<a download>` 触发；**若依业务错误是 HTTP 200 + JSON `{code:500,msg}`（如物理文件未落盘），必须检查 `content-type` 是否 application/json，是则 parse 出 msg 弹 msgError，不能把 JSON 错误体当文件下载**。
- 新增/编辑 el-dialog、el-upload（drag + action `/dev-api/common/upload` + Bearer headers + beforeUpload 大小限制 + success/remove 映射）、rules、提交体结构（`{record, files}`，form.id 决定 POST/PUT）全部原样；保存/删附件后 getList + loadStats 双刷。

## 测试业务页（testing 模式：testResult / testTask / comboScore）

medical 主从壳层在测试域的三种变体，标杆三页见上。共性要点：

- **主从 + KPI**：testResult（11/13）、testTask（10/14）均为 header → is-4 KPI → filter → rk-split-grid，左 rk-table-card 服务端分页（PAGE_SIZE 10 + filterGuard/防抖范式同 medical），右 rk-card（banner + 分段 + 空态）。写操作（选为最佳/改状态/登记/删除项）成功后 **getList + loadStats + loadDetail 三刷**，回归实测写路径后必须用 API 核对复原。
- **右详情私有件留在页面 scoped，不进 kit**：testResult 的尝试历史用 rk-table 子表（选中 ★n 绿胶囊 / 备选 #n 灰胶囊、状态 rk-status-badge、「选为最佳」rk-link + selectingId 锁 + confirm）；测试值用页面网格卡（fieldKey+派生 tag/大 mono 值+unit/fieldName，派生卡灰）；REP 四级行（Excellent 绿/Good 橙/Normal 灰/Poor 红，25×repNo% 条）。
- **el-tabs → 原生 rk-tabs/rk-tab**：`activeTab` ref + 按钮 is-active，面板用 `v-show`（别 v-if，切回不丢滚动/状态）；tab 文案带计数小胶囊（页面私有 `.tt-tab-count`）。testTask 右卡顶部还有 5 格等宽摘要条（页面私有 grid，数字按状态着色）。
- **多选删除**：左表首列原生 `<input type="checkbox" class="rk-check">`（td 上 `@click.stop` 防触发行点击），ids 数组 + `multiple` 控制头部 rk-btn-danger disabled；删除成功后清空 ids。**el-progress 换 rk-progress**（`tone-ok` 100% / brand ≥50% / `tone-warn` 更低，百分比文字 mono 放条右侧）。
- **业务 el-dialog 一个都不换**：el-tree-select（目标队伍）、el-switch（必测）、el-input-number、multiple filterable select（批量登记）、el-radio-group、el-alert、弹窗内 el-table（计算预览）原样保留；`v-hasPermi`、rules、`$modal.confirm`、`$alert(dangerouslyUseHTMLString)` 口径不动。
- **全量数组接口的 phv 式页**：comboScore 的 list 返回 `res.data` 数组（非分页 rows），用 `rawList` + computed 做即时 keyword 过滤与三态列排序（'' → desc → asc，表头按钮 ↕/↑↓）；KPI/统计从 computed 派生（保留原页「筛选后统计」语义）。
- **大型只读报告弹窗整体保留**：comboScore 快照报告（880px，头部大分+grade 徽章、T-Score 20~80 映射条形、11 列 el-table 明细、notes、`@media print`）连样式一起搬，el-dialog teleport 到 body 后 scoped data-v 仍生效，`:deep(.component-skip td)` 照旧。
- **本批顺手修的三个历史缺陷（改造时发现原页 bug 要修并在汇报中说明）**：① testTask 把 `reactive({items,members})` 当 ref 用（`detail.value.items.length`/`detail.value.members.map`），导致「添加测试项」默认排序与「批量登记」预选直接抛错——改 `detail.xxx`；② comboScore 模板 `@click="window.print()"` 在 setup 中不可达——加 `printReport(){ window.print() }`；③ 数据语义：combo-model 的 `modelId` 是数字码（4）而非 slug，列表模型 chip 显示 `模型#${m.modelId} · ${normalizationMethod}`，title 放公式长名 `comboModelName`。

## 配置型主从页（config 模式：indicator / testModel / comboModel）

testing 主从壳层在「字典配置」域的三页变体。结构：rk-header（新增 + 批量删除 rk-btn-danger）→ is-4 KPI → 可选 rk-filter（无查询参数的页如 comboModel 直接省略，不要硬加）→ rk-split-grid 10/14。标杆三页见上。

- **KPI 必须 getById 汇总，别信列表行的子集合字段**：这三页 list 行里 `refs/fields/components` 要么是 null 要么不返回（combo-model list 行甚至带 `components: null` 的键，极易误判为有数据）。统一范式：全量 list（pageSize 500）→ `Promise.all(rows.map(x => getX(x.id).then(r=>r.data).catch(()=>null)))` 汇总引用范围数/评级档数/字段数/组成项数/权重平衡（`|Σw−1|≤0.001`），配 statsSeq 防竞态。
- **表头全选复选**：左表首列表头放 `<input type="checkbox" class="rk-check" :checked="allChecked" @change="toggleAll">`（allChecked = 当前页全选），行格 `td.col-check @click.stop`；切换状态/删除后清空 ids。工具栏删除按钮必须 `@click="handleDelete()"` **显式无参调用**——原页写 `@click="handleDelete"` 时 MouseEvent 会被当成 row（原代码 `row ? row.id : ids` 判真后传 undefined）。
- **状态 el-switch 稀疏 PUT 是高频原页坑（本批两页中招）**：APMS 多个 mapper 是**全字段内联 UPDATE（无 `<if>` 判空）**，`updateX({id,status})` 会把 name 等 NOT NULL 列置空直接 SQL 500——即原页开关从来没真正生效过。改造遇到 el-switch/快速状态更新时，先 curl PUT 稀疏体验证后端；失败就显式带齐**列表行全部持久化字段**（indicator 含 code/category/name/unit/dataType/evaluationDirection/collectionMethod/status/version）。
- **内联编辑取消必须有快照**：编辑入口把原始值存入 Map（id → 字段快照），取消 `Object.assign(row, snap)`；comboModel 原页取消直接 `editing=false`，el-input-number 改过的值不会还原（本批修复）。
- **实时校验联动**：indicator 评级区间前端预览（重叠/空洞/min≥max）用 el-alert 原样保留；错误行高亮比对评级名时**大小写不敏感**（数据是 `Normal/Good` 混合大小写，原代码 toUpperCase 后去匹配原文导致红行从未生效）：`issue.toUpperCase().includes('['+level.toUpperCase()+']')`。
- **右卡私有件留在页面 scoped**：indicator 参考范围卡（性别胶囊 M/F/通用色条 + ageGroup chip + 范围 mono + 版本 + rk-table 评级内联编辑 + 「一键三档模板」confirm 批量 addLevel）；testModel 规程卡（📋 + white-space:pre-wrap）+ 必填 ●红/○灰；comboModel 公式渐变卡 + 权重合计条（is-ok 绿/is-err 红随 Σw 实时变色）。评级/分类/方向/归一化全部用 `:deep(.rk-soft-chip.is-xxx)` 自定义色。
- **业务弹窗一个不换**：el-radio-group（方向/组合/状态/必填）、el-input-number（precision/min/max/step）、filterable el-select（comboModel 只列 isCombo==='1' 模型）、textarea、rules、`$modal.confirm/$alert` 口径全部原样；新增弹窗内的默认值计算（字段 sortOrder=max+1、组成项 weight 0.25）保留。
- **所有写操作后 getList + loadStats（+ loadDetail）按影响范围刷新**；评级保存失败读 `err.response.data.msg` 透传后端 IndicatorRefInvalidException 的具体冲突说明。

## 文档型主从页（report 模式：PDF/快照类报告）

config 主从壳层在「报告/产物」域的变体。结构：rk-header（生成主操作）→ is-4 KPI（总数 + 各类型计数，**list 行已带 contentSnapshot 等全字段，类型计数直接全量 list 即可，不用 getById 汇总**）→ 单字段类型筛选（原生 select + 300ms 防抖 + filterGuard）→ rk-split-grid 10/14。左表类型 rk-soft-chip + 主体双行（姓名行 + 性别·队伍副行）；右卡：类型渐变 banner（#id/类型 chip/主体/生成人时间/模板版本）→ 文件状态条（Document 图标 + 文件名 + PDF Ready/No File chip）→ 暗色 JSON 快照卡（`white-space:pre-wrap`，max-height 300 滚动）→ 下载条（无 filePath 给 rk-empty）。

- **私有文件下载端点三件套（medical 之后第二次踩，凡裸 window.open/裸 fetch 下载的原页都要查）**：① 路径必须拼 `import.meta.env.VITE_APP_BASE_API`（dev 下裸 `/apms/...` 不走 vite proxy）；② token 用 `getToken()`（@/utils/auth，Cookie 存储；原页读 `localStorage.getItem('Admin-Token')` 永远为空）；③ 若依业务错误是 **HTTP 200 + JSON `{code:500,msg}`**（如「PDF 文件不存在（可能被清理）」），必须按 `content-type: application/json` 识别后 msgError，不能把错误 JSON 存成 .pdf 交给用户。
- **el-radio 条件表单的两个原页经典坑**：① `genRules` 的 key 必须等于 form-item 的 **prop 名**（athleteId/taskId/deptId），原页写成类型名（INDIVIDUAL/…）导致条件必填从未生效；v-if 隐藏的 form-item 不参与 validate，不用手写动态规则。② submit 必须真的调 `formRef.validate()`（原页 rules 写了却从不校验直接提交）；**打开弹窗时重置表单**——原页各 id 无条件塞进 params，上一次生成的 taskId 会串进下一次单人报告请求。
- **el-tree-select 自动化断言**：EP 下渲染为 el-select，弹层 class 含 `.el-tree-select__popper`，节点是 `.el-select-dropdown__item`（**不是** `.el-tree-node__label`）；el-radio 选项点击用 `.querySelector('input').click()`。
- 写操作（生成/删除）后 getList + loadStats 双刷；真实生成回归验完必须用 DELETE API 清理新建报告并核对 total/id 列表复原。

- **禁用态按钮必须读运行时值，别被「渐变变显眼」误导成新回归**：testResult「CSV 批量导入」改成渐变主 CTA 后用户反馈点不了——根因是原页遗留：`proxy.$checkPermi?.('apms:testResult:add')` ① 本项目 main.js 从未挂载 `$checkPermi` 全局（只有 `$modal/$tab/download/resetForm…`，没有 `$checkPermi/$checkRole`）② `checkPermi`（@/utils/permission）形参要求**数组**（`value instanceof Array`），传字符串恒 false。结果 hasImportPerm 恒 undefined、按钮恒禁用，白底次按钮时不显眼，渐变后才被发现。修法同 rtp：`import { checkPermi } from '@/utils/permission'` + `checkPermi(['apms:xxx:add'])`。**setup 里的程序化权限判断一律 import checkPermi 传数组；模板里只用 v-hasPermi 指令**；排查禁用先读 `el.disabled`/`el.classList.contains('is-disabled')` 与 Vue setupState 实际值取证。

### 自动化回归备忘（长时浏览器会话）

- el-input-number 的 `<input type=number">` 用 browser_type 会报 `selectionEnd` 错误；改用 browser_evaluate 原生 setter：`setter.call(el,'4.55'); el.dispatchEvent(new Event('input',{bubbles:true})); dispatch change; el.blur()`。
- el-dialog 可能整体卡在 `dialog-fade-enter-from/enter-active`（animationend 不回调，按钮 pointer-events 间歇为 none、a11y 快照不暴露按钮）。先去**未改造页**（如 /system/user）复现以确认是浏览器会话降级而非代码问题；功能断言改用 browser_evaluate 读 DOM（弹窗 display:block、表单字段数、校验 `.el-form-item__error`），收尾用路由跳转清场。browser_take_screenshot 同样可能持续超时，不要被它阻塞交付。

## 全局视觉约定

- **全站主题色 #2563EB 的唯一事实源是「登录页配置」的 `colors.accent`**：App.vue watch loginTheme store → `applyGlobalBrand` 把 accent 写入 `--el-color-primary` 及 light/dark 派生色 + `--current-color`（侧栏激活文字）+ settingsStore.theme（tagsView card 模式标签选中色走 `tagActiveStyle` 内联 `background-color: theme`，见 TagsView/index.vue）。所以标签页/侧栏/弹窗主按钮/开关/分页选中全跟随 accent。改品牌色必须三处一致：① 已保存的后端配置（管理端 `PUT /system/login/config`，公开 GET `/login/config` 校验）② `views/login/login.defaults.js` 的 colors.accent/inputFocus（新环境默认）③ `views/system/loginConfig/index.vue` 的 PALETTES「科技蓝（默认）」预设（须与 defaults 逐字段一致；其他预设是可选主题不要动）。历史教训：accent 曾是 #22d3ee（青/天蓝），导致标签选中色与花名册品牌蓝不符；hero 渐变固定写死 #2563EB→#06B6D4 不跟随 accent，所以标签/按钮会与 hero 不同色系——排查「某元素颜色不对」先读运行时 getComputedStyle 与 pinia loginTheme.config.colors.accent 取证，勿猜。
- **整体字体（黑体/宋体）跟随登录页设计器 `typography.fontFamily`**：字体栈唯一事实源是 `utils/theme.js` 的 `FONT_STACKS`（login.utils.js re-export，禁止第二份栈），`applyGlobalBrand` 写 `--app-font-family` + `--el-font-family`；index.scss 的 body 消费 `var(--app-font-family,<heiti 默认栈>)`，且必须有 `button,input,select,textarea{font-family:inherit}`——**EP `.el-button` 基类不声明 font-family，按钮会回退 UA 字体（macOS 为 Arial），只改变量按钮不跟随**（实测 btnFF='Arial' 才发现）。枚举白名单只开放 heiti/songti，mergeWithDefaults 把历史值 system/pingfang/yahei 归一 heiti（设计器 radio 必须始终有选中项）。字体栈必须跨平台命名：黑体 `"Heiti SC","SimHei","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`；宋体 `"Songti SC","STSong","SimSun","NSimSun","Noto Serif CJK SC",serif`（先 mac 后 win，serif/sans 兜底最后，否则 macOS 无 SimSun 会静默回退黑体，观感"没变化"）。设计器用卡片式 radio（每卡示例句内联绑定对应 FONT_STACKS 实时预览），保存链路 mergeWithDefaults→store（App.vue watch 即时 applyGlobalBrand，无需刷新）→PUT。回归读 getComputedStyle 的 fontFamily 取证 body/按钮/输入/下拉/表头五处；等宽类（rk-mono 等）保持 monospace 不受影响。改动用户配置类数据后必须 GET 原值并复原（曾误把用户已选的 songti PUT 成 heiti，发现 before 值后立即复原）。
- **二级/三级菜单图标走数据库 `sys_menu.icon` + SidebarItem 嵌套层渲染**：RuoYi 原版 `SidebarItem.vue` 用 `v-if="!isNest"` 屏蔽了嵌套层图标，但库里菜单（含 APMS）icon 字段本就全配（user/peoples/tree/dict/chart/monitor/documentation…），加图标=改前端两处：①SidebarItem 的 el-menu-item 与 el-sub-menu title 两个分支，isNest 时渲染带 `class="sub-menu-icon"` 的 svg-icon，无 icon 用 `.sub-menu-dot`（6px currentColor 圆点，占位 4+6+13=23px 与图标 15+8 对齐）兜底；②sidebar.scss：`.sub-menu-icon{15px;margin-right:8px}`，并把 EP inline 菜单缩进（公式 20+level*20，二级 40/三级 60）覆盖为二级 30/三级 46（选择器限定 `.sidebar-container .el-menu--inline…`，折叠态弹层 teleported 到 body 不受影响、保持 EP 默认）。svg-icon 是 `fill:currentColor` 1em，图标色自动跟随菜单文字/激活色，深/浅主题零额外配色。改完必须核对菜单引用的每个 icon 名在 `src/assets/icons/svg/` 有同名文件，否则显示空白（实测 2300「登录页设计」icon=skin 但目录缺 skin.svg，放开关后才暴露；补 svg 用 RuoYi-Vue3 仓库的 color.svg 调色板另存为 skin.svg，去掉 DOCTYPE 行否则 IDE 报外部 DTD 校验错；vite-plugin-svg-icons watch 图标目录，新增文件无需重启，可用 `curl localhost:5173/@id/virtual:svg-icons-register | grep icon-xxx` 验证注册）。**同一展开列表内图标不得重复**：改菜单 icon 走数据库 UPDATE + `patches/patch-<apms.version>-<时间戳>.sql` 幂等补丁（WHERE 带旧 icon 值守卫；deploy.sh 按 apms_db_version 自动应用，当前库立即手工执行），曾修 2263 组合体能评分 star→validCode（避开与 2200 顶级 star 重复；rate.svg 本身就是五角星不能当去重替换）、2262 组合模型 build→component（拼图块，避开与 2232 测试模型库 build 重复；补丁同日两项并入同一 patch 文件，deploy 前可随意增补）。核查重复用 `/getRouters` 拉全树按 parent 分组统计 icon（C 与父级 M 在同一展开列表也算重复）。
- **移动端断点约定（roster-kit 内置，新页不要重复造）**：壳层 `.rk-dash-page` 三档 padding——桌面 32/40/36、≤900 平板 28/20/32、≤768 手机 20/14/24（规则在文件 ~987 行，**必须放在 `.rk-dash-page` 基础规则之后**：roster-kit 被各页 scoped `@use`，data-v 选择器同特异性完全靠源码顺序，曾把 768 块加在 835 基础规则前，被 900 块 28/20/32 覆盖失效）；`.rk-detail-page` ≤768 为 18/14/20。≤768 同档还含：`.rk-profile{padding:16px}` + `.rk-profile-main{min-width:0}`（280 固定最小宽在 320px 屏撑破卡片）、`.rk-card-head/body` 14px 内距、`.rk-title` 20px。所有 actions 行（`.rk-header-actions`/`.rk-profile-actions` 及各页 *-header-actions）必须 `flex-wrap:wrap`；多列统计 grid 小屏降 2 列时注意补行分隔（奇/偶项去 border-right、换行项加 border-top），参考 testTask `.tt-summary` 的 640 块。数据表格一律放 `.rk-table-scroll{overflow-x:auto}` 内，窄屏卡片内横滚不算页面溢出。
- **无真机时的移动端测法**：顶层页注入 `position:fixed;width:375px;height:812px` 的**同源 iframe** 指向业务路由——iframe 内 `@media` 按 iframe 宽真实命中（CDP 视口改不了时的可靠替代），逐页读 `contentDocument.documentElement.scrollWidth > contentWindow.innerWidth` 判溢出；iframe 内 Vue app 同样触发 layout 的 <992 mobile 态（抽屉侧栏）。注意同源 iframe 共享 cookie/localStorage：测登录页清 token 前先把值带出 iframe 备份（SPA 跳 /login 会重建 iframe 的 window，备份留在里面会丢），测完恢复；或直接重新走登录接口取 token 写回。
- **hero 主操作按钮必须渐变**（demo `bg-btn-brand` 口径）：`.rk-header-actions .rk-btn-primary` 与 `.rk-profile-actions .rk-btn-primary` 已在 roster-kit 统一定义为 `linear-gradient(90deg,#2563EB,#06B6D4)` + 品牌色投影 `0 4px 12px rgba(37,99,235,.22)`，hover 切 `#3B82F6→#22D3EE` + 加深投影，禁用态保留渐变（`.is-disabled` 去投影，靠 `.rk-btn:disabled` 的 opacity .45）。**卡片/工具栏内的 rk-btn-sm 小按钮保持纯色**（demo 组件按钮是 `bg-primary` 纯色，只有页级主 CTA 渐变）。新增页面时 hero CTA 必须挂 `rk-btn-primary` 且放进 `rk-header-actions`/`rk-profile-actions`，不要在页面 scoped 自造；私有壳层页（如 athlete 花名册的 `.rp-btn-primary`，样式完全自包含、不 @use kit）需按同口径手写并与 kit 值逐字节保持一致（90deg 两色停、hover、投影）。页头没有创建类主操作的页面（如 rtp、dashboard）不要硬加。**hero 按钮只能有一个 Element Plus 图标（`<el-icon><Xxx/></el-icon>` + 文字），禁止图标与 emoji 并用（comboScore「批量计算」曾 Cpu 图标 + 🧮 emoji 双图标）**；全站 hero 渐变回归时逐页读 getComputedStyle 的 backgroundImage（含 hover），必须全部等于 `linear-gradient(90deg, rgb(37,99,235), rgb(6,182,212))` / hover `rgb(59,130,246)→rgb(34,211,238)`，el-button 页要重点查：kit 规则 0,3,0 特异度压过 EP `.el-button--primary:hover/focus` 的 0,2,0，hover 不应闪纯色。**渐变按钮必须 `border:0`（不能保留 1px 透明边框）**：`background` 简写后 `background-origin` 初始 padding-box、`background-clip` 初始 border-box、`background-repeat` 默认 repeat——渐变图像按 padding-box 定位却裁剪铺到 border-box，1px 边框环由**相邻重复平铺块**填充：左缘=上一块末端色（青）、右缘=下一块起点色（蓝），实测像素为左 #02B7D5/右 #2663EB 的反色细线（demo Tailwind preflight `border-width:0`，两盒重合无此问题）。注意把 `background-clip:border-box` 长属性写在 `background` 简写之前会被简写重置（无效修复，曾因此返工一轮）；若要保边框只能显式 `background-origin:border-box`（且长属性必须在简写之后）。全站 `*{box-sizing:inherit}`(border-box)，去边框不改变按钮外尺寸。排查此类"色线"先用 PIL 读截图边缘像素列取色，勿凭猜测改 CSS。

## 红线（违反即返工）

- 不动任何 API 文件、后端、SQL、路由、菜单。
- 弹窗（新增/编辑/导入/数据权限/树勾选）、`v-hasPermi`、`useDict`、`v-loading`、表单 rules、跳转路径全部保留原逻辑；只改列表页外壳。
- 保护口径不能丢：内置角色/账户只读或禁选、自己不能停用自己等（按原 `isReadonlyXxx/checkRowSelectable` 语义搬）。
- 图标从 `@element-plus/icons-vue` 显式导入，不使用字符串 icon。
- 不新建无关文件、不主动写 README/文档。
- `handleCommand` 等原页死代码不必保留；但拿不准是否死代码时保留。

## 完成后的验证（GetDiagnostics 0 错误 + 浏览器实测）

浏览器 `browser_evaluate` 取不到返回值时，用 Image beacon（本地起 `python3 -m http.server`，脚本里 `new Image().src='http://127.0.0.1:9999/p?d='+encodeURIComponent(JSON.stringify(x))`，读 http server 日志解析）。验证完杀掉 server、删日志。

逐项过：
1. 标题/副标题计数、表格无横向溢出（`scrollWidth<=clientWidth`）、底色 `rgb(248,250,255)`、卡 14px 圆角。**hero 不被遮挡**：量 `rk-title` 位置，展开侧栏时 left=220/top=104，折叠侧栏（54px 窄栏）时 left=74。
2. 状态徽章/开关：confirm 文案、确定切换、**取消回滚**；保护行禁用态。
3. 复选：单选、全选、半选 indeterminate、禁选行、批量按钮显隐与 disabled。
4. ⋮ 菜单各项动作与弹窗外点击关闭（`onBeforeUnmount` 移除 document 监听）。
5. 筛选防抖、空状态、重置；左树页还要测节点点击 → chip → × 清除。
6. 新增/修改弹窗打开与数据回填、导入弹窗、抽屉；树表测展开折叠、行内新增下级、根节点无删除。
7. 分页：翻页、禁用态、删空页回退（数据不足 1 页时验证按钮 disabled）。
8. console 无 error。

详情页额外逐项过（参照 athlete/detail 批次 0）：
1. ProfileHeader：头像取色与列表同口径、徽章/soft-chip、meta 空值「—」、mini stat 取最新一条；展开/折叠侧栏均无遮挡（折叠时卡 left=74）。
2. 每个 Tab 面板切换；面板内所有 `rk-table-scroll` 逐面板量 `scrollWidth<=clientWidth`（v-show 隐藏面板量出 0，先切再量）。
3. 预警横幅：找 g/y/r 三种状态的真实记录各验证一条（可 fetch list 筛 rtpStatus），g 不渲染、y amber、r red，原因/限制/复核日期齐全。
4. 每个 el-dialog 打开核对标题/字段/数据预填后取消；每个 $modal.confirm（离开/删除等）核对文案后取消（取消钮选择器用 `.el-message-box__btns button`，不要按文案找）。
5. 需 ≥2 条数据才出现的趋势/图表卡，找数据够的记录验证；下拉计算类入口验证菜单项内容。

看板页额外逐项过（参照 dashboard 批次 1）：
1. KPI：卡数/数值/单位/chip 与接口 summary 逐一核对；chips-bar 队伍分布；图表标题/副标题 5 张卡齐全。
2. 4 个 canvas 全部渲染（ECharts 实例数）；雷达 el-select 切换每名运动员，图随动；汇总表行数/状态徽章/进度条色调（≥80 ok/≥50 brand/≥20 warn/其余 risk）/日期空值「−」。
3. **resize 实测**：展开（200px）与折叠（54px）侧栏两态各量一次 chart-card 宽与 canvas clientWidth——必须相等跟随（折叠后约 +146px）。窗口宽度 1102 时图表卡正确单列堆叠。
4. console 无 error、无 ECharts alignTicks/ElProgress validator 警告。
5. **自动化环境冻结坑**：后台/非前台 guest view 会冻结渲染帧与 rAF——表现为 `browser_take_screenshot` 60s 超时、ECharts 入场动画冻结（canvas 导出时柱子/散点透明，雷达轴正常）、改了 class 但 getBoundingClientRect 返回旧布局（注入/移除一个 `<style>` 强刷样式可解）、`fetch().then` 与 `navigator.sendBeacon` 均不返回。这些都是环境问题不是代码 bug。验证图表最终视觉时：临时给 4 个 setOption 加 `animation:false` → HMR 重载 → canvas.toDataURL 经 GET 发给日志 server（`/img?n=xx&d=<encodeURIComponent(dataURL)>`，单张 URL 控制在 ~40KB 内，超限先离屏 canvas 缩 0.36~0.5 倍或转 jpeg），从日志 base64 解码 PNG 后用 Read 查看 → 验完移除 animation:false 恢复动画（真实浏览器动画是加分项）。

KPI 业务列表页额外逐项过（参照 phv/bodyMeasure 批次 2）：
1. 副标题三段式（N 条记录 · N 名队员 · 业务注脚）；4 张 KPI 与 `buildSummary` 手算口径逐一核对（去重队员用 Set(athleteId)、均值只算非空、toFixed 位数）；派生分级卡的 accent/chip tone 按阈值用真实数据各验证一条。
2. 全量表格无 `scrollWidth>clientWidth`、无分页器；空值单元格「—」；派生列（腿长/BMI）拿计算器核对一条。
3. 筛选即时 computed：关键词命中/无匹配空态/重置恢复；部门 select 缩进层级正确、选项数 = 树节点总数 + 1「全部」，按队伍过滤后每行 athleteTeam 一致，关键词+队伍组合过滤。
4. 业务弹窗：双模式 radio 切换各验一遍；运动员联动数组加载条数、选记录回填字段、decimalAge/父母身高自动带入；提交核对**网络面板实际请求**（URL/方法/params vs data 载荷）与成功后 list 重载。upsert 弹窗验新增默认值（id=null、日期=今天）与编辑回填。
5. **冻结环境弹窗坑**：合成 MouseEvent 对 el-select 下拉不可靠（优先 browser_snapshot 拿 ref 后真实 browser_click）；多个 `$alert/$confirm` 堆叠时合成 click/Escape/Enter 可能全部失效导致弹窗僵死，只能 navigate 刷新——环境问题非页面 bug。此时改读 Vue setupState（`el.__vueParentComponent` 向上找含目标键的实例）+ 网络面板验证逻辑；**真实写接口的回归会落库**（如计算生成重复记录），验完用 DELETE API 清理脏数据并复查 list 条数恢复。
6. 删除 confirm 文案核对；取消回滚路径若因僵死没走完，至少确认文案弹出 + 删除接口本身可用。

状态看板页额外逐项过（参照 rtp 批次 3）：
1. KPI 各状态人数 + 未评估数（=全员数 − 状态记录数）与四列 count/卡片数完全一致；副标题计数同步；列 tone 修饰类与 dot/胶囊配色正确（底色 rgb(248,250,255)）。
2. 队伍 select（flatDepts 选项数 = 树节点 + 1、全角空格缩进）按队名过滤真实生效——重点查原页 `_deptId` 类从未赋值的失效筛选；姓名过滤 + 组合过滤 + 重置恢复。
3. 点卡片开抽屉：状态面板 tone/图标随状态、快捷按钮按当前状态隐藏同态项、时间线条数与 from→to 徽章、清除按钮仅 status 非空时出现；编辑弹窗 radio 选中态与条件字段（如非 g 才显示训练限制）回填正确。
4. **拖拽实测**：用 `browser_drag({sourceRef,targetRef})`（参数名不是 startRef/endRef）；drop 后 confirm 文案核对，先取消一次并查网络面板**无 update/clear 请求**，再拖一次确定——网络面板见 `POST .../update`（载荷 status/trainingLimit 等）或 `/clear/{id}`，列计数即时更新。confirm 框 ref 偶发失效时用 DOM 点击 `.el-message-box__btns` 里文案为「确定」的按钮。
5. **真实写操作必须复原**：禁止 SQL；用 fetch/curl 携带完整原始字段（status/reason/trainingLimit/nextReviewDate）调同一 update 接口复原，再 curl status/list 核对分组计数与该记录字段。变更日志会多出测试条目（无删除日志 API，属可接受痕迹），汇报时说明。

主从双栏页额外逐项过（参照 medical 批次 3）：
1. KPI 与接口口径逐一 curl 核对：total 用服务端 total、分类计数、Set(id) 去重人数、**附件总数**——警惕 list 行子集合为 null 导致永远统计为 0（需并发 getById 汇总）；左表行内附件胶囊与 getById 条数一致。
2. 左表分页/翻页/省略号/删空页回退；筛选 watch 防抖只发 1 个 list 请求；重置只发 getList + loadStats 两个请求（filterGuard 生效），字段真正清空。
3. 点行：选中态高亮（inset brand 边）、右栏 banner tone 色（量 --pm-tone 与左边框 computed color）、附件卡类型图标 class、大小日期 meta、隐私锁；未选时空态。
4. 编辑弹窗：必须先 getById 再回填（附件 el-upload-list 出现既有文件、运动员/类型 el-select 显示选中文本、日期/机构/标题/remark 回填）；**回归时顺手验证附件回填是本批修掉的数据丢失缺陷**。新增弹窗全空 + rules 必填项数核对，均取消不落库。
5. 下载：网络面板见 `/dev-api/.../file/download/{id}` Fetch 且带 Authorization；物理文件缺失时弹后端 msg 错误 toast（200+JSON 识别），不下载错误体。删除附件只验 confirm 文案后取消，查无 DELETE 请求。
6. console 无页面 error（beacon 的 ORB 错误是验证工具噪音，忽略）。

通用编译教训（批次 3）：
- **GetDiagnostics 0 错误 ≠ Vite 编译通过**：模板标签错配（如 `<div>...</span>`）VS Code 诊断可能不报错但 vue compiler 报 "Invalid end tag" 整页白屏（路由动态 import 失败）。交付前必须 `curl "http://localhost:5173/src/views/<page>/index.vue?t=时间戳"`，返回 JS 即 200 通过；返回 Error HTML 时解析其中 `"loc":{"line":N,"column":M}` 精确定位。
- 沙箱里 `nohup ... &` 起的 beacon server 会随 Shell 命令结束被杀，要用 Shell 工具的 `run_in_background` 起 `python3 -m http.server`，日志读 job 输出文件。

## 可复用代码骨架

见 [references/skeletons.md](references/skeletons.md)：头像哈希、分页、多选、行菜单、筛选 watch、el-table 树表 deep 样式块。优先从标杆范例文件直接复制改名，骨架文件只作速查。
