# 领导看板图表配置化 + 跑马灯 + 大屏模式 · 设计方案

> 状态：**方案待评审**
> 日期：2026-09-21
> 范围：APMS 领导看板（`ruoyi-ui/src/views/apms/dashboard/index.vue`，路由「总览看板」）
> 技术栈：RuoYi-Vue 3.9.2 / Spring Boot / MyBatis（XML）/ Vue3 + Vite + Element Plus + Pinia + **ECharts 5.6.0**
>
> **已确认的需求方向**
> 1. 先出详细方案文档，评审通过后按阶段实施
> 2. 图表视觉可配（参照登录页设计器 `apms_login_config` 的成熟模式）
> 3. 跑马灯/轮播四种形态全要：**①雷达图自动轮播运动员 ②TOP 排名图表滚动 ③任务图表滚动 ④任务表格无缝上滚**
> 4. 增加**整屏大屏模式**（适合挂领导办公室屏幕自动播放）

---

## 一、目标与范围

### 要解决的问题

当前看板 4 个 ECharts 图表全部为**硬编码 option + 固定 320px 高度 + 固定字号**，数据量/名字长度变化即出现字符重叠：

| 图表 | 重叠现象 | 根因 |
|------|---------|------|
| PHV 成熟度散点 | **队员名字互相叠压（最严重）** | 每点强制显示名字，未开碰撞规避；同龄队员点天然聚集 |
| 指标雷达 | 维度多时轴名 `Ind#12up` 相邻挤压；顶点数值标签互叠 | 维度数量不固定，字号固定；全部顶点强制显示数值 |
| TOP10 排名 | 长名字截断、与柱体区挤压 | `grid.left=140` 写死，不随文字宽度计算 |
| 任务完成率 | 任务多时 x 轴标签 rotate 20° 仍挤 | 标签策略单一，无分页/滚动 |

### 纳入范围

1. **图表视觉配置化**：标题、配色、字号、图例位置、数据标签开关、坐标轴名、grid 边距
2. **卡片布局配置化**：卡片显隐、栅格占比、顺序、图表高度
3. **跑马灯/自动轮播**：上述四种形态，统一支持 hover 暂停、标签页不可见暂停
4. **大屏模式**：一键全屏、深色底、等比缩放、无操作自动进入（可选）、统一播放节奏

### 不纳入范围（明确边界）

- **数据字段映射不开放配置**（哪个字段进哪个轴由代码固定），避免业务用户配出坏图
- 看板聚合口径、`/apms/dashboard/overview` 接口数据结构不变
- 不做多页面轮播大屏（多个看板页切换）、不做拖拽式大屏编辑器（后续大屏专项再议）
- 不做配置历史版本/草稿（保存即生效，与登录页设计器一致）

---

## 二、总体架构

完全复刻登录页设计器「**默认值唯一真相源在前端 + 后端只存取 JSON**」模式：

```
apms_dashboard_config (单行单例 config_key='default'，config_json 存整份)
        │
        ├── GET/PUT /system/dashboard/config（需鉴权，看板是登录后页面，不需要匿名接口）
        │
   Pinia(dashboardTheme)：初始即内置默认值
        │  onMounted 拉取 → mergeWithDefaults 深度合并
        ↓
 dashboard/index.vue（渲染卡片网格）
   ├── buildXxxOption(cfg) ×4  ← 配置 → ECharts option 的纯函数
   ├── useAutoPlay(cfg)         ← 跑马灯统一控制（暂停原因/可见性）
   └── useScreenMode(cfg)       ← 大屏模式（全屏/缩放/播放节奏）
```

**关键原则**

1. 默认值只存在于前端 `dashboard.defaults.js` 一处；后端无配置行时返回 `{}`
2. 防重叠不是"补丁"，而是 option 构建器内置的**默认策略**，配置项只用于调整策略参数
3. 跑马灯全部基于 ECharts 官方能力（`dataZoom` + `dispatchAction`）和 DOM/CSS，不引入图表大屏框架（DataV 等），控制依赖体积

---

## 三、配置结构设计（`dashboard.defaults.js`）

新建：`ruoyi-ui/src/views/apms/dashboard/dashboard.defaults.js`

```js
export default {
  version: 1,

  /* ============ 全局主题 ============ */
  theme: {
    followLogin: true,            // true=跟随登录页配色（取 --login-accent 等换算）
    palette: {                    // followLogin=false 时生效
      positive1: '#43e97b', positive2: '#38f9d7',  // 正向柱渐变
      negative1: '#fa709a', negative2: '#fee140',  // 负向柱渐变
      info: '#4facfe',            // 雷达/第二序列
      danger: '#f5576c'           // 散点
    },
    fontSizeBase: 12
  },

  /* ============ 卡片网格布局 ============ */
  layout: {
    chartHeight: 320,             // px；大屏模式按缩放系数换算
    cards: [
      { id: 'ranking', span: 14, visible: true },
      { id: 'phv',     span: 10, visible: true },
      { id: 'radar',   span: 14, visible: true },
      { id: 'task',    span: 10, visible: true }
    ]
    // 渲染按数组顺序；卡片顺序即配置顺序（设置抽屉中可上移/下移）
  },

  charts: {
    /* -------- 左上：组合分排名（横向柱） -------- */
    ranking: {
      title: '组合分 TOP 10 排名',
      topN: 10,                    // 后端返回≤10；滚动模式下作为窗口条数
      showIdSuffix: true,          // 名字后显示 (#运动员ID)
      axisName: '组合分 (sigma)',
      barWidth: '60%',
      showValueLabel: true,
      valuePrecision: 3,
      labelFontSize: 12,
      truncateLen: 12,             // 名字超过该字数截断（轴内省略，tooltip 显示全名）
      grid: { mode: 'auto', right: 44, top: 16, bottom: 28 },
      // mode:'auto'  left 按最长名字像素宽度动态计算；'fixed' 时使用 left 值
      fixedLeft: 140,
      marquee: {
        enabled: false,            // 数据 > windowSize 时才有实际动作
        mode: 'scroll',            // scroll=平滑滚动(dataZoom窗口) | paging=整页切换
        windowSize: 10,            // 一屏显示条数
        step: 1,                   // 每次移动条数（scroll 模式）
        intervalSeconds: 2,        // 每次动作间隔
        pauseOnHover: true,
        loop: true
      }
    },

    /* -------- 右上：PHV 散点 -------- */
    phv: {
      title: 'PHV 成熟度散点图',
      axisXName: '当前年龄 (岁)',
      axisYName: '预测 PHV (岁)',
      symbolSize: 14,
      showNameLabel: true,
      labelFontSize: 10,
      avoidOverlap: true,          // labelLayout 防重叠总开关
      overlapStrategy: 'hide',     // hide=重叠者自动隐藏 | shift=纵向移位避让
      grid: { left: 60, right: 28, top: 36, bottom: 40 }
    },

    /* -------- 左下：指标雷达 -------- */
    radar: {
      title: '指标雷达（z_score 归一化）',
      axisLabelMode: 'id',         // id=Ind#12↑ | code=指标编码
      showUpDownTag: true,         // 名称后加 ↑/↓/- 方向标
      showValueLabel: false,       // 默认关闭顶点数值（重要重叠源；需要时可开）
      valuePrecision: 2,
      max: 3, min: -2, splitNumber: 4,
      areaOpacity: 0.4,
      autoShrinkLabel: true,       // 维度>6 时轴名字号自动缩小并收窄 radius
      marquee: {
        enabled: false,
        intervalSeconds: 5,        // 每 N 秒切换一名运动员
        pauseOnHover: true,
        manualHoldSeconds: 10      // 手动下拉选人后暂停时长，到点恢复轮播
      }
    },

    /* -------- 右下：任务完成率（分组柱） -------- */
    task: {
      title: '测试任务完成率',
      labelMode: 'rotate',         // rotate=倾斜 | truncate=截断省略
      truncateLen: 11,
      rotate: 20,
      labelFontSize: 10,
      legendTop: 4,
      seriesSelectedName: '选入',
      seriesTotalName: '参与队员',
      grid: { left: 30, right: 18, top: 40, bottom: 60 },
      marquee: {
        enabled: false,
        mode: 'scroll',
        windowSize: 8,
        step: 1,
        intervalSeconds: 2,
        pauseOnHover: true,
        loop: true
      }
    }
  },

  /* ============ 任务表格（无缝上滚） ============ */
  taskTable: {
    visible: true,
    title: '最近测试任务',
    maxHeight: 220,
    marquee: {
      enabled: false,
      speed: 30,                   // px/秒，匀速
      pauseOnHover: true,
      startDelaySeconds: 2
    }
  },

  /* ============ 大屏模式 ============ */
  screen: {
    enabled: true,                 // 是否显示「全屏播放」入口
    autoEnter: false,              // 无操作自动进入大屏
    idleSeconds: 120,
    designWidth: 1920,             // 设计稿基准
    designHeight: 1080,
    scaleMode: 'fit',              // fit=等比缩放留黑边 | stretch=拉伸铺满
    background: '#0b1612',
    // 大屏下各跑马灯节奏覆盖（未填则沿用各图表 marquee 配置）
    playOverrides: {
      radarIntervalSeconds: 8,
      rankingIntervalSeconds: 2,
      taskIntervalSeconds: 2,
      tableSpeed: 40
    }
  }
}
```

---

## 四、后端设计

### 4.1 新建配置表（patch SQL）

新建 `patches/patch-0.0.3-<时间戳>.sql`，结构与 `apms_login_config` 完全一致：

```sql
CREATE TABLE IF NOT EXISTS `apms_dashboard_config` (
  `id`           bigint(20)   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `config_key`   varchar(64)  NOT NULL DEFAULT 'default' COMMENT '配置标识（单例=default）',
  `config_name`  varchar(100)           DEFAULT '默认配置',
  `config_json`  longtext     NOT NULL COMMENT '看板配置 JSON',
  `schema_ver`   int(11)      NOT NULL DEFAULT 1,
  `status`       char(1)               DEFAULT '0',
  `create_by`    varchar(64)           DEFAULT '',
  `create_time`  datetime,
  `update_by`    varchar(64)           DEFAULT '',
  `update_time`  datetime,
  `remark`       varchar(500),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='领导看板配置表';
```

同 patch 追加两个权限点的菜单 SQL（挂在「系统管理 → 菜单」下，按钮类型）：
`system:dashboard:query`、``system:dashboard:edit``（参照登录页设计器权限项 `system:loginconfig:*` 的 sys_menu 插入写法，分配给 admin 角色）。

### 4.2 接口（照搬登录页，去掉匿名端）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/system/dashboard/config` | `system:dashboard:query` | 回显原始配置，无行返回 `{}` |
| PUT | `/system/dashboard/config` | `system:dashboard:edit` | 保存整份配置 |

新增文件（命名与登录页一一对应）：

- `ApmsDashboardConfigManageController.java`（放 `ruoyi-admin/.../controller/system/`）
- `ApmsDashboardConfig.java`（domain）
- `IApmsDashboardConfigService` / `ApmsDashboardConfigServiceImpl`（ruoyi-system）
- `ApmsDashboardConfigMapper.java` + `mapper/apms/ApmsDashboardConfigMapper.xml`

### 4.3 服务端校验要点

与登录页一致：**只做形态校验，不补默认值**——枚举（mode/strategy/labelMode/scaleMode）、数值范围（span 1~24、字号 8~30、opacity 0~1、topN 1~50、speed 5~200）、颜色格式、JSON ≤ 64KB。校验不过抛 `ServiceException`，前端按现有全局拦截提示。

---

## 五、前端设计

### 5.1 新增/改动文件清单

| 文件 | 说明 |
|------|------|
| `views/apms/dashboard/dashboard.defaults.js` | 默认配置（第三节） |
| `views/apms/dashboard/dashboard.utils.js` | `cloneDefaults / mergeWithDefaults`、像素测宽、option 构建辅助 |
| `views/apms/dashboard/optionBuilders.js` | `buildRankingOption/buildPhvOption/buildRadarOption/buildTaskOption` 纯函数 |
| `views/apms/dashboard/composables/useAutoPlay.js` | 跑马灯统一控制 |
| `views/apms/dashboard/composables/useScreenMode.js` | 大屏模式 |
| `views/apms/dashboard/components/DashboardSettings.vue` | 「看板设置」抽屉 |
| `views/apms/dashboard/components/AutoScrollTable.vue` | 无缝上滚表格（包裹/替代状态区 el-table） |
| `store/modules/dashboardTheme.js` | store（仿 loginTheme） |
| `api/apms/dashboardConfig.js` | getManaged/update 两个接口 |
| `views/apms/dashboard/index.vue` | 改造为配置驱动（模板结构基本不动） |

### 5.2 Store（仿 loginTheme，无匿名接口）

```js
state: () => ({ config: cloneDefaults(), loading: false })
actions: {
  async loadConfig() { /* GET /system/dashboard/config → mergeWithDefaults */ }
}
```

### 5.3 「看板设置」抽屉交互

看板页右上角两个按钮：**⚙ 看板设置**（权限 query/edit）、**⛶ 全屏播放**。

抽屉按「布局与显隐 / 全局主题 / 四个图表分区 / 表格滚动 / 大屏设置」折叠分组，控件与配置项一一对应；改动即时作用于页面（本地 config 直改），**保存**才 PUT；提供「恢复默认」（仅重置本地，保存后生效）。每个图表分区内含「跑马灯」子开关组。

---

## 六、防重叠默认策略（option 构建器内置）

| 图表 | 默认策略 |
|------|---------|
| **PHV 散点** | series 增加 `labelLayout: { hideOverlap: true }`（ECharts 5.6 原生）；`overlapStrategy:'shift'` 时改为回调 `moveOverlap:'shiftY'`。名字隐藏不影响 tooltip 全名 |
| **雷达** | ① `showValueLabel` 默认 **false**（当前重叠主因）；② 维度 >6 时 axisName 字号 11→10、radius 由 70% 收至 62% 给名称让位；③ 名称统一缩写 `Ind#12↑`（全角箭头 1 字符）；④ 维度 ≥10 时名称改为只在 tooltip/legend 查看（axisName 显示 `#12`） |
| **TOP 排名** | `grid.mode='auto'`：用离屏 canvas `measureText` 计算最长名字宽度，`grid.left = maxWidth + 24`（替代写死 140）；超 `truncateLen` 字截断，y 轴 `axisLabel.formatter` 省略、`axisLabel.tooltip.show` 与图表 tooltip 显示全名 |
| **任务柱图** | `labelMode` 二选一；rotate 模式下类目数 >8 自动加大 bottom 至 72；名称在 tooltip 始终显示全名（当前截断后 tooltip 也是截断值，一并修正） |
| **通用** | 容器用 `ResizeObserver` 触发 `chart.resize()`（替代仅监听 window resize）；宽度 < 卡片阈值时标签字号整体降 1 档 |

---

## 七、跑马灯/轮播详细设计

### 7.1 统一控制：`useAutoPlay`

```js
const { playing, addPauseReason, removePauseReason } = useAutoPlay()
```

- **暂停原因（多原因计数，任一存在即暂停）**：`hover`（鼠标在卡片/表格上）、`hidden`（document.visibilitychange）、`manual`（用户手动操作，如雷达下拉选人）、`screen-exit`
- 各跑马灯独立 timer，但 tick 前统一读 `playing`；组件卸载统一清理
- 大屏模式下通过配置覆盖节奏，不另起一套播放逻辑

### 7.2 雷达图自动轮播运动员

- 每 `intervalSeconds` 将 `radarAthleteId` 按 `radarOptions` 顺序循环切换，复用现有 `watch(radarAthleteId) → renderRadar()`
- 卡片 hover/mouseenter → pause；离开 → resume
- 手动下拉选人 → `manual` 暂停 `manualHoldSeconds` 后恢复（避免"我刚选完人就被切走"）
- 无第二人时不启动

### 7.3 TOP 排名图表滚动

数据 ≤ `windowSize` 时不启动。两种模式：

- **scroll（默认）**：给 ranking option 注入 y 轴 `dataZoom: { type:'inside', yAxisIndex:0, filterMode:'none', zoomLock:true, startValue, endValue }`（隐藏型，不显示滑动条）；每 `intervalSeconds` 用 `chart.dispatchAction({ type:'dataZoom', startValue, endValue })` 将窗口按 `step` 平移，到底回顶（loop）。ECharts 窗口切换自带过渡，视觉即"柱状条纵向跑马灯"
- **paging**：直接替换 `yAxis.data/series.data` 切片，整页切换

注意：滚动时 y 轴名字与柱条同步滚动，不会出现当前的固定标签问题。

### 7.4 任务图表滚动

同 7.3，改为 **x 轴 dataZoom**（`xAxisIndex:0`），窗口大小 `windowSize=8`；tooltip 全名照常。

### 7.5 任务表格无缝上滚（`AutoScrollTable`）

- 数据行渲染后，将表格 body 内容**克隆一份接在后面**（两份等长），容器固定 `maxHeight`、`overflow:hidden`
- `requestAnimationFrame` 按 `speed px/秒` 推进 `translateY`，到达 `-50%`（一份高度）时归零，肉眼无缝循环
- 优先实现方式：在 `AutoScrollTable` 中用普通表格标签复刻 el-table 行样式（脱离 el-table 内部结构，克隆/动画最稳）；不开启 el-table 虚拟滚动
- hover 暂停；未开启跑马灯时保持现有 el-table 原样（组件内两套渲染分支）

---

## 八、大屏模式（`useScreenMode`）

### 进入/退出

- 入口：「⛶ 全屏播放」按钮 → `document.documentElement.requestFullscreen()`；`autoEnter` 时监听全局 mousemove/keydown 做空闲计时
- 退出：浏览器原生 ESC（fullscreenchange 监听）或移动鼠标后出现的「退出大屏」悬浮按钮；退出后恢复普通看板与全部手动交互

### 布局缩放

- 以 `1920×1080` 为设计稿：看板内容包一层固定 `1920×1080` 容器，按视口算 `scale = min(vw/1920, vh/1080)`（fit）并 transform 居中，黑边填 `screen.background`；stretch 模式 x/y 分别缩放
- 好处：大屏下字号/卡片高度/图表高度全部确定，不会因屏幕分辨率重新挤字

### 播放行为

- 进入后自动开启全部已勾选的跑马灯（节奏取 `screen.playOverrides`），雷达轮播、图表滚动、表格上滚并行
- 底部汇总卡保留；顶部在大屏下可隐藏（设置项，默认保留）
- 鼠标静止 3s 自动隐藏光标，移动恢复

---

## 九、分期实施计划

| 阶段 | 内容 | 产出 | 依赖 |
|------|------|------|------|
| **P1 止血** | 四个图表防重叠默认策略 + grid 自适应 + ResizeObserver；option 抽离为 optionBuilders（先用写死配置） | index.vue 改造、optionBuilders.js | 无，可立即做 |
| **P2 配置化基建** | 后端表/接口/权限（patch SQL）；defaults/utils/store/api；DashboardSettings 抽屉；卡片显隐与 span/顺序可配 | 第四、五节全部文件 | P1 |
| **P3 跑马灯** | useAutoPlay + 雷达轮播 → 两个图表 dataZoom 滚动 → AutoScrollTable 无缝上滚；设置抽屉中开放参数 | 第七节 | P2 |
| **P4 大屏模式** | useScreenMode：全屏、1920×1080 缩放容器、自动播放与节奏覆盖、空闲自动进入 | 第八节 | P3 |

P1 与 P2 也可合并为一次提交，但建议**先合 P1 快速解决领导眼前看到的重叠问题**。

## 十、验收标准

**P1**：在当前数据下，PHV 散点名字无叠压（重叠者自动隐藏，hover 点可看全名）；雷达无顶点数值叠字、维度名不相邻重叠；TOP 排名长名字不截断柱体区；任务柱图标签不挤。窗口任意缩放无重叠复现。

**P2**：无配置行时看板与 P1 视觉一致；设置抽屉改动即时预览、保存后刷新页面保持；恢复默认生效；无权限用户看不到设置入口；非法配置被后端拒绝并有提示。

**P3**：四种轮播按配置节奏运行；hover 表格/图表立即暂停、离开恢复；切换浏览器标签暂停、切回恢复；雷达手动选人后按配置暂停再恢复；数据条数不足时对应轮播不启动。

**P4**：一键进入真·浏览器全屏；在 1920×1080 及其他分辨率（含超宽屏）下图表无变形无叠字；ESC/按钮可退出；自动播放与各跑马灯行为正确；`autoEnter` 按空闲时间触发。

## 十一、风险与对策

| 风险 | 对策 |
|------|------|
| `labelLayout` 隐藏名字后用户找不到人 | 散点 hover/点击仍显示全名；`overlapStrategy` 可切 shift |
| dataZoom 窗口与 tooltip/类目过滤冲突 | `filterMode:'none'` 保证被滚出的柱条不参与数值过滤；充分回归 tooltip |
| 表格克隆与 el-table 内部结构耦合 | AutoScrollTable 自渲染行，不依赖 el-table DOM 内部 |
| 大屏 fit 模式黑边观感 | 黑边使用与页面一致的深色背景，视觉为"电视屏"效果 |
| 浏览器全屏 API 兼容 | Chrome/Edge（项目实际使用）均支持；非安全上下文 localhost 也允许 |
| 配置膨胀 | 64KB 上限 + 形态校验；defaults 升级通过 `version` 字段将来做迁移 |
