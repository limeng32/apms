# 同域演示站（/trial/）规划：演示态固定 AI 全量，正式入口按部署 Edition 提供能力

> 状态：**已实施，待人工 UAT/生产部署**（代码与本地验收 2026-11-13 完成；SQL/部署仍由人工执行）
> 日期：2026-11-13
> 关联文档：edition_split_plan.md（双产品线/双构建架构）、demo_mode_plan.md（一键体验机制）
>
> 实施记录（2026-11-13，与 §7 九步对应）：
> - 新增：`ruoyi-ui/.env.trial`、`src/utils/trial.js`（isDemoLocked 原语在 demo.js；openTrial/hasTrialUrl/resolveLockedNavigation 在 trial.js）、`deploy/nginx-trial.conf.sample`、`.trae/demo-tests/trial.mjs`（23 项桩测）；
> - 构建：vite.config.js（base/outDir env 化）、edition 插件双标记、package.json `build:trial`、.gitignore、index.html（`%BASE_URL%`/`%VITE_DEMO_LOCKED%` 占位）、.env.standard/.env.ai（TRIAL_URL 注释样例）；
> - 锁定与安全：loginTheme.loadConfig 短路、ClickCaptcha onMounted 短路 + login.vue v-if、loginConfig publicHttp 拦截兜底、auth.js 三函数 fail-closed、permission.js 前置闸门（裁决走 trial.js 纯函数）、pwa.js 锁定跳过、login.vue 四态自动弹框与副作用门控；
> - 子路径：router 显式 BASE_URL + 4 处 `/index` 修复；
> - 部署：build.sh `--edition trial` 独立支线（dist-trial → 远端 frontend/trial-dist，不走 deploy.sh）；
> - 本地验收：三模式构建通过、standard 零 AI 回归、桩测 52+8+24 全过、浏览器冒烟 12 项断言全过（自动弹框/深链弹回/8888 进入/RPA 可用/全程零 /prod-api/退出回登录页）。
> - 评审修复（2026-11-13）：
>   1. P1 入口显隐：`VITE_TRIAL_URL` 只切换「一键体验」按钮行为、不控制显隐（`demoEntryEnabled = demoEnabled`），修正配置后按钮消失导致 openTrial 无触发点的缺陷；
>   2. P2 异常态绕过：路由闸门由 `isDemoMode()` 宽判定改为 `readDemoSessionState().state === 'demo'` 严格判定——broken/storage-error 不再漏过闸门被 `/register`、`/showcase` 白名单放行；网络层 `isDemoMode()` fail-closed 宽判定保持不变，两层分离；trial.mjs T2 同步改为四态矩阵断言（24 项）；
>   3. P3 生产零手工启用：`.env.standard`/`.env.ai` 直接提交启用 `VITE_TRIAL_URL`（生产默认值，发版无需改文件）；deploy-uat.sh 构建时注 `VITE_TRIAL_URL=''` 进程环境覆盖（Vite 进程环境优先于 .env，已实测），UAT 与 dev 保持原地口令演示；trial.mjs 增补空串 opt-out 断言；
>   4. P4 Nginx 合入 canonical：trial 三个 location（`^~ /trial/static/`、`= /trial/index.html`、`^~ /trial/`）直接合入 `deploy/apms-nginx.conf` aoti 443 块，随 deploy.sh Step 5b 覆盖+`nginx -t`+reload 自动上线（失败自动回滚），消除「样例未接入导致 /trial/ 被正式 `location /` 兜底返回错误 index」的隐患；本地 nginx 1.27 实测 11 项路由断言全过。

## 1. 需求与约束

### 1.1 目标

- 两个入口的内容口径固定为：
  - **正式入口 `/`**：按实际部署的 Edition 提供功能——部署 standard 即标准版（零 AI），部署 ai 即含 AI 能力，本规划不对正式部署的 Edition 做任何限定或改动；
  - **演示入口 `/trial/`**：**固定使用 AI 全量前端构建**，无论正式环境部署的是 standard 还是 ai，演示态始终提供包含 RPA 在内的完整 AI 功能；
- standard 交付物的「零 AI 代码」物理隔离原则仅约束 standard 正式构建本身；trial 是独立的第三份构建产物，不受该原则约束，也不改变正式部署 Edition（standard 或 ai）的任何产物；
- 演示进入方式**保持现有「一键体验 + 8888 口令」交互不变**（DemoPassDialog），不做免口令自动进入；
- **强制要求一**：进入 Trial（登录页挂载，含深链被守卫弹回的场景）自动弹出口令框，无需手动点击；
- **强制要求二**：所有演示业务路由（静态/动态/应用内二次导航）必须经过演示会话检查，未进入演示会话只允许访问 Trial 登录入口；
- 演示态仍是纯前端 mock：零真实 HTTP、静态样本数据、刷新还原、退出演示回登录页。

### 1.2 关键约束（已代码取证）

1. 当正式部署为 standard 时，其构建经 Vite 别名 `@ai → src/ai-stub`，AI 代码**不进产物**，build.sh 另有 grep 零 AI 校验，运行时开关无法让不存在的代码出现；正式部署为 ai 时虽含 AI 代码，但演示需要的「口令锁定/零真实请求/独立入口」也不应污染正式包——因此无论正式 Edition 为何，独立 trial 构建都是必要的；
2. 现有 demo 机制已完整：口令弹窗、demoAdapter 全接管、内存 DB、demo/真实 token 分键隔离；
3. ai 构建的 `features.js` 对 demo 态默认**全插件启用且不发请求**，RPA mock handler 已随 ai 构建注册——trial 直接复用该模式，演示态 RPA 的前后端链路现成；
4. 后端 `@AiEnabled` 条件装配保证纵深防御：即使拿到 ai 前端，standard 后端下 AI 接口一律 404；ai 后端下业务接口仍需真实 JWT，demo token 不被服务端认可。**本需求后端零改动、零 SQL**；
5. 路由为 `createWebHistory()`（无参）；已取证 vue-router 4.6.4 无参时 base 回退字面量 `/`、**不自动读取 Vite base**，子路径部署必须显式改为 `createWebHistory(import.meta.env.BASE_URL)`（见 §3.3）；
6. 已发现 4 处硬编码根路径跳转，子路径部署必须改造：
   - `layout/components/DemoBanner.vue:57` `location.href='/index'`
   - `layout/components/Navbar.vue:105` `location.href='/index'`
   - `ai/plugins/rpa/assistantClient.js:118` `location.href='/index'`
   - `utils/request.js:98` `location.href='/index'`
7. **输口令前的真实后端请求排查（P1，评审发现）**：用户首次打开 `/trial/`、尚未输入 8888 时 `isDemoMode()=false`，demoAdapter 尚未接管，全量审计后确认有 2 处真实请求：
   - **请求 A（独立 axios 实例，永远绕过 demoAdapter）**：`App.vue onMounted → loginThemeStore.loadConfig() → api/loginConfig.js 的 publicHttp → GET /prod-api/login/config`（login.vue onMounted 再次调用但被 inflight 去重；lock.vue、showcase/index.vue 也调用同一 action）；
   - **请求 B（全局实例，但此时未进 demo 态）**：`ClickCaptcha.vue` 在登录页**常驻挂载**，`onMounted → loadChallenge() → GET /captcha/click` 探测验证码开关；
   - 已排除项：短信验证码仅点击时发送、`getCodeImg` 仅 register.vue 使用（锁定态注册页不可达）、其余请求均发生在登录之后。
8. **同源会话边界排查（P1 安全，评审发现）**：`/` 与 `/trial/` 同 Origin，Cookie/localStorage/sessionStorage 不按路径隔离：
   - `auth.js getToken()` 在 `readDemoSessionState().state==='none'` 时**回落读取真实 Admin-Token Cookie**（L92）。若用户先在主站登录过，再打开 `/trial/`（未输 8888），getToken() 返回真实 JWT → permission.js L42 进入真实登录分支 → getInfo() 经全局实例发出**带真实凭证的请求**，演示锁定被完全绕过；
   - 全量审计确认认证凭证消费点共 14 处（request.js 注入头、permission 守卫、user store、download.js×3、upload 组件×7、ai/features、rpa/assistantClient），**全部经由 getToken() 单一函数**，无第二条读取路径；
   - 反向风险：`removeToken()`（user.logOut / 401 重登流程会调）在 trial 内若被触发，会删掉同域主站的真实登录 Cookie，构成跨上下文破坏；
   - sessionStorage：`window.open` 打开的新浏览上下文会复制 opener 的 sessionStorage 初始副本（之后各自独立），主站跳 trial 若不加 noopener，可能把主站标签的会话副本带入 trial（其中虽无 token 凭证，但违反最小暴露）；
   - 非凭证 Cookie（sidebarStatus/size/username/rememberMe）同域共享仅影响 UI 偏好，不构成认证边界问题，不纳入本次收口。

## 2. 方案选型

| 方案 | 形态 | 评价 |
|---|---|---|
| **A. 同域路径隔离（采纳）** | `/` 挂正式 dist（standard 或 ai，按实际部署）；`/trial/` 挂第三份 trial dist（固定 ai 全量 + 演示锁定 + base=/trial/） | 正式站零改动、两个 Edition 通用、同源免跨域；新增一个构建 mode 与一个 nginx location |
| B. 独立子域名 | trial.apms.top 挂 ai dist | 用户明确要求同域名，不采纳 |
| C. AI 代码合入正式包，运行时门控 | 单构建，demo 解锁 | 推翻 standard 零 AI 物理隔离、build/部署校验返工、源码可从公网包提取，不采纳 |

最终形态（正式站 Edition 任意，trial 内容恒定）：

```
https://aoti.apms.top/          → dist 或 dist-ai（按实际部署 Edition，真实登录后功能随线别）
https://aoti.apms.top/trial/    → dist-trial（固定 ai 全量 + 演示锁定，8888 口令进入，始终含 RPA）
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
VITE_APP_BASEPATH = '/trial/'            # Vite base（子路径，喂给 vite.config 与 router）
VITE_BUILD_OUTDIR = 'dist-trial'         # P1：独立输出目录，绝不覆盖正式构建（standard/ai 均输出 dist）
VITE_DEMO_LOCKED = 'true'                # 演示锁定：隐藏真实登录，只留口令入口
VITE_DEMO_PASSCODE = '8888'              # 沿用现有口令机制（env 可覆盖）
```

vite.config.js 改造（均带缺省值，standard/ai 现有 mode 行为不变）：

- `base: env.VITE_APP_BASEPATH || '/'`；
- `build.outDir: env.VITE_BUILD_OUTDIR || 'dist'`（trial 输出 `dist-trial`，避免覆盖正式构建的 dist）；
- 别名逻辑不动：trial 的 `VITE_EDITION=ai` 自然解析到 `src/ai`，与正式站当前是哪个 Edition 无关。

edition 标记插件（`vite/plugins/edition.js`）：

- trial 包 `edition.txt` 仍写 `ai`（不侵入部署脚本 standard|ai 枚举）；
- 额外写 `trial.txt`（内容 `trial`）作为演示包标识，供人工/脚本识别，不参与正式站部署门禁。

package.json 增脚本：`"build:trial": "vite build --mode trial"`。

### 3.2 演示锁定（VITE_DEMO_LOCKED）

仅作用于 trial 构建，靠构建期常量 tree-shaking，不影响主站包体：

1. **login.vue**：锁定态不渲染账号登录/短信登录/注册等真实登录表单，只渲染「一键体验」入口与 DemoPassDialog；口令校验仍走 `enterDemo(8888)` 既有链路；
2. **permission.js 守卫**：锁定态下若检测不到 demo 会话（手输业务 URL、刷新丢会话等），一律重定向回 trial 登录页；真实 token 登录分支在该构建中不可达；
3. **退出演示**：DemoBanner/Navbar 的退出动作回到 **trial 自己的登录页**（配合 3.3 的 base 修复），不会落到主站；
4. DemoBanner 文案在锁定态追加「演示环境」标识（可选增强，低优先级）。

#### 3.2.0 强制要求一：进入 Trial 自动弹出口令框

锁定态下口令框不依赖用户点击，登录页挂载即自动弹出，保证访客打开 `/trial/`（或被守卫弹回登录页）后第一交互只能是输口令：

- 触发点：login.vue `onMounted`（与现有 `demoDialogVisible` ref、DemoPassDialog 组件复用，不新增弹窗组件）；
- 触发条件（与会话四态严格对齐）：

  | 挂载时会话状态 | 行为 |
  |---|---|
  | none（正常首次/被守卫弹回/取消后重进） | **自动弹出口令框** |
  | demo | 正常不会停在登录页（守卫直接放行业务路由）；防御性不弹窗 |
  | broken | 先执行既有 broken 自愈清键 → 状态转 none → 自动弹出 |
  | storage-error | 不弹窗，渲染存储阻断页（与主站行为一致，无法进入任何流程） |

- 用户点「取消」关闭弹窗后，锁定态登录壳上仍保留「一键体验」按钮可手动再次唤起（不会卡死在空白登录页）；
- 口令错误沿用现有抖动/错误文案，弹窗保持打开；
- 深链场景闭环：直接访问 `/trial/apms/xxx` → 守卫（§3.2.2 规则 2）弹回 `/login` → 登录页挂载 → 自动弹框，访客无任何绕过口令接触业务页面的路径；
- standard/ai 构建中该自动弹出逻辑被构建期常量剔除，主站仍保持手动点击「一键体验」。

#### 3.2.0b 强制要求二：所有演示业务路由必须经过演示会话检查

- 检查点唯一且全局：`router.beforeEach` 中的锁定闸门（§3.2.2 规则 2）对**每一次导航**生效，覆盖静态路由（/index、/lock、个人中心、404 兜底等）、动态路由（getInfo 后 addRoute 的全部 `/apms/**` 菜单）以及应用内 `router.push` 触发的二次导航——不存在只在首屏检查、之后放行的缺口；
- 锁定态路由裁决矩阵：

  | 会话状态 | 访问 /login | 访问任意其他路径（含白名单 /register、/showcase） |
  |---|---|---|
  | none | 放行（并自动弹框） | 重定向 /login |
  | demo | 重定向首页（既有逻辑） | 放行，业务请求由 demoAdapter 本地闭环 |
  | broken | 放行（自愈后弹框） | 重定向 /login |
  | storage-error | 放行（渲染阻断页） | 重定向 /login（阻断页） |

- 会话中途失效（用户点「退出演示」清掉 demo 单键）后，下一次任意导航立即重新过闸并被弹回登录页，不依赖刷新；
- 后端侧不新增校验：演示态零真实 HTTP，本要求是纯前端路由不变量；桩测需覆盖矩阵全部格子。

### 3.2.1 零真实请求保证（P1 修复，评审发现）

目标：`VITE_DEMO_LOCKED=true` 的 trial 包，**从打开 `/trial/` 到退出演示的全生命周期，网络面板零真实后端请求**（含输口令之前）。按评审意见采用「锁定态本地短路」，不改造 mock 系统、不动 publicHttp 实例本身：

1. **请求 A 修复——loginTheme store 集中短路**（一处覆盖 App.vue / login.vue / lock.vue / showcase 四个调用点）：
   `store/modules/loginTheme.js` 的 `loadConfig()` 入口判断：锁定态直接 `return Promise.resolve()`，不调用 `getPublicLoginConfig`；state 初始值本就是 `cloneDefaults()` 完整默认配置，首帧渲染无空窗；`smsEnabled` 保持默认 false，短信 tab 自然隐藏；
2. **请求 B 修复——ClickCaptcha 双层处理**：
   - login.vue 模板对 `<ClickCaptcha>` 加 `v-if="!demoLocked"`，锁定态组件**不挂载**，onMounted 探测根本不执行（真实登录表单已隐藏，验证码在 trial 无任何使用场景）；
   - 组件内 `onMounted` 再加 env 短路兜底（`VITE_DEMO_LOCKED==='true'` 时直接 return），防止未来其他页面引用时复发；
3. **构建期保证**：`VITE_DEMO_LOCKED` 是构建期常量，短路分支在 standard/ai 产物中被 tree-shaking，主站包零行为变化；
4. **口令流程本身零请求**：`enterDemo` 只写 sessionStorage + 重置内存 DB，不经过 HTTP；进入 demo 态后全部请求由 demoAdapter 本地闭环（既有机制）；
5. 防御性兜底（可选，评审决定是否做）：在 `api/loginConfig.js` 的 publicHttp 请求拦截器中再判一次锁定态并 reject，作为最后一道闸——若 1/2 被后续重构绕过，请求也发不出去。

### 3.2.2 同源会话安全边界（P1 修复，评审发现）

目标：trial 构建对真实认证凭证「读不到、写不进、删不掉」，演示锁定不可被同域 Cookie 绕过。三条规则落地：

**规则 1：trial 构建的 getToken() 永不读取真实 Cookie（auth.js 单点收口）**

利用「14 处消费点全部经由 getToken()」的事实，只改 auth.js 一个文件：

```js
// 构建期常量；standard/ai 产物中该分支被 tree-shaking，原 Cookie 回落逻辑零变化
const DEMO_LOCKED = import.meta.env.VITE_DEMO_LOCKED === 'true'

export function getToken() {
  const s = readDemoSessionState()
  if (s.state === 'demo') return s.token
  // locked 构建：none/broken/storage-error 一律 undefined，彻底不回落 Admin-Token
  if (DEMO_LOCKED) return undefined
  if (s.state === 'broken' || s.state === 'storage-error') return undefined
  return Cookies.get(TokenKey) || (TokenKey !== LegacyTokenKey ? Cookies.get(LegacyTokenKey) : undefined)
}
```

同步对写/删入口做 fail-closed 防御（真实登录 UI 已隐藏，这些路径正常不可达，短路是纵深防御）：

- `setToken()`：locked 下 no-op（不写真实 Cookie）；
- `removeToken()`：locked 下 no-op（**绝不删除同域主站的真实登录 Cookie**，避免 trial 内任何 401/登出流程跨上下文破坏主站会话）；
- 效果：request.js 的 Authorization 注入、download.js、7 处 upload header、AI 客户端在非 demo 态全部拿不到凭证，即使手工构造业务 URL 也只会以匿名身份被守卫弹回登录页。

**规则 2：路由守卫锁定检查先于一切真实登录判断（permission.js）——落实强制要求二**

在 `isShowcaseHost()` 判断之后、`if (getToken())` 之前插入锁定闸门，对每次导航全局生效，完整裁决矩阵见 §3.2.0b：

```js
if (DEMO_LOCKED) {
  // 路由层只承认严格有效的 demo 会话；不能用 isDemoMode()——它对 broken/storage-error
  // 也返回 true（网络层 fail-closed 语义），异常态会漏过闸门再被 /register 白名单放行（P2 修复）
  const validDemo = readDemoSessionState().state === 'demo'
  const verdict = resolveLockedNavigation({ validDemo, toPath: to.path })
  if (verdict === true) return true
  if (verdict) { NProgress.done(); return verdict }
  // 严格 demo 态落入下方既有流程（getToken 返回 demo token，getInfo/getRouters 走 mock）
}
```

- **路由层与网络层判定严格分离（P2 修复要点）**：路由守卫用 `state==='demo'` 严格判定，broken/storage-error 按未授权弹回；网络层（request.js 的 demoAdapter、download/upload 守卫）继续用 `isDemoMode()` 宽判定，保证异常态下 adapter 绝不卸载、零真实请求——两层不变量不可混用；
- 白名单在锁定态收窄：原 `whiteList` 含 `/register`、`/showcase`，锁定闸门先于白名单判断，trial 中这些路径不可达；
- 覆盖范围含静态路由、动态 addRoute 的全部 `/apms/**`、应用内二次导航；退出演示后首次导航即重新过闸（§3.2.0b）；
- 与规则 1 互为兜底：即使未来 getToken 短路被重构误伤，守卫仍按 sessionStorage 的 demo 会话状态裁决，不承认任何 Cookie 凭证。

**规则 3：主站打开 trial 显式 noopener（login.vue 入口）**

§3.4 的「一键体验」跳转统一使用：

```js
window.open(import.meta.env.VITE_TRIAL_URL, '_blank', 'noopener,noreferrer')
```

- noopener 使新浏览上下文 `opener=null` 且获得**空的 sessionStorage**，不复制主站标签会话副本；
- 不用 `<a target=_blank>` 裸写（漏 rel=noopener 即失效），封装为单一工具函数 `openTrial()`，全仓只此一个打开点；
- 纵深说明：即便某浏览器对 noopener 处理有差异，复制过去的也只可能是 demo 会话（真实 JWT 仅存于 Cookie，而规则 1 已保证 trial 不读 Cookie），不构成凭证泄漏。

**不变量与验收口径**：trial 构建中「真实 JWT」在任何存储状态组合（none/demo/broken/storage-error）下都不可被 JS 读取、不会出现在任何请求头中；主站 Admin-Token Cookie 的生命周期不受 trial 内任何操作影响。

### 3.3 子路径适配（base=/trial/）

- **P1：router 必须显式传 base（评审发现，原「无需改」结论错误）**。已对实际安装的 vue-router 4.6.4 源码取证：`createWebHistory()` 无参时经 `normalizeBase(undefined)` 回退到 HTML `<base>` 元素或字面量 `'/'`，**整个 dist 中不存在任何 `import.meta.env.BASE_URL` 引用**（grep 零命中），即该版本不会自动读取 Vite base。必须修改 `src/router/index.js`：

  ```js
  // 改前：history: createWebHistory()
  history: createWebHistory(import.meta.env.BASE_URL)
  ```

  否则 `/trial/login` 解析、动态路由跳转、router.push 的 URL 拼接全部按根 `/` 计算，子路径部署直接失效。standard/ai 构建的 BASE_URL 为 `/`，显式传参与无参行为完全等价，零回归；
- 4 处硬编码 `/index` 统一改为 `` `${import.meta.env.BASE_URL}index` ``（standard/ai 的 BASE_URL 为 `/`，改写后行为等价，零回归）；
- 静态资源 URL 由 Vite 按 base 自动改写，无需手工处理；实施时全局再扫一遍 `'/index'`、`'/static'`、`public/` 引用确认无遗漏；
- 实施时排查 `public/` 下资源是否有以根路径硬引用的写法（favicon、BUILD_ID 注入点）。

### 3.4 正式站入口调整（适用全部 Edition）

正式站（standard 或 ai 构建）登录页「一键体验」按钮行为由 env 控制，**`VITE_TRIAL_URL` 是 Edition 无关的通用配置**：

- `VITE_TRIAL_URL` 的环境映射（随仓库提交，发版零手工修改）：

  | 环境 | 构建 mode | VITE_TRIAL_URL 来源 | 一键体验行为 |
  |---|---|---|---|
  | 本地 dev | development / development-ai | 无此键（dev env 不含） | 原地口令弹窗 |
  | UAT | standard / ai（deploy-uat.sh） | 脚本注入 `VITE_TRIAL_URL=''` 进程环境覆盖 | 原地口令弹窗 |
  | 生产 | standard / ai（build.sh 直连） | `.env.standard`/`.env.ai` 提交值 `https://aoti.apms.top/trial/` | noopener 新开 /trial/ |

  - 生产值直接启用并提交在两个正式 env 中，一次配置永久生效，不需要每次发版改文件；
  - UAT 与生产共用同一 vite mode，区分依赖 Vite 的优先级规则：**已存在的进程环境 `VITE_*` 变量覆盖 .env 文件值**（已用两次实测构建验证），deploy-uat.sh 在调 build.sh 前注空串；
  - 任意环境下 **「一键体验」按钮都保持显示**（显隐只由 `VITE_DEMO_ENABLED` 控制）：有 URL 时经 `openTrial()` 新开标签（强制 `noopener,noreferrer`，见 §3.2.2 规则 3），无 URL/空串时唤起本地 DemoPassDialog——切换的是按钮行为，不是按钮显隐；
- 对 ai 正式站的语义：其原地演示本就含 RPA，但仍统一收口到 trial——trial 额外提供演示锁定与零真实请求保证，演示行为与口令在两个 Edition 的正式站之间完全一致；
- 改动集中在 login.vue 的 `onDemoEntryClick()` 行为分支、两个正式 env 与 deploy-uat.sh 的构建调用处。

### 3.5 同源存储隔离分析（与 §3.2.2 配套）

- 两应用同源（协议+host+port 相同），Cookie 与 Web Storage 物理共享，**不依赖存储天然隔离，而靠认证收口建立逻辑边界**；
- 真实 JWT 只存于 Admin-Token Cookie；trial 构建的 getToken/setToken/removeToken 三函数全部短路（§3.2.2 规则 1），该 Cookie 对 trial 应用等价于不存在：读不到、不会被覆盖、不会被删除；
- demo 会话只存 sessionStorage 单键；主站开 trial 强制 noopener，新标签获得空 sessionStorage（规则 3）；退出演示/关闭标签即清理；
- 非认证 Cookie（侧边栏状态、字号、记住的用户名）可能同域共享，仅影响 UI 偏好，无安全含义；
- 实施时补桩测：① 预置 Admin-Token Cookie 后以 trial 构建运行，四种存储状态下 getToken() 断言；② 主站真实登录后新开 trial 标签，双方 token/角色互不可见、trial 内操作后主站 Cookie 不变；③ 守卫对未授权 URL 的重定向断言。

### 3.6 部署设计（人工执行，Agent 不代发）

**构建侧（build.sh，已实现）**：

- `--edition trial`：执行 `vite build --mode trial`，产物为 `ruoyi-ui/dist-trial/`，三件套自检（edition.txt=ai、trial.txt=trial、index.html base=/trial/）；
- trial 产物**独立 rsync 到 `${REMOTE_DIR}/frontend/trial-dist/`**（与正式 `frontend/dist` 并列，`--delete` 只清理该目录），不走主站 deploy.sh 的 upload/dist、edition.txt 配对、回滚链路；
- 主站 standard/ai 的构建与部署流程一行不改。

**nginx（已合入 canonical 配置，随正式部署自动生效）**：

trial location 已直接合入 `deploy/apms-nginx.conf` 的 aoti 443 server 块（不再只留样例）。deploy.sh Step 5b 每次部署用仓库配置覆盖 `/etc/nginx/conf.d/apms.conf`，先 `nginx -t` 再 reload、失败自动恢复旧配置，因此 trial 路由随版本发布自动上线，无需上线时手工改配置：

```nginx
# 三块均为 ^~/= 前缀匹配，优先级高于 server 级静态资源正则 location（防 /trial 静态资源被正则块抢走到正式 dist）
location ^~ /trial/static/ {
    alias /opt/apms/frontend/trial-dist/static/;
    expires 7d; access_log off;
    try_files $uri =404;
}
location = /trial/index.html {
    alias /opt/apms/frontend/trial-dist/index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
location ^~ /trial/ {
    alias /opt/apms/frontend/trial-dist/;
    index index.html;
    try_files $uri $uri/ /trial/index.html;   # SPA history 路由兜底
}
```

- 拆三块且各自显式 alias，避免嵌套 location 继承 alias 的路径拼接歧义；gzip 继承 server 级配置；demo 零请求，不反代 /prod-api；
- 80 块只做 301 跳 HTTPS，`http://aoti/trial/` 自动升级到 443 块；展示域（www/apms.top）与 IP 直连 default_server 不含 trial 块，trial 仅在 aoti 域名可达；
- 本地 nginx 1.27 实测 11 项断言全过：301 升级、/trial/ 与深链回退返回 trial index（标题含「演示环境」）、与正式 index 字节不同（证明未被 `location /` 兜底）、static 7d 缓存、index.html no-cache、favicon 200、缺失 static 资源 404、正式站静态正则 location 不受影响；
- 可选加固（评审决定）：nginx 层加访问口令（auth_basic）或 IP 白名单（样例见 `deploy/nginx-trial.conf.sample`）；trial 包本就含全量 AI 源码且无真实数据，不加也不泄露业务数据。

### 3.7 后端与数据

- 后端：无改动。trial 演示态零真实请求；即便有人绕过前端直接调接口——standard 后端的 AI 路径一律 404，ai 后端的业务接口仍需真实 JWT——两种 Edition 下 demo token 均不被服务端认可；
- 数据库/Redis：无改动、无新补丁。

## 4. 改动文件清单（预估）

| 类型 | 文件 | 说明 |
|---|---|---|
| 新增 | `ruoyi-ui/.env.trial` | trial mode 环境变量（含 VITE_BUILD_OUTDIR=dist-trial） |
| 改 | `ruoyi-ui/vite.config.js` | base/outDir 读 env |
| 改 | `ruoyi-ui/vite/plugins/edition.js` | trial.txt 标识 |
| 改 | `ruoyi-ui/package.json` | build:trial 脚本 |
| 改 | `src/router/index.js` | **P1**：createWebHistory 显式传 import.meta.env.BASE_URL |
| 改 | `src/views/login.vue` | 演示锁定 + **挂载自动弹口令框（§3.2.0）** + openTrial() noopener 跳转 + ClickCaptcha 锁定态 v-if |
| 改 | `src/views/login/ClickCaptcha.vue` | onMounted 锁定态短路（P1 请求 B 兜底） |
| 改 | `src/store/modules/loginTheme.js` | loadConfig 锁定态短路，不调 /login/config（P1 请求 A） |
| 改 | `src/utils/auth.js` | **P1 安全**：locked 下 getToken/setToken/removeToken 全短路，不碰真实 Cookie |
| 改 | `src/permission.js` | 锁定闸门前置（先于 getToken 判断），全局每次导航过闸，未进 demo 只放 /login（§3.2.0b） |
| 改 | `src/utils/demo.js` 或新增 `src/utils/trial.js` | 锁定态判定原语 + openTrial() 封装 |
| 改（可选） | `src/api/loginConfig.js` | publicHttp 锁定态拦截兜底 |
| 改 | DemoBanner.vue / Navbar.vue / assistantClient.js / request.js | 4 处 BASE_URL 跳转修复 |
| 改 | `deploy/build.sh` | trial 构建与独立产物分发 |
| 改 | `deploy/apms-nginx.conf` | aoti 443 块合入三个 `/trial/` location（随 deploy.sh 自动上线） |
| 新增（说明性样例） | `deploy/nginx-trial.conf.sample` | 同结构说明 + 可选加固方案，canonical 以 apms-nginx.conf 为准 |
| 新增 | `.trae/demo-tests/trial.mjs`（或并入现有 assistant.mjs） | 锁定态/存储隔离/构建标识桩测 |

## 5. 验收标准

1. `npm run build:standard` 产物 grep `apms/ai/rpa` 仍 **0 命中**、edition.txt=standard（零 AI 不回归）；随后执行 `npm run build:trial`，**正式构建的 dist 目录内容不被改动**（无论正式线别是 standard 还是 ai，trial 必须落在独立 dist-trial，可按目录 mtime/文件数比对验证）；
2. `npm run build:trial` 成功：dist-trial 根含 edition.txt=ai、trial.txt=trial；产物内含 RPA 组件与 mock handler；index.html 资源路径全部以 `/trial/` 开头；
2.1 **P1 路由 base 验收**：dist-trial 内 grep 打包产物确认 router 以 `/trial/` 为 history base；浏览器深链直接访问 `/trial/login`、`/trial/apms/athlete` 不出现跳到根域 `/login` 的现象；standard/ai 构建回归：BASE_URL=/ 下路由行为与改动前一致；
3. 本地以 `/trial/` base 起静态服务：打开 `/trial/` 自动弹出口令框（无需点击）；取消后可用「一键体验」手动唤起；输错口令拒绝并停留弹窗；8888 进入后悬浮球/RPA 面板可用，SSE 走 mock 全闭环，网络面板**无真实后端请求**；
3.1 **强制要求一验收**：全新标签打开 `/trial/`、深链访问 `/trial/apms/athlete`、broken 自愈后三种入口，口令框均自动弹出；storage-error 态不弹窗只显示阻断页；standard 与 ai 两种正式构建均回归验证登录页不会自动弹窗；
3.2 **强制要求二验收（路由矩阵桩测）**：按 §3.2.0b 矩阵逐格断言——none/broken/storage-error 下访问任意非 /login 路径（含 /register、/showcase、静态 /index、动态 /apms/**、404 兜底）一律重定向 /login；demo 态全部放行；演示中退出会话后首次 router.push 即被弹回，无需刷新；
4. **P1 零网络验收（输口令前）**：全新标签打开 `/trial/` 停在登录页、不做任何操作，DevTools Network 录制 3 秒：对 `/prod-api/**`（含 `/login/config`、`/captcha/click`）的真实请求数为 **0**；输错口令同样零请求；输入 8888 进入演示后仍为零真实请求（只有 mock adapter 内部分派，无 XHR/fetch 出网）；
5. **P1 会话安全验收（Cookie 绕过攻击面）**：
   - 预置同域 Admin-Token Cookie（模拟主站已登录）后打开 `/trial/`：未输口令时停在登录页，守卫不进入任何业务路由，Network 无带 Authorization 的请求；手工访问 `/apms/athlete`、`/index` 等任意业务 URL 一律被重定向回 `/trial/login`；
   - 桩测断言：trial 构建在 none/demo/broken/storage-error 四种存储状态下，getToken() 仅 demo 态返回 demo token，其余均为 undefined；setToken/removeToken 调用后 Cookie 无变化（主站凭证不被写入/删除）；
   - 主站「一键体验」打开的新标签 `window.opener === null`，且 sessionStorage 中无主站键（noopener 生效）；
6. trial 内手输业务 URL/刷新丢会话 → 回 trial 登录页，无法进入真实登录链路；
7. 退出演示回到 `/trial/` 登录页（不跳主站）；
8. 正式站 `/`（standard 或 ai 构建，两种 Edition 各验一遍）：生产构建产物 grep 含 `aoti.apms.top/trial/`，「一键体验」按钮显示且点击新开 `/trial/` 标签（本地口令弹窗不弹出）；`VITE_TRIAL_URL=''` 覆盖构建（UAT 形态）产物 grep 不含该 URL，按钮同样显示、点击唤起原地口令弹窗；dev mode 无此键，行为不变；
9. 现有 demo-tests 全量桩测（52+8 项）无回归；三部署脚本 bash 3.2/5.x 语法检查通过。

## 6. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 子路径硬编码遗漏导致跳转 404 | 4 处已定位 + 实施时全局复扫 + 验收第 7 条专项走查 |
| vue-router 无参 base 回退 `/` 致子路径失效（P1） | 显式 createWebHistory(import.meta.env.BASE_URL)，验收第 2.1 条深链走查 |
| trial 构建覆盖正式构建 dist（P1） | .env.trial 固定 VITE_BUILD_OUTDIR=dist-trial（与正式线别 standard/ai 无关），验收第 1 条目录隔离比对 |
| trial 包含 AI 源码被公开访问 | 演示包本无真实数据/接口；可选 nginx 口令或 IP 白名单 |
| 同源 Storage 键冲突 | demo/真实分键 + 新标签隔离 + 桩测验收 |
| 输口令前泄漏真实请求（P1） | loginTheme/ClickCaptcha 锁定态短路 + 验收第 4 条 Network 零请求录制；可选 publicHttp 拦截器兜底 |
| 同域 Cookie 绕过演示锁定（P1） | auth.js 三函数锁定态短路 + 守卫前置闸门 + noopener，验收第 5 条攻击面走查 |
| trial 内误删主站登录 Cookie | removeToken 锁定态 no-op，桩测断言 Cookie 生命周期不受影响 |
| 主站发版误传 dist-trial | 独立目录、独立 rsync，不进 deploy.sh 主链路 |
| 回滚 | 删除 nginx location 与 trial 目录即完全撤销；主站无任何依赖，零影响 |

## 7. 实施顺序（建议）

1. Vite 构建体系（env/config/edition 插件/package 脚本）+ 构建产物自检；
2. **P1 零网络短路**：loginTheme.loadConfig 锁定态短路 + ClickCaptcha v-if/onMounted 短路；
3. **P1 安全边界收口**：auth.js 三函数（getToken/setToken/removeToken）锁定态短路 + permission.js 前置锁定闸门；
4. 子路径适配：router/index.js 显式传 BASE_URL（P1）+ 4 处硬编码 /index 修复 + 全局硬编码复扫；
5. 演示锁定 UI（login.vue 含自动弹口令框 §3.2.0）+ openTrial() noopener 封装；
6. 正式站入口 TRIAL_URL 逻辑（Edition 无关，standard/ai 同一套 env 门控）；
7. Node 桩测（四态 token 断言、§3.2.0b 路由矩阵全格、自动弹框触发条件、隔离、构建标识）+ 浏览器零网络/Cookie 攻击面验收 + 现有桩测回归；
8. build.sh trial 分支；
9. nginx：trial location 合入 `deploy/apms-nginx.conf`（随正式部署自动覆盖+reload），本地 nginx 实例完成路由矩阵验收，样例文件仅留说明与可选加固。
