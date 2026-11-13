# 同域演示站（/trial/）规划：演示态含 RPA，正式登录保持 Standard

> 状态：规划待评审（未写实现代码）
> 日期：2026-11-13
> 关联文档：edition_split_plan.md（双产品线/双构建架构）、demo_mode_plan.md（一键体验机制）

## 1. 需求与约束

### 1.1 目标

- 生产域名 `aoti.apms.top` 维持现状：真实账号登录后只看到 **standard 版**内容，standard 交付物保持「零 AI 代码」物理隔离；
- 同一域名的**演示环境**中可以体验 RPA 助手等 **ai 版全部内容**；
- 演示进入方式**保持现有「一键体验 + 8888 口令」交互不变**（DemoPassDialog），不做免口令自动进入；
- 演示态仍是纯前端 mock：零真实 HTTP、静态样本数据、刷新还原、退出演示回登录页。

### 1.2 关键约束（已代码取证）

1. standard 构建经 Vite 别名 `@ai → src/ai-stub`，AI 代码**不进产物**，build.sh 另有 grep 零 AI 校验。运行时开关无法让不存在的代码出现，因此不能在 standard 单包内解决；
2. 现有 demo 机制已完整：口令弹窗、demoAdapter 全接管、内存 DB、demo/真实 token 分键隔离；
3. ai 构建的 `features.js` 对 demo 态默认**全插件启用且不发请求**，RPA mock handler 已随 ai 构建注册——演示态 RPA 的前后端链路现成；
4. 后端 `@AiEnabled` 条件装配保证：即使拿到 ai 前端，真实态在 standard 后端下 AI 接口一律 404。**本需求后端零改动、零 SQL**；
5. 路由为 `createWebHistory()`（无参，自动取 Vite `base`），支持子路径部署；
6. 已发现 4 处硬编码根路径跳转，子路径部署必须改造：
   - `layout/components/DemoBanner.vue:57` `location.href='/index'`
   - `layout/components/Navbar.vue:105` `location.href='/index'`
   - `ai/plugins/rpa/assistantClient.js:118` `location.href='/index'`
   - `utils/request.js:98` `location.href='/index'`

## 2. 方案选型

| 方案 | 形态 | 评价 |
|---|---|---|
| **A. 同域路径隔离（采纳）** | `/` 挂 standard dist；`/trial/` 挂第三份 trial dist（ai 代码 + 演示锁定 + base=/trial/） | 主站零改动、零 AI 原则保留、同源免跨域；新增一个构建 mode 与一个 nginx location |
| B. 独立子域名 | trial.apms.top 挂 ai dist | 用户明确要求同域名，不采纳 |
| C. AI 代码合入 standard 包，运行时门控 | 单构建，demo 解锁 | 推翻零 AI 物理隔离、build/部署校验返工、源码可从公网包提取，不采纳 |

最终形态：

```
https://aoti.apms.top/          → dist（standard，现状，真实登录=标准版）
https://aoti.apms.top/trial/    → dist-trial（ai 全量 + 演示锁定，8888 口令进入，含 RPA）
```

## 3. 详细设计

### 3.1 构建体系：新增第三个 Vite mode「trial」

trial 与 ai 的关系：**代码全集相同（VITE_EDITION=ai），差异只在部署 base、输出目录与演示锁定开关**。

新增 `ruoyi-ui/.env.trial`：

```properties
VITE_APP_TITLE = 运动员训练数据管理系统（演示环境）
VITE_APP_ENV = 'production'
VITE_APP_BASE_API = '/prod-api'          # 兜底值；demo 态零请求，实际不使用
VITE_EDITION = ai                        # 包含 AI 容器与全部插件
VITE_APP_BASEPATH = '/trial/'            # Vite base（子路径）
VITE_DEMO_LOCKED = 'true'                # 演示锁定：隐藏真实登录，只留口令入口
VITE_DEMO_PASSCODE = '8888'              # 沿用现有口令机制（env 可覆盖）
```

vite.config.js 改造（均带缺省值，standard/ai 现有 mode 行为不变）：

- `base: env.VITE_APP_BASEPATH || '/'`；
- `build.outDir: env.VITE_BUILD_OUTDIR || 'dist'`（trial 输出 `dist-trial`，避免覆盖 standard 的 dist）；
- 别名逻辑不动：trial 的 `VITE_EDITION=ai` 自然解析到 `src/ai`。

edition 标记插件（`vite/plugins/edition.js`）：

- trial 包 `edition.txt` 仍写 `ai`（不侵入部署脚本 standard|ai 枚举）；
- 额外写 `trial.txt`（内容 `trial`）作为演示包标识，供人工/脚本识别，不参与主站部署门禁。

package.json 增脚本：`"build:trial": "vite build --mode trial"`。

### 3.2 演示锁定（VITE_DEMO_LOCKED）

仅作用于 trial 构建，靠构建期常量 tree-shaking，不影响主站包体：

1. **login.vue**：锁定态不渲染账号登录/短信登录/注册等真实登录表单，只渲染「一键体验」入口与 DemoPassDialog；口令校验仍走 `enterDemo(8888)` 既有链路；
2. **permission.js 守卫**：锁定态下若检测不到 demo 会话（手输业务 URL、刷新丢会话等），一律重定向回 trial 登录页；真实 token 登录分支在该构建中不可达；
3. **退出演示**：DemoBanner/Navbar 的退出动作回到 **trial 自己的登录页**（配合 3.3 的 base 修复），不会落到主站；
4. DemoBanner 文案在锁定态追加「演示环境」标识（可选增强，低优先级）。

### 3.3 子路径适配（base=/trial/）

- 4 处硬编码 `/index` 统一改为 `` `${import.meta.env.BASE_URL}index` ``（standard/ai 的 BASE_URL 为 `/`，改写后行为等价，零回归）；
- 静态资源 URL 由 Vite 按 base 自动改写，无需手工处理；实施时全局再扫一遍 `'/index'`、`'/static'`、`public/` 引用确认无遗漏；
- router 无需改：`createWebHistory()` 默认读取 BASE_URL，router-link/ push 绝对路径均自动带 base；
- 实施时排查 `public/` 下资源是否有以根路径硬引用的写法（favicon、BUILD_ID 注入点）。

### 3.4 主站（standard）入口调整

主站登录页「一键体验」按钮行为由 env 控制：

- 新增 `VITE_TRIAL_URL`（生产 standard 构建配 `https://aoti.apms.top/trial/`）：
  - 配置后：点击「一键体验」**新开标签**打开 trial 站，由 trial 登录页承接 8888 口令流程；主站**隐藏原地口令演示**（避免「无 RPA 的原地演示」与「全量 trial 演示」两个口径并存）；
  - 未配置（本地 dev、UAT）：保持现有原地口令演示行为，零影响；
- 改动集中在 login.vue 入口判断与 DemoPassDialog 触发处，standard 包不含任何 AI 代码的原则不变。

### 3.5 同源存储隔离分析

- 两应用同源（协议+host+port 相同），共享 Web Storage；
- 现有设计中 demo 会话为 sessionStorage 单键、真实 token 为独立键，本就分键；trial 锁定态只写 demo 键、永不写真实 token；
- 主站与 trial 通过**新标签**打开，各自标签的会话生命周期独立；退出演示/关闭标签即清理；
- 实施时补桩测：主站真实登录后新开 trial 标签，双方 token/角色互不可见、互不污染（复用现有 assistantSession owner 隔离测试的套路）。

### 3.6 部署设计（人工执行，Agent 不代发）

**构建侧（build.sh）**：

- 新增 `--edition trial`（或独立 `--trial` 开关，评审时定）：执行 `vite build --mode trial`，产物为 `ruoyi-ui/dist-trial/`；
- trial 产物**独立 rsync 到远端独立目录**（如 `${REMOTE_DIR}/trial-dist/`），不走主站 deploy.sh 的 upload/dist、edition.txt 配对、回滚链路；
- 主站 standard/ai 的构建与部署流程一行不改。

**nginx（aoti.apms.top server 块内增量）**：

```nginx
location /trial/ {
    alias /usr/share/nginx/apms-trial/;          # dist-trial 落地目录
    try_files $uri $uri/ /trial/index.html;     # SPA history 路由兜底
    index index.html;
    # 静态资源缓存策略与主站一致；demo 零请求，无需反代 /prod-api
}
```

- `location /` 与现有 `/prod-api` 反代均不动；
- 可选加固（评审决定）：nginx 层加访问口令（auth_basic）或 IP 白名单；trial 包本就含全量 AI 源码且无真实数据，不加也不泄露业务数据。

### 3.7 后端与数据

- 后端：无改动。trial 演示态零真实请求；即便有人绕过前端直接调接口，standard 后端 AI 路径 404、业务接口需真实 JWT，demo token 不被服务端认可；
- 数据库/Redis：无改动、无新补丁。

## 4. 改动文件清单（预估）

| 类型 | 文件 | 说明 |
|---|---|---|
| 新增 | `ruoyi-ui/.env.trial` | trial mode 环境变量 |
| 改 | `ruoyi-ui/vite.config.js` | base/outDir 读 env |
| 改 | `ruoyi-ui/vite/plugins/edition.js` | trial.txt 标识 |
| 改 | `ruoyi-ui/package.json` | build:trial 脚本 |
| 改 | `src/views/login.vue` | 演示锁定 + TRIAL_URL 跳转 |
| 改 | `src/permission.js` | 锁定态会话守卫 |
| 改 | `src/utils/demo.js` 或 auth.js | 锁定态判定原语（按需） |
| 改 | DemoBanner.vue / Navbar.vue / assistantClient.js / request.js | 4 处 BASE_URL 跳转修复 |
| 改 | `deploy/build.sh` | trial 构建与独立产物分发 |
| 新增（运维侧，只提供样例） | nginx location 片段 | `/trial/` 静态站点 |
| 新增 | `.trae/demo-tests/trial.mjs`（或并入现有 assistant.mjs） | 锁定态/存储隔离/构建标识桩测 |

## 5. 验收标准

1. `npm run build:standard` 产物 grep `apms/ai/rpa` 仍 **0 命中**、edition.txt=standard（零 AI 不回归）；
2. `npm run build:trial` 成功：dist-trial 根含 edition.txt=ai、trial.txt=trial；产物内含 RPA 组件与 mock handler；index.html 资源路径全部以 `/trial/` 开头；
3. 本地以 `/trial/` base 起静态服务：打开 `/trial/` 只见演示入口；输错口令拒绝；8888 进入后悬浮球/RPA 面板可用，SSE 走 mock 全闭环，网络面板**无真实后端请求**；
4. trial 内手输业务 URL/刷新丢会话 → 回 trial 登录页，无法进入真实登录链路；
5. 退出演示回到 `/trial/` 登录页（不跳主站）；
6. 主站 `/` standard 包：配置 TRIAL_URL 后一键体验新开 `/trial/` 标签；未配置时原地演示行为不变；
7. 存储隔离桩测通过：主站真实登录与 trial 演示会话互不污染；
8. 现有 demo-tests 全量桩测（52+8 项）无回归；三部署脚本 bash 3.2/5.x 语法检查通过。

## 6. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 子路径硬编码遗漏导致跳转 404 | 4 处已定位 + 实施时全局复扫 + 验收第 5 条专项走查 |
| trial 包含 AI 源码被公开访问 | 演示包本无真实数据/接口；可选 nginx 口令或 IP 白名单 |
| 同源 Storage 键冲突 | demo/真实分键 + 新标签隔离 + 桩测验收 |
| 主站发版误传 dist-trial | 独立目录、独立 rsync，不进 deploy.sh 主链路 |
| 回滚 | 删除 nginx location 与 trial 目录即完全撤销；主站无任何依赖，零影响 |

## 7. 实施顺序（建议）

1. Vite 构建体系（env/config/edition 插件/package 脚本）+ 构建产物自检；
2. 4 处 BASE_URL 修复 + 全局硬编码复扫；
3. 演示锁定（login/permission/demo 原语）；
4. 主站入口 TRIAL_URL 逻辑；
5. Node 桩测（锁定态、隔离、标识）+ 现有桩测回归；
6. build.sh trial 分支；
7. 输出 nginx 配置样例交人工部署与验收。
