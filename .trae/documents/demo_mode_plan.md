# 「一键体验」演示模式实施计划（登录页口令 → super 全模块静态系统）

## 一、目标与已确认决策

在登录页增加「一键体验」入口：点击 → 弹口令框 → 输入 `8888` → 进入一个**界面与 super（业务管理员 business_admin）登录后完全一致、但数据全部为前端静态样本**的 APMS 系统。

| 决策项 | 结论（用户已拍板） |
|---|---|
| 展示形态 | **真实系统外壳 + 13 个真实业务页面组件**，数据全部前端内置假数据（非独立长页/截图） |
| 交互深度 | **假提交本地生效**：新增/修改/删除/计算/生成等在标签页内存中真实反映，**刷新即还原**；下载/上传等文件类操作给「演示环境不支持」提示 |
| 入口范围 | **仅登录页**（aoti / IP / localhost）。www.apms.top 与裸域展示页保持「纯展示死胡同」，不放入口 |
| 口令 | 固定 `8888`，前端常量（可 env 覆盖）。**纯前端校验，F12 可见，仅防普通访客，不具安全性**——用户已知悉并接受 |
| 凭证隔离（P0） | **Demo 会话只存单个 sessionStorage 键（JSON，模式+token 原子同存），绝不写正式 Admin-Token Cookie**；`getToken()` 对演示态 fail-closed——只要会话标记是 demo，凭证异常/缺失时返回 undefined，**绝不回落真实 Cookie**（详见§三） |
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
        ├─ sessionStorage.apms_demo_session = {mode:'demo', token:'demo-static-xxxx'}  # 单键 JSON，原子同存，标签页隔离
        ├─ db.resetDb()
        ├─ userStore.roles/permissions/token = 清空/同步        # 关键：roles 必须空，守卫才走初始化
        └─ router.replace('/apms/dashboard')
              └─ permission.js 守卫（getToken() 命中单键会话中的 demo token；roles===0 闸门）
                    ├─ userStore.getInfo()        → Demo Adapter → 静态 super 身份
                    │     └─ roles=['business_admin'], permissions=['*:*:*']
                    └─ permissionStore.generateRoutes()
                          └─ getRouters()         → Demo Adapter → APMS 13 菜单静态树
                                └─ router.addRoute 动态注册 → return {...to, replace:true} 重导航
              （之后页面里的 101 个业务请求：demoAdapter → normalizeRequest() 规范化 → handler 本地闭环；
                正式 Admin-Token Cookie 全程不读不写）
```

> 规范化管道（关键 P0，见§五「请求规范化」）：
> `config（url 已被 tansParams 改写为带 ?query 的形式、params 已清空）→ demoAdapter → normalizeRequest() → { method, path, query, body } → handler 按 path 精确/参数段匹配，只从 ctx.query/ctx.body 取参。`

> **关键机制 0（P0）：单键会话 + fail-closed，Demo 不碰正式 Cookie。**
> Cookie 按 host 共享、**不按标签页隔离**。若 demo 复用 Admin-Token Cookie：
> ① Tab A 在已渲染的登录页点体验、Tab B 刚真实登录 → demo 写入会**覆盖整个 host 的真 token，Tab B 下一请求 401 被踢**；
> ② 反之新标签发现 demo Cookie 后清除会**连演示标签的凭证一起删掉**。
> 因此：
> - 正式身份 → Cookie `Admin-Token`（30 天，现状不动）；
> - 演示身份 → sessionStorage **单键** `apms_demo_session`，值为 JSON `{ mode:'demo', token:'demo-static-…' }`——模式与凭证在同一个值里原子同存，从根源上不存在"模式在、token 没了"的半态（标签页隔离，关闭标签即失）；
> - 所有 sessionStorage 访问包 try/catch（与 [entry.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/entry.js#L47-L61) 现有风格一致）：存储被禁/损坏时按"无会话"处理，绝不影响普通登录读 Cookie；
> - [auth.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/auth.js) `getToken()` 对演示态 **fail-closed**：
>
>   ```js
>   const s = readDemoSession()              // 安全读单键 JSON，损坏/不可用 → null
>   if (s && s.mode === 'demo') {
>     return typeof s.token === 'string' && s.token.startsWith(DEMO_TOKEN_PREFIX)
>       ? s.token
>       : undefined                          // 半态/损坏：宁未登录，绝不回落真 Cookie
>   }
>   return Cookies.get(TokenKey) || /* 旧名兜底 */ …
>   ```
>
> 已核实全项目 12 个文件、33 处凭证消费点（request 拦截器、[plugins/download.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/plugins/download.js)、medical/report 的 fetch、FileUpload/ImageUpload/ExcelImport/CsvImport/Editor 等 5 个上传组件、permission 守卫）**全部统一经 `getToken()` 取 token**——改这一个函数即全链路隔离。由此安全承诺成立：**演示态下任何通道（含漏拦截的原生 fetch）拿到的只可能是假 token 或 undefined，永远拿不到真实凭证**；半态最坏结果是演示页提示未登录/请求失败，而不是借真实会话访问。
>
> `isDemoMode()` 与 `getToken()` 必须由**同一个 `readDemoSession()` 派生**（demo.js 从 auth.js 导入），禁止再各读各的键，确保两个判断永不分叉。
>
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
- **多标签并存矩阵**（host=aoti.apms.top，同一浏览器窗口）：

  | 标签 | sessionStorage 单键 | `getToken()` 返回 | 行为 |
  |---|---|---|---|
  | A 演示中 | `apms_demo_session={mode:'demo',token:demo-static}` | demo-static | 全本地 mock，零真实请求 |
  | B 真实登录 | 无该键 | Cookie 真 token | 正常业务系统，A 不影响它 |
  | C 新开粘贴 A 的 URL | 无该键 | Cookie 真 token（或无） | 进真实系统或被导到登录页——**天然不需要"新标签清除"逻辑** |
  | （故障态）单键 JSON 损坏/token 缺失或非法 | mode='demo' 但内容坏 | **undefined（fail-closed）** | 演示页被导向登录/请求失败，**绝不读到真 Cookie** |
- **为什么刷新可还原身份但重置数据**：同标签刷新 sessionStorage 存活 → 守卫重跑 mock 的 getInfo/getRouters 恢复身份；内存 DB 每次页面加载从 fixtures 重新深拷贝。关闭标签/浏览器后 sessionStorage 清空，演示态无任何残留，正式 Cookie 不受影响。
- **退出演示 ≠ 调 logout**：演示退出**不调 `/logout`、不 `removeToken()`**（否则可能误删同一 host 上真实登录的 Cookie），只删除单个 `apms_demo_session` 键并重置内存 store，随后整页跳回登录流程。

## 四、文件清单

### 新增（8 个）

| 文件 | 职责 |
|---|---|
| `src/utils/demo.js` | 常量与生命周期：会话键名 `DEMO_SESSION_KEY='apms_demo_session'` 与 token 前缀 `DEMO_TOKEN_PREFIX='demo-static-'`（从 auth.js re-export 或统一定义于 auth.js，避免循环依赖）、`isDemoEnabled()`（env `VITE_DEMO_ENABLED`，默认 true）、`PASSCODE`（env `VITE_DEMO_PASSCODE`，默认 `8888`）、`isDemoMode()`（**`readDemoSession()?.mode === 'demo'`，与 getToken 同源，不另读键**）、`enterDemo()`（**一次 `setDemoSession(token)` 原子写入单键 JSON**（写失败/存储不可用则抛错并提示"当前环境无法开启演示"，不进入）+ `db.resetDb()` + 清空 userStore.roles/permissions 并同步 token 字段，不填任何身份字段）、`exitDemo()`（**`clearDemoSession()` 删单键，不碰 Cookie**）。**不设 setupDemoProfile()**——身份完全由 mock 的 getInfo 经真实 getInfo() action 填充；不直接引用 TokenKey，正式 Cookie 的读写只走 auth.js 既有 `setToken/removeToken`。 |
| `src/views/login/DemoPassDialog.vue` | 口令弹窗（el-dialog + 密码输入，回车提交；错误抖动+提示；文案说明「静态演示，刷新还原」） |
| `src/mock/index.js` | 三部分：① `normalizeRequest(config)`（**P0**，见§五）——demoAdapter 的第一道工序：`method=(config.method||'get').toLowerCase()`；剥除 `config.baseURL` 前缀后 `new URL(config.url,'http://demo.local')` 取 **pathname（匹配键，绝不含 query）** 与 `searchParams`（→ query 对象）；body 对 string 做安全 JSON.parse、对象直用；输出 `{method, path, query, body, rawConfig}`。② `demoAdapter(config)`——`const ctx = normalizeRequest(config); const body = await mockDispatch(ctx)`，包成 AxiosResponse：`{ data: body, status: 200, statusText: 'OK', headers: {}, config, request: {} }`。③ `mockDispatch(ctx)`——按 method+path 模式匹配 handler；通用工具（分页切片、参数过滤、`ok()/list()/detail()` body 工厂）；**未匹配不静默成功**。 |
| `src/mock/db.js` | 内存 DB。**实现不变量：模块加载即初始化**（见§五「内存 DB 生命周期」）：`resetDb()` 深拷贝全部 fixtures 生成可变数据集（athletes/teams/indicators/testModels/testTasks/testResults/bodyMeasures/phvs/rtps/comboModels/comboScores/medicals/reports…），文件末尾立即调用一次（或 `let db = createDbFromFixtures()` 声明即初始化）；`getDb()` 返回当前数据集，供 handler 读写。两条得新数据路径：① enterDemo 显式 `resetDb()`；② F5/整页刷新后 JS 模块重新加载 → 模块级初始化自动再生成一份。 |
| `src/mock/fixtures/system.js` | 框架数据（喂给**真实** getInfo()/菜单/字典机制）：① `GET /getInfo` body——`{ user: { userId: -1, userName: 'super', nickName: '体验账号（super）', avatar: '' }, roles: ['business_admin'], permissions: ['*:*:*'], portalMode: false, homePath: '', pwdChrtype: null, isDefaultModifyPwd: false, isPasswordExpired: false }`（avatar 空串 → getInfo action 回退本地 defAva 图，不产生 HTTP；两个密码弹窗标志必须 false）；② `GET /getRouters` 静态菜单树（仅 APMS 目录）；③ `GET /system/dict/data/type/*` 字典（apms_* 与 sys_user_sex 等）；④ 部门树 `GET /system/dept/roleDeptTreeselect` 等框架接口、个人 profile 接口（**不含 `/logout`——演示退出不调后端，见§五退出流程**）。 |
| `src/mock/fixtures/dashboard.js` | overview + stats 聚合数据（卡片数字、图表序列、RTP 预警数等，数字与运动员/任务样本自洽） |
| `src/mock/fixtures/business.js` | 13 模块业务样本（1 个文件集中导出，约 800-1100 行）：24 名 U13–U18 运动员 + 4 支队伍/小组、~20 项指标、~6 个测试模型、进行中/已完成任务、成绩记录、体态/PHV/RTP、组合模型与评分、医疗记录、报告；跨模块 ID 关联（任务→运动员→成绩→RTP→报告） |
| `src/mock/handlers.js` | 101 接口的 handler 表，签名统一 `(ctx)`、内部用 `getDb()` 取库（不自行持有引用）：键为 `METHOD path`（path 不含 query；支持 `:param` 段）；框架接口 + 14 业务模块；list 通用分页过滤（**只读 `ctx.query`**）+ 每模块专属动作：testTask 执行、comboScore 计算、report 生成、rtp 评估/清除、medical 附件删除等，均改内存 db 后返回成功。**下载类接口不进 handler 表**（见下方三条下载通道的拦截方式）。 |

> fixtures/handlers 如体积过大可在实施时按模块拆文件，目录结构不变。

### 修改（7 处，均为小改；permission.js 零改动）

1. [utils/auth.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/auth.js)（P0 单键会话 + fail-closed，正式 `setToken/removeToken` 一行不动）
   - 新增演示会话的**安全读写**（try/catch 风格对齐 [entry.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/entry.js#L47-L61)）与 fail-closed 的 `getToken()`：
     ```js
     export const DEMO_SESSION_KEY = 'apms_demo_session'
     export const DEMO_TOKEN_PREFIX = 'demo-static-'

     // 所有 sessionStorage 访问统一过这一层：存储被禁/JSON 损坏一律按"无会话"处理
     export function readDemoSession() {
       try {
         const raw = sessionStorage.getItem(DEMO_SESSION_KEY)
         return raw ? JSON.parse(raw) : null
       } catch (e) {
         return null
       }
     }
     export function setDemoSession(token) {
       // 单次 setItem：mode 与 token 原子同存，不存在两键半态
       sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ mode: 'demo', token }))
     }
     export function clearDemoSession() {
       try { sessionStorage.removeItem(DEMO_SESSION_KEY) } catch (e) {}
     }

     export function getToken() {
       const s = readDemoSession()
       if (s && s.mode === 'demo') {
         // fail-closed：演示态只认真正的 demo token；异常/缺失 → undefined，绝不回落 Admin-Token
         return typeof s.token === 'string' && s.token.startsWith(DEMO_TOKEN_PREFIX)
           ? s.token : undefined
       }
       return Cookies.get(TokenKey)
         || (TokenKey !== LegacyTokenKey ? Cookies.get(LegacyTokenKey) : undefined)
     }
     ```
   - 注：`setDemoSession` 的写 try/catch 由调用方 `enterDemo()` 处理失败（存储不可用时弹错并中止进入）；`DEMO_SESSION_KEY/DEMO_TOKEN_PREFIX/readDemoSession/setDemoSession/clearDemoSession` 从 auth.js 导出，demo.js 只消费不另定义，auth.js 保持为无业务依赖的叶子模块，杜绝循环依赖。
   - 半态边界说明：`{mode:'demo'}` 缺 token、token 为 null/非前缀串等**可解析的坏会话**一律 fail-closed 返回 undefined；完全无法解析的 JSON / 存储不可用按"无会话"处理（回落 Cookie）——后者与 [entry.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/entry.js#L58-L61) 的既有容错原则一致，且只可能是用户破坏自身存储，不构成跨标签凭证泄露。
   - 正式 `setToken`（30 天 Cookie）/`removeToken`（清新旧 Cookie）保持原样，demo.js 永不调用它们。
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
   - `logOut()` **最前面加演示态分支，短路真实 logout API 与 Cookie 清理**：
     ```js
     logOut() {
       return new Promise((resolve, reject) => {
         if (isDemoMode()) {
           // 不调 /logout、不 removeToken()：保护同 host 其他标签可能存在的真实登录 Cookie
           exitDemo()                         // clearDemoSession()：删除单个 apms_demo_session 键
           this.token = ''
           this.roles = []
           this.permissions = []
           this.portalMode = false
           this.homePath = ''
           return resolve()
         }
         logout(this.token).then(() => { /* …现有正式退出逻辑原样… */ })
       })
     }
     ```
   - 三个调用方（[Navbar L127](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/layout/components/Navbar.vue#L127) → `location.href='/index'`、[request.js 401 L90](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js#L90) → 同、[lock.vue L124](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/lock.vue#L124)）`.then` 后的跳转保持不变：整页加载后守卫见 sessionStorage 已空、若正式 Cookie 也不在则回 /login；**若同 host 恰有真实登录 Cookie（别的标签登的），则进入真实系统——这是正确行为，不构成串号**。
8. [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js) —— **零改动，仅确认两点**：
   - 原计划的「demo token 但无标记 → removeToken 回登录页」边缘防护**整段删除**：凭证改为 sessionStorage 单键后，新标签天然读不到演示会话（`getToken()` 回落到 Cookie），不存在需要清除的共享态；
   - 既有顺序天然正确：`isShowcaseHost()` 收敛在最前，展示域不进 token/用户/动态菜单逻辑；演示态只可能出现在业务域。

### 可选（视觉提示，建议做）

- Layout 顶部（Navbar 下）演示态横幅：「演示模式 · 数据为静态样本，仅当前标签页有效，刷新还原」，可关闭，琥珀色底；右上角用户区显示「体验账号」。改 `layout/index.vue` 或 Navbar，约 30 行。

## 五、关键流程约定

### enterDemo（不写 Cookie、不预填身份，交给守卫真实初始化）
1. 校验口令（`PASSCODE`，trim 后比对，错误次数不限制但有错误提示）；
2. **原子写入单键会话**：`setDemoSession(DEMO_TOKEN_PREFIX + Date.now())`——一次 setItem 写入 JSON `{mode:'demo', token}`，杜绝两键半态；全程不触碰 Admin-Token Cookie。若 setItem 抛错（Web Storage 被禁）→ `ElMessage.error('当前浏览器环境不支持演示模式')` 并中止，不进入演示；
3. `db.resetDb()`（显式取一份全新数据；刷新路径的还原由 db.js 模块级初始化不变量保证，见§五「内存 DB 生命周期」）；
4. **重置身份态**：`userStore.roles = []; userStore.permissions = []`（守卫 `roles.length===0` 闸门成立的必要条件，防御同标签上一个账号残留），并 `userStore.token = getToken()`（同步为 demo token，保持 state 一致）；
5. `router.replace('/apms/dashboard')` → 守卫见 `roles.length===0` → 真实链路依次执行 `getInfo()`（demoAdapter 返回 super 身份）与 `generateRoutes()/addRoute()`（demoAdapter 返回 APMS 菜单树）→ `return {...to, replace:true}` 重导航落地看板。**全程不新增任何初始化分支。**

### 刷新 / 新标签 / 退出时的状态
- **同标签刷新**：单键 sessionStorage 存活 → `getToken()` 仍返回其中的 demo token，Pinia 重置后 roles 为空 → 守卫重跑 getInfo/getRouters（mock）恢复身份；db 模块重新求值并**模块级自动重置**（§五不变量）→ 数据还原、身份自动恢复，不依赖重跑 enterDemo；
- **新标签粘贴演示 URL**：新标签的 sessionStorage 为空 → 单键不存在，`getToken()` 自动回落到正式 Cookie：有真实登录则正常进真实系统（不是演示态），无则导到 /login。**不需要任何守卫特判，也不影响 A 标签的演示会话**；
- **关闭标签/浏览器**：sessionStorage 清空，演示态零残留；正式 Cookie 原封不动；
- **退出**（头像菜单/锁屏/401 三个现有出口统一走 `userStore.logOut()` 的演示分支）：不调 `/logout`、不 `removeToken()`，只 `exitDemo()` 删除单个 `apms_demo_session` 键 + 重置 store 字段 → 调用方既有整页跳转（`location.href='/index'`）→ 按 Cookie 现状进入真实系统或登录页。
- **故障半态**（单键内容可解析但残缺，如 `{mode:'demo'}`、token 非法）：`isDemoMode()` 仍为 true（下载/请求守卫照常拦），但 `getToken()` fail-closed 返回 undefined → 守卫因无 token 导向 /login、mock 请求即使用于其他通道也只带 undefined；**绝不会回落真实 Cookie 借道真实会话**。

### 内存 DB 生命周期（实现不变量：模块加载即有数据）

刷新不会重跑 `enterDemo()`（守卫只跑 getInfo/getRouters），所以"刷新即还原"不能依赖 enterDemo 里的 `resetDb()` 调用，必须由**模块初始化**保证：

```js
// src/mock/db.js
import * as fixtures from './fixtures/index'

let db

function createDbFromFixtures() {
  // fixtures 全为 JSON 兼容的纯数据（无函数/DOM/Date 特殊对象）；
  // structuredClone 在目标浏览器与 Node 18+ 均可用，如顾虑旧环境可回退 JSON 深拷贝
  return structuredClone(fixtures)
}

export function resetDb() {
  db = createDbFromFixtures()
  return db
}

export function getDb() {
  return db
}

// 不变量：模块首次被 import（request.js → mock/index.js → db）即生成一份。
// F5/整页刷新 → 整个 JS 上下文重建 → 本模块重新求值 → 自动再生成全新数据集，
// 不依赖任何调用方记得先 reset，杜绝 "db.xxx 为 undefined/空表" 的刷新故障。
resetDb()
```

两条"得全新数据"路径都由此闭合：

| 场景 | 触发 | db 来源 |
|---|---|---|
| 首次点「一键体验」 | `enterDemo()` 第 3 步显式 `resetDb()` | 全新深拷贝（防御：db 模块在登录页就已随 request.js 被 import，模块级那份可能已"陈旧"，虽然非演示态没人动它） |
| F5 / 浏览器恢复 / `location.href` 整页跳转后刷新恢复演示态 | JS 模块重新求值 | 文件末尾的模块级 `resetDb()` 自动执行 |
| 同标签内不刷新仅路由切换 | 无 | 沿用当前 db——假增删改持续可见，符合预期 |

handler 一律 `getDb()` 取库，不自行持有引用（避免 reset 后操作旧对象）。

### 请求规范化 normalizeRequest（P0：不规范化则所有列表接口全 MISS）

**仓库真实行为**（[request.js L34-40](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js#L34-L40)）：请求拦截器在 adapter 执行**之前**就对 GET 做了改写——
`config.url = config.url + '?' + tansParams(config.params); config.params = {}`（tansParams 还会把对象参数编码成 `params[beginTime]=..` 形式）。
因此 demoAdapter 拿到的 config 永远是 `url='/apms/athlete/list?pageNum=1&pageSize=10&name=..'`、`params={}`。若 handler 直接拿 `config.url` 匹配，所有列表接口全部命中不了：strict 下一片"接口尚未实现"，lenient 下一片空列表——**有菜单、没数据**。

规则（写死在 `src/mock/index.js`，任何 handler 不得绕过）：

```js
function normalizeRequest(config) {
  const method = (config.method || 'get').toLowerCase()
  // 自定义 adapter 收到的 url 不含 baseURL（buildFullPath 由默认 adapter 内部完成），
  // 但防御性剥一次前缀，避免环境差异
  let rawUrl = config.url || ''
  if (config.baseURL && rawUrl.startsWith(config.baseURL)) rawUrl = rawUrl.slice(config.baseURL.length)
  const u = new URL(rawUrl, 'http://demo.local')
  const query = Object.fromEntries(u.searchParams.entries())   // pageNum/pageSize/name/params[beginTime]…
  let body = config.data
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { /* 保留原串 */ } }
  return { method, path: u.pathname, query, body: body ?? {}, rawConfig: config }
}
```

handler 契约：
- handler 签名 `(ctx)`、内部 `getDb()` 取库：**匹配键只用 `ctx.path`（pathname）**：先精确匹配，再按参数段模板匹配（如 `GET /apms/medical-record/:id` → 捕获命名参数 `ctx.params.id`）；
- 分页/过滤参数一律取 **`ctx.query.pageNum / ctx.query.pageSize / ctx.query.name`**，**禁止读 `config.params`（拦截器已将其清空，恒为 `{}`）或自行 parse URL**；写操作入参取 `ctx.body`；
- 数字参数（pageNum/pageSize/状态码）由通用分页工具统一 `Number()` 转换与默认值兜底（1/10）；
- tansParams 的 `prop[key]` 编码经 `searchParams` 解析后键名原样保留（如 `params[beginTime]`），日期区间过滤按此键读取；
- POST/PUT 的 `config.data` 是**未序列化的 JS 对象**（axios 在默认 adapter 内才 stringify，自定义 adapter 抢先拿到对象），normalize 时对象直用、字符串才 JSON.parse。

### mock 响应工厂（body 由 demoAdapter 包成 AxiosResponse）
- handler 只产出业务 body（标准 RuoYi 结构），由 `demoAdapter` 统一封装；入参统一为规范化后的 `ctx`；
- 列表：`{code:200, rows: db.xxx.filter(按 ctx.query 精确/like 过滤).slice((pageNum-1)*pageSize, pageNum*pageSize), total}`；
- 详情：`{code:200, data: find(id)}`；
- 新增：生成负 ID（`-Date.now()`，避免与样本冲突）+ createTime=now，unshift；
- 修改：map 替换 + updateTime；删除：按逗号 ids filter；
- 动作类：更新相关记录状态字段（如任务状态、报告状态）后 `{code:200}`——页面自身的成功提示与列表刷新逻辑天然生效；
- **文件类操作不 mock**：`download()`、裸 axios 下载插件、页面原生 fetch 下载/el-upload 均在各自调用点**进入前**拦截（§四-4/5/6），不产生「假成功」。

### 未匹配接口策略（不静默成功）

漏配 mock 的保存接口若返回假成功，会出现「提示保存成功但数据没变」，而漏配列表若带 query 直接匹配又会造成「有菜单没数据」，因此未匹配请求一律显式暴露（MISS 判定基于**规范化后的 `ctx.method + ctx.path`**，不受 query 串影响）：

| 模式 | 未匹配 GET | 未匹配 POST/PUT/DELETE |
|---|---|---|
| **strict**（dev 默认；UAT 构建可设 `VITE_DEMO_MOCK_STRICT=true`） | `console.error('[DEMO MOCK MISS]', ctx.method, ctx.path)` + `{code:601, msg:'演示数据接口尚未实现：GET path'}` | 同左（601 走现有拦截器弹 warning，页面 catch 不落地假数据） |
| **lenient**（生产构建默认） | `console.error(...)` + 空态 200（`{code:200, rows:[], total:0, data:null}`，页面呈现空列表/空详情） | `console.error(...)` + `{code:601, msg:'演示环境暂不支持此操作'}` |

要点：
- 任何环境、任何方法，未匹配都先 `console.error('[DEMO MOCK MISS]', ctx.method, ctx.path, ctx.query)`，开发/UAT 控制台零容忍；
- 修改类接口在任何模式下都不返回成功——杜绝假保存；
- strict/lenient 由 `import.meta.env.DEV || VITE_DEMO_MOCK_STRICT==='true'` 决定；
- **覆盖率脚本是上线门禁**（§八）：扫描 `src/api/**/*.js` 提取全部 url+method 与 handler 表比对，未覆盖项必须清零才允许阶段 3 验收。

### 菜单树蓝本
`fixtures/system.js` 的 getRouters 数据**以 dev 真实接口返回为蓝本**：实施时用 admin/admin123 在本地 dev 获取 token 后 `curl /prod-api/getRouters`（或经 vite 代理），摘取 APMS 子树（2200 及其 13 子菜单）固化为 JSON，保证 name/path/component/meta 结构零偏差；仅保留 APMS 目录（演示态不展示系统管理等非业务菜单，符合「APMS 模块展示」定位；首页路由 /index 仍可直达）。

## 六、安全与边界

- **凭证隔离（P0，fail-closed）**：演示会话只存 sessionStorage 单键 JSON（mode+token 原子同存），正式 Admin-Token Cookie 全程不读不写不删——演示标签与真实登录标签（同 host）可并存，互不踢登录、互不删凭证。`getToken()` 单点裁决：演示态只返回合法 demo token，残缺/异常返回 undefined，绝不回落 Cookie；33 处既有凭证消费点零改动即完成隔离；
- 演示态**零真实业务请求**：service 实例由 demoAdapter 接管（拦截器本身只 return config）；三条非 service 通道（`download()`、裸 axios 插件、页面原生 fetch/el-upload）在调用点前置拦截；漏配 handler 不静默成功（§五策略）。即使有漏网的原生 fetch，经 `getToken()` 拿到的也只是假 token（或半态下的 undefined），真实后端只会 401，**不泄露、不借用任何真实会话**。
- 口令防君子不防小人：bundle 可见，不做频率限制（可接受）；env `VITE_DEMO_PASSCODE` 可换，`VITE_DEMO_ENABLED=false` 可一键关闭入口。
- 演示会话（模式+凭证）只在 sessionStorage 单键：关闭标签即失效，且按标签页隔离；新标签粘贴 URL 自然回落到真实/未登录态，无需特判。
- 不影响正常登录：所有新增逻辑以 `isDemoMode()/demoEntry` 门控，正式登录的 Cookie 链路、守卫、设计器预览零回归。
- 纯前端、无数据库操作、无 nginx/后端改动；不 commit。

## 七、实施步骤（建议三阶段，每阶段可独立验收）

1. **阶段 1 · 骨架打通**：auth.js 单键会话（安全读写/getToken fail-closed）+ demo.js + 口令弹窗 + 登录页入口 + request 拦截器挂载 demoAdapter + db/mock 框架（含 strict 未匹配策略）+ getInfo/getRouters/字典 + logOut 演示分支 + 演示横幅 + **三条下载/上传通道前置守卫排查落地**。验收：8888 进入，Layout/APMS 菜单/路由全通，Network 面板**零业务请求**（含下载/上传），控制台无 `[DEMO MOCK MISS]` 之外的报错；**多标签隔离实测**（A 演示中 / B 真实 super 登录并存 5 分钟，双方均不被踢；C 新标签粘贴 A 的 URL 不进演示态；A 退出后 B 仍在线）；**fail-closed 实测**（DevTools 把 `apms_demo_session` 改成 `{mode:'demo'}` / 非法 JSON / 删除后分别验证：不读真 Cookie、普通登录不受影响）。
2. **阶段 2 · 13 模块数据与交互**：business fixtures（关联样本）+ handlers（列表过滤分页、详情、假增删改、专属动作）。验收：逐菜单浏览、筛选、打开详情、新增/修改/删除本地生效、刷新还原；控制台保持零 MISS。
3. **阶段 3 · 覆盖率门禁与打磨**：覆盖率脚本扫全部 api 文件与 handler 比对、未覆盖清零；lenient/strict 双模式验证；下载/上传提示、空态与边界（空筛选结果、翻页末页）；`vite build` + 诊断 + UAT（localhost 直接点入口）验收。

## 八、验证方式（不用无头浏览器）

- `npx vite build` + GetDiagnostics；
- Node 桩测：口令校验、**`getToken()` 会话裁决五态**（① 合法单键会话→demo token；② `{mode:'demo'}` 缺 token→undefined 且不读 Cookie；③ token 非前缀串/null→undefined；④ 无会话→Cookie（含 LegacyTokenKey 兜底）；⑤ 键值为非法 JSON/存储抛错→等同无会话不崩、普通登录不受影响；全程断言 demo 流程零 Cookie 写删）、**`isDemoMode()` 与 `getToken()` 同源**（同一 `readDemoSession()` 派生，半态下行为与文档矩阵一致）、demoAdapter 经**真实 axios 1.13.2 实例**走通（200/601 两分支进入现有响应拦截器）、**normalizeRequest 用例**（① GET 经真实拦截器后 `url` 带 `?pageNum=1&pageSize=10&name=张`、params={} → path 命中列表 handler 且 ctx.query 分页/过滤值正确；② `params[beginTime]` 对象参数键名保留；③ POST `config.data` 为 JS 对象时 body 直用；④ method 缺省兜底 get；⑤ baseURL 前缀剥除）、mockDispatch 匹配（精确 + `:id` 参数段）、**db 生命周期**（① 模块首次 import 后 `getDb()` 即为完整数据集、无 undefined 表；② `resetDb()` 后改动不泄漏到新库、新库与 fixtures 深隔离——改新库不污染 fixtures）、db 增删改纯函数；
- **覆盖率脚本（上线门禁）**：扫描 `src/api/**/*.js` 提取全部 url+method 与 handler 表比对，输出未覆盖清单，阶段 3 必须清零；
- dev/UAT 浏览器人工验收：入口显隐、错误口令、进入后 **Network 零真实请求**（下载点按钮验证只弹 warning 不出请求）、控制台零 `[DEMO MOCK MISS]`、各模块浏览与本地假提交、同标签刷新还原、关闭标签后无残留、退出不删真实 Cookie；
- 回归：正常账号登录、登录设计器预览（无入口）、www/裸域展示页（无入口、收敛不变）。

## 九、风险

| 风险 | 应对 |
|---|---|
| **Demo 半态读到真实 Cookie**（两键方案下 mode 在/token 缺失 → isDemoMode=true 但 getToken 回落 Admin-Token，借真实会话访问）/ Demo 复用 Cookie 污染同 host 真实标签 | **P0 fail-closed 单键会话**：mode+token 存同一个 JSON 值（一次 setItem 原子同存，无两键不同步）；`getToken()` 见 mode=demo 只返回合法前缀 token，残缺即 undefined，永不回落 Cookie；存储访问全部 try/catch，损坏/禁用不影响普通登录；不写/不删正式 Cookie、不调 `/logout`。阶段 1 Node 桩验证五态 + 多标签实测 |
| Axios mock 机制用错（request 拦截器返回伪 response 致 XHR adapter 崩溃） | 严格用 `config.adapter = demoAdapter` + `return config`；adapter 返回完整 AxiosResponse、method 缺省兜底 get；阶段 1 Node 桩测在真实 axios 1.13.2 实例上验证 |
| blob 下载的 601 假象：响应拦截器先判 blob 直接 return，601 分支走不到 | 不在 mock 层伪造 blob；`download()` 函数顶部前置拦截；另排查裸 axios（plugins/download.js）与原生 fetch（medical/report）两条绕过 service 的通道，调用点守卫 |
| GET 的 query 已被 tansParams 拼进 config.url 且 params 清空，直接拿 url 匹配导致全部列表 MISS（有菜单没数据） | `normalizeRequest()` 作为 adapter 第一道工序：pathname 做匹配键、searchParams 做 ctx.query；handler 禁止读 config.params；阶段 1 Node 桩覆盖「带 params 的列表请求→命中而非 MISS」 |
| 刷新不重跑 enterDemo，若 db 只在 enterDemo 里 reset → F5 后 db 未初始化/空表 | db.js 实现不变量：模块加载即 `resetDb()`（或声明即初始化）；handler 只经 `getDb()` 取库；Node 桩验证模块首次 import 即有完整数据 |
| 漏配 mock 的写接口假成功（"保存成功"但无变化） | 未匹配修改类一律 601 + `console.error('[DEMO MOCK MISS]')`；dev/UAT strict 模式 GET 也 601；覆盖率脚本门禁清零 |
| 101 接口字段结构多，fixtures 工作量大 | 蓝本优先：真实 getRouters JSON 固化；业务字段以页面表格/表单列代码为准逐模块核对；通用 CRUD 工厂覆盖 80% 模式，专属接口单列 |
| el-upload/原生 fetch 绕过 axios | 阶段 1 排查 medical 附件、report 下载、头像/导入控件，演示态隐藏或前置守卫并给提示 |
| 假提交后组件 keep-alive 缓存不刷新 | 与真实系统行为一致（页面自身操作后有刷新逻辑的都走 then 回调），不额外处理 |
| 样本数据不自洽（图表数字与列表对不上） | dashboard fixtures 从同一份 athletes/tasks/rtps 派生计算，单一数据源 |
| 后续真实菜单/接口变更，mock 漂移 | handler 覆盖率脚本纳入阶段 3 验收；mock 代码集中在 src/mock，注释标注「随菜单/接口变更同步」 |
