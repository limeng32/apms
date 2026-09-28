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
        ├─ setToken('demo-static-xxxx')          # 复用现有 cookie token 位，守卫天然放行
        ├─ sessionStorage['apms_demo_mode']='1'  # 演示态总开关（标签页级生命周期）
        ├─ user store 注入静态身份（super/全权限）
        └─ router.push('/apms/dashboard')
              └─ 守卫 getInfo()/getRouters() 等一切请求
                    └─ request.js 请求拦截器识别演示态 → mockDispatcher 短路
                          └─ 内存 DB（fixtures 深拷贝）→ 标准 RuoYi 响应
```

- **为什么能复用真实页面**：页面只认 store 里的 roles/permissions、菜单树、API 响应。三者全部由 mock 喂给真实组件，Layout/路由/权限指令/字典/TagsView 等框架机制零改动。
- **为什么刷新可还原身份但重置数据**：token 是 session cookie、演示标记在 sessionStorage（复制到新标签页的边缘场景见 §六防护）；内存 DB 每次页面加载从 fixtures 重新深拷贝。
- **退出**：头像菜单「退出登录」走现有 logOut（/logout 也被 mock 返回成功），额外清除演示标记与 token，回到 /login。

## 四、文件清单

### 新增（8 个）

| 文件 | 职责 |
|---|---|
| `src/utils/demo.js` | 常量与生命周期：`DEMO_TOKEN_PREFIX`、`isDemoEnabled()`（env `VITE_DEMO_ENABLED`，默认 true）、`PASSCODE`（env `VITE_DEMO_PASSCODE`，默认 `8888`）、`isDemoMode()`、`enterDemo()`（写 token/标记/注入 user store）、`exitDemo()`、`isDemoToken()` |
| `src/views/login/DemoPassDialog.vue` | 口令弹窗（el-dialog + 密码输入，回车提交；错误抖动+提示；文案说明「静态演示，刷新还原」） |
| `src/mock/index.js` | `mockDispatch(config)`：按 method+url 模式匹配 handler；通用工具（分页切片 pageNum/pageSize、参数过滤、`ok()/list()/detail()` 响应工厂）；**未匹配兜底**（GET→空集合/空对象；POST/PUT/DELETE→成功；blob→601 不支持） |
| `src/mock/db.js` | 内存 DB：`resetDb()` 深拷贝全部 fixtures 生成可变数据集（athletes/teams/indicators/testModels/testTasks/testResults/bodyMeasures/phvs/rtps/comboModels/comboScores/medicals/reports…），供 handler 增删改 |
| `src/mock/fixtures/system.js` | 框架数据：getInfo 用户体（name=super、角色 business_admin、permissions=`['*:*:*']` 让全部 v-hasPermi 按钮可见）、getRouters 静态菜单树、字典（apms_* 与 sys_user_sex）、部门树、profile |
| `src/mock/fixtures/dashboard.js` | overview + stats 聚合数据（卡片数字、图表序列、RTP 预警数等，数字与运动员/任务样本自洽） |
| `src/mock/fixtures/business.js` | 13 模块业务样本（1 个文件集中导出，约 800-1100 行）：24 名 U13–U18 运动员 + 4 支队伍/小组、~20 项指标、~6 个测试模型、进行中/已完成任务、成绩记录、体态/PHV/RTP、组合模型与评分、医疗记录、报告；跨模块 ID 关联（任务→运动员→成绩→RTP→报告） |
| `src/mock/handlers.js` | 101 接口的 handler 表（框架接口 + 14 业务模块；list 通用分页过滤 + 每模块专属动作：testTask 执行、comboScore 计算、report 生成、rtp 评估/清除、medical 附件等，均改内存 db 后返回成功） |

> fixtures/handlers 如体积过大可在实施时按模块拆文件，目录结构不变。

### 修改（5 处，均为小改）

1. [LoginFormFields.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login/LoginFormFields.vue)
   - 新增 prop `demoEntry: Boolean`（默认 false）；提交按钮下方渲染居中小号文字按钮「一键体验演示环境 →」，`emit('demo')`；
   - 设计器预览 `preview=true` 时不渲染（设计器侧零影响）。
2. [login.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login.vue)
   - `#form` 内给 LoginFormFields 传 `:demo-entry="isDemoEnabled()"`、`@demo="dialogVisible=true"`；挂载 `DemoPassDialog`；
   - 口令正确 → `await enterDemo()` → `router.replace('/apms/dashboard')`。
3. [request.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js)
   - 请求拦截器最前面：`if (isDemoMode()) return mockDispatch(config)`，返回合成 response（`{data: body, request:{responseType}, config}`），继续走现有响应拦截器（200 正常返回、601 弹 warning、blob 走下载失败分支），**不发出任何真实网络请求**。
4. [store/modules/user.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/store/modules/user.js)
   - `logOut()` 中识别 demo token 时调 `exitDemo()` 清标记；
   - 新增 `setupDemoProfile()`（或放 demo.js 直接操作 store）：写入 id/name/nickName/avatar('')/roles/permissions/portalMode(0)/homePath('')，**不调任何接口**。
5. [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js)
   - 守卫内边缘防护：token 为 demo 前缀但 `isDemoMode()` 为假（新标签页复制 URL：有 cookie 无标记）→ 清 token 回 /login；
   - 展示域（www/裸域）收敛逻辑优先级不变，演示态不可能出现在展示域（无入口）。

### 可选（视觉提示，建议做）

- Layout 顶部（Navbar 下）演示态横幅：「演示模式 · 数据为静态样本，仅当前标签页有效，刷新还原」，可关闭，琥珀色底；右上角用户区显示「体验账号」。改 `layout/index.vue` 或 Navbar，约 30 行。

## 五、关键流程约定

### enterDemo
1. 校验口令（`PASSCODE`，trim 后比对，错误次数不限制但有错误提示）；
2. `Cookies.set(TokenKey, DEMO_TOKEN_PREFIX + Date.now())`（session cookie，不加 expires；自动复用现有 cookieName 端口隔离）；
3. `sessionStorage.setItem('apms_demo_mode','1')`；
4. `db.resetDb()`；
5. 注入 user store 静态身份；
6. `router.replace('/apms/dashboard')`，后续守卫调 getInfo/getRouters 全部命中 mock。

### mock 响应工厂
- 列表：`{code:200, rows: db.xxx.filter(按 query 精确/like 过滤).slice((pageNum-1)*pageSize, pageSize*pageNum), total}`；
- 详情：`{code:200, data: find(id)}`；
- 新增：生成负 ID（`-Date.now()`，避免与样本冲突）+ createTime=now，unshift；
- 修改：map 替换 + updateTime；删除：按逗号 ids filter；
- 动作类：更新相关记录状态字段（如任务状态、报告状态）后 `{code:200}`——页面自身的成功提示与列表刷新逻辑天然生效；
- 下载/导出/附件（responseType=blob）：`{code:601, msg:'演示环境暂不支持文件下载'}`，走现有 download() 的 blobValidate 失败分支弹提示；
- 上传：如页面使用走 service 的封装则 mock 601；若有 el-upload 直连 action（不走 axios），演示态在组件层隐藏上传控件（实施时排查 medical 附件与头像组件）。

### 菜单树蓝本
`fixtures/system.js` 的 getRouters 数据**以 dev 真实接口返回为蓝本**：实施时用 admin/admin123 在本地 dev 获取 token 后 `curl /prod-api/getRouters`（或经 vite 代理），摘取 APMS 子树（2200 及其 13 子菜单）固化为 JSON，保证 name/path/component/meta 结构零偏差；仅保留 APMS 目录（演示态不展示系统管理等非业务菜单，符合「APMS 模块展示」定位；首页路由 /index 仍可直达）。

## 六、安全与边界

- 演示态**零真实业务请求**：request 层短路 + 未匹配兜底，任何漏网请求只返回本地空数据；demo token 对真实后端无效（天然 401），无法借演示态访问真实数据。
- 口令防君子不防小人：bundle 可见，不做频率限制（可接受）；env `VITE_DEMO_PASSCODE` 可换，`VITE_DEMO_ENABLED=false` 可一键关闭入口。
- 演示标记是 sessionStorage：关闭标签即失效；A 标签演示中复制 URL 到 B 标签 → 守卫边缘防护清 token 回登录页，不会拿 demo token 打真实后端。
- 不影响正常登录：所有新增逻辑以 `isDemoMode()/demoEntry` 门控，正常账号登录链路与设计器预览零回归。
- 纯前端、无数据库操作、无 nginx/后端改动；不 commit。

## 七、实施步骤（建议三阶段，每阶段可独立验收）

1. **阶段 1 · 骨架打通**：demo.js + 口令弹窗 + 登录页入口 + request 短路 + db/mock 框架 + getInfo/getRouters/字典 + 演示横幅。验收：8888 进入，Layout/APMS 菜单/路由全通，无真实请求报错（Network 面板无 4xx/5xx）。
2. **阶段 2 · 13 模块数据与交互**：business fixtures（关联样本）+ handlers（列表过滤分页、详情、假增删改、专属动作）。验收：逐菜单浏览、筛选、打开详情、新增/修改/删除本地生效、刷新还原。
3. **阶段 3 · 兜底打磨**：未匹配接口兜底、上传/下载提示、空态与边界（空筛选结果、翻页末页）、`vite build` + 诊断 + UAT（localhost 直接点入口）验收。

## 八、验证方式（不用无头浏览器）

- `npx vite build` + GetDiagnostics；
- Node 桩测：口令校验、mockDispatcher 对 101 接口的匹配覆盖率（脚本扫 api/apms/*.js 提取 url 与 handler 表比对，列出未覆盖项）、db 增删改纯函数；
- dev/UAT 浏览器人工验收：入口显隐、错误口令、进入后 Network 无真实请求、各模块浏览与本地假提交、刷新还原、退出回登录页；
- 回归：正常账号登录、登录设计器预览（无入口）、www/裸域展示页（无入口、收敛不变）。

## 九、风险

| 风险 | 应对 |
|---|---|
| 101 接口字段结构多，fixtures 工作量大 | 蓝本优先：真实 getRouters JSON 固化；业务字段以页面表格/表单列代码为准逐模块核对；通用 CRUD 工厂覆盖 80% 模式，专属接口单列 |
| el-upload 等绕过 axios 的通道无法 mock | 阶段 1 排查 medical 附件/头像/导入控件，演示态隐藏或禁用并给提示 |
| 假提交后组件 keep-alive 缓存不刷新 | 与真实系统行为一致（页面自身操作后有刷新逻辑的都走 then 回调），不额外处理 |
| 样本数据不自洽（图表数字与列表对不上） | dashboard fixtures 从同一份 athletes/tasks/rtps 派生计算，单一数据源 |
| 后续真实菜单/接口变更，mock 漂移 | handler 覆盖率脚本纳入阶段 3 验收；mock 代码集中在 src/mock，注释标注「随菜单/接口变更同步」 |
