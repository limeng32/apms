# 登录页完全可配置化 + 可视化设计器 · 设计方案

> 状态：**方案已评审，待实施（从 M1 开始）**
> 日期：2026-09-20
> 范围：APMS 登录页（`ruoyi-ui/src/views/login.vue`）
> 技术栈：RuoYi-Vue 3.9.2 脚手架 / Spring Boot 4.x / MyBatis（XML + PageHelper）/ Vue3 + Vite + Element Plus + Pinia + SCSS
>
> **已确认的关键决策**
> 1. 存储：**新建独立配置表 `apms_login_config`**（单例配置，不复用 sys_config）
> 2. 布局：**双栏增强 + 居中卡片 + 全屏背景图卡片** 三种模板，并为「首页视频背景」预留字段
> 3. 字体：**仅 5 个固定系统字体栈可选**（system / pingfang / yahei / heiti / songti），不做 webfont 上传，也不提供自定义 font-family 输入——避免"设计器有、客户机器没有字体"的交付不一致
> 4. 版本：**保存即生效 + JSON 导入/导出/恢复默认**（不做草稿/历史版本）
> 5. 图片格式：**logo/背景图仅 jpg/jpeg/png；favicon v1 使用 PNG（不上传 ico）**；复用 `/common/upload` 现有白名单，不修改若依全局上传配置；webp/ico 待将来做登录页专用上传接口
> 6. 配置加载时机：**不在应用启动/路由守卫阶段拉取，不阻塞 `app.mount()`**；Store 初始即内置默认值，仅在进入 `/login` 后由页面 `onMounted` 异步拉取一次，成功则合并更新，失败静默——已登录用户访问首页不会产生该请求
> 7. 默认值唯一真相源：**视觉默认值只存在于前端 `login.defaults.js` 一处**。后端不维护任何默认 JSON——数据库无配置时接口直接返回 `{}`，由前端做 `{}` + 默认值的深度合并；后端只负责存取、`schema_ver`、字段/大小/安全校验。避免两份默认值漂移导致"无数据一个样、保存后另一个样"

---

## 一、目标与范围

把当前 `login.vue` 中**全部硬编码内容**（文案、颜色、字体、图标/图片、布局）抽取为一份 JSON 配置，由管理员通过「设计器」页面可视化编辑、实时预览、保存即生效。

### 纳入配置

- **所有文案**：品牌名、英文副标题、Hero 标题（多行）、描述、特性条（图标+标题+正文，0~6 条）、表单标题/副标题/placeholder/按钮文字、记住我、忘记密码、版权等
- **所有颜色**：品牌背景渐变、accent 强调色、按钮三态（normal/hover/loading）、输入框边框/聚焦色、各级文字色、页面底色
- **字体**：字体族（5 个固定系统字体栈之一）、字号、字重
- **图标与图片**：品牌 logo（内置 SVG 库选择或上传图片）、favicon、品牌区/全屏背景图
- **布局**：模板（双栏 / 居中卡片 / 全屏背景图）、分栏比例、各区块显隐、移动端品牌区显隐、圆角

### 不纳入配置（明确边界）

- 登录逻辑、表单校验、验证码、加密登录流程（代码不变）
- dev 环境的 6 个演示角色快捷登录（仅开发态存在，不进配置）
- 忘记密码的真实业务流程（仅支持配置「弹窗提示文案 / 外链跳转 / 隐藏」三态，不做找回密码功能）

---

## 二、现状调研结论（方案依据）

### 登录页现状

文件：`ruoyi-ui/src/views/login.vue`（高度定制，非若依默认）

- 双栏布局 `.login-wrap { grid-template-columns: 1.1fr 1fr }`，≤900px 隐藏左栏。
- **左栏 `.login-brand`（深绿品牌区，颜色全部硬编码）**：
  - `.lb-head`：内联 SVG 盾牌 logo + `.lb-name`（取 `VITE_APP_TITLE`）+ 英文副标题 `ATHLETE PERFORMANCE MANAGEMENT SYSTEM`
  - `.lb-hero`：h1「为运动员的/每一次成长/建立数据基石」（`.accent` 绿色）、描述段、`.lb-features` 共 4 条（图标 + 加粗小标题 + 说明）
  - `.lb-foot` 版权
- **右栏 `.login-form-side`**：`.lf-title`「欢迎回来」、`.lf-subtitle`、用户名/密码表单、记住我、忘记密码（仅弹提示）、登录按钮、`.lf-roles`（仅 dev 的 6 个演示角色快捷登录）、`.lf-copyright`
- 硬编码主色：`#1d3b33 / #16302a / #27503f`（背景渐变）、`#4aa886`（accent/图标）、`#2f6b57→#3d8a6e`（按钮）、`#e3eae6`（边框）、`#8a9a93`（次要文字）等。**当前未使用任何品牌 CSS 变量**；有 `html.dark` 暗黑覆盖。
- 动态文案仅两处：`title = import.meta.env.VITE_APP_TITLE`、`footerContent = defaultSettings.footerContent`，其余文案全写死。

### 可复用基础设施

- `ruoyi-ui/src/settings.js`：已有 defaultSettings（title、sideTheme、showSettings、footerContent 等）。
- 后端 `sys_config` 参数机制具备 CRUD API 且带 Redis 缓存，但需登录鉴权（**本方案不复用该机制存储**，仅参考其 Controller 写法）。
- `SecurityConfig.java`（约 L103-L108）当前匿名放行：`/login, /register, /captchaImage, /apms/version, /health, /actuator/**` 及 GET 静态资源 `/profile/**`。**登录页是预登录态，读主题必须新增匿名 GET 接口**（仿照已公开的 `/apms/version`）。
- 上传能力：`CommonController.java`（约 L74）`POST /common/upload`、`/common/uploads`（登录后管理员可用），返回 `/profile/...`，而 `/profile/**` 匿名可读 → logo/背景图可在登录页匿名展示。
- **上传白名单事实（已核实）**：`/common/upload` 调用 `FileUploadUtils.upload(filePath, file)`，使用 `MimeTypeUtils.DEFAULT_ALLOWED_EXTENSION`，图片部分仅 `bmp/gif/jpg/jpeg/png`（`IMAGE_EXTENSION` 同样不含 webp/ico）。因此 v1 直接复用该接口，**不能也不需要改全局白名单**。
- `ruoyi-ui/index.html` favicon 固定 `/favicon.ico`、title 为 `%VITE_APP_TITLE%`（换 favicon/标题需运行时动态注入）。

---

## 三、总体架构：配置驱动渲染

核心原则——**只有一份渲染代码**，真实登录页与设计器预览共用，保证所见即所得：

```
apms_login_config (单行单例，config_key='default'，config_json 存整份 JSON)
        │
        ├── 匿名 GET /login/config ──→ 仅进入 /login 后，页面 onMounted 异步拉取
        │                                      │（不阻塞 mount，不经过路由守卫）
        │                                      ↓
        │                          Pinia(loginTheme)：初始即内置默认值
        │                                      │  成功 → 深度合并并响应式更新
        │                                      └  失败 → 静默，保持默认值
        │                                      ↓
        └── 鉴权 GET/PUT /system/login/config ──→ 设计器页面   LoginRenderer.vue
                                                          ↑          ↑
                                              login.vue ──┘          └── 设计器预览（同一组件）
```

三个关键设计：

1. **`LoginRenderer.vue`（新增，纯展示组件）**：接收 `config` 对象，渲染品牌区 + 布局壳 + 视觉样式；登录表单以 `<slot name="form">` 透出，登录逻辑仍留在 `login.vue`。真实登录页和设计器预览都渲染它，杜绝「设计器一套、真实页面一套」。
2. **内置默认配置 `login.defaults.js`（新增）**：把当前页面的全部文案和颜色原样固化为默认值。Pinia Store 创建时即以默认值初始化，LoginRenderer 首帧即用默认配置渲染；配置请求只在登录页 `onMounted` 异步发起，成功后深度合并并响应式更新，任何异常（接口错误、超时、JSON 损坏、字段缺失）都静默保持默认值，**不阻塞应用启动、不白屏、绝不阻断登录**。
3. **CSS 变量主题层**：把现有 SCSS 硬编码色值全部替换为 `var(--login-*)`，由配置动态注入到 Renderer 根节点；Element Plus 按钮/输入框沿用现有 `:deep()` 选择器，仅替换色值为变量。

组件拆分建议：

```
views/login/
├── LoginRenderer.vue        # 纯展示：按 template 选择布局壳，注入 CSS 变量
├── LoginBrandPanel.vue      # 品牌区（head + hero + features + foot），split/fullscreen 复用
├── login.defaults.js        # 内置默认配置（与当前页面像素一致）
├── login.schema.js          # 字段白名单 / 类型 / 长度校验（前端侧）
└── login.utils.js           # 深合并、占位符替换、CSS 变量映射、favicon/title 注入、safeUrl 白名单过滤
```

**实施红线（本方案最重要的决定）**：

- `LoginRenderer` 是登录页视觉的**唯一渲染出口**——真实 `login.vue` 与设计器预览必须渲染同一个组件、传同形态的 config 对象。**严禁设计器另写一套 Preview HTML / 另抄一份模板和样式**，否则两边必然逐渐走样，"所见即所得"失效。
- `login.vue` 只保留登录业务（表单数据、校验、加解密、记住我、`userStore.login`、跳转、dev 角色快捷登录），UI 全部下沉到 `LoginRenderer`；登录表单通过 `<slot name="form">` 注入 Renderer，Renderer 不感知任何登录逻辑。

---

## 四、数据模型：独立配置表

v1 为**单例配置**（单行，`config_key='default'`），独立成表；使用 MyBatis XML，不引入 MyBatis-Plus。

### 建表 DDL（交用户执行，禁止 AI 直接写库）

```sql
CREATE TABLE apms_login_config (
  id           bigint(20)   NOT NULL AUTO_INCREMENT COMMENT '主键',
  config_key   varchar(64)  NOT NULL DEFAULT 'default' COMMENT '配置标识（单例=default，预留多主题）',
  config_name  varchar(100)          DEFAULT '默认配置' COMMENT '配置名称',
  config_json  longtext     NOT NULL COMMENT '登录页配置 JSON（完整配置对象）',
  schema_ver   int(11)      NOT NULL DEFAULT 1 COMMENT '配置结构版本号（用于字段迁移，非历史版本）',
  status       char(1)               DEFAULT '0' COMMENT '状态（0正常 1停用）',
  create_by    varchar(64)           DEFAULT '' COMMENT '创建者',
  create_time  datetime              COMMENT '创建时间',
  update_by    varchar(64)           DEFAULT '' COMMENT '更新者',
  update_time  datetime              COMMENT '更新时间',
  remark       varchar(500)          DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录页页面配置表';
```

说明：

- **不做历史表、不做草稿态**——保存即生效；备份手段为「导出 JSON」。
- JSON 内的 `version` 为**结构版本号**，将来新增字段时前端按它做迁移合并（与表字段 `schema_ver` 对应）。
- **缓存**：单行唯一键查询成本极低、登录页 QPS 不高，v1 **直接查库、不加 Redis**，保存后天然即时生效；将来有性能需要再加缓存（若加，业务缓存须走独立 Redis DB，遵循项目隔离约束）。
- 表中无数据时后端接口返回空对象 `{}`（HTTP 200，**不是 404**）；由前端 `{}` + `login.defaults.js` 深度合并出完整配置。管理员首次保存时 upsert 写入 `default` 行。**不需要种子数据**。

### 后端配套（新增，建议包 `com.ruoyi.web.controller.apms` 或独立模块）

- 实体 `ApmsLoginConfig` + Mapper 接口 + `ApmsLoginConfigMapper.xml` + Service
- Service 职责仅限：
  1. 读取单行配置：有行则原样返回 `config_json`（解析为 JSON 对象），无行则返回 `{}`；
  2. 保存：upsert `default` 行，写入 `schema_ver`、update_by/time；
  3. 校验：JSON ≤64KB、字段白名单、颜色/数字/枚举值格式等安全校验（**只校验形态，不补默认值**）。
- **后端不得内置任何视觉默认 JSON、不做默认值合并**；默认值的唯一真相源是前端 `login.defaults.js`。这样"从未保存"与"保存后"的视觉差异只能来自用户的显式修改，不会出现两份默认值漂移。

---

## 五、配置项清单（JSON 结构草案）

```jsonc
{
  "version": 1,
  "layout": {
    "template": "split",          // split | centered | fullscreen
    "splitRatio": 1.1,            // split 左栏占比（0.8~1.6）
    "showBrandOnMobile": false,   // ≤900px 是否显示品牌区
    "cardRadius": 10              // 输入框/按钮/卡片圆角 px
  },
  "brand": {
    "name": "",                   // 空则回退 VITE_APP_TITLE
    "subTitle": "ATHLETE PERFORMANCE MANAGEMENT SYSTEM",
    "logo": { "type": "builtin", "value": "shield" },  // builtin | image；image 仅 jpg/jpeg/png
    "favicon": null               // null=沿用 /favicon.ico；或 /profile/... 站内路径（PNG）；禁止外链与 javascript:/data:/file:
  },
  "hero": {
    "visible": true,
    "lines": [                    // 多行标题，每行独立控制是否 accent
      { "text": "为运动员的", "accent": false },
      { "text": "每一次成长", "accent": false },
      { "text": "建立数据基石", "accent": true }
    ],
    "description": "覆盖数字档案、生长发育监控、科研测试、RTP 参训状态、医疗附件、组合评价与 PDF 报告的一体化管理平台。",
    "features": {
      "visible": true,
      "items": [                  // 0~6 条，可增删、拖拽排序，图标从内置图标库选
        { "icon": "Check",       "title": "一人一档",   "text": "跨赛季持续数据归集，体态/测试/RTP/医疗全维度" },
        { "icon": "TrendCharts", "title": "Mirwald PHV", "text": "已确认公式可计算，Khamis-Roche 待参数确认" },
        { "icon": "Key",         "title": "数据权限",   "text": "队伍级 DataScope，医疗附件私有存储，独立权限点" },
        { "icon": "Document",    "title": "报告可复现", "text": "算法版本+参考统计量快照，历史分数不漂移" }
      ]
    }
  },
  "form": {
    "title": "欢迎回来",
    "subtitle": "请使用账号登录 {title} 工作台",   // 支持 {title} 占位符
    "usernamePlaceholder": "请输入用户名",
    "passwordPlaceholder": "请输入密码",
    "rememberText": "记住我",
    "buttonText": "登 录",
    "loadingText": "登录中...",
    "forgot": {
      "mode": "alert",            // alert | link | hidden
      "text": "忘记密码？",
      "alertMessage": "请联系管理员重置密码",
      "url": ""                   // 仅 mode=link 时生效；白名单：http(s):// 开头 或 站内相对路径 /xxx；禁止 javascript:/data:/file: 及协议相对地址 //host
    }
  },
  "footer": {
    "brandText": "© {year} {title} · 基于 RuoYi-Vue 3.9.2",  // 左栏底部
    "copyright": "© {year} {title} · {footerContent}",        // 表单侧底部
    "showCopyright": true
  },
  "colors": {
    "brandGradient": { "angle": 150, "stops": ["#16302a", "#1d3b33", "#27503f"] },
    "accent": "#4aa886",
    "textOnBrand": "#ffffff",
    "textOnBrandMuted": "rgba(255,255,255,.7)",
    "pageBg": "#ffffff",
    "formTitle": "#1f2c28",
    "formSubText": "#8a9a93",
    "inputBorder": "#e3eae6",
    "inputFocus": "#4aa886",
    "buttonBg": "#2f6b57",
    "buttonHover": "#3d8a6e",
    "buttonLoading": "#4aa886",
    "link": "#2f6b57"
  },
  "typography": {
    "fontFamily": "system",       // 仅允许枚举：system | pingfang | yahei | heiti | songti（后端枚举校验，无 custom）
    "heroSize": 38,               // px
    "heroWeight": 700,
    "brandNameSize": 22,
    "formTitleSize": 24
  },
  "background": {                 // 主要用于 fullscreen；split 时可作为品牌区背景图叠加
    "type": "image",              // image | video（video 为预留值，v1 不开放编辑）
    "image": null,                // 仅允许 /profile/... 站内路径或 null（仅 jpg/jpeg/png）；禁止外链、javascript:/data:/file:
    "overlay": 0.4,               // 遮罩透明度 0~1
    "video": {                    // 字段先定义，设计器中置灰标注「规划中」，M4 实现
      "url": "",                  // M4 开放时沿用同一白名单原则：仅 /profile/... 站内路径（或明确允许的 http(s) 媒体地址）
      "poster": "",               // M4 开放时：仅 /profile/... 或 null
      "autoplay": true,
      "muted": true,
      "loop": true
    }
  }
}
```

### 占位符规则

- 文本字段支持 `{title}`（品牌名，回退 `VITE_APP_TITLE`）、`{year}`（当前年份）、`{footerContent}`（defaultSettings.footerContent）
- 换行通过 hero `lines` **数组**表达，不接受用户输入 `<br>`
- **所有文案一律文本插值，禁止 v-html**

---

## 六、主题落地机制（CSS 变量）

从现有 SCSS 抽取约 15 个变量，映射到 Renderer 根节点：

| CSS 变量 | 当前硬编码值 | 用途 |
|---|---|---|
| `--login-brand-bg` | `linear-gradient(150deg,#16302a,#1d3b33,#27503f)` | 品牌区背景 |
| `--login-accent` | `#4aa886` | Hero accent、特性图标、输入框聚焦、角色按钮 hover |
| `--login-btn-bg` / `-hover` / `-loading` | `#2f6b57 / #3d8a6e / #4aa886` | Element Plus 主按钮三态 |
| `--login-text-brand` / `-muted` | `#fff / rgba(255,255,255,.7)` | 品牌区主/次文字 |
| `--login-text-1` / `-2` | `#1f2c28 / #8a9a93` | 表单标题 / 次要文字 |
| `--login-border` | `#e3eae6` | 输入框边框、虚线分割 |
| `--login-link` | `#2f6b57` | 忘记密码链接 |
| `--login-page-bg` | `#fff` | 表单区/页面底色 |
| `--login-radius` | `10px` | 圆角 |
| `--login-hero-size` / `--login-brand-size` | `38px / 22px` | 字号 |
| `--login-font-family` | 现有浏览器默认栈 | 全局字体（由 `typography.fontFamily` 枚举映射） |

注入方式：Renderer 根节点 `:style="cssVars"`（JS 把 config 映射成变量键值对，含渐变字符串拼接 `linear-gradient(${angle}deg, ...stops)`）。`html.dark` 暗黑覆盖保留。

### 字体栈定义（5 个固定枚举，前端代码内置）

`typography.fontFamily` 只存枚举值，实际 CSS font-family 字符串由前端按下表映射（每个栈均跨 macOS/Windows 带系统字体兜底，保证不出现缺字回退异常）；**不接受配置传入自定义 font-family**：

| 枚举值 | 设计器显示名 | CSS font-family |
|---|---|---|
| `system` | 系统默认 | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif` |
| `pingfang` | 苹方优先 | `"PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif` |
| `yahei` | 雅黑优先 | `"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, sans-serif` |
| `heiti` | 黑体 | `"Heiti SC", "SimHei", "PingFang SC", "Microsoft YaHei", sans-serif` |
| `songti` | 宋体衬线 | `"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif` |

### favicon / 浏览器标题

拿到配置后通过 util 动态替换 `link[rel="icon"]` 的 href 与 `document.title`（仅登录页生效，离开登录页恢复，不影响全站）。favicon 为 PNG 时设置 `type="image/png"`；未配置则保持 `index.html` 中的 `/favicon.ico` 不动。

---

## 七、三种布局模板与视频预留

`layout.template` 三值共用同一份文案/表单/配色配置，只切换布局壳与背景：

| 模板 | 说明 | 版本 |
|---|---|---|
| `split` | 现有左右双栏；新增分栏比例滑块（grid-template-columns 动态化）、移动端品牌区显隐 | M1/M3 |
| `centered` | 无品牌栏；logo + 表单标题 + 登录卡片整体居中；页面底色/渐变可配 | M3 |
| `fullscreen` | 整屏背景图 + 半透明遮罩 + 浮层登录卡片 | M3（图片） |
| fullscreen + video | 背景为自动播放静音循环 mp4，poster 兜底 | **M4，仅预留字段** |

Renderer 按模板渲染三种布局壳，`LoginBrandPanel` 供 split 复用；M4 加视频时只补一个背景渲染分支（`<video autoplay muted loop playsinline>`），不改配置结构。设计器「图标与图片/背景」分页中视频区块置灰，标注「规划中」。

---

## 八、设计器页面

新增菜单：**系统管理 → 登录页设计**，路由 `/system/login-design`，权限点 `system:loginconfig:edit`。

### 页面结构

- **左侧约 70%：实时预览**。直接渲染 `LoginRenderer`（非 iframe，同组件保证一致），提供「桌面宽度 / 移动宽度（375px）」切换。
- **右侧约 30%：属性面板（el-tabs 分页）**
  1. **文案内容**：各文本输入框（textarea）、区块显隐开关、特性条编辑器（增删、拖拽排序、图标从内置 Element Plus 图标库选择）
  2. **主题色**：el-color-picker + 常用预设色板；品牌背景用「角度 + 多色标（至少 2、至多 4）」渐变构建器
  3. **字体**：字体族下拉，**仅 5 个固定系统栈**（系统默认/苹方优先/雅黑优先/黑体/宋体衬线），无自定义输入框；+ Hero/品牌名/表单标题字号字重。字体栈字符串由前端代码内置（见下表），不接受配置传入原始 font-family
  4. **图标与图片**：logo（内置 SVG 库 or 上传图片）、favicon（PNG）、背景图上传 + 遮罩透明度滑块；上传控件 `accept` 限定 `image/jpeg,image/png`，视频区置灰
  5. **布局**：模板单选卡片、分栏比例滑块、移动端品牌区显隐、圆角
- **顶部操作条**：保存、恢复默认（二次确认）、导入 JSON、导出 JSON；有未保存修改时离开页面给拦截提示（`onBeforeRouteLeave` + beforeunload）。

### 交互原则

- **单一 Renderer**：预览区直接挂 `<LoginRenderer :config="localConfig" />`，不得为设计器单独实现预览模板（见第三节实施红线）。
- **本地草稿态（不落库的草稿）**：进入设计器时把库中正式配置（经前端默认值合并后的完整对象）**拷贝**到本地 `localConfig`；所有编辑只改 `localConfig` 并实时驱动预览；点「保存」PUT 成功后，正式配置才被整体替换。刷新/离开未保存则丢弃草稿。这天然满足"保存即生效"，无需额外的草稿表。
- 导入 JSON 与保存走同一套白名单校验，失败给字段级错误提示。
- 上传复用现有 `POST /common/upload`，图片落 `/profile/`（匿名可读），沿用其后端扩展名白名单与大小校验；**前端 el-upload 显式 `accept="image/jpeg,image/png"` 并做选图拦截**，logo/背景图/favicon 统一只收 jpg/jpeg/png（favicon 建议正方形 PNG，如 64×64/128×128）。
- **不修改** `MimeTypeUtils` / 全局上传白名单；将来确需 webp/ico 时，新增登录页专用上传端点（自定义 `allowedExtension`），不扩大 `/common/upload` 的允许范围。

---

## 九、后端接口

新建 `ApmsLoginConfigController`（不污染 SysConfigController）：

| 接口 | 鉴权 | 说明 |
|---|---|---|
| `GET /login/config` | **匿名放行** | 登录页读取；**原样返回库中 `config_json`；无行则返回 `{}`**（不做默认值合并、不补字段） |
| `GET /system/login/config` | 登录 | 设计器回显（原始 config_json，无行时同样为 `{}`，附 updateTime 等元信息） |
| `PUT /system/login/config` | `system:loginconfig:edit` | 保存（upsert 单行），请求体为完整配置 JSON |

要点：

- `SecurityConfig.java` 白名单增加 `GET /login/config`，**必须按 HTTP 方法精确放行，不得整路径放行**。在 `filterChain` 的 `authorizeHttpRequests` 中新增独立一行（`HttpMethod` 已在该文件导入，可仿照静态资源那行的写法）：

  ```java
  // 登录页配置：仅 GET 匿名可读；写接口仍走鉴权
  .requestMatchers(HttpMethod.GET, "/login/config").permitAll()
  ```

  **禁止**写成 `.requestMatchers("/login/config").permitAll()`——后者会对该路径的所有方法放行，将来若误增 `POST/PUT /login/config` 也会被匿名开放。
  注意：现有 `.requestMatchers("/login", ...)` 是精确路径匹配，不会覆盖 `/login/config`，两者互不影响，无需改动原有行。
- 接口响应为配置 JSON 本体（外层按项目 AjaxResult 约定包裹），内容只有公开视觉字段；管理字段（status/remark/create_by 等）不出现在匿名响应中——保存时即不允许这些字段入库（白名单校验）。
- 后端校验：JSON 大小 ≤64KB、字段白名单（拒绝未知顶层字段或忽略并记录）、颜色/数字/枚举值格式校验；**校验不通过直接报错，绝不静默填默认值**。
- **URL 字段白名单（PUT 保存与 JSON 导入同一套校验，导入不能绕过）**：
  - `form.forgot.url`（`mode=link` 时）：必须满足以下其一，否则保存报错：
    - `http://` 或 `https://` 开头的绝对 URL（解析后 scheme 必须严格为 http/https）；
    - 站内相对路径：以单个 `/` 开头（如 `/help/reset-password`）。
  - `brand.logo`（type=image 时的 value）、`brand.favicon`、`background.image`：只允许 `null` 或以 `/profile/` 开头的站内路径。
  - 一律拒绝（大小写混淆、首尾空白、嵌套编码都要先 trim + 小写比对）：`javascript:`、`data:`、`file:`、`vbscript:` 等非 http(s) scheme；协议相对地址 `//host`（绕不开外链且继承当前 scheme）；包含 `\r\n` 的头注入字符。
  - 建议实现：服务端用白名单前缀/正则判定，不用黑名单枚举 scheme；前端 `login.schema.js` 同步做一遍即时校验并在设计器给出字段级错误，但**前端校验仅为体验，后端是安全边界**。
- 导入功能复用 PUT；导出由前端直接下载文件，无需额外接口。
- 设计器回显约定：设计器拿到 `{}` 或部分字段的配置后，同样在**前端**用 `login.defaults.js` 深度合并再填充表单；保存时提交完整配置对象。

### 加载时序（非阻塞，仅登录页内拉取）

**禁止**在 `main.js` 挂载前 `await`，也**禁止**放进 `permission.js` 全局路由守卫——否则已登录用户每次进系统都白跑一次请求，且接口慢时会平白拖慢甚至挂起整个 Vue 应用。

正确时序：

```
App 正常启动、正常 mount（不 await 任何登录页配置）
        ↓
loginTheme Store 创建时即用 login.defaults.js 初始化
        ↓
进入 /login，LoginRenderer 立即用默认配置渲染（首帧可见）
        ↓
login.vue onMounted → loginThemeStore.loadConfig()（异步、不 await 渲染）
        ↓
成功 → 深度合并默认值 → 响应式更新，页面无刷新换肤
失败/超时 → catch 内什么都不做，继续用默认配置
```

实现约定：

- `loadConfig()` 内部自带短超时（约 3s，`Promise.race` 或 axios `timeout`）且 **catch 全部异常、不弹错误提示、不抛出**；
- **只防并发重复请求，不做"SPA 生命周期只加载一次"的永久已加载标记**：
  - 用瞬时 `loading` 标志阻止同一次挂载内的并发重复 GET（`if (loading.value) return`，`finally` 中复位）；
  - **不要**设置永久 `loaded=true`。否则会出现：登录后管理员在设计器改主题并保存 → 退出重新进入 `/login`，因 `loaded` 仍为 true 而沿用旧配置，使"保存即生效"出现例外。
  - 正确语义：**login.vue 每次挂载 → 请求一次**（进入一次 `/login` 发一次）；不做 TTL 缓存（本项目无短时间反复进出登录页的场景，没有必要）。

  ```js
  // store/modules/loginTheme.js（示意）
  const loading = ref(false)
  async function loadConfig() {
    if (loading.value) return        // 仅防并发
    loading.value = true
    try {
      const data = await fetchLoginConfig()   // GET /login/config
      config.value = mergeWithDefaults(data)  // {} 与默认值深合并
    } catch {
      // 静默：保持当前 config（首帧已是默认值）
    } finally {
      loading.value = false
    }
  }
  ```
- 仅在 `/login` 路由对应的页面组件 `onMounted` 中触发，其他页面与全局守卫零侵入。

---

## 十、安全与健壮性

- 所有文案一律文本插值 / 占位符替换，**禁用 v-html**，杜绝配置型 XSS。
- **URL 字段双层防护**：
  1. 存储层：保存/导入时后端按第九节白名单校验（forgot.url 仅 http(s)/站内路径；图片类仅 `/profile/` 或 null），杜绝 `javascript:`/`data:`/`file:`/协议相对地址入库；
  2. 渲染层：`LoginRenderer` 绑定忘记密码链接时，`mode=link` 才渲染 `<a>`，`:href` 绑定的值再次经前端 `safeUrl()` 过滤（不符合白名单直接不渲染链接、退化为纯文本）；图片字段只用于 `<img :src>`/CSS `url()` 的 `/profile/` 路径，不进入任何可执行上下文。
  - 这样即使数据库被旁路写入脏数据，渲染层仍不产生可点击的 `javascript:` 链接。
- v1 图片上传**只接受 jpg/jpeg/png**（favicon 也用 PNG，浏览器原生支持；不支持 ico、webp）——受限于 `/common/upload` 现有白名单，且不为本功能扩大全局白名单；前端 accept 限制 + 后端白名单双重约束。
- 矢量 logo 走**内置 SVG 图标库**（不开放 SVG 文件上传，避免内嵌脚本风险）；自定义 SVG 上传延至 M4 且必须服务端消毒（白名单标签/属性、禁 script/foreignObject/事件属性）。
- 图片上传沿用现有大小校验；设计器保存做 schema 校验。
- 接口异常、超时、JSON 解析失败、字段缺失 → 全部回退默认值。
- 写接口必须登录 + 权限点；匿名接口仅 GET 且只读。

---

## 十一、数据库变更清单（只产出 SQL，由用户本人执行）

> 遵循项目铁律：AI 绝不直接对 dev/uat/prod 任何库执行写操作（INSERT/UPDATE/DELETE/DDL），以下 SQL 由用户手动执行。

1. **DDL**：创建 `apms_login_config`（见第四节）。
2. **菜单与权限（M2 实施时提供，参考 SQL 形态）**：
   - `sys_menu` 插入 1 个菜单「登录页设计」（挂载于「系统管理」目录下，component `system/loginDesign/index`，perms `system:loginconfig:edit`）
   - 超管角色拥有全部权限，通常无需额外 `sys_role_menu`；如非超管管理员需访问，再给授权 INSERT。
3. **无种子数据**：默认值只在前端 `login.defaults.js`，不插入任何配置行；首次保存自动 upsert 建行。

---

## 十二、文件改动清单（预估）

### 前端新增

- `src/views/login/LoginRenderer.vue`：纯展示渲染器（布局壳 + CSS 变量注入 + slot 表单）
- `src/views/login/LoginBrandPanel.vue`：品牌区面板
- `src/views/login/login.defaults.js`：内置默认配置
- `src/views/login/login.schema.js`：前端字段校验白名单
- `src/views/login/login.utils.js`：深合并 / 占位符 / CSS 变量映射 / favicon 注入
- `src/store/modules/loginTheme.js`：Pinia store
- `src/api/loginConfig.js`：三个接口封装
- `src/views/system/loginDesign/index.vue`：设计器页面（含取色/渐变/图标选择等小控件，可在该目录下拆子组件）

### 前端修改

- `src/views/login.vue`：改为「渲染 LoginRenderer → slot 内保留现有登录表单与逻辑」，并在 `onMounted` 调用 `loginThemeStore.loadConfig()`（fire-and-forget，不 await）；视觉零变化
- `src/main.js`、`src/permission.js`：**不改动**（配置加载不进启动流程、不进全局路由守卫）
- `src/router/index.js`：设计器路由（若不使用动态菜单则需静态登记；本项目走动态菜单，以 sys_menu 为准）

### 后端新增

- `ApmsLoginConfig` 实体、`ApmsLoginConfigMapper`(.java/.xml)、`IApmsLoginConfigService` / Impl
- `ApmsLoginConfigController`（3 个端点）+ 请求/响应 DTO 与校验

### 后端修改

- `SecurityConfig.java`：新增**一行** `.requestMatchers(HttpMethod.GET, "/login/config").permitAll()`（方法精确放行；不动既有白名单行）

### SQL（交用户执行）

- 建表 DDL + 菜单权限 INSERT（M2）；**无种子数据 INSERT**

---

## 十三、分期里程碑

### M1 严格范围（常量配置化，零行为/零视觉变化）

M1 只做一件事：**把现有 `login.vue` 里的硬编码常量搬到配置链路上，其余什么都不动**。

改动链（严格限定 5 步）：

```
现有 login.vue（视觉/逻辑冻结，不重排 DOM、不改样式值）
      ↓ ① 抽 LoginRenderer.vue（仅 split 布局；表单走 slot，登录逻辑原样留在 login.vue）
      ↓ ② 硬编码文案/结构 → login.defaults.js
      ↓ ③ 硬编码颜色/字号 → CSS 变量（变量值由 defaults.js 注入，数值与现状逐一对应）
      ↓ ④ apms_login_config 建表 + 实体/Mapper/Service（无内置默认 JSON，无行返回 {}）
      ↓ ⑤ GET /login/config（匿名 GET 精确放行）+ login.vue onMounted 异步拉取、前端深合并
```

**M1 不做（明确排除，全部后移）：**

- ❌ centered / fullscreen 布局模板（M3）
- ❌ 任何图片/图标上传、logo 更换（M3；M1 沿用现有内联盾牌 SVG）
- ❌ favicon 动态注入、document.title 动态化（M3；M1 保持 `index.html` 的 `/favicon.ico`）
- ❌ 字体族/字号可配（M3；M1 仅把现有字号/字重作为默认值经 CSS 变量输出，值不变）
- ❌ 设计器页面（M2）、分栏比例滑块、区块显隐开关等一切"可编辑"能力
- ❌ 改动 main.js / permission.js、改动登录业务逻辑

**M1 唯一核心验收：数据库无任何配置行时，改造前后登录页肉眼完全一致。**

排错友好性保证：登录逻辑没动、布局 DOM 没动、样式数值没动——出问题只可能出在"常量 → 配置"的搬运环节，范围极小、可逐值比对（建议实施时保留一份改造前截图对照）。

| 阶段 | 内容 | 交付标准 |
|---|---|---|
| **M1 地基（无视觉变化）** | 严格按上方 5 步：建表 SQL（交用户执行）+ 实体/Mapper/Service（无内置默认 JSON，无行返回 `{}`）+ 匿名 GET 精确放行 + defaults.js/Store/深合并 + CSS 变量抽取 + LoginRenderer（仅 split）；仅 login.vue `onMounted` 异步加载 | **空表时改造前后肉眼完全一致**；接口返回 `{}` 页面正常；断网/停接口可正常登录；已登录访问首页无 `/login/config` 请求 |
| **M2 设计器主链路** | 系统管理 → 登录页设计；文案/显隐/主题色/渐变编辑 + 实时预览 + 保存/恢复默认/导入导出 + 菜单权限 SQL | 管理员可自助改文案与配色并立即生效 |
| **M3 字体与多模板** | 字体栈设置、logo/favicon（PNG）/背景图（jpg/png）上传、centered 与 fullscreen（图片）模板、分栏比例 | 三种模板可用，图标图片可换 |
| **M4（将来，可选）** | 视频背景、登录页专用上传端点（webp/ico）、自定义 SVG 上传（服务端消毒）、多主题/历史版本/草稿发布分离 | 按需启动 |

---

## 十四、验收要点（实施后核对）

1. 后端服务正常但 `apms_login_config` 无数据时，`GET /login/config` 返回 `{}`（HTTP 200），登录页经前端默认值合并后与改造前完全一致；后端代码中不存在任何视觉默认值（搜不到重复的颜色/文案常量）。
2. 停掉后端 / 接口超时 / 返回非法 JSON，登录页仍可正常渲染并登录（默认值兜底）；首帧渲染不被该接口阻塞。
3. 已登录用户直接访问首页（`/`）时，Network 中**不存在** `/login/config` 请求；该请求仅在进入 `/login` 后发出，且每次进入只发一次。
4. 管理员在设计器保存新配置后退出登录、重新进入 `/login`（同一 SPA 生命周期内，不刷新浏览器），登录页必须展示新配置并能在 Network 看到一次新的 `/login/config` 请求——验证不存在永久 `loaded` 缓存导致的旧主题残留。
5. 设计器预览与真实登录页在桌面宽、375px 移动宽下视觉一致。
6. 配置中的 `<script>`、HTML 标签原样作为文本显示，不被执行。
7. **URL 白名单**（保存与导入同规则）：
   - `forgot.url` 填 `javascript:alert(1)`（含大小写/前后空白混淆）、`data:text/html,...`、`//evil.com/x` 时，PUT 必须返回校验错误、不入库；`https://x.com` 与 `/help` 可保存；
   - `favicon`/`background.image`/logo 填任意外链 `https://evil.com/a.png` 必须被拒，仅 `/profile/...` 与 null 通过；
   - 即使数据库被旁路写入 `javascript:` URL，登录页渲染出的忘记密码项不是可执行链接（不出现或退化为纯文本），点击无脚本执行。
8. 未登录访问 `PUT /system/login/config` 返回 401；无权限用户访问返回 403。
9. 未登录仅 `GET /login/config` 为 200；对 `/login/config` 发 `POST/PUT/DELETE` 必须返回 401（验证按方法精确放行）。
10. 保存后刷新登录页立即生效；favicon/标题动态替换且不影响登录后全站页面。
11. dev 演示角色快捷登录、记住我、忘记密码弹窗行为不变。
