# APMS 演示模式 · 正式页面开发/重构后的同步维护指南

> 配套文档：[demo_mode_plan.md](./demo_mode_plan.md)
> 适用范围：`ruoyi-ui`（Vue3 + Element Plus + Vite + Pinia）「一键体验」演示模式
> 最后更新：2026-09-29

## 一句话结论

**只动 UI 随便改，动「接口契约」（URL/方法/参数/返回形状）就必须同步 handler。**

演示模式的设计原则是「真实系统外壳 + 同一份真实页面」：它没有复制任何业务页面，
路由 `apmsRouters` 指向的就是 `src/views/apms/` 下的真实 `.vue` 文件，请求拦截器只在
请求发出时把 axios adapter 换成本地 mock 引擎。因此 mock 本质上是一个跑在浏览器内存里的
"假后端"，维护它和"改后端时同步前端 api 文件"是同一种成本。

---

## 一、会自动更新的部分（无需改 mock）

以下改动演示环境立即生效：

- 页面模板、表单、表格列、弹窗、样式、交互逻辑（含 roster 花名册风格重构）
- 组件拆分、props/emit 调整、Pinia store 改动
- Element Plus 升级、字典标签渲染等
- 任何不涉及新接口/新参数/新响应字段的纯前端行为变更

---

## 二、需要手动同步的部分

| 改动类型 | 不改 mock 的后果 | 要改的地方 |
|---|---|---|
| 页面调了**新接口**（api 文件新增函数） | dev（strict）下请求 601「接口尚未实现」+ 控制台 `[DEMO MOCK MISS]`；生产（lenient）下 GET 静默空态、写操作 601 | `src/mock/handlers/` 对应模块加路由 |
| 视图里**直接 `request({...})`**（没走 api 文件，如 testTask 页内联调用） | 同上，但覆盖率脚本扫不到，容易漏 | 建议统一走 api 文件；否则只能靠 strict MISS 日志发现 |
| 接口**参数/响应结构变了**（字段改名、分页变 data 数组等） | 页面拿到的形状对不上，表现为空列/渲染异常 | 对应 handler 的筛选条件与返回形状 |
| 新增**字典** `useDict('xxx')` | 字典下拉为空 | `src/mock/fixtures/system.js` 的 `dictMap` |
| 页面依赖**新数据列/新关联表** | 字段空白（一般不崩），演示效果打折 | `src/mock/fixtures/business.js` 补样本行 |
| 新增/改名**菜单或页面** | 演示态看不到新页面（菜单清单是静态的） | `src/mock/fixtures/system.js` 的 `apmsRouters` |
| 新增**上传/下载**入口 | 演示态会真发请求到不存在的后端 | 视图处加 `isDemoMode()` 守卫（5 个共享上传组件已内置） |

---

## 三、每次重构后的三道闸

```bash
# 1. API 覆盖率门禁：扫 14 个 api 文件全部接口与 handler 路由表比对，缺一个即退出码 1
node .trae/demo-tests/coverage.mjs

# 2. 桩测：42 项用例（含 strict 模式下 43 个真实页面请求零 MISS）
node .trae/demo-tests/run.mjs

# 3. 编译兜底
cd ruoyi-ui && npx vite build
```

**日常开发提示**：dev 环境默认 strict。开发时开一个标签页挂着演示模式，
任何漏同步的接口都会在浏览器控制台立刻报 `[DEMO MOCK MISS]`，不会悄悄坏掉。

---

## 四、同步 handler 的写法要点

### 4.1 注册与路由匹配规则

- handler 集中注册于 `src/mock/handlers/index.js`，每模块一个文件。
- 匹配顺序：先 `METHOD /精确路径` Map，再按 `:param` 段数模板匹配（注册顺序即优先级）。
- **具体字面路径与同段数 `:param` 冲突时**，字面路径是精确键，天然优先
  （如 `/rtp/status/list` 先于 `/rtp/status/:athleteId`）；
  不同段数（如 `/medical-record/file/:id` vs `/medical-record/:id`）天然不冲突。

### 4.2 handler 契约

```js
// ctx = { method, path, query, body, params, rawConfig }
route('get', '/apms/xxx/list', (ctx) => paginate(rows, ctx.query, [
  { key: 'name', mode: 'like', value: ctx.query.name },
  { key: 'status', value: ctx.query.status }
]))
```

- 列表筛选参数**只从 `ctx.query` 取**（handler 禁止读 `ctx.rawConfig.params`）；
  非 GET 的 `params`（如 POST `?taskId=`）由引擎 `flattenParams` 补拍进 query。
- 分页：`paginate(rows, query)` → `{code:200, rows, total}`；
  data 数组型列表：`listData(rows)` → `{code:200, data:[...]}`。
- 写操作返回 `ok('msg')` / `detail(row)`；失败返回 `{code:601, msg}`，
  **未匹配绝不静默成功**。
- 新行用 `nextId()`（负数 ID），`stampCreate/stampUpdate` 补审计字段；
- 所有数据读写一律 `getDb()`，不持有表引用；假增删改只作用于内存克隆体，刷新即还原。

### 4.3 常见响应形状（别踩坑）

| 接口类型 | 形状 |
|---|---|
| 分页列表（花名册/指标/任务/医疗/报告） | `{code, rows, total}` |
| 全量列表（体态/PHV/RTP 状态/组合分/子资源） | `{code, data:[...]}` |
| 详情 | `{code, data:{...}}`，主子表详情需手工组装子表（如 indicator.refs.levels） |
| 批量计算（组合分） | `{code, data:{totalAthletes, successCount, skipCount, items:[...]}}` |
| 框架 getInfo | fixture 必须自带 `code:200,msg`（真实接口无 code，但响应拦截器要判） |

---

## 五、演示模式架构速查

```
登录页「一键体验」→ DemoPassDialog（口令 8888）
  → enterDemo()：setDemoSession(demo token 仅存 sessionStorage) + resetDb() + 清 roles/permissions
  → request.js 拦截器末尾：isDemoMode() 时 config.adapter = demoAdapter（只此一行挂钩）
  → mock/index.js 引擎：normalizeRequest → mockDispatch → handlers → 内存 db
  → 13 个真实业务页面零改动渲染静态样本
```

关键文件：

- 会话四态：`src/utils/auth.js`（none/demo/broken/storage-error，fail-closed）
- 演示入口/退出：`src/utils/demo.js`
- mock 引擎：`src/mock/index.js`（strict：dev 或 `VITE_DEMO_MOCK_STRICT=true`）
- 数据表：`src/mock/fixtures/system.js`（框架）+ `business.js`（21 张业务表）
- 下载/上传守卫：`utils/request.js`、`plugins/download.js`、5 个共享上传组件
- 环境开关：`VITE_DEMO_ENABLED=false` 关闭入口；`VITE_DEMO_PASSCODE` 覆盖口令

---

## 六、人工验收清单（口令 `8888`）

1. 登录页点「一键体验演示环境 →」→ 输 8888 → 进看板，KPI 与四个图表有数据
2. 13 个菜单逐页点：花名册筛选、指标/模型/任务详情子表、测试结果选最佳、
   PHV 计算、RTP 改灯、组合分批量计算、报告生成均即时生效
3. F5 刷新 → 所有假数据还原蓝本；底部演示条「退出演示」→ 回登录页
4. 下载报告/医疗附件、上传附件 → 提示演示环境不支持
5. A 标签真实 super 登录、B 标签演示，两边互不干扰（demo token 只在 sessionStorage，绝不碰 Cookie）
6. broken/storage-error 异常态：请求仍完全本地处理，刷新即退出，无 Cookie 回落
