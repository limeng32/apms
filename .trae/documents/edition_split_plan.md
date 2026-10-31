# APMS 双产品线（apms-standard / apms-ai）与 ruoyi-ai 插件化模块实施计划

> 状态：待评审（2026-10-31，第二版：纳入 ruoyi-ai 内部插件体系）
> 范围：后端 Maven 模块拆分 + Edition 构建体系 + **AI 插件框架（SPI）** + Feature Flags 运行时开关 + 前端零 AI 代码隔离与插件注册表 + 构建/部署脚本适配
> 关联文档：[rpa_assistant_plan.md](rpa_assistant_plan.md)（首个 AI 插件：RPA 助手 M1）

---

## 1. 目标与已确认决策

### 1.1 目标

1. 保持两条产品线：
   - **apms-standard**：标准私有化版，产物中**物理不含任何 AI 代码**；
   - **apms-ai**：AI 版，在 standard 全部能力之上承载一个**插件容器**，AI 能力以插件形式逐个加入。
2. 所有 AI 相关代码从 ruoyi-admin / ruoyi-framework / ruoyi-system / ruoyi-common 迁出，统一收拢到新模块 **ruoyi-ai**。
3. ruoyi-ai 内部采用**插件模式（Plugin SPI）**：
   - **RPA 插件**（即已交付的伪 RPA 助手 M1）是第一个插件；
   - 后续 **RAG（知识库检索增强）、Data（数据洞察/异常检测）、Coach（训练建议/选材）** 等以同构插件加入，每个插件自包含、自描述、独立开关、独立审计；
   - 新增一个插件 = 新增一个插件包 + 一行注册，不改容器主干。
4. 采用 **Edition（构建期产品线）+ Plugin Feature Flags（运行时插件开关）** 两层管控：
   - Edition 决定 AI 能力的**上限**（standard 版连端点都不存在）；
   - 每个插件一个 `sys.ai.<plugin>.enabled` 热开关，在 ai 版内决定该插件**是否启用**。
5. standard 前端构建产物中零 AI 代码（构建期别名桩替换，而非仅界面隐藏）；ai 前端通过插件注册表自动发现并按开关挂载。

### 1.2 已确认决策（2026-10-31）

| 决策点 | 选定方案 |
|---|---|
| 后端构建形态 | **Maven Profile 双产物**：默认 `mvn package` 出 standard（物理不含 AI 字节码），`-P ai` 出 ai |
| Feature Flag 管控位置 | **Edition 封顶 + sys_config 热开关**：沿用 `sys.account.smsLoginEnabled` 模式，参数设置修改后即时生效、无需重启 |
| ai 版中插件默认状态 | **默认开启**（种子值 true，可随时关闭） |
| standard 前端隔离强度 | **零 AI 代码**：AI 代码收拢到 `src/ai/`，Vite 按 `VITE_EDITION` 别名替换为空桩 |
| ruoyi-ai 内部组织 | **插件化**：容器核心 + 独立插件包（rpa 首发，预留 rag/data/coach） |

### 1.3 明确不做（边界）

- 不接入真实大模型 / Agent，M1 RPA 仍为 pseudo provider（与 rpa_assistant_plan.md 现状一致）；
- 本期不为每个插件建独立 Maven 子模块（YAGNI）：插件先以**模块内包 + SPI** 形态存在；若未来某插件引入重型依赖（如 RAG 的向量数据库客户端），再演进为 `ruoyi-ai-plugin-rag` 子模块，SPI 契约保持不变；
- 不做 license / 授权码机制：产品线由**交付的构建产物**物理决定，私有化部署天然防串版；
- 不删除任何 AI 代码，只做迁移、分层与门控；
- standard 侧仅允许保留一个 AI 接缝：页面上的惰性 `data-rpa` 锚点（无任何行为与依赖，详见 §5.4）。

---

## 2. 仓库调研结论（现状事实）

### 2.1 模块依赖链

```
ruoyi-admin ──► ruoyi-framework ──► ruoyi-system ──► ruoyi-common
ruoyi-admin ──► ruoyi-quartz
ruoyi-admin ──► ruoyi-generator
```

改造后新增：`ruoyi-admin ──► ruoyi-ai`（仅 ai profile），ruoyi-ai ──► ruoyi-framework（传递获得 system/common、spring-webmvc、aspectj、redis、druid）。**禁止 framework/system/common 反向依赖 ruoyi-ai；禁止插件之间互相依赖**（需要的能力下沉到容器核心）。

### 2.2 新模块可零配置接入的既有扫描约定（已核实）

| 约定 | 位置 | 对 ruoyi-ai 的意义 |
|---|---|---|
| 启动类在 `com.ruoyi`，`@SpringBootApplication` 默认组件扫描 | `ruoyi-admin/.../RuoYiApplication.java` | `com.ruoyi.ai.**` 的组件自动注册 |
| `@MapperScan("com.ruoyi.**.mapper")` | `ruoyi-framework/.../config/ApplicationConfig.java` | `com.ruoyi.ai.**.mapper`（含各插件 mapper）自动扫描 |
| `mybatis.typeAliasesPackage: com.ruoyi.**.domain` | `ruoyi-admin/.../application.yml` | 各插件 domain 自动别名 |
| `mybatis.mapperLocations: classpath*:mapper/**/*Mapper.xml` | 同上 | 各插件 `resources/mapper/<plugin>/*Mapper.xml` 自动加载 |
| MVC 拦截器扩展点 | 标准 `WebMvcConfigurer` | 插件门控用拦截器实现，无需改框架配置 |

### 2.3 现成的 Feature Flag 先例（直接复用模式）

`sys_config` 表键 `sys.account.smsLoginEnabled` 经 `ISysConfigService.selectConfigByKey()` 读取，带 Redis 缓存，「参数设置」保存即清缓存、热生效。同类先例：`sys.account.captchaEnabled`、`sys.account.sliderCaptchaEnabled`、`sys.account.registerUser`。

### 2.4 其他关键现状

- `GET /login/config` 匿名公开、前端独立 axios 实例请求、失败静默回退 —— 前端拉取功能表的容错风格参照；
- 版本真相源：根 pom `<apms.version>`，经 Maven filtering 注入 `version.properties`，`/apms/version` 返回；
- 构建：[deploy/build.sh](file:///Users/limeng/Documents/trae_projects/apms/deploy/build.sh) `mvn clean package` + `npx vite build`，产物固定 `apms.jar`；
- SQL 补丁：[deploy/deploy.sh](file:///Users/limeng/Documents/trae_projects/apms/deploy/deploy.sh) 平铺 glob `patches/*.sql` + `apms_db_version` 去重，**不扫描子目录**；
- dev 运行：`mvn install` 后 `java -jar ruoyi-admin/target/apms.jar`（IDE classpath 走 ~/.m2 的 jar）。

### 2.5 现有 AI 资产全量清单（RPA 插件迁移对象，共 14 个后端文件）

| 现位置 | 说明 |
|---|---|
| `ruoyi-admin/.../web/controller/apms/ApmsAssistantController.java` | SSE chat + capabilities 端点 |
| `ruoyi-admin/.../web/controller/apms/AssistantExceptionHandler.java` | 400/413/429 真实 4xx |
| `ruoyi-admin/src/main/resources/mapper/apms/ApmsAssistantLogMapper.xml` | 审计表 Mapper XML |
| `ruoyi-framework/.../assistant/AssistantStreamService.java` | SSE 编排/心跳/CAS 终态 |
| `ruoyi-framework/.../aspectj/AssistantRateLimiter.java` | Redis 限流 |
| `ruoyi-system/.../domain/apms/ApmsAssistantLog.java` | 审计实体 |
| `ruoyi-system/.../domain/apms/assistant/`（5 个 DTO） | ChatRequest/Context/Principal/Reply/Action |
| `ruoyi-system/.../mapper/apms/ApmsAssistantLogMapper.java` | Mapper 接口 |
| `ruoyi-system/.../service/apms/assistant/`（4 个）+ `impl/AssistantServiceImpl.java` | 服务层 |
| `ruoyi-common/.../exception/AssistantRequestException.java` | 4xx 异常（被上述文件引用） |

前端：`src/components/Assistant/`（8 文件）、`src/utils/assistantSession.js`、`src/mock/handlers/assistant.js`，以及 5 个主干集成点（layout/index.vue、user.js×2 处、demo.js×2 处、mock/handlers/index.js）、1 个保留锚点（athlete/index.vue 第 33 行 `data-rpa="athlete-add"`）。

SQL：`patches/patch-1.0-261031125227.sql`（`apms_assistant_log`，已在 dev 执行）。
测试：`.trae/demo-tests/assistant.mjs`（7 项全绿，import 路径随迁移更新）。

引用面已 grep 核实：除上表文件外全仓无其他引用，迁移闭合。

---

## 3. 目标架构

### 3.1 ruoyi-ai 模块与插件总体布局

模块坐标 `com.ruoyi:ruoyi-ai:3.9.2`，包根 `com.ruoyi.ai`。内部两层：**容器核心（core）** 与 **插件（plugin.<key>）**。

```
ruoyi-ai/src/main/java/com/ruoyi/ai/
├── core/                              # 插件容器：与具体插件无关，所有插件共用
│   ├── AiPlugin.java                  # 插件 SPI（自描述契约）
│   ├── AiPluginDescriptor.java        # key/名称/flag/默认开关等元数据值对象
│   ├── AiPluginRegistry.java          # 收集所有 AiPlugin Bean + 聚合启用状态
│   ├── AiFeatureService.java          # sys.ai.<key>.enabled 读取（缓存复用 sys_config）
│   ├── RequireAiPlugin.java           # @RequireAiPlugin("rpa") 门控注解
│   ├── AiPluginInterceptor.java       # 按注解校验插件启用状态，关闭 → 404
│   ├── AiWebMvcConfigurer.java        # 注册拦截器到 /apms/ai/**
│   ├── AiFeatureController.java       # GET /apms/ai/features（插件清单+状态）
│   ├── AiExceptionHandler.java        # 由 AssistantExceptionHandler 泛化改名
│   └── AiRequestException.java        # 由 AssistantRequestException 泛化改名
└── plugin/
    └── rpa/                           # ① RPA 助手插件（本期唯一实体插件）
        ├── RpaPlugin.java             # AiPlugin 实现：key="rpa"，名称、flag 声明
        ├── web/RpaAssistantController.java     # /apms/ai/rpa/chat、/capabilities
        ├── stream/AssistantStreamService.java
        ├── ratelimit/AssistantRateLimiter.java
        ├── domain/ApmsAssistantLog.java
        ├── domain/assistant/（5 个 DTO 保持子包）
        ├── mapper/ApmsAssistantLogMapper.java
        └── service/（IAssistantService、AssistantProvider、PseudoAssistantProvider、
                     AssistantCapabilityResolver、impl/AssistantServiceImpl）

ruoyi-ai/src/main/resources/
└── mapper/rpa/ApmsAssistantLogMapper.xml

# 未来插件（本期不建空包，仅在文档中固化位置与接入流程，§3.4）
# plugin/rag/  → RAG 知识库检索增强
# plugin/data/ → 数据洞察、异常检测
# plugin/coach/ → 训练建议、智能选材
```

关键分层约束：

- **core 不依赖任何 plugin 包**（只面向 `AiPlugin` 接口）；
- **plugin 之间不互相依赖**；插件需要复用的能力（SSE 基类、分页、审计模板等）下沉到 core；
- 插件包名/资源路径/Mapper XML 目录/URL 前缀/flag 段/sys_config 键/前端目录/补丁目录全部以 **plugin key** 统一命名，形成固定映射（§3.4）。

### 3.2 后端插件 SPI 与门控机制

**SPI 契约**

```java
public interface AiPlugin {
    /** 插件唯一键，贯穿 URL/flag/包名/目录：rpa / rag / data / coach */
    String key();
    /** 展示名称（参数设置、features 接口用） */
    String name();
    /** 是否默认启用；缺省 true（与「ai 版默认开启」一致，漏配种子也不丢能力） */
    default boolean defaultEnabled() { return true; }
    /** 能力简介，可选，用于 features 接口与未来插件管理页 */
    default String description() { return ""; }
    /** flag 键默认规则：sys.ai.<key>.enabled */
    default String flagKey() { return "sys.ai." + key() + ".enabled"; }
}
```

- 每个插件提供一个 `@Component` 描述符（如 `RpaPlugin`）；
- `AiPluginRegistry` 构造时注入 `List<AiPlugin>`（Spring 自动收集全部插件 Bean），启动后形成不可变注册表；
- `AiFeatureService.isEnabled(key)`：读 `selectConfigByKey(flagKey)`，仅当值为 `"false"`（忽略大小写）时关闭；无配置行时取插件 `defaultEnabled()`。

**统一门控（控制器无需手写开关判断）**

```java
@RestController
@RequestMapping("/apms/ai/rpa")
@RequireAiPlugin(RpaPlugin.KEY)          // 类级注解，方法级可覆盖
public class RpaAssistantController extends BaseController { ... }
```

- `AiPluginInterceptor` 对 `/apms/ai/**`（排除 `/apms/ai/features`）生效：从 `HandlerMethod` 解析 `@RequireAiPlugin` → 查注册表 → 未安装/已关闭一律抛 `AiRequestException(404, "功能未开通")`，由 `AiExceptionHandler` 输出真实 4xx JSON；
- 对 SSE POST 同样适用（拦截器在控制器调用前完成）；
- 门控三层纵深：
  1. **构建层**：standard jar 无 ruoyi-ai → 全部 404；
  2. **容器层**：拦截器按插件 flag 统一 404（不返回 403，不暴露功能存在性）；
  3. **界面层**：前端按 features 表挂载/隐藏入口。

**插件状态查询端点（位于 core）**

`GET /apms/ai/features`（登录态）：

```json
{
  "code": 200,
  "data": {
    "edition": "ai",
    "plugins": {
      "rpa": { "enabled": true, "name": "RPA 助手", "description": "..." }
    }
  }
}
```

- ai 版：返回当前已注册插件的实时状态（热开关改完立即反映，无需重启）；
- standard 版：该 URI 天然 404，前端静默回退「无插件」。

**URL 规范化（趁本次迁移一次到位，UAT/生产尚未发布，无兼容负担）**

| 旧（dev 现状） | 新 |
|---|---|
| `POST /apms/assistant/chat` | `POST /apms/ai/rpa/chat` |
| `GET /apms/assistant/capabilities` | `GET /apms/ai/rpa/capabilities` |
| — | `GET /apms/ai/features`（新增，容器级） |

SSE 事件协议（meta/delta/action/done）、16KB 限制、20 次/60s 限流、15s 心跳、CAS 终态、审计落一条、`X-Accel-Buffering: no` 等行为全部不变；前端 `assistantClient.js` 随包迁移时改两处 URL。

### 3.3 新增插件的标准接入流程（给 rag / data / coach 的模板）

以后新增 AI 插件按此清单执行，**容器核心与其他插件零改动**：

1. 后端建包 `com.ruoyi.ai.plugin.<key>`，按 web/service/domain/mapper 分层；Mapper XML 放 `resources/mapper/<key>/`；
2. 新增一个 `@Component` 实现 `AiPlugin`（声明 key/名称/默认开关）；
3. Controller 挂在 `/apms/ai/<key>/**` 并标注 `@RequireAiPlugin("<key>")`；
4. 插件专属表/菜单/参数种子放 `patches/ai/<key>-*.sql`（§3.7），包含 `sys.ai.<key>.enabled` 种子；
5. 前端建 `src/ai/plugins/<key>/`，写 `index.js` 插件描述符（§3.5）—— **自动发现，无需手写注册行**；
6. 补该插件的 Node 桩测 / 接口验证；
7. 在本文档 §3.1 注释或后续独立插件文档中登记。

插件 key 一旦发布不可更改（它同时是 URL、flag、目录、存储命名空间的一部分）。

### 3.4 Edition：Maven Profile 双产物

根 pom.xml：

1. `<properties>` 增加 `<apms.edition>standard</apms.edition>`；
2. `<dependencyManagement>` 声明 ruoyi-ai；
3. `<modules>` 增加 `ruoyi-ai`（**始终参与编译**，保证插件代码在任何 profile 下不腐烂；是否进入产物由 admin 的 profile 决定）；
4. profile：

```xml
<profiles>
  <profile>
    <id>standard</id>
    <activation><activeByDefault>true</activeByDefault></activation>
    <properties><apms.edition>standard</apms.edition></properties>
  </profile>
  <profile>
    <id>ai</id>
    <properties><apms.edition>ai</apms.edition></properties>
  </profile>
</profiles>
```

ruoyi-admin/pom.xml 增加同名 `ai` profile，仅在其中声明 ruoyi-ai 依赖（`mvn -P ai` 时父子同名 profile 同时激活）。standard 构建的 `BOOT-INF/lib/ruoyi-ai-*.jar` 不存在。

Edition 上报：`version.properties` 增加 `app.edition=${apms.edition}`；`VersionController` 返回 `edition` 字段。两条线**共用 apms.version 版本号**、以 edition 区分；产物名保持 `apms.jar`（systemd/nginx 零改动）；换线 = 换 jar 重发，`/apms/version` 可核验。

ruoyi-ai/pom.xml：parent 根 pom，仅依赖 `ruoyi-framework`，不引入新第三方依赖。

### 3.5 前端：插件容器 + 零 AI 代码隔离

#### 3.5.1 目录结构

```
ruoyi-ui/src/
├── ai/                                 # 仅 ai 构建进入产物
│   ├── index.js                        # AI 容器入口：发现插件、拉 features、挂载、会话清理
│   ├── core/
│   │   ├── registry.js                 # import.meta.glob 自动发现 ./plugins/*/index.js
│   │   └── features.js                 # 插件启用状态缓存与查询（getPluginState(key)）
│   └── plugins/
│       └── rpa/                        # RPA 插件自包含目录
│           ├── index.js                # 前端插件描述符（唯一对容器契约面）
│           ├── AssistantLauncher.vue
│           ├── AssistantPanel.vue
│           ├── AssistantMessage.vue
│           ├── assistantStore.js
│           ├── assistantClient.js     # URL 改为 /apms/ai/rpa/*
│           ├── assistantSse.js
│           ├── assistantActions.js
│           ├── assistantDemo.js
│           ├── assistantSession.js
│           └── mock/assistantHandlers.js
└── ai-stub/
    └── index.js                        # 同契约空桩（standard 构建唯一进入产物的 AI 相关文件）
```

未来 rag/data/coach 各在 `src/ai/plugins/<key>/` 加一个目录即被自动发现。

#### 3.5.2 前端插件描述符契约

```js
// src/ai/plugins/rpa/index.js
export default {
  key: 'rpa',                                  // 与后端 /apms/ai/<key>、features.plugins.<key> 对齐
  name: 'RPA 助手',
  Launcher: AssistantLauncher,                 // 挂到 layout 的悬浮入口组件（无入口可置 null）
  mockHandlers: () => assistantHandlers,       // demo 模式注册；非 demo 不调用
  clearSession() { clearAssistantSession() },  // 登出 / 进出演示模式时回调
  async mount(app, router) { /* 快捷键 Alt+A 等一次性初始化，可选 */ }
}
```

容器 `src/ai/index.js` 行为：

- `initAi(app, router)`：拉 `/apms/ai/features` → 得到启用插件集合 → 只对已启用插件调用 `mount()` 并收集 `Launcher`；
- `AiLauncher` 导出为**渲染函数/组件数组**：layout 一处 `<AiLaunchers />` 遍历渲染所有已启用插件的入口；某插件关闭即不渲染、快捷键不注册；
- `aiMockHandlers()`：demo 模式下聚合**所有已启用插件**的 mock handlers；standard 空桩恒为 `[]`；
- `clearAiSession()`：遍历调用各插件清理回调；
- 自动发现：`import.meta.glob('./plugins/*/index.js', { eager: true })`，**新增插件目录即注册，容器主干不改**。

空桩 `src/ai-stub/index.js` 逐键同形导出 no-op（`initAi` 立即 resolve、无 Launcher、handlers 为 `[]`、edition 恒 `standard`）；契约漂移由 Node 同形测试拦截。

#### 3.5.3 构建期物理隔离

`vite.config.js`：

```js
const edition = env.VITE_EDITION || 'standard'
// resolve.alias 增加独立别名键（不撞既有 '@' / '~'）：
{ find: '@ai', replacement: path.resolve(__dirname, edition === 'ai' ? 'src/ai' : 'src/ai-stub') }
```

- 主干代码只允许 `from '@ai'`，**禁止直接 import `@/ai/...`**（code review 硬约束）；
- standard 构建中 `src/ai/` 无引用链 → 不进 dist；验证：`grep -rn "assistant\|rk-assistant" dist/` 零命中。

#### 3.5.4 主干集成点（两版同一份代码）

| 文件 | 改造 |
|---|---|
| `src/main.js` 或 permission 初始化链路 | 登录态就绪后 `await initAi(app, router)`；404/失败静默（仿 loginConfig 容错） |
| `src/layout/index.vue` | 静态 import 与硬编码标签 → `<AiLaunchers />`（来自 `@ai`；stub 渲染空） |
| `src/store/modules/user.js` | logout 两处 → `clearAiSession()` |
| `src/utils/demo.js` | enter/exitDemo 两处 → `clearAiSession()` |
| `src/mock/handlers/index.js` | `...aiMockHandlers()` 替换直接 import（消除 mock 跨层引用 components 的旧瑕疵） |
| `src/views/apms/athlete/index.vue` | **不动**：`data-rpa="athlete-add"` 作为标准侧唯一惰性接缝保留 |
| `src/utils/features.js`（新增，两版共用） | 通用功能表 store：`{ edition, plugins, loaded }`，供页面级场景查询 |

#### 3.5.5 构建模式与 package.json

新增：`.env.standard`、`.env.ai`（生产，差异为 `VITE_EDITION` 与既有生产变量）、`.env.development-ai`（本地 ai 联调，`/dev-api`）；`.env.development` 不动（缺省 standard）。

```json
"dev": "vite",
"dev:ai": "vite --mode development-ai",
"build:standard": "vite build --mode standard",
"build:ai": "vite build --mode ai",
"build:prod": "vite build --mode standard"
```

### 3.6 插件 Feature Flag 注册表

| sys_config 键 | 插件 | ai 版默认 | standard 版 |
|---|---|---|---|
| `sys.ai.rpa.enabled` | RPA 助手 | `true` | 键不存在、端点不存在 |
| `sys.ai.rag.enabled` 等 | 未来插件 | 随其补丁声明 | — |

- 参数设置中按「AI 能力」分组可查可改，保存即热生效（SSE 端点也在下一次请求立即受控，无需重启）；
- 缺省即启用（仅 `"false"` 关闭），避免漏配种子导致能力消失。

### 3.7 SQL 与部署链路适配

**AI 专属补丁目录（以插件 key 命名文件）**

```
patches/
├── *.sql                       # 两线共用，现状不变
└── ai/
    └── rpa-1.0-261031125227.sql # 由 patch-1.0-261031125227.sql 移入并改名：
                                 # ① apms_assistant_log 建表（表名保留，免 dev 重建）
                                 # ② sys.ai.rpa.enabled=true 幂等种子
```

- dev 库已按旧文件名执行过建表补丁并记入 `apms_db_version`：改名后 runner 视为新补丁会**重跑一次**——建表语句 `CREATE TABLE IF NOT EXISTS` 幂等无副作用，仅多一条版本记录；种子随之写入。为整洁也可由我在 dev 手工补一条旧名→新名的版本记录后跳过执行，两种方式都安全，实施时给出具体 SQL 由您本人选择执行；
- UAT/生产未执行过该补丁，ai 部署时按新路径一次执行（建表 + 种子）；
- standard 部署永不扫描 `patches/ai/`；dev 已存在的 AI 表保留无害（不 DROP）；
- 未来插件 DDL/DML/菜单统一 `patches/ai/<key>-*.sql`；AI 页面菜单只进 AI 库，standard 的 `getRouters` 天然不可见。

**脚本改动（遵循 deploy-shell-scripts 技能；部署仍由您本人执行）**

- `deploy/build.sh`：新增 `--edition standard|ai`（缺省 standard）；`mvn -P ${EDITION}`；前端 `vite build --mode ${EDITION}`；ai 版额外 rsync `patches/ai/` 并纳入文件数校验；构建后自检 jar 内 ruoyi-ai 有无、dist 中 assistant 命中数；
- `deploy/deploy.sh`：新增 `--edition`（缺省 standard 向后兼容）；ai 模式补丁循环额外纳入 `${PATCHES_LOCAL}/ai/*.sql`（basename 去重共用 `apms_db_version`）；健康检查后回读 `/apms/version` 的 edition 与参数比对，不一致即判失败走既有自动回滚；
- `deploy/deploy-uat.sh` 透传 edition；`deploy/env.conf.example` 增加 `EDITION` 说明；
- nginx 零改动（SSE 已用 `X-Accel-Buffering: no`）。

---

## 4. 文件与模块变更清单

### 4.1 新增

| 路径 | 内容 |
|---|---|
| `ruoyi-ai/pom.xml` | 模块 POM（依赖 ruoyi-framework） |
| `ruoyi-ai/.../ai/core/**` | SPI、注册表、feature 服务、注解、拦截器、MVC 配置、features 端点、异常体系（约 9 个类） |
| `ruoyi-ai/.../ai/plugin/rpa/**` | 迁入的 14 个文件（控制器改名 RpaAssistantController、URL 改 /apms/ai/rpa、异常改名） |
| `ruoyi-ai/src/main/resources/mapper/rpa/ApmsAssistantLogMapper.xml` | 迁入，namespace/全限定名同步 |
| `ruoyi-ui/src/ai/index.js`、`src/ai/core/*` | 前端插件容器 |
| `ruoyi-ui/src/ai/plugins/rpa/**` | 迁入的助手实现 + 插件描述符 + mock |
| `ruoyi-ui/src/ai-stub/index.js` | 空桩契约 |
| `ruoyi-ui/src/utils/features.js` | 两版共用功能表 store |
| `.env.standard` / `.env.ai` / `.env.development-ai` | 构建模式 |

### 4.2 修改

根 pom.xml、ruoyi-admin/pom.xml、version.properties、VersionController.java；vite.config.js、package.json、main.js/permission.js、layout/index.vue、user.js、demo.js、mock/handlers/index.js；build.sh、deploy.sh、deploy-uat.sh、env.conf.example；`.trae/demo-tests/assistant.mjs`（路径 + 空桩同形断言）。

### 4.3 git mv（迁移后原位删除）

后端 14 个文件（§2.5）、前端 Assistant 目录等 11 处（§2.5）、SQL 补丁移入 `patches/ai/` 并改名加插件键前缀。

---

## 5. 实施步骤（依赖有序）

1. **后端骨架**：ruoyi-ai POM + core 包空骨架（SPI/注册表/拦截器/异常/features 端点）；根 pom 与 admin profile；两种 profile `mvn install` 基线通过。
2. **RPA 插件迁移**：14 个文件 git mv 到 `plugin/rpa` 包结构；包名/import/异常改名/XML 同步；控制器改注 `@RequireAiPlugin("rpa")`、URL 改 `/apms/ai/rpa/**`；新增 `RpaPlugin` 描述符。
3. **Edition 上报**：version.properties + VersionController。
4. **后端双版验证**：standard/ai 分别 `mvn install` + 启动 + curl 矩阵（§6）。
5. **SQL**：补丁移入 `patches/ai/` 改名 + rpa flag 种子；输出 dev 手工执行清单（**您本人执行**）。
6. **前端容器化迁移**：`src/ai`（core + plugins/rpa）、`src/ai-stub`、glob 自动发现；features store；5 个主干集成点改造；3 个 env 文件 + scripts。
7. **前端双版验证**：两种 mode build 的 dist 核查；dev 两模式 + demo 联调；flag 热开关联调。
8. **桩测**：更新 assistant.mjs；新增空桩同形契约断言；全绿。
9. **部署脚本**：按 §3.7 改造（加载 deploy-shell-scripts 技能，bash 3.2 / `set -u` 安全）；`bash -n` 与 `--help` 验证；**不执行部署**。
10. **收口**：rpa_assistant_plan.md 增加「已迁入 ruoyi-ai / rpa 插件」指引；输出两线发版命令与 git 提交清单，向您汇报。

---

## 6. 验证方案

### 6.1 后端矩阵

| 项 | standard（`-P standard`） | ai（`-P ai`） |
|---|---|---|
| jar 构成 | 无 `BOOT-INF/lib/ruoyi-ai-*.jar`、无 `com/ruoyi/ai/` | ruoyi-ai jar 存在 |
| `/apms/version` | edition=standard | edition=ai |
| `/apms/ai/features`（带 token） | **404** | 200，`plugins.rpa.enabled=true` |
| `/apms/ai/rpa/capabilities` | **404** | 200，能力表正确 |
| `/apms/ai/rpa/chat` | **404** | SSE 四事件完整，含 `X-Accel-Buffering: no` |
| 旧 URL `/apms/assistant/**` | 404 | 404（已规范迁移；dev 联调同步改前端） |
| 关闭 `sys.ai.rpa.enabled` | — | features 实时变 false；rpa 两端点均 404；球消失；再打开即时恢复 |
| 既有回归 | 登录/getRouters/花名册等全部正常 | 同左；限流 20/60s、审计、UUID 校验、413、心跳行为不变 |
| 编译 | 两 profile `mvn clean install -DskipTests` 均 SUCCESS | 同左 |

### 6.2 前端与端到端

- standard 产物 `grep -rn "assistant\|rk-assistant" dist/` 零命中；页面无球、Alt+A 无反应、demo 无助手；
- ai 产物含 rpa chunk；dev:ai 真后端与 demo mock 全功能；登出/进出 demo 会话清理正常；
- 热开关：参数设置改 `sys.ai.rpa.enabled` 后刷新（或下一次 features 拉取）入口显隐正确，无需重启。

### 6.3 构建链与测试

- `node .trae/demo-tests/assistant.mjs`：原 7 项 + 空桩同形断言全绿；
- `build.sh --only-build` 两版自检日志正确；`bash -n` 所有改过的脚本通过。

---

## 7. 风险与处理

| 风险 | 处理 |
|---|---|
| standard 残留对 `com.ruoyi.ai.*` 的引用导致编译失败 | 两 profile 全量 clean install 强制验证；admin 内不保留任何 AI 直接引用 |
| 拦截器与 SSE/安全链路顺序问题 | 拦截器只做启用态短路、无 body 读取；在 Security 过滤器之后、控制器之前执行，SSE POST 实测验证；排除 `/apms/ai/features` 自身 |
| 插件 Bean 被 sys_config 运行时变化「动态启停」与 Spring 静态装配混淆 | Bean 始终装配（ai 版），仅请求态门控 + 前端挂载态门控；不做 Bean 热拔插，避免生命周期复杂度 |
| 前端插件自动发现把非插件目录误打包 | glob 固定 `./plugins/*/index.js`；新增插件必须提供描述符默认导出，同形测试兜底 |
| `@ai` 别名与 `@`/`~` 冲突 | 独立带连字符别名键；两种 build 实测 |
| URL 由 /apms/assistant 改为 /apms/ai/rpa 影响 dev 已有调用 | 仅 dev 阶段、前后端同批修改同批验证；UAT/生产未发布无负担；旧 URL 两版均 404，不保留双写 |
| 改后端后运行旧 jar（~/.m2 老问题） | 沿用纪律：先 `mvn install` 再重启；切 profile 后必须重新 install + 重启 |
| dev 补丁改名产生重跑/记录差异 | IF NOT EXISTS 幂等；提供两种处理 SQL 由您本人选择执行 |
| 未来插件引入重依赖污染 ai 版 | 已预留演进路径：独立 `ruoyi-ai-plugin-*` 子模块 + SPI 不变；本期不提前建设 |
| 部署传错 edition | deploy.sh 回读 `/apms/version` 比对，不一致判失败自动回滚 |
| 插件间出现互相调用需求 | 禁止直接依赖；共性能力下沉 core；必要时通过 core 事件/接口解耦，评审把关 |

---

## 8. 对既有工作的影响与兼容

- **RPA 助手用户侧行为零变化**：对话协议、限流、审计、心跳、响应头均不变；仅代码位置（ruoyi-ai/plugin/rpa）、URL 前缀（/apms/ai/rpa）、门控方式（注解拦截器）变化；
- **演示模式**：ai 版 demo 保留助手 mock；standard 版 demo 无助手，与产品线定位一致；
- 端口、nginx、systemd 无变化；版本号沿用 `apms.version` 时间戳规则，实施时按规则 bump；
- 发版命令（实施完成后交付，您本人执行）：
  - standard：`bash deploy/build.sh`；
  - ai：`bash deploy/build.sh --edition ai`；
  - UAT：`bash deploy/deploy-uat.sh --edition <线>`。
