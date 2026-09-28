# 双域名入口（aoti 登录站 / www 与裸域品牌展示页）实施计划

## 背景与决策（已与用户确认）

生产环境规划两个入口，均指向同一台服务器、同一份前端 dist：

| 域名 | 形态 |
|---|---|
| `aoti.apms.top` | 现有完整登录页（不变） |
| `www.apms.top` | 纯品牌展示页 = 登录页去掉右侧登录区与客户方 logo，保留版权/ICP |
| `apms.top`（裸域） | 与 www 同页，同样渲染纯品牌展示页（不做 301，URL 保持裸域） |

已确认的决策：

1. www 页**不放任何登录入口按钮**，纯展示；用户只能自行访问 aoti 子域登录。
2. 展示域（`www.apms.top` 与裸域 `apms.top`）上访问**任意路径**（/login、/index、/apms/*、未知路径）一律回落地页，不提供、也不能通过正常页面路由进入客户登录入口和业务系统。
3. 本期 nginx 只规划 **80 端口**；443/证书后续单独处理。
4. 展示页内容（品牌名、Hero、背景、版权/ICP）**复用登录页设计器同一份配置**，不新增运营内容维护面。

## Repository Research（现状结论）

- 登录页结构：[login.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login.vue) 仅做业务逻辑，UI 全部在 [LoginRenderer.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login/LoginRenderer.vue)，三种布局模板：`split`（默认左右双栏）、`centered`（移动端默认）、`fullscreen`。
  - split 右侧 `<main class="login-form-side">`（L228-253）内含**客户方 logo**（`.rs-logo-head`→LoginLogoSlot）+ 登录卡片 slot + **右下版权** `.lf-copyright`（`cfg.footer.copyright`，可含 ICP 链接）。
  - 左侧 `<aside class="login-brand">`（L149-225）：版权方 logo + 品牌名 + Hero + **左下版权** `.lb-foot`（`cfg.footer.brandText`，可含 ICP 链接）。
  - centered/fullscreen 模板：客户方 logo 在 `.lc-logo-corner`，登录卡片在 `.lc-card`，版权在 `.lc-copyright`。
- 布局 CSS：`.login-split { display:grid; grid-template-columns: var(--login-split) }`（L442-445）；移动端品牌区由 `.brand-hidden-mobile .login-brand { display:none }` 控制（L770/787）。
- 配置数据：公开接口 `GET /system/login/config`（免鉴权，登录页未登录即可拉取），经 [loginTheme store](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/store/modules/loginTheme.js) 的 `loadConfig()` 与默认值合并。展示页可直接复用。
- 路由守卫 [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js)：无 token 且不在白名单（`/login`、`/register`）→ 重定向 `/login?redirect=...`。
- Cookie 按 host 隔离（host-only，不跨子域/裸域共享）：`www.apms.top`、`apms.top` 与 `aoti.apms.top` 天然各有独立 Cookie 罐，展示域永远不会有 aoti 的 token，方案无需处理鉴权态。
- 部署链：[build.sh](file:///Users/limeng/Documents/trae_projects/apms/deploy/build.sh#L155) 上传 [apms-nginx.conf](file:///Users/limeng/Documents/trae_projects/apms/deploy/apms-nginx.conf)，远端 [deploy.sh](file:///Users/limeng/Documents/trae_projects/apms/deploy/deploy.sh#L640-L642) 复制到 `/etc/nginx/conf.d/apms.conf` 并 `nginx -t && reload`。当前配置 `server_name _;`（通配默认站），root 同一 dist，`/prod-api/` 反代后端。www 页需要该反代（拉公开配置、取 /profile/ 上传图）。
- favicon/页签标题由 `applyLoginHead()` 按配置动态处理，展示页同样调用即可保持一致。

## 方案总览

- **入口模式按 hostname 在前端判定**（同一份 dist 服务多个域名），nginx 不做任何按域重写，仅声明多个 server_name；裸域与 www 渲染同一页面，不做 301 跳转。
- LoginRenderer 增加 `showcase` 布尔 prop：true 时渲染品牌展示形态。设计器不传该 prop（默认 false），现有登录页与设计器预览零影响。
- 展示页组件 `views/showcase/index.vue` 注册为真实根路径记录 `/`（另保留 `/showcase` 兼容直访）；原 `path:'' → redirect /index` 根记录改造为 `/index` 顶级 Layout 路由；permission 守卫在展示域把一切非根路径收敛回 `/`，地址栏始终保持 `http://apms.top/`，不出现 `/showcase`；业务域访问 `/` 由守卫改投 `/index`（等价原根重定向）。

## Files and Modules

1. `ruoyi-ui/src/utils/entry.js`（**新增**）
   - `isShowcaseHost()`：hostname ∈ `www.apms.top,apms.top`（可由 `.env` 的 `VITE_SHOWCASE_HOSTS` 覆盖，逗号分隔）。
   - dev 预览：`import.meta.env.DEV` 下允许 `?showcase=1` 强制展示模式（本机无域名 DNS 时用于验收）；生产构建不含此旁路。
2. `ruoyi-ui/src/views/showcase/index.vue`（**新增**）
   - 结构仿 login.vue：`<LoginRenderer :config="loginThemeStore.config" showcase>`，不传 `form`/`roles` slot。
   - onMounted：`loadConfig()` 后 `applyLoginHead({favicon,title})`；onBeforeUnmount：`restoreLoginHead()`（与登录页完全一致的页签处理）。
   - 纯展示组件，无登录逻辑、无 dev 角色卡。
3. [LoginRenderer.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login/LoginRenderer.vue)
   - props 新增 `showcase: { type: Boolean, default: false }`；根节点 class 增加 `showcase-on`。
   - **split 模板**：`<main class="login-form-side">` 整体 `v-if="!showcase"`（一次切除右侧登录区+客户 logo+右下版权）；`.lb-foot` 在 showcase 时于 brandText 下**追加渲染 `cfg.footer.copyright`**（FooterRichText），保证两份版权/ICP 都不丢。
   - **centered/fullscreen 模板**（移动端默认走 centered）：`.lc-logo-corner`（客户 logo）与 `.lc-card`（登录卡片）在 showcase 时不渲染；保留 `.lc-brand` 与 `.lc-copyright`。
   - 样式新增（scoped 同块）：
     - `.showcase-on.login-split { grid-template-columns: 1fr }`，品牌区满宽、内容仍受现有 max-width/留白约束；
     - `.showcase-on.brand-hidden-mobile .login-brand { display:flex }`（展示页移动端也必须显示品牌区，覆盖登录页"移动端隐藏品牌区"策略）；
     - 双版权堆叠间距 class（如 `.lb-copyright-extra`）。
4. [router/index.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/router/index.js)
   - 两条隐藏公开路由：`{ path: '/', meta: { showcaseRoot: true } }` 与 `{ path: '/showcase', meta: { showcaseRoot: true } }`，组件均为 `views/showcase/index.vue`。
   - 原 `{ path: '', redirect: '/index', children: [{ path: '/index', ... }] }` 改造为 `{ path: '/index', component: Layout, children: [{ path: '', name: 'Index', ... }] }`（业务首页顶级化，URL/面包屑/affix 不变）。
   - 注意：不能用 `alias:'/'`——vue-router 4 中真实 path 记录恒优先于 alias（已用 4.6.4 实测），`/` 仍会落在 redirect 记录。
5. [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js)
   - 守卫最前面：`isShowcaseHost()` 为真时，`/` 与 `/showcase` 放行（均渲染落地页），其余所有目标（含 /login、/index、404 兜底前）一律 `replace('/')`，不做 token 判断、不加载用户路由。
   - 非展示域访问 `/`（以 `to.meta.showcaseRoot` 辨认）→ `replace('/index')`，等价原根记录 `redirect:'/index'`；业务代码中所有 `push('/')`（登录成功、401、TagsView 兜底）经此统一改投，最终 URL 与现状一致。`/showcase` 仍在白名单（非展示域可直接访问，无入口链接、无副作用）。
   - aoti 域/IP 直连/localhost：现有行为完全不变。
6. [apms-nginx.conf](file:///Users/limeng/Documents/trae_projects/apms/deploy/apms-nginx.conf)
   - `server_name _;` 改为 `server_name aoti.apms.top www.apms.top apms.top _;`（同一 server 块、同一 root、同一 `/prod-api/` 反代；模式差异全部前端判定）。
   - UAT 的 [apms-uat.conf](file:///Users/limeng/Documents/trae_projects/apms/deploy/apms-uat.conf) 不动。
7. （可选）`.env.production` 增加注释说明 `VITE_SHOWCASE_HOSTS` 可覆盖项；默认值硬编码 `www.apms.top,apms.top` 即可，**不新增 env 文件**。

## Implementation Steps（依赖顺序）

1. 新增 `utils/entry.js`（hostname 判定 + dev 预览旁路）。
2. LoginRenderer 加 `showcase` prop：三处模板条件渲染 + 根 class + 配套 CSS + 双版权落点。
3. 新增 `views/showcase/index.vue`（复用 store 配置与页签处理）。
4. router 注册真实根记录 `/` + `/showcase`、`/index` 顶级化；permission.js 加展示域收敛守卫与业务域 `/ → /index` 改投。
5. `npx vite build`；dev server 下用 `?showcase=1` 逐布局/移动端宽度自测。
6. 改 apms-nginx.conf server_name（随下次 `bash deploy/build.sh` 由 deploy.sh 自动 install + reload）。

## Dependencies and Considerations

- **DNS 前置条件**（用户侧）：`aoti.apms.top`、`www.apms.top` 的 A 记录与裸域 `apms.top` 的 A 记录均需指向 `39.97.246.69`（裸域不能用 CNAME，直接配 A 记录）；未解析前可继续用 IP 直连（命中 `_` 默认站 = 登录模式，行为不变）。
- 展示页依赖 `/prod-api/system/login/config` 与 `/prod-api/profile/...`（管理员上传的背景/Logo），同 server 块现有反代天然满足，无需新开 location。
- 后端**零改动**：公开配置接口本就免鉴权；不新增任何接口、不碰数据库。
- 展示域不出现登录表单，故不会产生展示域 token；aoti 登录后的系统使用全部留在 aoti 域，host-only Cookie 隔离天然成立（与刚做的 localhost 端口后缀隔离互不冲突）。
- 设计器（登录配置页）不传 showcase，预览效果不变；展示页随设计器保存即时变化（每次挂载拉取公开配置，机制同登录页）。
- 移动端：split 下品牌区在展示页强制显示；窄屏默认 centered 模板已做客户 logo/卡片摘除与版权保留。
- 无 CTA：落地页为纯展示死胡同（用户已确认）。

## Validation

- dev（5173）：
  - `http://localhost:5173/?showcase=1` → 地址栏停在根路径并渲染落地页：左侧品牌区满宽、无右侧表单区、无客户 logo；左下 brandText + 右下 copyright 两份版权/ICP 均可见；
  - 窄屏（≤900px）同样可见品牌区与版权，无登录卡片；
  - 不带参数访问 `/login`、`/index`（未登录）行为与现状完全一致（登录页 / 跳登录）；
  - 展示模式下直接访问 `/apms/...`、`/anything` → 全部 replace 回 `/`（不带 /showcase）。
- UAT（本机 production 构建，http://localhost/）：`?showcase=1` 旁路对 localhost/loopback/RFC1918 私网段同样开放（公网 IP 与真实域名不开放），访问 `http://localhost/?showcase=1` 即落地页、`?showcase=0` 退出；旁路状态存 sessionStorage（按 origin 隔离，不影响 dev :5173 与他人）。
- 构建：`npx vite build` 通过、GetDiagnostics 零错误；dist 产物单份。
- 生产（部署 + DNS 后，用户执行）：
  - `curl -H "Host: www.apms.top" http://39.97.246.69/`、`curl -H "Host: apms.top" http://39.97.246.69/` 与带 Host: aoti 的请求均 200 且同 index.html；
  - 浏览器实测三个域名分别呈现展示页（www、裸域）/登录页（aoti），同浏览器互不影响；
  - www / 裸域手改地址栏访问 /index 均回到落地页。

## Risks

- **风险：双版权视觉重复/拥挤** → 两份文案由设计器分别维护；落地页堆叠展示并加间距，若内容雷同用户可在设计器将其一留空（showCopyright 不新增开关，沿用 `footer.showCopyright` 控制整体显隐；brandText 始终渲染，与登录页一致）。
- **风险：centered/fullscreen 摘除卡片后垂直留白失衡** → 验收时按两模板各截一图微调 flex 间距；split 为桌面默认、centered 为移动默认，必测；fullscreen 与 centered 同结构族，同步处理。
- **风险：未来上 HTTPS 时两域证书不同需拆 server 块** → 当前单块多 server_name 不阻碍后续拆分为两个 443 server，root/proxy 配置原样复制即可，前端无需再改。
- **风险：展示域被当默认站意外影响其他主机名** → `_` 保留为默认 server_name，任何非这三个域名的 Host（含 IP）仍是完整登录站，行为与今天一致。
