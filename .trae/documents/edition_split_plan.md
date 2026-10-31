# APMS 双产品线（apms-standard / apms-ai）与 ruoyi-ai 插件化模块实施计划

> 状态：待评审（2026-10-31，第三版：Edition 定为部署级 · 后端单 jar 条件装配 · 两线同库结构）
> 范围：后端单产物 + 部署级 Edition 条件装配、AI 插件框架（SPI）、Feature Flags、前端双构建零 AI 代码、统一数据库结构、构建/部署脚本适配
> 关联文档：[rpa_assistant_plan.md](rpa_assistant_plan.md)（首个 AI 插件：RPA 助手 M1）

---

## 1. 目标与已确认决策

### 1.1 目标

1. 保持两条产品线：**apms-standard**（无 AI 能力）与 **apms-ai**（承载 AI 插件容器）。
2. AI 代码全部收拢到新模块 **ruoyi-ai**，内部采用**插件模式**：RPA 助手为首个插件，后续 RAG / Data / Coach 以同构插件加入（新增插件 = 新增插件包 + 一个描述符，容器主干零改动）。
3. **Edition 是部署级概念（v3 核心）**：
   - **后端只构建一个 jar**；是否启用 AI 由部署服务器的 `EDITION` 配置在**启动时**决定 —— standard 部署不注册任何 AI 业务 Bean，AI 端点全部 404；
   - 换线不改产物：同一 jar 改 `EDITION` 重启即可在 standard / ai 之间切换；
   - **前端保持双构建**：按 `VITE_EDITION` 产出两份 dist，standard 的浏览器产物中零 AI 代码；
   - 部署时强制「前端 dist 线别 = 后端运行线别」一致（脚本校验，不一致即部署失败）。
4. **两条产品线数据库结构完全一致**：所有插件的表结构在 standard 与 ai 库中都存在（DDL 统一执行）；仅 AI 专属*数据*（开关参数、AI 菜单授权）按线裁剪。换线/备份/恢复/升级面对同一套 schema。
5. 运行时管控采用 **Edition 封顶 + 插件级 Feature Flag（sys_config 热开关）**：flag 只在 ai 部署有意义；ai 版中各插件默认开启、可热关闭。

### 1.2 已确认决策（2026-10-31，三轮收敛）

| # | 决策点 | 选定方案 |
|---|---|---|
| 1 | 后端形态 | **单一 jar**：ruoyi-ai 始终在产物中；启动时按部署级 `EDITION` 条件装配，standard 不加载 AI Bean |
| 2 | Edition 来源 | **部署级配置**：`env.conf` 的 `EDITION=standard\|ai`（缺省 standard，fail-safe），经 deploy.sh 传入 Spring 属性 `app.edition` |
| 3 | 前端形态 | **双构建**：`VITE_EDITION` + Vite 别名桩替换，standard dist 零 AI 代码 |
| 4 | 数据库 | **两线表结构完全一致**：插件 DDL 随公共补丁在两线执行；仅 AI 专属 DML 按线分发 |
| 5 | Feature Flag | Edition 封顶 + `sys.ai.<plugin>.enabled` 热开关（沿用 sys_config 缓存即清机制），ai 版默认开启 |
| 6 | ruoyi-ai 组织 | 容器核心 core + 插件 plugin.<key>（首发 rpa，预留 rag/data/coach） |

### 1.3 明确不做（边界）

- 不接入真实大模型 / Agent：RPA M1 保持 pseudo provider；
- 本期不为每个插件建 Maven 子模块：插件先以模块内包 + SPI 存在；未来某插件引入重型依赖（如 RAG 向量库客户端）时再演进为 `ruoyi-ai-plugin-*` 子模块，SPI 契约不变；
- 不做 license / 授权码：产品线由部署配置与前端产物共同决定；
- 不删除任何 AI 代码，只做迁移、分层与门控；
- standard 数据库中**保留** AI 插件的空表（结构一致要求），不做 DROP；
- standard 侧仅允许一个 AI 接缝：页面惰性 `data-rpa` 锚点（无行为、无依赖，§5.4）。

---

## 2. 仓库调研结论（现状事实）

### 2.1 模块依赖链

```
ruoyi-admin ──► ruoyi-framework ──► ruoyi-system ──► ruoyi-common
ruoyi-admin ──► ruoyi-quartz / ruoyi-generator
```

改造后：`ruoyi-admin ──► ruoyi-ai ──► ruoyi-framework`（**编译期常依赖，不再使用 Maven profile**）。
约束：framework/system/common 不得依赖 ruoyi-ai；插件之间不得互相依赖，共性能力下沉 core。

### 2.2 扫描约定与条件装配的可行性（已核实）

| 约定 | 事实 | 对方案的影响 |
|---|---|---|
| 启动类 `@SpringBootApplication` 在 `com.ruoyi` | 组件扫描覆盖 `com.ruoyi.ai.**` | AI 组件能被扫到；在每个 AI 构造型类上加 `@Conditional` 即可在扫描期被过滤（Spring 的 ClassPath 扫描会执行 ConditionEvaluator） |
| `@MapperScan("com.ruoyi.**.mapper")` 在 framework ApplicationConfig | 全局强制扫描 `**/mapper` 包 | AI Mapper 接口若放 `.mapper` 包会在 standard 也被注册；方案：AI Mapper 放 **`.persistence` 包**（不匹配全局通配），由 ruoyi-ai 内**带条件的** `@MapperScan("com.ruoyi.ai.**.persistence")` 仅在 ai 线注册 |
| `typeAliasesPackage: com.ruoyi.**.domain` | 通配 | `com.ruoyi.ai.plugin.*.domain` 自动别名（POJO，两线注册均零副作用） |
| `mapperLocations: classpath*:mapper/**/*Mapper.xml` | 通配 | 插件 XML 放 `resources/mapper/<key>/` 自动加载；standard 启动时 XML 也会被解析 —— 因两线同库、表都存在，启动无风险 |
| 管理端口 8081/9081/10081 仅暴露 `/health`，`show-details: always` | 免鉴权可读 | 用条件注册的 **HealthIndicator** 上报运行线别，供 deploy.sh 免 token 校验（§3.4） |
| 部署启动 | deploy.sh 以一串 `--xxx` Spring 参数启动 jar | 追加 `--app.edition=${EDITION}` 即可，无需改 systemd unit |

### 2.3 现成先例

- 热开关：`sys_config` 的 `sys.account.smsLoginEnabled`，经 `ISysConfigService.selectConfigByKey()` 读取、带缓存、参数设置保存即热生效；
- 运行时静默回退：前端 `GET /login/config` 独立 axios 实例、失败回退默认值；
- 版本：pom `<apms.version>` filtering 到 `version.properties`，`/apms/version` 返回；
- 补丁：deploy.sh 平铺 glob `patches/*.sql` + `apms_db_version` 按 basename 去重、幂等可重跑；不扫描子目录（需小改）；
- 构建：build.sh `mvn clean package` + `npx vite build`，产物名固定 `apms.jar`。

### 2.4 现有 AI 资产（RPA 插件迁移对象）

后端 14 文件：`ApmsAssistantController`、`AssistantExceptionHandler`（admin）；`AssistantStreamService`、`AssistantRateLimiter`（framework）；`ApmsAssistantLog` + assistant 5 DTO（system domain）；`ApmsAssistantLogMapper`（system mapper）；service 层 5 文件（system）；`AssistantRequestException`（common）；XML 1 个（admin resources/mapper/apms）。

前端：`src/components/Assistant/`（8）、`src/utils/assistantSession.js`、`src/mock/handlers/assistant.js`；集成点 layout/index.vue、user.js（2 处）、demo.js（2 处）、mock/handlers/index.js；保留锚点 athlete/index.vue `data-rpa="athlete-add"`。

SQL：`patches/patch-1.0-261031125227.sql`（**apms_assistant_log 建表 DDL，已在 dev 执行**）。
测试：`.trae/demo-tests/assistant.mjs`（7 项全绿）。
引用面已全量 grep 核实，迁移闭合。

---

## 3. 目标架构

### 3.1 ruoyi-ai 布局：core 容器 + 自包含插件

模块坐标 `com.ruoyi:ruoyi-ai:3.9.2`，包根 `com.ruoyi.ai`。

```
ruoyi-ai/src/main/java/com/ruoyi/ai/
├── core/
│   ├── AiEnabled.java                # 元注解：@ConditionalOnProperty(app.edition=ai)，AI 类统一标注
│   ├── AiEditionProperties.java      # app.edition 绑定（standard/ai），缺省 standard
│   ├── AiAutoConfiguration.java      # @AiEnabled @Configuration：@MapperScan("com.ruoyi.ai.**.persistence")
│   ├── AiPlugin.java                 # 插件 SPI：key/name/defaultEnabled/flagKey/description
│   ├── AiPluginRegistry.java         # 注入 List<AiPlugin>，聚合注册表与启用状态
│   ├── AiFeatureService.java         # 读 sys.ai.<key>.enabled（仅 "false" 关闭，缺省取默认值）
│   ├── RequireAiPlugin.java          # 门控注解 @RequireAiPlugin("rpa")
│   ├── AiPluginInterceptor.java      # 未注册/已关闭 → AiRequestException(404)
│   ├── AiWebMvcConfigurer.java       # 拦截 /apms/ai/**（排除 /features）
│   ├── AiFeatureController.java      # GET /apms/ai/features
│   ├── AiHealthIndicator.java        # 上报 {edition:ai, plugins:[rpa,...]} 到管理端口 /health
│   ├── AiExceptionHandler.java       # @RestControllerAdvice，真实 4xx（由 AssistantExceptionHandler 改名）
│   └── AiRequestException.java       # 由 AssistantRequestException 改名泛化
└── plugin/
    └── rpa/                          # ① RPA 助手（本期唯一实体插件）
        ├── RpaPlugin.java            # @AiEnabled @Component，AiPlugin 实现，KEY="rpa"
        ├── web/RpaAssistantController.java     # /apms/ai/rpa/chat、/capabilities
        ├── stream/AssistantStreamService.java
        ├── ratelimit/AssistantRateLimiter.java
        ├── domain/ApmsAssistantLog.java
        ├── domain/assistant/（5 DTO）
        ├── persistence/ApmsAssistantLogMapper.java   # 注意包名 persistence，不匹配全局 mapper 通配
        └── service/（IAssistantService、AssistantProvider、PseudoAssistantProvider、
                      AssistantCapabilityResolver、impl/AssistantServiceImpl）

ruoyi-ai/src/main/resources/mapper/rpa/ApmsAssistantLogMapper.xml
# 未来：plugin/rag、plugin/data、plugin/coach；resources/mapper/<key>/
```

所有 AI 构造型类（`@Component/@Service/@RestController/@RestControllerAdvice/@Configuration`）统一标注 `@AiEnabled`。`@AiEnabled` 定义：

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ConditionalOnProperty(name = "app.edition", havingValue = "ai")
public @interface AiEnabled {}
```

- standard 启动：这些 Bean 在组件扫描期即被 Condition 过滤 → 无控制器、无服务、无通知、无拦截器、无 HealthIndicator；AI Mapper 由带条件的 `AiAutoConfiguration` 上的 `@MapperScan` 控制，同样不注册；
- ai 启动：全部注册，启动日志打印已加载插件清单（INFO）。

### 3.2 部署级 Edition 装配

- 属性来源：Spring 属性 `app.edition`，在 `ruoyi-admin/application.yml` 增加默认值：

```yaml
app:
  edition: ${APP_EDITION:standard}   # 部署级：standard（默认/fail-safe）| ai
```

- deploy.sh 启动命令追加 `--app.edition="${EDITION}"`（EDITION 读自 env.conf，缺省 standard）；本地联调：`APP_EDITION=ai java -jar apms.jar` 或加 JVM 参数；
- 父 pom `<modules>` 与 ruoyi-admin 依赖中 ruoyi-ai 为**常依赖**（无 profile）；`mvn package` 永远只有一个 jar，`BOOT-INF/lib/ruoyi-ai-3.9.2.jar` 恒在；
- `version.properties` **不注入** edition（非构建期属性）；`VersionController` 以 `@Value("${app.edition:standard}")` 实时读取，`/apms/version` 返回 `edition`；
- standard 行为证据：`GET /apms/ai/features` → 404（无 Controller）；`/apms/ai/rpa/**` → 404；管理端口 `/health` 无 `ai` 组件。

### 3.3 插件 SPI、门控与 URL 规范

SPI 契约：

```java
public interface AiPlugin {
    String key();                       // rpa / rag / data / coach —— 贯穿 URL/flag/包名/目录
    String name();
    default boolean defaultEnabled() { return true; }   // 缺省开启
    default String description() { return ""; }
    default String flagKey() { return "sys.ai." + key() + ".enabled"; }
}
```

- 每插件一个 `@AiEnabled @Component` 描述符；`AiPluginRegistry` 注入 `List<AiPlugin>` 自动汇总；
- `AiFeatureService.isEnabled(key)`：仅 sys_config 值为 `"false"` 时关闭，无配置行取 `defaultEnabled()`（漏配种子不丢能力）；
- 统一门控：Controller 类标注 `@RequireAiPlugin("rpa")`，拦截器对 `/apms/ai/**`（排除 `/features`）在调用前校验，关闭/缺失统一 **404**（不暴露功能存在性）；SSE POST 同样适用；
- 门控三层：① 部署层（standard 无 Bean → 404）；② 插件层（flag 关闭 → 拦截器 404）；③ 界面层（features 表不挂载入口）；
- 插件状态端点 `GET /apms/ai/features`（登录态，ai 线）：

```json
{ "code": 200, "data": { "edition": "ai",
  "plugins": { "rpa": { "enabled": true, "name": "RPA 助手", "description": "..." } } } }
```

URL 规范化（UAT/生产未发布，无兼容负担；dev 同批改）：

| 旧 | 新 |
|---|---|
| `POST /apms/assistant/chat` | `POST /apms/ai/rpa/chat` |
| `GET /apms/assistant/capabilities` | `GET /apms/ai/rpa/capabilities` |
| — | `GET /apms/ai/features` |

SSE 事件协议、16KB 限制、20 次/60s 限流、15s 心跳、CAS 终态、审计一条、`X-Accel-Buffering: no` 全部不变。

**新增插件接入模板（rag/data/coach）**：① 建 `com.ruoyi.ai.plugin.<key>` 包（web/service/domain/persistence）与 `resources/mapper/<key>/`；② 写一个 `@AiEnabled` 的 `AiPlugin` 描述符；③ Controller 挂 `/apms/ai/<key>/**` + `@RequireAiPlugin`；④ 表 DDL 进公共 `patches/`（两线都执行），flag 种子与菜单授权进 `patches/ai/`（仅 ai 线）；⑤ 前端建 `src/ai/plugins/<key>/`（glob 自动发现）；⑥ 补桩测/接口验证。plugin key 发布后不可改。

### 3.4 健康检查与部署线别校验

- `AiHealthIndicator`（`@AiEnabled`）向管理端口 `/health` 贡献：

```json
"components": { ..., "ai": { "status": "UP", "details": { "edition": "ai", "plugins": ["rpa"] } } }
```

- standard 部署无此指示器 → `/health` 中无 `ai` 块；
- deploy.sh 启动后以管理端口免 token 校验：`EDITION=ai` 必须存在 `components.ai.details.edition=="ai"` 且插件列表非空；`EDITION=standard` 必须**不存在** `ai` 块；不一致即判定部署失败、走既有自动回滚。同时校验前端 dist 与 EDITION 配对（build.sh 以 `--edition` 同时决定 vite mode 与上传清单，产物天然成对）。

### 3.5 统一数据库结构（两线一致）

**铁律：凡 DDL 一律两线统一；AI 专属 DML 才允许按线分发。**

| 补丁位置 | 内容 | standard | ai |
|---|---|---|---|
| `patches/*.sql`（现有机制不变） | **全部建表/改表 DDL** + 两线共用数据 | 执行 | 执行 |
| `patches/ai/*.sql`（新增目录，仅 DML） | `sys.ai.<plugin>.enabled` 种子、AI 菜单/角色授权 | 不执行 | 执行 |

- 现有 `patches/patch-1.0-261031125227.sql` **保持原位不移动**（建表 DDL 两线统一，dev 已执行无需重跑）；
- 新增一枚 AI 专属 DML 补丁 `patches/ai/rpa-seed-<时间戳>.sql`：幂等插入 `sys.ai.rpa.enabled=true`（含 config_name 等列，参数设置可见）；dev 由我给 SQL 清单、**您本人执行**；UAT/生产 ai 部署时自动执行；
- `patches/ai/` 中**严禁出现 DDL**（脚本评审 + 本计划约束；deploy.sh 对该目录文件做 `grep -Ei 'create|alter|drop'` 防呆，命中即拒绝部署）；
- 收益：standard 与 ai 备份/恢复同构；standard → ai 升级 = 换 ai 构建的 dist + 改 EDITION 重启 + 补 ai DML，**零结构迁移**；
- dev 已有的 AI 表与两线一致原则天然吻合；不回收、不 DROP；
- 未来 AI 页面菜单（RAG/Data/Coach 带来真实页面时）：菜单行进 `patches/ai/`；**需配套服务端菜单过滤**（standard 部署即使库中残留 AI 菜单行，getRouters 也必须剔除）——首个带页面的插件落地时在 `SysMenuServiceImpl`/Mapper 增加按 `app.edition` 过滤的实现（菜单以权限标识前缀 `apms:ai:<plugin>:` 或专用标记列识别），本期 RPA 无菜单、不提前建设，仅在此登记技术债。

### 3.6 前端：插件容器 + 双构建零 AI 代码

#### 3.6.1 目录

```
ruoyi-ui/src/
├── ai/                              # 仅 ai 构建进入 dist
│   ├── index.js                     # 容器入口：拉 features、发现/启用插件、挂载、会话清理
│   ├── core/
│   │   ├── registry.js              # import.meta.glob('./plugins/*/index.js', {eager:true})
│   │   └── features.js              # 插件状态缓存
│   └── plugins/rpa/                 # 助手全部实现迁入（10 个文件）+ index.js 描述符 + mock/
└── ai-stub/index.js                # 同契约空桩（standard dist 唯一 AI 相关文件，几十行 no-op）
```

插件描述符契约：

```js
export default {
  key: 'rpa',
  name: 'RPA 助手',
  Launcher: AssistantLauncher,      // layout 悬浮入口；无入口为 null
  mockHandlers: () => [...],        // demo 注册
  clearSession() {},                // 登出/进出演示
  async mount(app, router) {}       // 一次性初始化（Alt+A 等，可选）
}
```

容器行为：`initAi()` 拉 `GET /apms/ai/features`（404/失败静默 → 无插件，仿 loginConfig），仅对启用插件 mount 并收集 Launcher；`AiLaunchers` 在 layout 一处遍历渲染；`aiMockHandlers()` 聚合启用插件 mock；`clearAiSession()` 遍历清理。新增插件目录即被 glob 发现，主干零改动。

#### 3.6.2 双构建隔离

`vite.config.js`：`const edition = env.VITE_EDITION || 'standard'`；别名 `{ find: '@ai', replacement: '.../src/' + (edition==='ai' ? 'ai' : 'ai-stub') }`。主干只允许 `from '@ai'`，禁止直接引 `@/ai/...`。standard 构建中 `src/ai/` 无引用链 → 不进 dist。

env/scripts：新增 `.env.standard`、`.env.ai`（生产变量 + VITE_EDITION）、`.env.development-ai`（/dev-api 联调）；`.env.development` 不动（默认 standard）。

```json
"dev": "vite",  "dev:ai": "vite --mode development-ai",
"build:standard": "vite build --mode standard",
"build:ai": "vite build --mode ai",
"build:prod": "vite build --mode standard"
```

#### 3.6.3 主干集成点（两版同一份代码）

| 文件 | 改造 |
|---|---|
| main.js / permission 初始化 | 登录态就绪后 `await initAi()` |
| layout/index.vue | 硬编码助手 → `<AiLaunchers />`（stub 渲染空） |
| store/modules/user.js、utils/demo.js | `clearAssistantSession` → `clearAiSession()` |
| mock/handlers/index.js | `...aiMockHandlers()`（stub 返回 []），消除跨层引用 |
| views/apms/athlete/index.vue | 不动，保留惰性 `data-rpa` 锚点 |
| utils/features.js（新增，两版共用） | `{ edition, plugins, loaded }` 功能表 store |

### 3.7 构建/部署脚本适配（遵循 deploy-shell-scripts 技能；部署由您本人执行）

- `deploy/build.sh --edition standard|ai`（缺省 standard）：
  - Maven 步骤**不带 profile**（单 jar 恒构建）；
  - 前端 `npx vite build --mode ${EDITION}`；
  - 始终上传 `patches/` 与 `patches/ai/`（执行与否由远端 EDITION 决定）；
  - 构建自检：jar 中 ruoyi-ai 恒存在；dist 中 `assistant` 关键字命中数（standard 必须为 0）；
- `deploy/deploy.sh --edition standard|ai`（缺省 standard，向后兼容；EDITION 也可由 env.conf 提供，命令行优先）：
  - 启动参数追加 `--app.edition`；
  - 补丁：始终执行 `patches/*.sql`；仅 ai 线追加执行 `patches/ai/*.sql`（basename 去重共用 apms_db_version）；ai 目录 DDL 防呆扫描；
  - 启动后按 §3.4 校验管理端口健康块，不一致自动回滚；
- `deploy/deploy-uat.sh` 透传；`env.conf.example` 增加 `EDITION` 说明（standard 缺省）；
- nginx 零改动（SSE 已有 `X-Accel-Buffering: no`）。

---

## 4. 文件变更清单

**新增**：`ruoyi-ai/pom.xml` + core 约 12 个类；plugin/rpa 迁入的 14 文件（控制器改名、包名/XML/URL 同步）；`resources/mapper/rpa/*.xml`；前端 `src/ai/**`、`src/ai-stub/index.js`、`src/utils/features.js`；3 个 env 文件；`patches/ai/rpa-seed-*.sql`。

**修改**：根 pom.xml（module + dependencyManagement，**无 profile**）、ruoyi-admin/pom.xml（常依赖 ruoyi-ai）、application.yml（app.edition 默认值）、VersionController；vite.config.js、package.json、main.js/permission.js、layout/index.vue、user.js、demo.js、mock/handlers/index.js；build.sh、deploy.sh、deploy-uat.sh、env.conf.example；assistant.mjs（路径 + 空桩同形断言）。

**迁移**：§2.4 全部文件（git mv）；SQL 建表补丁不动，仅追加新种子补丁。

---

## 5. 实施步骤

1. **后端骨架**：ruoyi-ai 常依赖接入；core 包（AiEnabled 元注解、条件配置、SPI/注册表/拦截器/异常/features/health）；`mvn install` 后以默认（standard）启动验证 AI 全无、`APP_EDITION=ai` 启动验证 core 装配。
2. **RPA 插件迁移**：14 文件 git mv 到 `plugin/rpa`（Mapper 接口改放 `.persistence`）；改名/import/XML namespace/URL/注解；`RpaPlugin` 描述符。
3. **Edition 上报**：application.yml 默认值 + VersionController。
4. **后端双模式验证**（同一 jar 两种启动参数）：§6 矩阵。
5. **SQL**：新建 `patches/ai/rpa-seed-*.sql`；输出 dev 手工执行清单（您本人执行）。
6. **前端容器化**：src/ai + rpa 插件 + 空桩 + glob 注册 + features store；集成点改造；env/scripts。
7. **前端双构建验证**：dist grep + dev 两模式 + demo + flag 热开关。
8. **桩测**：7 项原断言 + 空桩同形契约。
9. **部署脚本**：--edition 全链路 + health 线别校验 + DDL 防呆；`bash -n`/`--help` 验证；不部署。
10. **收口**：更新 rpa_assistant_plan.md 指引；输出两线发版命令、dev 启动参数、git 提交清单。

---

## 6. 验证方案（同一 jar，两种部署模式）

| 项 | EDITION=standard | EDITION=ai |
|---|---|---|
| 启动日志 | 无插件加载行 | 输出 `[ai] plugins loaded: [rpa]` |
| 管理端口 /health | 无 `ai` 块 | `components.ai.details.edition=ai`、plugins=[rpa] |
| `/apms/version` | edition=standard | edition=ai |
| `/apms/ai/features` | 404 | 200，plugins.rpa.enabled=true |
| `/apms/ai/rpa/capabilities`、`/chat` | 404 | 能力表 200；SSE 四事件 + X-Accel-Buffering |
| AI Mapper Bean | 不注册（条件 MapperScan） | 注册；审计正常落库 |
| `sys.ai.rpa.enabled=false` | — | features 实时 false、rpa 两端点 404、悬浮球消失；复原即恢复 |
| 数据库 | 含 apms_assistant_log 等全部插件表（结构一致） | 同左 + sys_config 种子 |
| 既有业务回归 | 登录/getRouters/花名册等全正常 | 同左；限流/审计/413/UUID 校验行为不变 |
| 前端 dist | grep assistant/rk-assistant 零命中；无球、Alt+A 无效、demo 无助手 | rpa chunk 在；真后端 + mock 全功能；登出/演示会话清理正常 |
| 构建 | `mvn clean install -DskipTests` 单 jar SUCCESS；`vite build --mode standard/ai` 均成功 | — |
| 部署 | EDITION 与 dist 错配时 deploy.sh 健康校验失败并回滚 | — |

`node .trae/demo-tests/assistant.mjs`：原 7 项 + 空桩同形断言全绿。

---

## 7. 风险与处理

| 风险 | 处理 |
|---|---|
| 漏标 `@AiEnabled` 导致 AI Bean 在 standard 被注册 | 验证以 standard 启动的 /health 与全部 /apms/ai/** 404 兜底；code review 清单化；可加启动自检（core 扫描 com.ruoyi.ai 下存在未标注的构造型即告警失败） |
| AI Mapper 被全局 `@MapperScan("com.ruoyi.**.mapper")` 扫到 | Mapper 接口统一放 `.persistence` 子包 + 条件 MapperScan；XML 在 standard 被解析但表存在、无入口可达 |
| 环境未配 EDITION | 默认 standard（fail-safe），能力默认关闭而非误开 |
| 前端 dist 与后端线别错配 | build.sh 成对产出；deploy.sh health 双向校验；错配即回滚 |
| standard 库执行 AI 表 DDL 的接受度 | 已确认为目标要求：两线结构一致；空表零运行成本，收益是换线零迁移 |
| patches/ai 误放 DDL 破坏两线结构一致 | 文件名/目录约定 + deploy.sh DDL 关键字防呆拒绝执行 |
| ai → standard 回退且库中已有 AI 菜单（未来页面插件） | 本期无 AI 菜单；已登记：首个页面插件必须同步实现 getRouters 按线过滤 |
| 条件注解与组件扫描不生效（认知误区） | 已核实 ClassPath 扫描执行 ConditionEvaluator；标准启动实测为准 |
| 改后端后运行旧 jar（~/.m2 老问题） | 沿用纪律：mvn install 后重启；EDITION 仅启动参数变化，无需重构建 |
| 插件间相互调用 | 禁止；共性下沉 core，必要时 core 事件解耦 |
| 未来重依赖插件污染单 jar | 演进路径预留：ruoyi-ai-plugin-* 子模块 + SPI 不变；本期不建 |
| URL 迁移（/apms/assistant → /apms/ai/rpa） | 仅 dev 阶段，前后端同批改；旧 URL 两模式均 404，不做双写 |

---

## 8. 对既有工作的影响与运行方式

- RPA 用户侧行为零变化（协议/限流/审计/心跳/响应头不变），仅代码位置、URL 前缀、门控方式变化；
- demo：ai 版有助手 mock，standard 版无；
- 端口/nginx/systemd 不变；版本号沿用 apms.version 时间戳规则；
- 常用命令：
  - 后端本地 ai 联调：`APP_EDITION=ai java -jar ruoyi-admin/target/apms.jar`（缺省即 standard）；
  - 前端：`npm run dev`（standard）/ `npm run dev:ai`；
  - 发版（您本人执行）：`bash deploy/build.sh --edition standard`｜`bash deploy/build.sh --edition ai`；UAT：`deploy-uat.sh --edition <线>`。
