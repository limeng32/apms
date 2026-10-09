# 数据驾驶舱首页「大屏门面区」改造实施计划

## 一、需求与已确认决策

将数据驾驶舱首页上半部分改造为参考 demo（`.trae/demoapp/app/src/pages/Dashboard.tsx`）的大屏门面区：任务进度、RTP 风险分布饼图、伤病台账摘要、PHV 发育阶段分布、健康预警（替代无数据的 ACWR 负荷预警），全部图表带初始化动画；现有分析图表下移保留；支持深色「大屏模式」一键切换。

已与用户确认的 4 项决策：

1. **负荷预警卡位 → 健康预警卡**：ACWR 训练负荷在真实后端不存在（`.trae/knowledge/roadmap/acwr.md` 标注二期 phase-2），用已上线的 RTP 规则引擎 ACTIVE 预警数据（红/黄/INFO + 预警名单）替代，位置与视觉对齐 demo AcwrCard。
2. **现有图表下移保留**：组合分 TOP10、PHV 散点、指标雷达、任务完成率柱图、最近任务表整体下沉到「详细分析」分隔区，逻辑不动。
3. **大屏模式**：页头新增切换按钮，深色科技风 + 实时时钟 + 球场线纹理（demo `pitch-lines.svg`），默认浅色日常风格。
4. **取数方式**：扩展现有 `GET /apms/dashboard/overview`，单请求返回新增数据块；无表结构变更、无 SQL 补丁。

## 二、仓库调研结论

### 前端现状
- 页面：[dashboard/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/apms/dashboard/index.vue)，已使用 ECharts 5.6.0（全量 import），数据来自 `getOverview()`，已有 `.rk-chart-grid/.rk-chart-card` 等 roster-kit 卡片样式可复用。
- demo 参考：React + recharts + framer-motion，本项目用 Vue3 + ECharts + CSS 关键帧等价实现（不引入新依赖）。
- 关键动画映射：ECharts 内置入场动画（pie expansion / bar grow，可配 `animationDelay` 按 index stagger）；进度条 CSS `transition:width` 挂载后从 0 生长；卡片 CSS keyframes fade-up + `animation-delay` 错峰；KPI 数字自研 ~40 行的 rAF count-up composable；红色脉冲点 CSS ping 动画。

### 后端现状（数据全部真实可得）
| 门面模块 | 数据来源 | 口径 |
|---|---|---|
| RTP 风险饼图 | `ApmsRtpStatusMapper.selectList()`（一人一行当前状态） | green/yellow/red + 未评估(无状态记录)；现有 `/stats` 已有同款判定逻辑可照搬 |
| 本周任务进度 | `ApmsTestTaskMapper` + `ApmsTestResultMapper`（overview 现有逻辑） | 增加「活跃任务」口径：status≠completed 且 [startDate,endDate] 覆盖今天；完成率=有 selected 结果的去重运动员/有结果去重运动员 |
| 伤病台账摘要 | `ApmsMedicalRecordMapper` + `RtpRiskEvaluator.isInjuryClosed(date, own)`（medical 模块 siteStats 已在用） | 活跃=injury/surgery 且未闭环；本月新发=recordDate 在自然月内且未闭环；已康复=近 12 月内已闭环伤病数；部位分布复用 siteStats 同款聚合；最近活跃伤病取停训级最新 3 条 |
| PHV 阶段分布 | `ApmsPhvRecordMapper.selectList()` 的 `maturityOffset` | 按运动员取最新一条后分 4 档（与 demo 一致）：前期 <−1 / 接近期 −1~+0.5 / 高峰后 +0.5~+1.5 / 已越过 >+1.5 |
| 健康预警卡 | `IRtpRiskService.stat(query)` + `selectList(query)`（当日 ACTIVE） | total/warning/attention/infoHealth 计数 + 预警名单前 3 条（enrich 后含 athleteName/team、suggestedLevel、riskScore、触发原因） |

- overview 接口无 `@PreAuthorize`（登录即可访问），已有 `@DataScope(deptAlias="d")` 切在 combo_score 查询上；PHV/任务块现状也是全量统计。新块沿用现状，并把 `query.getParams()` 透传给支持 `${params.dataScope}` 的查询。
- 静态资源：demo `public/pitch-lines.svg` 需拷贝到 `ruoyi-ui/public/`。

## 三、布局规划（对齐 demo 栅格）

```
页头：标题 + [大屏模式切换按钮]（大屏态额外显示青色实时时钟、球场纹理底）
行1  KPI ×5（count-up 动画）：
     在训运动员 │ 本周任务平均完成率 │ 活跃伤病 │ 建议停训(红) │ 建议限制(黄)
行2  [参训风险分布 donut 5/12] [本周测试任务进度 7/12]
行3  [伤病台账摘要 4/12] [PHV 发育阶段分布 4/12] [健康预警 4/12]
───── 详细分析（分隔标题，仅日常浅色态默认展示；大屏态折叠为一个「展开详情」按钮）─────
行4  现有 2×2 图表（组合分排名 / PHV 散点 / 指标雷达 / 任务完成率）
行5  现有最近任务表
```

- 风险饼图：donut 中心显示在训总人数（count-up），第四段灰色=未评估；右侧按队伍堆叠横条（demo 是年龄组，本项目改用真实可得的队伍维度）；底部图例点击跳转 `/apms/rtpWarning`（红/黄）或 `/apms/rtp`。
- 任务进度：每行任务名 + 负责人(testerName) + 进度条生长 + tested/target + 日期窗；点击行跳 `/apms/testTask`。
- 伤病摘要：3 格统计 + 部位横向渐变条（青→红）+ 最近活跃伤病脉冲点列表，跳 `/apms/medical`。
- PHV：4 档紫→绿柱图，底部提示「±1 年窗口内 N 人」（offset 在 [−1,1]），跳 `/apms/growth`。
- 健康预警：红/黄/INFO 三色占比条 + TOP3 预警行（脉冲点、姓名、分值、原因摘要），跳 `/apms/rtpWarning`。

## 四、改动文件清单

### 后端（1 个文件，无 SQL 补丁）
- [ApmsDashboardController.java](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/apms/ApmsDashboardController.java)
  - 新增注入：`ApmsMedicalRecordMapper`、`RtpRiskEvaluator`（`@Component`，ruoyi-system）、`IRtpRiskService`、`ApmsAthleteMapper`（已有）
  - 在 `overview()` 返回体追加 5 个 key（不动现有 key）：
    - `rtpDistribution`: `{ green, yellow, red, none, total, byTeam: [{team,green,yellow,red,none}] }`
    - `activeTasks`: `[{ taskId, taskName, testerName, startDate, endDate, status, tested, target, progress }]` + `weeklyAvgProgress`
    - `injurySummary`: `{ active, newThisMonth, recovered, sites:[{site,active,total}], recent:[{athleteId,athleteName,title,recordDate,bodySite}] }`
    - `phvBands`: `[{key,label,count}]`（4 档，每人取最新 PHV）+ `windowCount`
    - `healthAlerts`: `{ total, warning, attention, infoHealth, list:[{athleteId,athleteName,athleteTeam,level,riskScore,reason}] }`（当日 ACTIVE，红黄优先取前 3）
  - 闭环判定复用 `riskEvaluator.isInjuryClosed`，部位中文映射沿用 medical 前端 code 映射的后端同款 code（bodySite 存的就是 code/名称，直接透传，由前端映射）。

### 前端（新增 7 个文件 + 改 2 个文件 + 1 个静态资源）
- 改 [dashboard/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/apms/dashboard/index.vue)：
  页头加大屏切换（localStorage 记忆偏好）、时钟；KPI 行换 5 张新卡；行2/行3 门面卡栅格；「详细分析」折叠区包住现有图表（现有图表脚本逻辑整体保留，仅把 initCharts 中的卡片在模板上移位并适配深色 option）；统一 `bigScreen` 状态下传各卡。
- 新增 `src/views/apms/dashboard/components/`：
  - `dashTheme.js`：ECharts 浅色/深色两套轴、网格、tooltip 常量（从现页面内联常量提取）
  - `useCountUp.js`：rAF 数字滚动 composable（~40 行，支持 `prefers-reduced-motion` 直接跳终值）
  - `DashRtpDonut.vue`：donut + 队伍堆叠条 + 图例（ECharts，700~900ms 入场、hover 扇区放大）
  - `DashTaskProgress.vue`：任务行 + CSS 进度条错峰生长
  - `DashInjurySummary.vue`：3 统计格 + ECharts 横向渐变柱 + 脉冲列表
  - `DashPhvBands.vue`：4 档柱（`animationDelay: idx*120` 错峰生长）
  - `DashHealthAlert.vue`：三色占比条 + TOP3 预警列表
- 新增静态资源：`ruoyi-ui/public/pitch-lines.svg`（从 demo 拷贝）。
- KPI 卡直接复用 roster-kit `.rk-kpi-card` 结构，不新增组件。
- 深色样式全部作用在 dashboard 根节点的 `.is-bigscreen` 修饰类下（scoped），不污染全局 roster-kit。

## 五、实施步骤（依赖顺序）

1. 后端：在 `overview()` 增补 5 个数据块（先写 rtpDistribution + activeTasks，再写 injurySummary + phvBands，最后 healthAlerts），本地起服务用接口返回值核对口径。
2. 前端基础设施：拷贝 pitch-lines.svg；新增 `dashTheme.js`、`useCountUp.js`。
3. 前端 5 张门面卡组件逐个实现（先静态 + ECharts，再接 props，最后加入场动画与空态）。
4. 重构 dashboard/index.vue：新 KPI 行 + 门面区 + 大屏切换/时钟/纹理 + 「详细分析」折叠区收纳现有图表；现有图表 option 接入深浅双主题。
5. 跳转接线（testTask / medical / growth / rtpWarning / rtp，均为现有路由 path，实施时以 router 配置核对）。

## 六、动画清单（初始化动态效果）

| 元素 | 动画 |
|---|---|
| 全部卡片 | fade-up（opacity 0→1 + translateY 16→0），按行/列 60~80ms 错峰 |
| KPI 数字 / donut 中心总数 | rAF count-up 900ms，easeOut |
| donut | ECharts 默认 expansion 900ms；hover 扇区 scale 1.04 |
| 柱图（部位/PHV/堆叠条） | ECharts grow 700ms，`animationDelay = idx*80~120ms` |
| 任务进度条 | width 0→实际值 700ms easeOut，逐行 delay 80ms |
| 红/预警脉冲点 | CSS ping（scale+opacity 2s 循环），尊重 `prefers-reduced-motion` |
| 大屏切换 | 根节点背景/文字 300ms 交叉淡化；ECharts 以 `notMerge` 重渲深色 option |
| 折叠详情区 | CSS height+opacity 展开（200ms） |

## 七、验证

- 后端：项目根 `mvn clean package` 通过；启动后手动核对 `/apms/dashboard/overview` 新增 5 个 key（**接口由你本人在已启动的 dev 后端上验证**，SQL 不涉及）。
- 前端：dev server 对所有新增/修改模块 curl 转换无 `Transform failed`；GetDiagnostics 0 错误；`npm run build` 通过。
- 页面视觉由你在浏览器验收：浅色/大屏深色两态、空数据态（无 PHV/无伤病/无预警时）、≤1280px 窄屏栅格降级、1920px 大屏效果、卡片跳转路由。
- 不使用无头浏览器做页面验证（遵循既定偏好）。

## 八、风险与处理

1. **DataScope 口径**：新聚合块若 mapper XML 支持 `${params.dataScope}` 则透传 `query.getParams()`；不支持的（如 RTP/PHV）与现有 overview 中 PHV/任务块行为保持一致（全量可见范围按现有接口自身注解决定），不扩大既有权限行为。实施时逐个核对 XML。
2. **闭环判定性能**：`isInjuryClosed` 在内存按运动员分组后调用（同 siteStats 现有做法），500 条记录内无压力；不新增 N+1 SQL。
3. **大屏态 ECharts 重渲**：切换时统一 dispose + 按新主题 init，避免半深半浅；ResizeObserver 沿用现有模式，卸载时 dispose。
4. **数据为空**：5 张卡均需空态文案（donut 全 0 时显示「暂无 RTP 评估」、柱图空轴等），不能出现 NaN/空白崩溃。
5. **healthAlerts 依赖当日扫描**：RTP 快照是定时扫描产出，非扫描日可能无 ACTIVE 数据；卡片显示「今日暂无待处理预警」正常态而非错误态。
6. **改动面控制**：现有 4 个图表的取数/交互（雷达选人等）不改逻辑，只做模板移位与主题参数化；后端只加 key 不改 key。
