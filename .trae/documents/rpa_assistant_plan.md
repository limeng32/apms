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
- 回答经 SSE 传输，由前端逐字呈现；
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
| P1 | §8.2 原示例重写整段 `/prod-api/`，忽略仓库已有的 rewrite、请求头透传与超时配置 | 改为在 `apms-nginx.conf` / `apms-uat.conf` 原 `location ^~ /prod-api/` 前新增精确 `location = /prod-api/apms/assistant/chat`，只对该接口关缓冲（§8.2） |
| P0 | `fetch` 绕过 [request.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js) 的 baseURL、Bearer 注入与 Demo Adapter；若 `/capabilities` 直接 fetch，演示模式会发出真实请求 | `assistantClient` 统一处理两个接口：base 拼接、`getToken()`、`isDemoMode()` 前置分流（chat 与 capabilities 都分流）、HTTP/JSON 错误映射（§5.6） |
| P1 | §4.3 让后端按 15–25ms/段发送，用线程等待制造逐字效果 | 后端不 sleep：M1 一次或按自然结构发完 `delta` 后立即 `done`；逐字效果由前端打字机负责（§4.3 / §5.3） |
| P1 | navigate 与 highlight 是两个独立动作，未定义页面未渲染、数据加载中、按钮被权限隐藏时的行为；`router.resolve` 可能只命中 404 兜底 | `navigate` 可携带 `highlightKey`/`requiresPerm`，执行器按顺序等待锚点（5s 超时、失败静默）；路由校验必须排除 `/:pathMatch(.*)*` 且命中 allowedPaths（§3.3 / §5.5） |
| P1 | 会话未按账号/Demo 模式隔离；`question varchar(1000)` 无前置长度校验；审计终态可能重复或遗漏 | sessionStorage 增加 owner 校验与清除触发点；DTO 前置校验；CAS 终态 + `message_id` 唯一索引（§4.6 / §5.8） |

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
6. **传输流式与展示流式分离**：后端不制造延迟，前端负责打字机；未来 Agent 的 Token 流可直接复用展示层。

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
| `delta` | `{text:"..."}` | 文本片段；**M1 允许一次性携带完整回答** |
| `action` | `{type:"navigate", path:"/testings/dispatch", label:"打开任务页", confirm:false}` | 可点击动作 |
| `done` | `{finishReason:"stop"}` | 正常结束 |
| `error` | `{code,msg,retryable}` | 可重试错误 |

> **传输流式 ≠ 展示流式**：后端只负责尽快把文本与动作发完，**禁止 `Thread.sleep` / 人为分段延迟**。逐字打字机效果由前端根据 `delta` 队列模拟；M4 接真实 Agent 后，前端直接按 Token 流展示，不需要改协议。

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
| `navigate` | `path`, `label`, `highlightKey?`, `requiresPerm?`, `durationMs?` | `path` 必须属于当前用户可访问路由集合；不允许外链与 `//host`；`highlightKey` 表示跳转成功后定位；`requiresPerm` 为按钮权限数组；`durationMs` 仅控制高亮展示时长（默认 3000） |
| `highlight` | `targetKey`, `label`, `durationMs` | 仅用于当前页面；只接受前端本地注册的 key；后端不传 CSS 选择器 |

**跳转与高亮是一个有序动作，不是两个独立动作**：

- 助手优先下发单个 `navigate` 并携带可选 `highlightKey`；前端执行器按「校验路由 → 跳转 → 等待页面就绪 → 查找锚点 → 高亮」顺序执行。
- 独立 `highlight` 仅用于“已经在目标页”的场景，不隐含跳转。
- 后端只在用户拥有对应按钮权限时才下发 `highlightKey`；前端仍会在执行前复核权限与锚点存在性。
- 任一环节失败（路由不存在、页面未渲染、锚点因权限隐藏、等待超时）都只结束该动作，**不得抛出错误或让助手会话失败**。

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
    ├── AssistantChatRequest.java          # 请求 DTO（@Size/URL/UUID 校验）
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
4. 生成动作：仅当目标路径精确命中 `Principal.allowedPaths` 时下发 `navigate`；若该意图带页面锚点且用户拥有对应按钮权限，则同时携带 `highlightKey`（不单独下发 highlight）；
5. 发送事件：按自然结构发送 1~N 个 `delta`（M1 通常一次性发完整回答），**不做 sleep、不做人为逐字延迟**；发送完毕立即 `done`；
6. 结束：使用 Principal 快照写审计记录，发送 `done`。

> M1 的规则回答是确定的模板文本，没有真实生成耗时。线程池与心跳是为 M4 真实 Agent 长连接预留；M1 的流任务应瞬时完成，不占用线程等待。

首批意图：

| 意图 | 示例问法 | 回答要点 | 动作 |
|---|---|---|---|
| `ATHLETE_CREATE` | 怎么新增运动员 / 建档 | 花名册新增、必填项、RTP 不预置 | 去 `/athletes/roster` + `highlightKey=athlete-add` |
| `PHV_HOW` | PHV 在哪 / 怎么算 | 体态录入 → Mirwald；成年身高口径 | 去 `/athletes/growth` |
| `IMPORT_RESULT` | 怎么导入成绩 / 体测 | xlsx/xls/csv 两阶段导入、冲突拒绝 | 去 `/testings/dispatch` + `highlightKey=task-create` |
| `COMBO_SCORE` | 组合评分怎么算 | T 分、参考快照、N<5 代理口径 | 去 `/testings/combo-dispatch` + `highlightKey=combo-calculate` |
| `RTP_EDIT` | RTP 怎么改 / 谁能改 | 权限点、留痕、人工确认 | 去 `/healthcare/alert-center` + `highlightKey=rtp-edit` |
| `REPORT_DOWNLOAD` | 报告在哪下载 | 生成 → 鉴权下载 | 去 `/analytics/report-center` + `highlightKey=report-generate` |
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
- **补集**：固定路由单独维护白名单（如 `/index`、`/apms/athlete/detail/{athleteId}`），且必须按权限点二次校验；带参数的固定路由用模式匹配，不能按字符串精确匹配；
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
  message_id   varchar(64)  NOT NULL COMMENT '单条消息ID（后端生成，唯一）',
  user_id      bigint       NOT NULL COMMENT '用户ID',
  user_name    varchar(64)  DEFAULT NULL COMMENT '用户名',
  question     varchar(1000) NOT NULL COMMENT '用户问题（入库前已校验长度）',
  answer       mediumtext   COMMENT '完整回答',
  intent       varchar(64)  DEFAULT NULL COMMENT '命中意图',
  action_json  json         DEFAULT NULL COMMENT '下发动作',
  provider     varchar(20)  NOT NULL DEFAULT 'pseudo' COMMENT 'provider',
  status       varchar(20)  NOT NULL DEFAULT 'success' COMMENT 'success/error/aborted',
  error_msg    varchar(500) DEFAULT NULL COMMENT '错误信息',
  create_time  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_message_id (message_id),
  KEY idx_user_time (user_id, create_time),
  KEY idx_session (session_id),
  CONSTRAINT chk_assistant_status CHECK (status IN ('success','error','aborted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='RPA助手审计日志';
```

> 补丁文件名按部署时 `apms.version` 生成；**由用户本人执行**，Agent 不直连数据库。

### 4.6 输入校验与审计终态

**请求校验（必须在建立 SSE / 写审计之前完成）**

| 字段 | 规则 | 失败响应 |
|---|---|---|
| `message` | trim 后非空；长度 1–1000 字符（与 `question varchar(1000)` 对齐） | 400 JSON，不建流、不写审计 |
| `sessionId` | UUID v4 格式（36 字符，正则校验） | 400 JSON |
| `context.route` | 可选；字符串，≤200 字符，必须以 `/` 开头，禁止 `//`、控制字符、外链 | 400 JSON |
| `context.pageTitle` | 可选；≤100 字符，去除控制字符 | 400 JSON |
| `context.entityId` | 可选；正整数 | 400 JSON |
| 请求体 | ≤16KB；`Content-Type: application/json` | 413/415 JSON |
| 未知字段 | DTO 白名单，未定义字段忽略 | — |

- 校验失败一律在请求线程返回 4xx JSON（不是 SSE），**不创建审计记录**，避免“超长 question 到写库才失败”。
- 通过校验后才进入限流与 SSE；`message_id` 由后端生成并放入 `meta` 事件。

**审计终态（一次请求只落一条）**

```java
enum AssistantTerminal { PENDING, SUCCESS, ERROR, ABORTED }

// 每个请求一个上下文，终态只能 CAS 成功一次
AtomicReference<AssistantTerminal> state = new AtomicReference<>(PENDING);
boolean finishOnce(AssistantTerminal next, String errorMsg) {
    if (!state.compareAndSet(PENDING, next)) return false;
    audit(next, errorMsg);   // 只在这里落库一次
    return true;
}
```

| 触发 | 终态 | 说明 |
|---|---|---|
| 正常发送 `done` | `success` | 先置终态再写审计；`done` 后回调不再改状态 |
| Provider 异常 / 中途异常 | `error` | 尽力发送 `error` 事件后落库 |
| `onTimeout` | `error` | `error_msg=TIMEOUT`；除非已终态 |
| 客户端断开（关标签、网络断、用户点停止触发 abort） | `aborted` | `onCompletion` / `onError` 且尚未发送 `done` 时判定 |
| 已发送 `done` 后的 `onCompletion` | 不改状态 | 保持 `success`，不产生第二条审计 |
| 审计写失败 | 终态不变 | 只记服务端日志，不回滚、不改 SSE 结果 |

- `SseEmitter.onCompletion` / `onError` / `onTimeout` 与正常发送路径可能在不同线程并发触发，统一走 `finishOnce` 的 CAS；
- `message_id` 唯一索引作为第二道防线，重复插入直接失败，不会产生两条记录；
- 前端主动停止只 abort 请求，不额外调用“停止接口”，服务端以断线判定 `aborted`；
- **停止时机决定终态**：若 `done` 已发送（M1 后端通常瞬间完成），用户停止只停止前端打字机，审计保持 `success`；若请求尚未完成并被 abort，才记 `aborted`。前端不得把“停止展示”误报成服务端失败。

---

## 五、前端设计

### 5.1 新增文件

```text
ruoyi-ui/src/components/Assistant/
├── AssistantLauncher.vue     # 悬浮球、Alt+A、流式状态点
├── AssistantPanel.vue        # 抽屉、消息列表、建议问题、停止/清空
├── AssistantMessage.vue      # 流式文本 + 动作 chip
├── assistantClient.js        # baseURL/Bearer/Demo 分流 + fetch SSE + 错误映射
├── assistantDemo.js          # 本地能力表 + 本地伪流式（chat/capabilities 共用）
├── assistantSession.js       # 会话存储、owner 校验、清除（叶子模块，供 user/demo 调用）
├── assistantActions.js       # navigate / highlight 白名单执行
└── assistantStore.js         # Pinia：会话、上下文、打开状态
```

### 5.2 挂载

在 [layout/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/layout/index.vue) 挂载 `<AssistantLauncher />`，位于 `.app-wrapper` 内、`demo-banner` 之上；登录页不挂载。

### 5.3 交互

- `Alt+A` 呼出、`Esc` 关闭；输入框聚焦时仍可呼出（`preventDefault` 阻止字符输入）；
- 右侧抽屉 420px，移动端（≤768px）底部 85vh，带安全区；
- 流式期间显示「停止」；关闭抽屉不中断请求，重新打开恢复当前流；
- **前端打字机**：维护待展示文本队列，按固定节奏（约 15–25ms/字或每帧若干字）渲染；后端 `delta` 可能一次到达整段，前端只负责视觉展开；
- 「停止」优先停止本地打字机并清空队列；若请求仍在进行再调用 `AbortController.abort()`；
- 后端 `done` 到达时若队列未渲染完，继续渲染至结束（不被 `done` 截断）；M4 真实 Token 流则直接追加展示；
- `action` 事件先缓存，待打字机队列清空后再展示动作 chip，避免“按钮先于文字出现”；
- 导航动作点击后面板收起但保留会话；目标页 3 秒内高亮；
- 主题跟随 `--el-color-primary`（登录页 accent），不引入新依赖；
- 文本用 `white-space: pre-wrap` + 转义渲染，不使用 `v-html`；
- 会话保存在 `sessionStorage`（刷新保留，关闭标签清除），不落业务库；
- 首次打开面板时通过 `assistantClient.getCapabilities()` 预热 `allowedPaths` 与建议问题（该函数已内置 Demo 分流）；失败不阻塞对话。

### 5.4 上下文

每次请求携带：

```js
{
  route: route.path,
  pageTitle: route.meta?.title || '',
  // M1 可选：entityId（运动员详情 / 任务详情）
}
```

### 5.5 动作执行器（navigate + highlight 顺序执行）

`navigate` 与 `highlight` 不是两个独立动作：带 `highlightKey` 的 `navigate` 是一个**原子序列**，执行器必须完成「路由校验 → 跳转 → 等待页面就绪 → 查找锚点 → 高亮」后才算结束。

#### 5.5.1 路由校验（不能只看 `router.resolve` 有返回）

Vue Router 有通配 404 路由：

```js
{ path: '/:pathMatch(.*)*', component: () => import('@/views/error/404'), hidden: true }
```

`router.resolve('/任意乱写')` 也会返回 matched 记录（命中 404 兜底），因此必须同时满足：

1. `path` 规范化后命中 `assistantStore.allowedPaths`（后端 capabilities 下发，权威；静态路径按集合匹配，带参路由按模式匹配）；
2. `resolved.matched.length > 0`；
3. 末级 matched 记录 **不是** `/:pathMatch(.*)*`（用 `record.path` 判断，避免依赖 name）；
4. 末级记录有 `name`（业务路由由 `buildMenus` 生成，404 兜底无 name）；
5. 不属于 `/login`、`/401`、`/showcase`、`/redirect` 等非业务路由（allowedPaths 已排除，双保险）。

任一不满足：不跳转，返回 `{ ok:false, reason:'route-not-allowed' }`，不抛错。

#### 5.5.2 执行顺序与代码骨架

```js
async function runAction(action, ctx) {
  const path = normalizePath(action.path)
  if (!ctx.allowedPaths.has(path)) return { ok: false, reason: 'route-not-allowed' }

  const resolved = router.resolve(path)
  const last = resolved.matched[resolved.matched.length - 1]
  const isCatchAll = !last || last.path === '/:pathMatch(.*)*'
  if (isCatchAll || !last.name) return { ok: false, reason: 'route-not-found' }

  const seq = ++ctx.actionSeq                 // 新动作使旧动作失效
  await router.push(path)                     // push 完成只代表导航确认
  if (ctx.actionSeq !== seq) return { ok: false, reason: 'superseded' }
  if (normalizePath(router.currentRoute.value.path) !== path) {
    return { ok: false, reason: 'not-on-target' }
  }

  if (action.highlightKey) {
    // 按钮因权限被 v-hasPermi 隐藏时，直接跳过高亮，不报错
    if (action.requiresPerm && !checkPermi(action.requiresPerm)) {
      return { ok: true, highlighted: false, reason: 'no-perm' }
    }
    const el = await waitForAnchor(action.highlightKey, {
      timeoutMs: 5000,                          // 页面数据加载等待上限，固定 5s
      isCancelled: () => ctx.actionSeq !== seq
    })
    if (!el) return { ok: true, highlighted: false, reason: 'anchor-not-found' }
    highlight(el, action.durationMs || 3000)    // 展示时长
    return { ok: true, highlighted: true }
  }
  return { ok: true, highlighted: false }
}
```

#### 5.5.3 等待页面就绪与锚点

`router.push` resolve 只代表路由切换完成，目标页的数据请求与 DOM 渲染可能仍在进行，因此：

- 先 `await nextTick()` + 两个 `requestAnimationFrame`，给首屏渲染留出时间；
- 再 `waitForAnchor(key, timeoutMs)`：
  - 立即查 `document.querySelector('[data-rpa="' + key + '"]')`；
  - 未找到则 `MutationObserver` 监听 `.app-main`（或 `document.body`）子树变化，出现即 resolve；
  - 5s 超时 resolve `null`（**不 reject**）；
  - 观察过程中若 `actionSeq` 变化或路由离开目标页，立即 disconnect 并返回 `null`；
- 找到后再次校验当前路由仍是目标页，防止异步期间用户已切走；
- 高亮实现：加临时 class（3s 后移除）+ `scrollIntoView({ block: 'center', behavior: 'smooth' })`，不修改业务数据、不点击按钮；
- 所有定时器 / observer / class 在动作结束或组件卸载时清理，避免残留。

#### 5.5.4 失败策略

| 情况 | 行为 |
|---|---|
| 路径不在 allowedPaths / 命中 404 兜底 | 不跳转，静默结束；不向聊天流程抛错 |
| 页面数据加载慢、锚点晚出现 | 最多等 5s，出现即高亮 |
| 锚点始终不存在（权限隐藏 / 页面改版） | 结束该动作；可给一次轻提示“已打开页面”，不显示错误 |
| 用户中途切页 / 连续下发新动作 | 旧动作被 `actionSeq` 作废，observer 与定时器立即清理 |
| 独立 `highlight`（当前页） | 同样走 `waitForAnchor`，失败静默结束 |

#### 5.5.5 锚点注册表

```js
const TARGETS = {
  'athlete-add': '[data-rpa="athlete-add"]',
  'task-create': '[data-rpa="task-create"]',
  'rtp-edit': '[data-rpa="rtp-edit"]',
  'combo-calculate': '[data-rpa="combo-calculate"]',
  'report-generate': '[data-rpa="report-generate"]'
}
```

- 后端只传 `targetKey`，不传选择器；选择器只存在于前端注册表；
- `checkPermi` 从 `@/utils/permission` 导入且**必须传数组**（本项目既有约定）；
- 不执行任何后端下发的选择器或代码。

### 5.6 assistantClient：与 request.js 请求体系对齐（P0）

`fetch` 不会经过 [request.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/request.js)，因此以下三件事必须在 `assistantClient` 内单独实现，且 **chat 与 capabilities 两个接口都适用**：

| request.js 既有逻辑 | assistantClient 的对应实现 |
|---|---|
| `baseURL: import.meta.env.VITE_APP_BASE_API` | 统一 `const BASE = import.meta.env.VITE_APP_BASE_API`；生产实际请求 `/prod-api/apms/assistant/chat`，dev 为 `/dev-api/...` |
| `Authorization: Bearer <getToken()>` | `getToken()`（来自 `@/utils/auth`）；无 token 不加头，由 401 分支兜底 |
| `isDemoMode() → config.adapter = demoAdapter` | 在**任何网络调用之前**判断 `isDemoMode()`；`chat` 与 `capabilities` 都走本地实现，零真实请求 |

实现约定：

- `capabilities` 真实模式直接用现有 axios `request({ url: '/apms/assistant/capabilities', method: 'get' })`，自动获得 baseURL、Bearer、Demo Adapter 与全局错误处理；但**仍先判断 `isDemoMode()`**，演示模式直接返回本地能力表，不进入 axios。
- `chat` 因 SSE 无法走 axios，使用 `fetch`，手工拼接 URL 与 Bearer。
- 两个函数都不得裸调 `fetch` 或裸拼 `/apms/...`。

```js
import { getToken, isDemoMode } from '@/utils/auth'
import request from '@/utils/request'
import { demoCapabilities, demoChatStream } from './assistantDemo'

const BASE = import.meta.env.VITE_APP_BASE_API

export async function getCapabilities() {
  if (isDemoMode()) return demoCapabilities()          // 演示：零网络
  const res = await request({ url: '/apms/assistant/capabilities', method: 'get' })
  return res.data                                     // 若依响应体 {code,msg,data}
}

export async function streamChat(payload, { onEvent, signal }) {
  if (isDemoMode()) {                                  // 演示：零网络
    return demoChatStream(payload, { onEvent, signal })
  }

  const token = getToken()
  const res = await fetch(`${BASE}/apms/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload),
    signal
  })

  const ct = res.headers.get('content-type') || ''
  if (!res.ok || !ct.includes('text/event-stream')) {
    throw await toAssistantError(res)                  // 401/403/429/500/JSON
  }
  await parseSse(res.body, onEvent)
}
```

**错误处理映射**

| 情况 | 处理 |
|---|---|
| HTTP 401 | 提示“登录状态已过期”，提供「重新登录」；与 request.js 的 401 语义一致，复用 `isRelogin` 防重复弹窗，不静默重试 |
| HTTP 403 | 提示“当前账号无权限使用该能力”，保留面板 |
| HTTP 429 | 提示“请求过于频繁，请稍后再试”；有 `Retry-After` 时显示等待秒数 |
| HTTP 5xx | 提示“服务暂时不可用”，标记可重试 |
| 2xx 但 `content-type` 非 `text/event-stream` | 按 JSON 解析，识别若依 `{code:401/500/601,msg}`，展示 `msg`，不喂给 SSE 解析器 |
| SSE `error` 事件 | 保留已收到的部分回答，展示错误并可重试 |
| 网络错误 / 超时 | 提示网络异常；`AbortError` 视为用户主动停止，不算错误 |

**SSE 解析要点**

- `TextDecoder(..., { stream: true })` 逐块解码；
- 以空行（`\n\n` / `\r\n\r\n`）分帧，`event:` 与 `data:` 可多行，`data` 多行按 `\n` 拼接；
- 忽略 `:` 开头的心跳注释；
- 单帧 JSON 解析失败只记录日志并丢弃该帧，不终止整条流；
- `AbortController` 由「停止」按钮与面板关闭（可选保留）触发。

### 5.7 演示模式（chat + capabilities 双重隔离）

- `assistantClient` 的两个导出函数都先判断 `isDemoMode()`（[auth.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/utils/auth.js)）；broken / storage-error 态同样为 true，照常本地分流；
- `demoCapabilities()`：返回 2400 菜单树对应的固定路径与建议问题，与演示环境 `getRouters` 的静态结果保持一致；
- `demoChatStream()`：本地意图表 + `setTimeout` 伪流式，返回 `meta/delta/action/done` 同构事件，动作同样受本地 allowedPaths 限制；
- 第二道防线：在 `src/mock/handlers/` 增加 `/apms/assistant/capabilities` handler（若未来有人误用 axios 调它，Demo Adapter 也不会发真实请求）；
- `.trae/demo-tests/run.mjs` 增加：
  - Demo 下 `getCapabilities()` 与 `streamChat()` 均零网络（对 `fetch` 与 axios 打桩断言调用次数为 0）；
  - 真实模式下 URL 为 `VITE_APP_BASE_API + '/apms/assistant/chat'` 且带 Bearer；
  - SSE 多行 `data`、心跳注释、`error` 事件解析；
  - 401/403/429/500 与非 SSE 响应的错误映射。

### 5.8 客户端会话隔离（账号 / Demo 切换）

M1 只是操作帮助，但 M2 可能包含运动员信息，因此会话存储必须带归属，不能只靠“退出时清一下”。

**存储结构**

```js
// sessionStorage 单键；payload 自带 owner
const KEY = 'apms_assistant_session'
const payload = {
  owner: { mode: 'demo' | 'real', userId: 100 | -1 },
  messages: [...],          // 最多 30 条 / 32KB
  updatedAt: 1790000000000
}
```

- 读取时校验 `owner.mode === (isDemoMode() ? 'demo' : 'real')` 且 `owner.userId === userStore.id`；
  任一不匹配、JSON 损坏、存储不可用 → 丢弃并重置为空会话，**绝不展示上一个账号/模式的对话**。
- Demo 用户 id 为 `-1`（`mock/fixtures/system.js`），与真实账号天然隔离；`broken` / `storage-error` 态同样不读旧数据。
- sessionStorage 按标签页隔离；复制标签页时即使 payload 被克隆，owner 校验仍会拦截不同账号。

**清除 / 隔离触发点（缺一不可）**

| 触发 | 动作 |
|---|---|
| `userStore.logOut()`（真实或 Demo 分支） | 调 `clearAssistantSession()`；关闭面板、abort 进行中的流、清空内存消息 |
| `enterDemo()` / `exitDemo()` | 调 `clearAssistantSession()`，Demo 与真实会话互不复用 |
| 登录成功 / `userStore.id` 或 `token` 变化 | `watch` 触发 reset，防止 A→B 切换后残留 |
| 收到 401 / 重新登录 | reset + abort 当前流 |
| 页面刷新 | 同一 owner 可恢复；owner 变化则自动丢弃 |
| 标签页关闭 | sessionStorage 自动清除 |

**实现约定**

- `assistantSession.js` 为叶子模块（只依赖 sessionStorage 常量与纯函数），供 `user.js`、`demo.js`、`assistantStore` 调用，避免循环依赖；
- `assistantStore` 暴露 `resetSession()`：清消息、清 action 队列、`actionSeq++`、abort 当前 `AbortController`；
- 会话只存问答文本与动作记录，不存 token、密码、手机号等凭证；
- M2 若消息含业务数据，优先只存内存；确实需要刷新恢复时，缩短保留条数并继续按 owner 隔离。

---

## 六、data-rpa 锚点（最小改动）

只在关键入口加属性，不改布局与逻辑：

| 页面 | 锚点 | 对应按钮权限 |
|---|---|---|
| 花名册 | `athlete-add`（新增运动员按钮） | `apms:athlete:add` |
| 指标库与任务下发 | `task-create`（新建任务按钮） | `apms:testTask:add` |
| 健康预警中心 | `rtp-edit`（评估处置按钮） | `apms:rtp:edit` |
| 组合测试调度 | `combo-calculate`（批量计算按钮） | `apms:comboScore:calculate` |
| 报告中心 | `report-generate`（生成报告按钮） | `apms:report:generate` |

> 锚点必须挂在稳定的按钮元素上；`v-hasPermi` 隐藏按钮时锚点自然不存在，执行器按 §5.5.4 静默降级，不视为故障。

---

## 七、实施顺序

| 步骤 | 内容 | 产出 |
|---|---|---|
| M1a | 协议常量、意图目录、请求校验规则、审计表补丁 | 补丁 SQL（交用户执行） |
| M1b | Provider、CapabilityResolver（buildMenus 还原路由）、Redis 用户级限流、Principal 快照、SSE（不发人为延迟）、CAS 终态审计 | 后端可独立 `curl` 验证 |
| M1c | client、store、Launcher、Panel、actions、前端打字机、会话 owner/清除钩子 | 前端可呼出并逐字呈现 |
| M1d | 5 个页面加 `data-rpa` 锚点 | 高亮可用 |
| M1e | 构建与回归 | `mvn clean package`、`npm run build`、Node 桩测、手工验收 |

---

## 八、部署注意（环境端口与 SSE）

### 8.1 环境端口（以 deploy 脚本与 env.conf 为准）

| 环境 | 业务 API 端口 | 健康检查端口 | 前端/nginx 入口 | 说明 |
|---|---|---|---|---|
| dev | `8080` | `8081` | Vite `5173` | `vite.config.js` 中 `/dev-api` → `localhost:8080` 并去掉前缀 |
| uat | `9080` | `9081` | nginx `8088` | `deploy/deploy-uat.sh` 默认值；本机 `/opt/apms-uat` |
| prod | `10080` | `10081` | nginx `80/443` | `deploy/deploy.sh` + `env.conf.example`；`/opt/apms`，systemd |

> 写死端口会导致 UAT/生产 502。Agent 不执行部署，部署与 env.conf 修改由用户本人操作。

### 8.2 SSE 与现有 nginx 配置（最小差异，不重写现有 location）

仓库已有两套可用配置，SSE 只做增量，不替换原有代理块：

- **生产** [apms-nginx.conf](file:///Users/limeng/Documents/trae_projects/apms/deploy/apms-nginx.conf)：HTTP default、HTTPS `aoti.apms.top`、HTTPS `www.apms.top` 三个 server 块，各自包含
  `location ^~ /prod-api/`（`rewrite ^/prod-api/(.*)$ /$1 break;`、透传 `Host/X-Real-IP/X-Forwarded-For/X-Forwarded-Proto`、`proxy_pass http://127.0.0.1:10080;`、connect 30s / read 60s / send 30s）。
- **UAT** [apms-uat.conf](file:///Users/limeng/Documents/trae_projects/apms/deploy/apms-uat.conf)：`listen 8088`，`location /prod-api/` 反代 `localhost:9080`，read 60s。

做法：在原 `location ^~ /prod-api/` **之前**增加一个精确匹配 `location =`（nginx 中 `=` 优先级高于 `^~`），只对助手流式接口关闭缓冲，其他 API 保持原行为。

生产 `deploy/apms-nginx.conf`（在 HTTP default 与 HTTPS aoti 两个业务 server 块各加一份；www 品牌展示页无登录，可不加）：

```nginx
# SSE：RPA 助手流式接口（必须放在原有 ^~ /prod-api/ 之前）
location = /prod-api/apms/assistant/chat {
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header REMOTE-HOST $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    rewrite ^/prod-api/(.*)$ /$1 break;

    proxy_pass http://127.0.0.1:10080;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
}
```

UAT `deploy/apms-uat.conf`（`listen 8088` 的 server 块内）：

```nginx
location = /prod-api/apms/assistant/chat {
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    rewrite ^/prod-api/(.*)$ /$1 break;

    proxy_pass http://localhost:9080;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
}
```

说明：

- 原 `proxy_read_timeout 60s` 对 SSE 偏短；精确块提升到 180s，配合后端 15s 心跳，正常不会被掐断。
- 不要直接在 `^~ /prod-api/` 上关闭 `proxy_buffering`：那会让所有 API 和文件下载都失去缓冲，影响面更大；精确块只作用于助手。
- 生产链路：`build.sh` 上传 `deploy/apms-nginx.conf` → 远端 `deploy.sh` 安装到 `/etc/nginx/conf.d/apms.conf`，先备份旧配置、`nginx -t` 通过才 `reload`，失败自动恢复。因此改仓库配置后正常发版即可，无需登录服务器手改。
- UAT 链路：`deploy-uat.sh` **不自动安装** `apms-uat.conf`，只在 Step 7 执行 `nginx -t` 与 reload；需要手动同步该文件后再 reload。
- dev：Vite `/dev-api` 代理不做缓冲，无需额外配置。

### 8.3 发版链路（与 SSE 相关的实际行为）

| 脚本 | 实际行为 | 对 SSE 的影响 |
|---|---|---|
| `deploy/build.sh` | 本地执行：`mvn clean package -DskipTests -Dapms.version=...` → `npx vite build` → 上传 jar、dist、`apms-nginx.conf`、`apms-backend.service`、TLS 证书、`patches/*.sql` 到 `/opt/apms/upload/` → 远端执行 `deploy.sh` | 发版即替换前后端；助手接口随 jar/dist 一起上线 |
| `deploy/deploy.sh` | 生产：备份、停服、同步 `dist`、应用补丁（按 `apms_db_version` 去重）、安装 `/etc/nginx/conf.d/apms.conf`（`nginx -t` 通过才 reload，失败回滚旧配置）、systemd 启动、`10081/health` 检查、外网验证 | 停服会断开正在进行的 SSE；前端需把断流显示为“连接已断开”，不当作回答完成 |
| `deploy/deploy-uat.sh` | 本机 UAT：默认智能构建（产物比源码旧时自动 `build.sh --only-build`），`/opt/apms-uat`，`9080/9081`，`8088` nginx，Step 7 仅 `nginx -t` + reload，**不自动安装 `apms-uat.conf`** | 改 UAT nginx 后需手动同步 `apms-uat.conf` 再 reload；否则 SSE 仍按旧配置 60s 超时 |

> 发版脚本、SQL 补丁、nginx 配置更新均由用户本人执行，Agent 不运行部署、不拷贝产物到 `.uat/`。

---

## 九、验收标准

1. 数据驾驶舱、花名册、指标任务、医疗、报告、系统角色 6 类页面均可呼出；`Alt+A` / `Esc` 正常。
2. 回答逐字呈现（前端打字机）；「停止」可中断；页面状态不丢；后端无 `Thread.sleep` / 人为延迟。
3. “怎么新增运动员”返回步骤 + 「打开花名册」动作；点击后跳转到花名册，等待页面渲染后高亮新增按钮，不触发任何写操作。
4. 跳转+高亮异常路径：页面数据加载慢时最多等 5s 仍能高亮；无 `apms:athlete:add` 权限时只跳转、不高亮；锚点不存在或 path 命中 404 兜底时不跳转/不报错，助手会话正常。
5. 无权限页面不会出现在动作中（后端菜单过滤 + 前端 allowedPaths + 404 排除三重校验）。
6. **演示模式零网络**：打开面板时 `/capabilities` 与 `/chat` 均不产生真实请求（Network 面板无 `/apms/assistant/*`），能力表与本地回答可用；broken / storage-error 态同样不发请求。
7. 真实模式请求正确：Network 面板中 chat 为 `POST /prod-api/apms/assistant/chat`（dev 为 `/dev-api/...`），带 `Authorization: Bearer ...` 与 `Accept: text/event-stream`；capabilities 为 `GET /prod-api/apms/assistant/capabilities`。
8. 错误处理：401 提示重新登录、403 提示无权限、429 提示限流、500 提示服务异常；非 SSE 的 JSON 错误能展示后端 `msg`，不出现“把 JSON 当流解析”的乱码。
9. 每轮问答在 `apms_assistant_log` 有一条记录；中断记为 `aborted`。
10. 控制台无报错；移动端为底部面板且不遮挡内容；暗色大屏模式视觉正常。
11. **账号/模式隔离**：同一标签页 A 退出 → B 登录后看不到 A 的对话；Demo ↔ 真实切换后同样互不可见；刷新后仅同一 owner 可恢复。
12. **输入校验**：`message` 超 1000 字符、`sessionId` 非 UUID、`route` 非法时返回 4xx JSON，Network 无 SSE，审计表无新增行。
13. **审计终态唯一**：正常完成 → 1 条 `success`；用户停止/断线 → 1 条 `aborted`；异常 → 1 条 `error`；`message_id` 唯一，无重复行。

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
| fetch 绕过 request.js | assistantClient 统一负责 baseURL、Bearer、Demo 前置分流；chat 与 capabilities 均不裸调网络 |
| 后端线程被逐字延迟占用 | M1 规则回答不 sleep，发完即结束；线程池/心跳只为 M4 长连接预留 |
| `router.resolve` 命中 404 兜底被误判为有效路由 | 校验 `allowedPaths` + 排除 `/:pathMatch(.*)*` + 末级记录必须有 name |
| 目标页未渲染 / 数据加载慢 / 按钮被权限隐藏 | `navigate` 携带 `highlightKey`，MutationObserver 最多等 5s；失败静默降级，不抛错 |
| 跨账号 / Demo 切换残留对话 | sessionStorage payload 带 owner，读取校验；logout/enterDemo/exitDemo/401 显式清除 |
| 超长 question 到写库才失败 | DTO 前置校验（≤1000 字符），失败 4xx 且不建流、不写审计 |
| 并发回调造成重复/遗漏审计 | `AtomicReference` CAS 终态 + `message_id` 唯一索引；正常完成/断线/异常各只落一条 |

---

## 十一、后续里程碑（不在本次实施）

- **M2**：只读数据问答（任务数、未评估人数、最近报告）。注意 `@DataScope` 依赖请求线程 ThreadLocal：查询必须在请求线程完成，或显式传 `userId` 与数据范围参数，不能在 SSE 后台线程直接调带 `@DataScope` 的 Service。
- **M3**：受控动作——打开新增弹窗并预填、触发导出，必须二次确认并记录动作审计。
- **M4**：`AgentAssistantProvider` 接入真实 Agent，复用同一 SSE 协议与前端执行器。
