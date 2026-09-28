# 「一键体验」演示模式实施计划（登录页口令 → super 全模块静态系统）

## 一、目标与已确认决策

在登录页增加「一键体验」入口：点击 → 弹口令框 → 输入 `8888` → 进入一个**界面与 super（业务管理员 business_admin）登录后完全一致、但数据全部为前端静态样本**的 APMS 系统。

| 决策项 | 结论（用户已拍板） |
|---|---|
| 展示形态 | **真实系统外壳 + 13 个真实业务页面组件**，数据全部前端内置假数据（非独立长页/截图） |
| 交互深度 | **假提交本地生效**：新增/修改/删除/计算/生成等在标签页内存中真实反映，**刷新即还原**；下载/上传等文件类操作给「演示环境不支持」提示 |
| 入口范围 | **仅登录页**（aoti / IP / localhost）。www.apms.top 与裸域展示页保持「纯展示死胡同」，不放入口 |
| 口令 | 固定 `8888`，前端常量（可 env 覆盖）。**纯前端校验，F12 可见，仅防普通访客，不具安全性**——用户已知悉并接受 |
| 后端/数据库/nginx | **零改动**，纯前端实现，随前端构建生效 |

## 二、现状依据（已核实）

- super 角色 = `business_admin`（patch-0.0.4 SQL L105-114）；APMS 顶级目录 menu_id=2200，下挂 **13 个菜单**（patch-0.0.2 SQL L80-93）：总览看板 dashboard、运动员档案 athlete、指标库 indicator、测试模型库 testModel、测试任务 testTask、测试结果 testResult、体态测量 bodyMeasure、PHV phv、RTP rtp、组合模型 comboModel、组合体能评分 comboScore、医疗记录 medical、报告中心 report；按钮权限点均为 `apms:*`。
- 动态菜单 100% 由 `GET /getRouters` 下发（[permission store](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/store/modules/permission.js#L35-L54)），结构为 `{name,path,component,meta:{title,icon},children}`，`component:'Layout'/'ParentView'/'apms/xxx/index'` 由前端映射。
- 业务 API：14 个文件、**101 个接口**，全部经同一 axios 实例 [request.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js)；标准 RuoYi 响应 `{code,msg,rows,total,data}`。
- 登录页无验证码；[login.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login.vue) 通过 LoginRenderer 的 `#form` slot 注入 [LoginFormFields.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login/LoginFormFields.vue)（设计器预览共用，`preview=true`）；提交按钮下方是入口的自然位置。
- 系统首页 [views/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/index.vue#L218) 仅依赖 `GET /apms/dashboard/overview`（另有 /apms/dashboard/stats，共 2 个看板接口要 mock）。
- 字典走 `GET /system/dict/data/type/{dictType}`（useDict + dict store 带缓存）；APMS 相关字典：apms_position、apms_athlete_status、apms_medical_type、apms_dept_type、sys_user_sex 等（patch-0.0.2 SQL L45-48 等）。

## 三、总体架构

```
登录页「一键体验」→ 口令弹窗(8888)
   └─ enterDemo()
        ├─ setSessionToken('demo-static-xxxx')   # auth.js 会话级 Cookie（非30天持久），守卫放行
        ├─ sessionStorage['apms_demo_mode']='1'  # 演示态总开关（标签页级生命周期）
        ├─ db.resetDb()
        ├─ userStore.roles/permissions = []      # 关键：必须为空，守卫才会走初始化
        └─ router.replace('/apms/dashboard')
              └─ permission.js 守卫（roles.length === 0 闸门，真实链路原样跑）
                    ├─ userStore.getInfo()        → Demo Adapter → 静态 super 身份
                    │     └─ roles=['business_admin'], permissions=['*:*:*']
                    └─ permissionStore.generateRoutes()
                          └─ getRouters()         → Demo Adapter → APMS 13 菜单静态树
                                └─ router.addRoute 动态注册 → return {...to, replace:true} 重导航
              （之后页面里的 101 个业务请求同样全部经 Demo Adapter 本地闭环）
```

> **关键机制 1：初始化必须交给真实链路，enterDemo 不预填身份。**
> permission.js 只有在 `userStore.roles.length === 0` 时才执行 `getInfo() → generateRoutes() → addRoute()`；
> 若提前注入 roles，守卫直接放行，此时 `/apms/dashboard` 动态路由尚未注册，导航必然失败。
> 因此 enterDemo 反而要**确保 roles 为空**，让 getInfo/getRouters 经 Demo Adapter 拿到静态返回值，
> 由系统自身完成身份填充与动态路由注册——不需要 setupDemoProfile()。
>
> **关键机制 2：Demo Adapter，而不是在 request 拦截器里 return 伪 response。**
> Axios 1.13.2 中 request interceptor 的返回值必须是 request config，随后交给 adapter 派发；
> 直接 `return {data,...}` 会让 XHR adapter 拿到 `method=undefined` 的 config 而崩溃（已有 RuoYi 同类教训）。
> 正确做法只换 adapter：正常模式走 XHR/fetch adapter，演示模式完全本地闭环。

- **为什么能复用真实页面**：页面只认 store 里的 roles/permissions、菜单树、API 响应。三者全部由 mock 喂给真实组件，Layout/路由/权限指令/字典/TagsView 等框架机制零改动。
- **为什么刷新可还原身份但重置数据**：token 是**会话级 Cookie（setSessionToken，浏览器退出即失效，区别于正式登录的 30 天持久 Cookie）**、演示标记在 sessionStorage（复制到新标签页的边缘场景见下）；内存 DB 每次页面加载从 fixtures 重新深拷贝。
- **退出**：头像菜单「退出登录」走现有 logOut（/logout 也被 mock 返回成功），额外清除演示标记与 token，回到 /login。

## 四、文件清单

### 新增（8 个）

| 文件 | 职责 |
|---|---|
| `src/utils/demo.js` | 常量与生命周期：`DEMO_TOKEN_PREFIX`、`isDemoEnabled()`（env `VITE_DEMO_ENABLED`，默认 true）、`PASSCODE`（env `VITE_DEMO_PASSCODE`，默认 `8888`）、`isDemoMode()`、`enterDemo()`（**调 auth.js 的 `setSessionToken()`** 写会话级 token + 标记 + `db.resetDb()` + **把 userStore.roles/permissions 清空**，不填任何身份字段）、`exitDemo()`（清标记；token 与 store 清理由现有 logOut 完成）、`isDemoToken()`（`getToken()?.startsWith(DEMO_TOKEN_PREFIX)`）。**不设 setupDemoProfile()**——身份完全由 mock 的 getInfo 经真实 getInfo() action 填充；不直接引用 TokenKey，token 读写只走 auth.js。 |
| `src/views/login/DemoPassDialog.vue` | 口令弹窗（el-dialog + 密码输入，回车提交；错误抖动+提示；文案说明「静态演示，刷新还原」） |
| `src/mock/index.js` | 两部分：① `demoAdapter(config)`——Axios 自定义 adapter，返回 `Promise<AxiosResponse>`：`{ data: body, status: 200, statusText: 'OK', headers: {}, config, request: {} }`（完整响应形态；演示态不存在 blob 通道，见下方下载处理）。② `mockDispatch(config)`——按 method+url 模式匹配 handler；通用工具（分页切片 pageNum/pageSize、参数过滤、`ok()/list()/detail()` body 工厂）；**未匹配不静默成功**（见「未匹配接口策略」小节）。`method` 统一 `(config.method || 'get').toLowerCase()` 兜底。 |
| `src/mock/db.js` | 内存 DB：`resetDb()` 深拷贝全部 fixtures 生成可变数据集（athletes/teams/indicators/testModels/testTasks/testResults/bodyMeasures/phvs/rtps/comboModels/comboScores/medicals/reports…），供 handler 增删改 |
| `src/mock/fixtures/system.js` | 框架数据（喂给**真实** getInfo()/菜单/字典机制）：① `GET /getInfo` body——`{ user: { userId: -1, userName: 'super', nickName: '体验账号（super）', avatar: '' }, roles: ['business_admin'], permissions: ['*:*:*'], portalMode: false, homePath: '', pwdChrtype: null, isDefaultModifyPwd: false, isPasswordExpired: false }`（avatar 空串 → getInfo action 回退本地 defAva 图，不产生 HTTP；两个密码弹窗标志必须 false）；② `GET /getRouters` 静态菜单树（仅 APMS 目录）；③ `GET /system/dict/data/type/*` 字典（apms_* 与 sys_user_sex 等）；④ 部门树 `GET /system/dept/roleDeptTreeselect` 等框架接口、`POST /logout` 成功体、个人 profile 接口。 |
| `src/mock/fixtures/dashboard.js` | overview + stats 聚合数据（卡片数字、图表序列、RTP 预警数等，数字与运动员/任务样本自洽） |
| `src/mock/fixtures/business.js` | 13 模块业务样本（1 个文件集中导出，约 800-1100 行）：24 名 U13–U18 运动员 + 4 支队伍/小组、~20 项指标、~6 个测试模型、进行中/已完成任务、成绩记录、体态/PHV/RTP、组合模型与评分、医疗记录、报告；跨模块 ID 关联（任务→运动员→成绩→RTP→报告） |
| `src/mock/handlers.js` | 101 接口的 handler 表（框架接口 + 14 业务模块；list 通用分页过滤 + 每模块专属动作：testTask 执行、comboScore 计算、report 生成、rtp 评估/清除、medical 附件删除等，均改内存 db 后返回成功）。**下载类接口不进 handler 表**（见下方三条下载通道的拦截方式）。 |

> fixtures/handlers 如体积过大可在实施时按模块拆文件，目录结构不变。

### 修改（8 处，均为小改）

1. [utils/auth.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/auth.js)
   - 新增一个会话级写入接口，正式登录的 `setToken`（30 天持久）不动：
     ```js
     // 演示模式专用：不设 expires → 会话 Cookie，浏览器完全退出即失效
     export function setSessionToken(token) {
       return Cookies.set(TokenKey, token)
     }
     ```
   - `getToken/removeToken` 复用现有实现（removeToken 已同时清新旧名）；demo.js 只依赖 `getToken/setSessionToken/removeToken`，不接触 TokenKey。
2. [LoginFormFields.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login/LoginFormFields.vue)
   - 新增 prop `demoEntry: Boolean`（默认 false）；提交按钮下方渲染居中小号文字按钮「一键体验演示环境 →」，`emit('demo')`；
   - 设计器预览 `preview=true` 时不渲染（设计器侧零影响）。
3. [login.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login.vue)
   - `#form` 内给 LoginFormFields 传 `:demo-entry="isDemoEnabled()"`、`@demo="dialogVisible=true"`；挂载 `DemoPassDialog`；
   - 口令正确 → `await enterDemo()` → `router.replace('/apms/dashboard')`。
4. [request.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js)（两处）
   - **请求拦截器**中（仍返回 config）挂 adapter：
     ```js
     if (isDemoMode()) {
       config.adapter = demoAdapter   // 换成本地 adapter，零真实 HTTP
     }
     return config
     ```
   - **`download()` 函数顶部直接拦截**（注意：不能靠返回 `{code:601}` 的 blob 体——现有响应拦截器第 82 行先判断 `responseType==='blob'/'arraybuffer'` 直接 `return res.data`，根本走不到第 101 行的 601 分支）：
     ```js
     export function download(url, params, filename, config) {
       if (isDemoMode()) {
         ElMessage.warning('演示环境暂不支持文件下载')
         return Promise.resolve()      // 不起 loading、不发请求
       }
       downloadLoadingInstance = ElLoading.service(...)
       // ...原逻辑不动
     }
     ```
   - 普通 JSON 链路照常走现有响应拦截器（200 解包 / 601 warning / 500 error），API 文件与页面组件无感知。
5. [plugins/download.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/plugins/download.js)（防御性）
   - 该插件用的是**裸 `axios`**（非 service 实例），adapter 换不到；目前仅代码生成器 tool/gen、tool/build 使用，不在演示菜单内，但为杜绝真实请求，在 `name()/resource()/zip()` 三个方法顶部各加同一个 `isDemoMode()` 守卫（warning + return）。
6. **APMS 页面内的原生 fetch 下载/上传点（组件层守卫，adapter 与 download() 都管不到原生 fetch / el-upload）**：
   - [medical/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/apms/medical/index.vue#L480-L486) `handleDownload()`（`fetch()` 带 Bearer 下附件）顶部：演示态 `ElMessage.warning('演示环境暂不支持附件下载'); return`；附件 el-upload 演示态 `:disabled="isDemoMode()"` 并提示；
   - [report/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/apms/report/index.vue#L396-L402) 报告下载 `fetch()` 处同样守卫；
   - 阶段 1 全局排查其余 `fetch(`、`new FormData` 直传点（头像等），演示态一并禁用；附件删除按钮（走 delMedicalFile → service）由 mock handler 正常支持（内存删除+成功提示）。
7. [store/modules/user.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/store/modules/user.js)
   - **getInfo() 不改**：mock 返回体已按其契约构造（user/roles/permissions/portalMode/homePath/密码标志），由它原样完成身份填充；
   - 仅 `logOut()` 的 `.then()` 里加一行：demo token 时 `sessionStorage.removeItem('apms_demo_mode')`（否则退出后登录页的公开配置请求仍会被 demoAdapter 接管）；logout 接口本身由 mock 返回成功，store 字段清空逻辑全部复用现有代码。
8. [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js)
   - **顺序约束**：边缘防护只能加在 `isShowcaseHost()` 收敛分支**之后**、`getToken()` 分支内——展示域（www/裸域）永远先收敛到 /，不进入 token/用户/动态菜单逻辑，两套机制天然不相交；
   - 防护逻辑：token 为 demo 前缀但 `isDemoMode()` 为假（新标签页：有会话 Cookie 无 sessionStorage 标记）→ `removeToken()` + 回 /login。

### 可选（视觉提示，建议做）

- Layout 顶部（Navbar 下）演示态横幅：「演示模式 · 数据为静态样本，仅当前标签页有效，刷新还原」，可关闭，琥珀色底；右上角用户区显示「体验账号」。改 `layout/index.vue` 或 Navbar，约 30 行。

## 五、关键流程约定

### enterDemo（不预填身份，交给守卫真实初始化）
1. 校验口令（`PASSCODE`，trim 后比对，错误次数不限制但有错误提示）；
2. `setSessionToken(DEMO_TOKEN_PREFIX + Date.now())`——走 auth.js 新接口（**不设 expires 的会话 Cookie，非 30 天持久**，自动复用现有 cookieName 端口隔离）；浏览器完全退出后 token 自行消失；
3. `sessionStorage.setItem('apms_demo_mode','1')`；
4. `db.resetDb()`；
5. **清空身份态**：`userStore.roles = []; userStore.permissions = []`（防御上一个账号残留；Pinia 在内存中，未刷新直接进演示时可能非空。也可调 `userStore.$reset()`，但 $reset 会把 token state 重置为 cookie 初值，选最小两项即可）；
6. `router.replace('/apms/dashboard')` → 守卫见 `roles.length===0` → 真实链路依次执行 `getInfo()`（demoAdapter 返回 super 身份）与 `generateRoutes()/addRoute()`（demoAdapter 返回 APMS 菜单树）→ `return {...to, replace:true}` 重导航落地看板。**全程不新增任何初始化分支。**

### 刷新 / 重开 / 退出时的状态
- **同标签刷新**：会话 Cookie 与 sessionStorage 均存活，Pinia 重置后 roles 为空 → 守卫重跑 getInfo/getRouters（mock）恢复身份，db 从 fixtures 重新深拷贝 → 数据还原、身份自动恢复；
- **新标签粘贴 URL**：会话 Cookie 在同一浏览器会话的标签间共享，但 sessionStorage 不共享 → 守卫边缘防护（§四-6）识别「demo token 但非演示态」→ 清 token 回 /login，绝不拿 demo token 请求真实后端；
- **退出**：现有 logOut → mock `/logout` 成功 → 清空 token/roles/permissions（现有代码）+ 清演示标记（user.js 新增一行）→ 回 /login，登录页恢复真实公开配置接口。

### mock 响应工厂（body 由 demoAdapter 包成 AxiosResponse）
- handler 只产出业务 body（标准 RuoYi 结构），由 `demoAdapter` 统一封装；
- 列表：`{code:200, rows: db.xxx.filter(按 query 精确/like 过滤).slice((pageNum-1)*pageSize, pageSize*pageNum), total}`；
- 详情：`{code:200, data: find(id)}`；
- 新增：生成负 ID（`-Date.now()`，避免与样本冲突）+ createTime=now，unshift；
- 修改：map 替换 + updateTime；删除：按逗号 ids filter；
- 动作类：更新相关记录状态字段（如任务状态、报告状态）后 `{code:200}`——页面自身的成功提示与列表刷新逻辑天然生效；
- **文件类操作不 mock**：`download()`、裸 axios 下载插件、页面原生 fetch 下载/el-upload 均在各自调用点**进入前**拦截（§四-4/5/6），不产生「假成功」。

### 未匹配接口策略（不静默成功）

漏配 mock 的保存接口若返回假成功，会出现「提示保存成功但数据没变」且极难排查，因此未匹配请求一律显式暴露：

| 模式 | 未匹配 GET | 未匹配 POST/PUT/DELETE |
|---|---|---|
| **strict**（dev 默认；UAT 构建可设 `VITE_DEMO_MOCK_STRICT=true`） | `console.error('[DEMO MOCK MISS]', method, url)` + `{code:601, msg:'演示数据接口尚未实现：GET url'}` | 同左（601 走现有拦截器弹 warning，页面 catch 不落地假数据） |
| **lenient**（生产构建默认） | `console.error(...)` + 空态 200（`{code:200, rows:[], total:0, data:null}`，页面呈现空列表/空详情） | `console.error(...)` + `{code:601, msg:'演示环境暂不支持此操作'}` |

要点：
- 任何环境、任何方法，未匹配都先 `console.error('[DEMO MOCK MISS]', method, url, config)`，开发/UAT 控制台零容忍；
- 修改类接口在任何模式下都不返回成功——杜绝假保存；
- strict/lenient 由 `import.meta.env.DEV || VITE_DEMO_MOCK_STRICT==='true'` 决定；
- **覆盖率脚本是上线门禁**（§八）：扫描 `src/api/**/*.js` 提取全部 url+method 与 handler 表比对，未覆盖项必须清零才允许阶段 3 验收。

### 菜单树蓝本
`fixtures/system.js` 的 getRouters 数据**以 dev 真实接口返回为蓝本**：实施时用 admin/admin123 在本地 dev 获取 token 后 `curl /prod-api/getRouters`（或经 vite 代理），摘取 APMS 子树（2200 及其 13 子菜单）固化为 JSON，保证 name/path/component/meta 结构零偏差；仅保留 APMS 目录（演示态不展示系统管理等非业务菜单，符合「APMS 模块展示」定位；首页路由 /index 仍可直达）。

## 六、安全与边界

- 演示态**零真实业务请求**：service 实例由 demoAdapter 接管（拦截器本身只 return config）；三条非 service 通道（`download()`、裸 axios 插件、页面原生 fetch/el-upload）在调用点前置拦截；漏配 handler 不静默成功（§五策略）。demo token 对真实后端无效（天然 401），且不会被发出，无法借演示态访问真实数据。
- 口令防君子不防小人：bundle 可见，不做频率限制（可接受）；env `VITE_DEMO_PASSCODE` 可换，`VITE_DEMO_ENABLED=false` 可一键关闭入口。
- 演示标记是 sessionStorage：关闭标签即失效；A 标签演示中复制 URL 到 B 标签 → 守卫边缘防护清 token 回登录页，不会拿 demo token 打真实后端。
- 不影响正常登录：所有新增逻辑以 `isDemoMode()/demoEntry` 门控，正常账号登录链路与设计器预览零回归。
- 纯前端、无数据库操作、无 nginx/后端改动；不 commit。

## 七、实施步骤（建议三阶段，每阶段可独立验收）

1. **阶段 1 · 骨架打通**：demo.js + 口令弹窗 + 登录页入口 + request 拦截器挂载 demoAdapter + db/mock 框架（含 strict 未匹配策略）+ getInfo/getRouters/字典 + 演示横幅 + **三条下载/上传通道前置守卫排查落地**。验收：8888 进入，Layout/APMS 菜单/路由全通，Network 面板**零业务请求**（含下载/上传），控制台无 `[DEMO MOCK MISS]` 之外的报错。
2. **阶段 2 · 13 模块数据与交互**：business fixtures（关联样本）+ handlers（列表过滤分页、详情、假增删改、专属动作）。验收：逐菜单浏览、筛选、打开详情、新增/修改/删除本地生效、刷新还原；控制台保持零 MISS。
3. **阶段 3 · 覆盖率门禁与打磨**：覆盖率脚本扫全部 api 文件与 handler 比对、未覆盖清零；lenient/strict 双模式验证；下载/上传提示、空态与边界（空筛选结果、翻页末页）；`vite build` + 诊断 + UAT（localhost 直接点入口）验收。

## 八、验证方式（不用无头浏览器）

- `npx vite build` + GetDiagnostics；
- Node 桩测：口令校验、demoAdapter 经**真实 axios 1.13.2 实例**走通（200/601 两分支进入现有响应拦截器）、mockDispatch 匹配、db 增删改纯函数；
- **覆盖率脚本（上线门禁）**：扫描 `src/api/**/*.js` 提取全部 url+method 与 handler 表比对，输出未覆盖清单，阶段 3 必须清零；
- dev/UAT 浏览器人工验收：入口显隐、错误口令、进入后 **Network 零真实请求**（下载点按钮验证只弹 warning 不出请求）、控制台零 `[DEMO MOCK MISS]`、各模块浏览与本地假提交、刷新还原、退出回登录页；
- 回归：正常账号登录、登录设计器预览（无入口）、www/裸域展示页（无入口、收敛不变）。

## 九、风险

| 风险 | 应对 |
|---|---|
| Axios mock 机制用错（request 拦截器返回伪 response 致 XHR adapter 崩溃） | 严格用 `config.adapter = demoAdapter` + `return config`；adapter 返回完整 AxiosResponse、method 缺省兜底 get；阶段 1 Node 桩测在真实 axios 1.13.2 实例上验证 |
| blob 下载的 601 假象：响应拦截器先判 blob 直接 return，601 分支走不到 | 不在 mock 层伪造 blob；`download()` 函数顶部前置拦截；另排查裸 axios（plugins/download.js）与原生 fetch（medical/report）两条绕过 service 的通道，调用点守卫 |
| 漏配 mock 的写接口假成功（"保存成功"但无变化） | 未匹配修改类一律 601 + `console.error('[DEMO MOCK MISS]')`；dev/UAT strict 模式 GET 也 601；覆盖率脚本门禁清零 |
| 101 接口字段结构多，fixtures 工作量大 | 蓝本优先：真实 getRouters JSON 固化；业务字段以页面表格/表单列代码为准逐模块核对；通用 CRUD 工厂覆盖 80% 模式，专属接口单列 |
| el-upload/原生 fetch 绕过 axios | 阶段 1 排查 medical 附件、report 下载、头像/导入控件，演示态隐藏或前置守卫并给提示 |
| 假提交后组件 keep-alive 缓存不刷新 | 与真实系统行为一致（页面自身操作后有刷新逻辑的都走 then 回调），不额外处理 |
| 样本数据不自洽（图表数字与列表对不上） | dashboard fixtures 从同一份 athletes/tasks/rtps 派生计算，单一数据源 |
| 后续真实菜单/接口变更，mock 漂移 | handler 覆盖率脚本纳入阶段 3 验收；mock 代码集中在 src/mock，注释标注「随菜单/接口变更同步」 |
