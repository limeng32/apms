# 系统级 RPA 助手（伪 RPA · 流式）实施计划

> 状态：**规划已确认，待实施**
> 范围：M1 伪 RPA（不接 Agent）
> 更新时间：2026-10-30
> 关联文档：[DESIGN.md](../DESIGN.md)、[demo_mode_plan.md](./demo_mode_plan.md)、[demo_mode_maintenance.md](./demo_mode_maintenance.md)、[PERMISSION_DESIGN.md](../PERMISSION_DESIGN.md)

---

## 一、目标与边界

### 1.1 目标

在 APMS 任意登录页面提供一个可随时呼出的「系统副驾」：

- 用自然语言回答系统使用问题；
- 回答以流式方式逐字呈现；
- 能把用户带到正确的页面（`navigate`）；
- 能在页面内高亮关键入口（`highlight`）；
- 未来可无缝替换为真实 Agent，前端协议不变。

### 1.2 已确认决策（用户拍板）

| 决策项 | 结论 |
|---|---|
| 呼出入口 | 全局悬浮球 + 右侧抽屉；挂在 Layout，登录后所有页面可用；`Alt+A` 呼出、`Esc` 关闭 |
| 动作深度 | M1 仅 `navigate` + `highlight`；不填表、不点击提交、不自动保存 |
| 流式实现 | 后端 SSE 规则引擎，`POST /apms/assistant/chat`，`text/event-stream` |
| 记录持久化 | 新增审计表 `apms_assistant_log`；只产出 SQL 补丁，由用户本人执行 |

### 1.3 明确不做（M1）

- 不接大模型 / Agent / 外部 API；
- 不做浏览器级或操作系统级 RPA；
- 不自动提交任何写操作（新增、修改、删除、计算、生成、下载）；
- 不执行任意 JavaScript、不解析后端下发的 CSS 选择器；
- 不新增菜单与权限点（登录用户均可用，能力按现有菜单/权限过滤）；
- 不改动现有业务接口与页面逻辑。

### 1.4 评审修订记录（2026-10-30）

| 级别 | 原方案问题 | 修订 |
|---|---|---|
| P0 | 计划使用 `LimitType.USER`，但 [LimitType.java](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-common/src/main/java/com/ruoyi/common/enums/LimitType.java) 只有 `DEFAULT` / `IP`，照写编译失败；`DEFAULT` 为全局额度 | 不扩展枚举；改为 Redis `assistant:user:{userId}` 按用户限流（§4.4） |
| P1 | `selectMenuTreeByUserId()` 返回层级菜单，子菜单 path 可能是相对路径，不能直接和 `/testings/dispatch` 比较 | 统一走 `ISysMenuService.buildMenus()`（与 `getRouters` 同源）还原 `RouterVo` 完整路径后再匹配（§4.4） |
| P1 | 自建 SSE 线程池默认拿不到 `SecurityContext`，异步线程调用 `SecurityUtils` 会失败 | 请求线程捕获 `LoginUser` → 不可变 `AssistantPrincipal` 快照，异步只读快照（§4.4） |
| 环境 | 端口写死 8080 会导致 UAT/生产 502 | 明确 dev `8080/8081`、uat `9080/9081`、prod `10080/10081`（§8.1） |

### 1.5 阶段路线

| 阶段 | 能力 | 是否接 Agent |
|---|---|---|
| **M1 伪 RPA** | 规则意图、流式回答、导航、高亮、能力问答 | 否 |
| M2 只读数据问答 | 用现有接口回答“多少任务 / 谁未评估 / 最近报告” | 否 |
| M3 受控动作 | 打开新增弹窗并预填、触发导出，必须用户二次确认 | 否 |
| M4 真 Agent | 通过 `AssistantProvider` 替换规则引擎，协议不变 | 是 |

---

## 二、总体架构

```
Layout（登录后所有页面）
└── AssistantLauncher（悬浮球 + Alt+A）
      └── AssistantPanel（右侧抽屉 / 移动端底部面板）
            ├── assistantStore（Pinia：消息、流式状态、上下文）
            ├── assistantClient（fetch + SSE 解析 / Demo 本地流）
            └── assistantActions（动作白名单执行器）
                     │
                     ▼
POST /apms/assistant/chat  (text/event-stream, Bearer)
                     │
ApmsAssistantController
  ├── 请求线程：捕获 LoginUser → AssistantPrincipal
  │             （userId / userName / permissions / allowedPaths）
  └── 限流：Redis key 按 userId，超限直接 429，不进入 SSE
                     ▼
AssistantService（异步流）
  ├── PseudoAssistantProvider（规则意图 + 模板回答）
  ├── CapabilityResolver（buildMenus 还原完整路由，请求线程预计算）
  ├── AssistantActionFactory（仅生成 whitelist 动作）
  └── ApmsAssistantLog（审计，使用 Principal 快照）
```

关键原则：

1. **权限过滤在后端**：动作路径必须命中当前用户菜单树还原出的完整路由；前端再做一次路由存在性复核。
2. **异步线程不读 ThreadLocal**：鉴权、菜单能力、用户名都在请求线程取好并快照传递；后台线程禁止调用 `SecurityUtils`。
3. **协议与 Provider 解耦**：M4 只替换 Provider，SSE 事件与前端执行器不动。
4. **动作最小化**：M1 只做导航与高亮，任何写操作都必须由用户自己点击完成。
5. **演示模式同源裁决**：`isDemoMode()` 为真时走本地伪流式，绝不发真实请求。

---

## 三、流式协议（v1）

### 3.1 请求

```json
{
  "sessionId": "uuid",
  "message": "怎么创建测试任务",
  "context": {
    "route": "/testings/dispatch",
    "pageTitle": "指标库与任务下发"
  }
}
```

- Header：`Authorization: Bearer <token>`、`Accept: text/event-stream`
- 不使用原生 `EventSource`（无法携带 Authorization），改用 `fetch + ReadableStream`。

### 3.2 SSE 事件

| event | data | 说明 |
|---|---|---|
| `meta` | `{messageId, provider:"pseudo", version:"v1"}` | 开始 |
| `delta` | `{text:"..."}` | 增量文本 |
| `action` | `{type:"navigate", path:"/testings/dispatch", label:"打开任务页", confirm:false}` | 可点击动作 |
| `done` | `{finishReason:"stop"}` | 正常结束 |
| `error` | `{code,msg,retryable}` | 可重试错误 |

SSE 帧示例：

```text
event: delta
data: {"text":"先在「指标库与任务下发」中创建任务，"}

event: action
data: {"type":"navigate","path":"/testings/dispatch","label":"打开任务页","confirm":false}

event: done
data: {"finishReason":"stop"}
```

### 3.3 动作白名单（M1）

| type | 参数 | 约束 |
|---|---|---|
| `navigate` | `path`, `label` | `path` 必须属于当前用户可访问路由集合；不允许外链与 `//host` |
| `highlight` | `targetKey`, `label`, `durationMs` | 只接受前端本地注册的 key；后端不传 CSS 选择器 |

明令禁止的 type：`click`、`fill`、`submit`、`eval`、`download`、`openUrl`。

---

## 四、后端设计

### 4.1 新增文件

```text
ruoyi-admin/src/main/java/com/ruoyi/web/controller/apms/
└── ApmsAssistantController.java          # POST /apms/assistant/chat, GET /apms/assistant/capabilities

ruoyi-system/src/main/java/com/ruoyi/system/
├── domain/apms/ApmsAssistantLog.java
├── mapper/apms/ApmsAssistantLogMapper.java
└── service/apms/assistant/
    ├── AssistantProvider.java            # 流式 Provider 接口（M4 预留）
    ├── PseudoAssistantProvider.java      # 规则意图 + 回答模板
    ├── AssistantIntentCatalog.java       # 意图/关键词/同义词目录
    ├── CapabilityResolver.java           # buildMenus → 完整路由集合
    ├── AssistantActionFactory.java       # 仅构建 navigate / highlight
    ├── AssistantContext.java             # route/pageTitle 等
    ├── AssistantPrincipal.java           # 请求线程身份快照
    └── impl/AssistantServiceImpl.java    # SSE 编排、限流、审计

ruoyi-framework/src/main/java/com/ruoyi/framework/aspectj/
└── AssistantRateLimiter.java             # 按 userId 限流（复用 limitScript，与 IpRateLimiter 并列）

ruoyi-admin/src/main/resources/mapper/apms/
└── ApmsAssistantLogMapper.xml

patches/
└── patch-<apms.version>-<MMDDHHMMSS>.sql # apms_assistant_log 建表（幂等）
```

### 4.2 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/apms/assistant/chat` | POST | SSE 流式回答；登录鉴权 + 频率限制 |
| `/apms/assistant/capabilities` | GET | 返回当前用户可访问页面与建议问题，用于启动预热 |

### 4.3 规则引擎

0. **请求线程预计算**：捕获 `LoginUser`，调用 `CapabilityResolver` 得到 `allowedPaths`，连同 userId/userName/permissions 一起封装为不可变 `AssistantPrincipal`；
1. 归一化问题：去空白、转小写、同义词替换；
2. 意图打分：关键词命中数 + 权重，取最高分；低于阈值走兜底意图；
3. 生成回答：模板文本（支持当前页面上下文、权限说明）；
4. 生成动作：仅当目标路径精确命中 `Principal.allowedPaths` 时下发 `navigate`；
5. 流式输出：按句/片段发送 `delta`，每段间隔约 15–25ms；
6. 结束：使用 Principal 快照写审计记录，发送 `done`。

首批意图：

| 意图 | 示例问法 | 回答要点 | 动作 |
|---|---|---|---|
| `ATHLETE_CREATE` | 怎么新增运动员 / 建档 | 花名册新增、必填项、RTP 不预置 | 去 `/athletes/roster` |
| `PHV_HOW` | PHV 在哪 / 怎么算 | 体态录入 → Mirwald；成年身高口径 | 去 `/athletes/growth` |
| `IMPORT_RESULT` | 怎么导入成绩 / 体测 | xlsx/xls/csv 两阶段导入、冲突拒绝 | 去 `/testings/dispatch` |
| `COMBO_SCORE` | 组合评分怎么算 | T 分、参考快照、N<5 代理口径 | 去 `/testings/combo-dispatch` |
| `RTP_EDIT` | RTP 怎么改 / 谁能改 | 权限点、留痕、人工确认 | 去 `/healthcare/alert-center` |
| `REPORT_DOWNLOAD` | 报告在哪下载 | 生成 → 鉴权下载 | 去 `/analytics/report-center` |
| `PAGE_HELP` | 当前页面能做什么 | 基于 route 的页面说明 | 无 |
| `CAPABILITY` | 你能做什么 | 能力清单 + 建议问题 | 无 |
| `FALLBACK` | 未命中 | 提示可问的问题 | 无 |

### 4.4 权限、限流与异步上下文

**路由能力还原（不能直接比较 `menu.path`）**

- 使用 `ISysMenuService.selectMenuTreeByUserId(userId)` 取菜单树；
- 再调用**同一个** `ISysMenuService.buildMenus(menus)`（与 `GET /getRouters` 完全同源）得到 `RouterVo` 树；
- 递归拼接完整路径：
  - 子路径以 `/` 开头 → 绝对路径；
  - 否则 `父路径 + "/" + 子路径`，父路径为 `/` 时做去重处理；
  - 目录（`M`）继续下钻，页面（`C`）收录为可导航路径；
- 产出 `Set<String> allowedPaths`（规范化：去掉尾部 `/`、合并重复 `/`）；
- 示例：菜单 2402 `path=cockpit`、父目录 2401 `path=overview` → 完整路由 `/overview/cockpit`；2402 的 `menu.path` 本身永远不等于 `/overview/cockpit`，所以不能直接比较原始 `menu.path`。
- **补集**：固定路由单独维护白名单（如 `/index`、`/apms/athlete/detail/{athleteId}`），且必须按权限点二次校验；
- 隐藏菜单（`hidden=true`）仍会注册路由，但默认不进入“建议页面”，仅参与动作合法性校验。

**按 userId 限流（不扩展 LimitType）**

当前 `LimitType` 只有 `DEFAULT` 和 `IP`，直接写 `@RateLimiter(limitType=USER)` 会编译失败，且 `DEFAULT` 是全局额度，不能用于多用户系统。M1 新增编程式 `AssistantRateLimiter`，复用项目已有的 Redis Lua 限流脚本（与 [IpRateLimiter.java](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/aspectj/IpRateLimiter.java) 同源）：

```java
// 请求线程内，建立 SSE 之前
String key = CacheConstants.RATE_LIMIT_KEY + "assistant:user:" + userId;
List<Object> keys = Collections.singletonList(key);
Long number = redisTemplate.execute(limitScript, keys, 20, 60); // 60s 窗口，最多 20 次
if (number == null || number.intValue() > 20) {
    return ResponseEntity.status(429).body(AjaxResult.error("访问过于频繁，请稍候再试"));
}
```

- 多实例共享 Redis，天然按用户隔离；
- 超限返回 `429` + JSON（前端 `assistantClient` 识别非 `text/event-stream` 响应并提示）；
- 不修改 `LimitType` 枚举，避免影响其他模块。`AssistantRateLimiter` 放在 `ruoyi-framework` 或 `ruoyi-system` 均可，但必须能注入 `RedisTemplate` 与 `limitScript`；推荐与 `IpRateLimiter` 并列放 `ruoyi-framework`，由 Controller 调用。

**SSE 异步线程的登录上下文**

- `SecurityContext` 是 ThreadLocal，**不会自动传播到自建线程池**；
- 请求线程完成：JWT 鉴权、`SecurityUtils.getLoginUser()`、菜单能力计算；
- 构造不可变快照：

```java
class AssistantPrincipal {
    Long userId;
    String userName;
    Set<String> permissions;
    Set<String> allowedPaths;
}
```

- 异步流只使用该快照：审计写 userId/userName，动作只用 allowedPaths；
- 异步线程内**禁止**调用 `SecurityUtils`、`@DataScope` 依赖的 ThreadLocal；
- M2 若要读写数据：在请求线程预取结果，或显式把 `userId` 与数据范围参数传入查询方法，不能指望后台线程的 DataScope AOP。

**其他**

- 登录必需；M1 不新增权限点，能力按现有菜单过滤；
- SSE 独立线程池（核心 2 / 最大 4 / 队列 32），拒绝时返回 `error` 事件；
- 15s 心跳；客户端断开时停止生成；
- 审计失败只记日志，不影响回答。

### 4.5 审计表

```sql
CREATE TABLE IF NOT EXISTS apms_assistant_log (
  id           bigint       NOT NULL AUTO_INCREMENT COMMENT '主键',
  session_id   varchar(64)  NOT NULL COMMENT '会话ID',
  user_id      bigint       NOT NULL COMMENT '用户ID',
  user_name    varchar(64)  DEFAULT NULL COMMENT '用户名',
  question     varchar(1000) NOT NULL COMMENT '用户问题',
  answer       mediumtext   COMMENT '完整回答',
  intent       varchar(64)  DEFAULT NULL COMMENT '命中意图',
  action_json  json         DEFAULT NULL COMMENT '下发动作',
  provider     varchar(20)  NOT NULL DEFAULT 'pseudo' COMMENT 'provider',
  status       varchar(20)  NOT NULL DEFAULT 'success' COMMENT 'success/error/aborted',
  error_msg    varchar(500) DEFAULT NULL COMMENT '错误信息',
  create_time  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_user_time (user_id, create_time),
  KEY idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RPA助手审计日志';
```

> 补丁文件名按部署时 `apms.version` 生成；**由用户本人执行**，Agent 不直连数据库。

---

## 五、前端设计

### 5.1 新增文件

```text
ruoyi-ui/src/components/Assistant/
├── AssistantLauncher.vue     # 悬浮球、Alt+A、流式状态点
├── AssistantPanel.vue        # 抽屉、消息列表、建议问题、停止/清空
├── AssistantMessage.vue      # 流式文本 + 动作 chip
├── assistantClient.js        # fetch SSE 解析、超时/中止、Demo 分支
├── assistantActions.js       # navigate / highlight 白名单执行
└── assistantStore.js         # Pinia：会话、上下文、打开状态
```

### 5.2 挂载

在 [layout/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/layout/index.vue) 挂载 `<AssistantLauncher />`，位于 `.app-wrapper` 内、`demo-banner` 之上；登录页不挂载。

### 5.3 交互

- `Alt+A` 呼出、`Esc` 关闭；输入框聚焦时仍可呼出（`preventDefault` 阻止字符输入）；
- 右侧抽屉 420px，移动端（≤768px）底部 85vh，带安全区；
- 流式期间显示「停止」；关闭抽屉不中断请求，重新打开恢复当前流；
- 导航动作点击后面板收起但保留会话；目标页 3 秒内高亮；
- 主题跟随 `--el-color-primary`（登录页 accent），不引入新依赖；
- 文本用 `white-space: pre-wrap` + 转义渲染，不使用 `v-html`；
- 会话保存在 `sessionStorage`（刷新保留，关闭标签清除），不落业务库；
- 首次打开面板时调用 `GET /apms/assistant/capabilities` 预热 `allowedPaths` 与建议问题；失败不阻塞对话。

### 5.4 上下文

每次请求携带：

```js
{
  route: route.path,
  pageTitle: route.meta?.title || '',
  // M1 可选：entityId（运动员详情 / 任务详情）
}
```

### 5.5 动作执行器

- 只实现 `navigate` / `highlight`；
- `navigate` 前用 `router.resolve(path)` 校验，且 path 必须命中 `assistantStore.allowedPaths`（来自后端 `capabilities`，与后端 `Principal.allowedPaths` 同源）；
- 路径规范化统一（去尾 `/`、合并 `//`），与后端 CapabilityResolver 保持同一规则；
- `highlight` 从本地注册表取选择器：

```js
const TARGETS = {
  'athlete-add': '[data-rpa="athlete-add"]',
  'task-create': '[data-rpa="task-create"]',
  'rtp-edit': '[data-rpa="rtp-edit"]',
  'combo-calculate': '[data-rpa="combo-calculate"]',
  'report-generate': '[data-rpa="report-generate"]'
}
```

- 高亮用 CSS class + 定时移除，不修改业务数据；
- 不执行任何后端下发的选择器或代码。

### 5.6 演示模式

- `assistantClient` 先判断 `isDemoMode()`（[auth.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/auth.js)）：
  - 真实模式：`fetch` 打 `/apms/assistant/chat`；
  - 演示模式：本地 intent 表 + `setTimeout` 伪流式，零真实请求；
- 在 `src/mock/handlers/` 增加 assistant handler，仅用于能力清单与本地回复；
- 在 `.trae/demo-tests/run.mjs` 增加：
  - SSE 行解析用例；
  - 动作白名单过滤用例；
  - Demo 模式不走网络用例。

---

## 六、data-rpa 锚点（最小改动）

只在关键入口加属性，不改布局与逻辑：

| 页面 | 锚点 |
|---|---|
| 花名册 | `athlete-add`（新增运动员按钮） |
| 指标库与任务下发 | `task-create`（新建任务按钮） |
| 健康预警中心 | `rtp-edit`（评估处置按钮） |
| 组合测试调度 | `combo-calculate`（批量计算按钮） |
| 报告中心 | `report-generate`（生成报告按钮） |

---

## 七、实施顺序

| 步骤 | 内容 | 产出 |
|---|---|---|
| M1a | 协议常量、意图目录、审计表补丁 | 补丁 SQL（交用户执行） |
| M1b | Provider、CapabilityResolver（buildMenus 还原路由）、Redis 用户级限流、Principal 快照、SSE、审计 | 后端可独立 `curl` 验证 |
| M1c | client、store、Launcher、Panel、actions | 前端可呼出并流式 |
| M1d | 5 个页面加 `data-rpa` 锚点 | 高亮可用 |
| M1e | 构建与回归 | `mvn clean package`、`npm run build`、Node 桩测、手工验收 |

---

## 八、部署注意（环境端口与 SSE）

### 8.1 环境端口（以 deploy 脚本与 env.conf 为准）

| 环境 | 业务 API 端口 | 健康检查端口 | 说明 |
|---|---|---|---|
| dev | `8080` | `8081` | 本地开发；前端 Vite 代理到 8080 |
| uat | `9080` | `9081` | `deploy/deploy-uat.sh` 默认值 |
| prod | `10080` | `10081` | `deploy/deploy.sh` + `deploy/env.conf.example` 默认值 |

> 写死端口会导致 UAT/生产 502。Agent 不执行部署，部署与 env.conf 修改由用户本人操作。

### 8.2 nginx SSE 配置

SSE 必须关闭代理缓冲，否则流式会“憋一大段再一次性出现”。按环境替换上游端口：

```nginx
# 生产（10080）；UAT 用 9080
location /prod-api/ {
    proxy_pass http://127.0.0.1:10080/;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}
```

- UAT：`proxy_pass http://127.0.0.1:9080/;`
- dev：不经过 nginx，Vite proxy 默认支持流式；若本地反向代理需同样关闭缓冲。

> 配置与部署由用户执行；Agent 只提供配置内容。

---

## 九、验收标准

1. 数据驾驶舱、花名册、指标任务、医疗、报告、系统角色 6 类页面均可呼出；`Alt+A` / `Esc` 正常。
2. 回答逐字流式出现；「停止」可中断；页面状态不丢。
3. “怎么新增运动员”返回步骤 + 「打开花名册」动作；点击后跳转，不触发任何写操作。
4. 无权限页面不会出现在动作中（后端菜单过滤 + 前端路由复核）。
5. 演示模式下助手可用且零真实请求。
6. 每轮问答在 `apms_assistant_log` 有一条记录；中断记为 `aborted`。
7. 控制台无报错；移动端为底部面板且不遮挡内容；暗色大屏模式视觉正常。

---

## 十、风险与对策

| 风险 | 对策 |
|---|---|
| SSE 被 nginx 缓冲 | 关闭 `proxy_buffering`，心跳 15s |
| 事件流被安全过滤器拦截 | 使用 Bearer 头 + `fetch`，接口与普通鉴权接口同链路 |
| 动作路径越权 | `buildMenus` 还原完整路由 + 后端 allowedPaths + 前端 `router.resolve` 三重校验 |
| 菜单相对路径误判 | 禁止直接比较 `menu.path`；统一走 `buildMenus → RouterVo` 递归拼接 |
| 限流编译失败/全局共享额度 | 不扩展 `LimitType`；自定义 Redis key `assistant:user:{userId}` |
| 异步线程 SecurityContext 丢失 | 请求线程捕获 `AssistantPrincipal` 快照，异步只读快照 |
| 演示模式误发真实请求 | `isDemoMode()` 四态裁决优先于任何网络调用 |
| 写操作误触 | M1 不提供 click/fill/submit；动作仅导航与高亮 |
| 审计表写失败拖垮回答 | 审计 try/catch，只记服务端日志 |
| 高亮选择器注入 | 后端只传 targetKey，本地固定映射 |

---

## 十一、后续里程碑（不在本次实施）

- **M2**：只读数据问答（任务数、未评估人数、最近报告）。注意 `@DataScope` 依赖请求线程 ThreadLocal：查询必须在请求线程完成，或显式传 `userId` 与数据范围参数，不能在 SSE 后台线程直接调带 `@DataScope` 的 Service。
- **M3**：受控动作——打开新增弹窗并预填、触发导出，必须二次确认并记录动作审计。
- **M4**：`AgentAssistantProvider` 接入真实 Agent，复用同一 SSE 协议与前端执行器。
