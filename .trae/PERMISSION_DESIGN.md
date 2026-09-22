# APMS 权限体系设计方案

> 版本：v1.0（决策已冻结）
> 日期：2026-09-22
> 状态：**全部决策已冻结**，可按 §10 拆任务进入实施。

---

## 1. 背景与目标

### 1.1 需求陈述

1. **不向客户暴露 admin 账号**：客户交付环境中不出现 admin，也无法通过任何页面看到或操作它。
2. **提供 super 账号**：具备管理全部业务的能力，是客户侧最高权限账号；并可管理专岗账号（建号、启停、改密、分配角色）。
3. **提供若干专岗角色账号**：这些账号登录后**完全不显示左侧导航栏**，只进入与其岗位相关的固定工作页面。

### 1.2 设计目标

- 沿用 RuoYi 原生 RBAC（用户 → 角色 → 菜单/权限点），**不另造权限体系**。
- 权限收敛在「菜单授权 + 接口权限点」两条原生链路上，改动最小化。
- 所有写操作遵循**双层门禁**：前端 UI 控制可见性/可用性，后端 Service 层强校验（前端可被绕过）。
- admin 作为平台保留账号继续存在（运维兜底），但对客户完全不可见。

### 1.3 非目标（本期不做）

- 不做多租户、不做组织间数据隔离（如后续需要，走数据权限 `@DataScope` 扩展）。
- 不改造 RuoYi 的认证方式（仍为 JWT + 用户名密码）。

---

## 2. 现状分析（RuoYi 3.9.2 权限链路）

| 环节 | 实现位置 | 规则 |
|---|---|---|
| 超管判定 | [SysUser.isAdmin()](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-common/src/main/java/com/ruoyi/common/core/domain/entity/SysUser.java) | `userId == 1` 即超管，硬编码 |
| 角色超管判定 | [SysRole.isAdmin()](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-common/src/main/java/com/ruoyi/common/core/domain/entity/SysRole.java#L87-L95) | `roleId == 1`（admin 角色） |
| 角色集合 | [SysPermissionService.getRolePermission](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/web/service/SysPermissionService.java#L37-L50) | userId=1 → 直接下发角色串 `admin`；否则取 `sys_user_role` 关联 |
| 权限点集合 | [SysPermissionService.getMenuPermission](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/web/service/SysPermissionService.java#L58-L88) | userId=1 → `*:*:*`（全权限）；否则按角色汇总菜单 perms |
| 菜单树 | [SysMenuServiceImpl.selectMenuTreeByUserId](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/impl/SysMenuServiceImpl.java#L139-L151) | userId=1 → 全量菜单；否则按角色关联菜单过滤 |
| 用户信息接口 | [SysLoginController.getInfo](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/SysLoginController.java#L72-L94) | 返回 user / roles / permissions |
| 路由接口 | [getRouters](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/SysLoginController.java#L101-L107) | 返回用户可见菜单构建的前端路由 |
| 前端路由生成 | [permission.js store](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/store/modules/permission.js) | getRouters 结果转 Vue Router 路由 |
| 前端路由守卫 | [src/permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js) | 首次进入拉 getInfo → generateRoutes → 动态注册 |
| 无侧栏能力（已有） | [layout/index.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/layout/index.vue#L4-L5) + [app store sidebar.hide](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/store/modules/app.js#L40-L42) | 框架原生支持隐藏侧栏（顶部导航模式即使用此机制），**无需新建布局** |
| 内置对象保护（已有） | checkUserAllowed / checkRoleAllowed | 已拦截对 userId=1 用户、roleId=1 角色的写操作 |

**结论**：super 与专岗账号都可以用「普通用户 + 角色菜单授权」实现；无侧栏模式框架已有现成开关。需要新增的仅是角色上的「无导航模式」语义标识与落地页配置。

---

## 3. 账号体系设计

### 3.1 三层账号模型

```
┌─────────────────────────────────────────────────────┐
│ admin（userId=1，roleId=1，role_key=admin）          │
│ · 平台保留超管，*:*:* 全权限                          │
│ · 仅交付方运维/兜底使用，不对客户提供，对客户不可见     │
└─────────────────────────────────────────────────────┘
          ▲ 受保护，任何客户账号不可见、不可操作
┌─────────────────────────────────────────────────────┐
│ super（建议用户名 super，角色 role_key=business_admin）│
│ · 客户侧最高账号，权限来自菜单授权（非 *:*:*）         │
│ · 全部业务菜单 + 账号管理（用户/角色）                │
│ · 管理所有专岗账号                                   │
└─────────────────────────────────────────────────────┘
          │ 创建 / 启停 / 重置密码 / 分配角色
┌─────────────────────────────────────────────────────┐
│ 专岗账号（教练、测试人员、队医、录入员……）             │
│ · 仅绑定一个专岗角色                                  │
│ · 无侧栏无导航，登录直达专属工作台                     │
│ · 仅能访问授权页面与授权接口                          │
└─────────────────────────────────────────────────────┘
```

### 3.2 各账号权限边界

| 能力 | admin（保留） | super（业务超管） | 专岗账号 |
|---|---|---|---|
| 全部业务功能（运动员/测试/测量/PHV/医疗/RTP/报告/看板） | ✅ | ✅ | 仅授权页面 |
| 用户管理（建号、启停、重置密码、分配角色） | ✅ | ✅（仅可见/管理 super 与专岗账号，**看不到 admin**） | ❌ |
| 角色管理 | ✅ | ✅（可管理专岗角色；**admin 角色不可见，super 角色自身不可改**） | ❌ |
| 菜单管理（菜单结构与权限点维护） | ✅ | ❌（**已冻结：不可见**） | ❌ |
| 部门 / 岗位 / 字典 / 参数 / 通知公告 | ✅ | ✅（业务依赖字典与基础组织数据） | ❌ |
| 登录页设计（品牌配置） | ✅ | ✅ | ❌ |
| 操作日志 / 登录日志 | ✅ | ✅（**已冻结：保留**，账号操作审计需要） | ❌ |
| 系统监控（在线用户/定时任务/数据监控/服务监控） | ✅ | ❌（**已冻结：不授予**） | ❌ |
| 系统工具（代码生成/表单构建/Swagger） | ✅ | ❌（**已冻结：技术工具不对客户开放**） | ❌ |
| 个人中心、修改密码、退出登录 | ✅ | ✅ | ✅ |

> super 的权限全部通过「角色 → 菜单」勾选获得，菜单树勾选项即其权限边界。
> 菜单管理不对 super 开放，意味着：日后新增业务模块、调整权限点、给 super/专岗补授权，均需由交付方通过 admin 操作（见 §8 风险项 R3）。

### 3.3 专岗划分（已冻结：3 个专岗）

现有 13 个业务菜单，按职责聚为三类（测试执行与形态测量合并为同一岗位）：

| 职责簇 | 包含菜单 | 专岗 |
|---|---|---|
| 分析决策 | 总览看板、组合体能评分、报告中心、RTP/PHV（只读） | 教练 |
| 测量执行 | 测试任务（现场执行）、测试结果（成绩录入）、体态测量、PHV 计算 | 测量员 |
| 医疗保障 | 医疗记录、RTP 风险预警（处置） | 队医 |
| 基础配置（**归 super，不设专岗**） | 指标库、测试模型库、组合模型、测试任务创建排期 | super |

最终 **3 个专岗**（均复用现有列表页，不新建工作台）：

| 专岗角色（role_key） | 登录落地页 | 职责说明 |
|---|---|---|
| 教练 `portal_coach` | `/apms/dashboard`（总览看板） | 查看全队总览、运动员档案与成绩（只读）、PHV/RTP 风险（只读）、查阅与下载报告；不做任何数据录入 |
| 测量员 `portal_tester` | `/apms/testTask`（测试任务） | 执行测试任务（成员报名/出勤）、录入测试成绩、体态测量录入与 PHV 计算；可只读查阅指标库、测试模型库作为测量标准 |
| 队医 `portal_medic` | `/apms/medical`（医疗记录） | 医疗记录登记维护、RTP 状态评估与处置（含清除）、查阅与医疗相关的报告；运动员档案只读 |

补充规则：

- 所有专岗均拥有运动员档案的 **list/query 只读**权限（执行工作的基础）。
- 删除类权限（remove）、任务创建排期（testTask:add）、模型与指标的维护、组合评分 calculate、报告 generate，**全部保留在 super**。

> 详细到权限点的授权见 §6《岗位权限矩阵》。

---

## 4. 无导航模式（Portal 模式）设计

### 4.1 模式定义

- **标准模式**（admin / super / 普通管理角色）：左侧导航 + 顶部栏 + 标签页，与现状一致。
- **Portal 模式**（专岗角色）：无侧栏、无标签页、无菜单；登录后直达角色配置的落地工作台；页面内如需跳转，由工作台自身的功能按钮完成（如任务卡片 → 录入页），不依赖导航。
- 顶部栏保留精简版：系统名、当前用户、**修改密码/个人中心**、**退出登录**（退出入口必须保留）。

### 4.2 判定来源（推荐方案：角色加 2 个字段）

在 `sys_role` 增加：

| 字段 | 类型 | 说明 |
|---|---|---|
| `nav_visible` | char(1)，默认 `0` | `0`=标准模式（显示导航）；`1`=Portal 模式（无导航） |
| `home_path` | varchar(200)，可空 | Portal 模式登录落地路由，如 `/apms/testTask`；标准模式忽略 |

涉及改动：`SysRole` 实体、角色新增/编辑表单、`SysRoleMapper`（insert/update/resultMap）、`getInfo` 返回值。

`getInfo` 增加返回：

```json
{
  "navVisible": false,
  "homePath": "/apms/testTask"
}
```

聚合规则：用户角色中任一角色 `nav_visible=1` 即为 Portal 模式（配合 §5.3「专岗账号强制单角色」，不存在歧义）。

### 4.3 备选方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 角色加字段 | `nav_visible` + `home_path` | 语义清晰、配置集中、端到端最直接；可在角色管理页可视化维护 | 加 2 列、改动实体与 mapper | **推荐** |
| B. role_key 前缀约定 | `portal_` 前缀的角色进入无导航，落地页取首个菜单 | 零 DB 改动 | 语义隐晦、role_key 承担了非业务含义、落地页依赖菜单排序 | 不推荐 |
| C. 纯菜单推导 | 角色只分配 `visible=1` 隐藏菜单，前端发现"无可见菜单"即进入 Portal | 零 DB 改动 | 无法区分"权限配错的账号"与"专岗账号"，排障困难；落地页无明确配置 | 不推荐 |

### 4.4 路由与页面加载

1. **业务菜单的 visible 维持现状，无需改成隐藏**：Portal 模式下侧栏整个不渲染，菜单可见与否对专岗账号无意义；super 的侧栏照常显示。
2. 专岗账号登录后：
   - `getRouters` 仅返回其被授予的菜单路由并动态注册；
   - 前端守卫检测到 Portal 模式 → 隐藏侧栏 → 重定向到 `home_path`。
3. 访问未授权路由：该路由未动态注册 → 守卫重定向回 `home_path`（未注册路由最终兜底 404）；直接调未授权接口 → 后端 403。**页面隐藏只是体验，接口权限点才是安全边界。**

### 4.5 与现有功能的交互

- 锁屏：Portal 模式保留锁屏能力，解锁后回到 `home_path`。
- 浏览器后退：仅在工作台内部历史中移动；退到无权限路由时重定向回 `home_path`。
- 多端/窗口：无特殊处理。

---

## 5. super 对账号的管理边界

### 5.1 可见性（UI + 接口双层）

| 对象 | super 所见 |
|---|---|
| admin 用户（userId=1） | **不出现**在用户列表、用户选择、分配角色等任何场景 |
| admin 角色（roleId=1） | **不出现**在角色列表、角色下拉 |
| super 自身账号 | 可见，可改基础信息与密码；**不可删除、不可停用** |
| super 角色 | 可见只读；**不可修改权限、不可停用、不可删除** |
| 专岗账号/角色 | 完全可见、可管理 |

后端实现要点：

- 用户/角色列表查询：当前操作者非平台保留身份（userId≠1）时，SQL 追加过滤 `user_id <> 1` / `role_id <> 1`（Mapper 层条件，Service 层传参）。
- 写操作在现有 `checkUserAllowed`（已拦 userId=1）、`checkRoleAllowed`（已拦 roleId=1）之外补充：
  - 保存用户时，提交的 roleIds 包含 roleId=1 → 拒绝；
  - 停用/删除 super 角色或当前登录用户自身 → 拒绝；
  - 角色的 `nav_visible=1` 时校验 `home_path` 必填且必须是已存在的菜单路由。

### 5.2 内置保护判定白名单

新增保护不再加字段，统一以稳定标识判定（最小改动）：

- 平台保留：`userId=1` / `roleId=1`（沿用现状）。
- 业务保留：role_key 白名单常量，初版仅 `business_admin`（super 角色）。
- 后续若有其他受保护业务角色，在常量中追加 role_key 即可。

### 5.3 专岗账号规则

- **强制单角色**：专岗账号只能绑定一个 `nav_visible=1` 的角色。用户保存时后端校验，不允许同时叠加标准模式角色（避免模式冲突）。
- super 可对专岗账号执行：新建、重置密码、停用/启用、调整其专岗角色（换岗）、删除。
- 专岗账号不分配部门/岗位（已冻结：本期不做行级数据权限）。

---

## 6. 岗位权限矩阵（基于现有 Controller 权限点核实）

权限点取自各 APMS Controller 的 `@PreAuthorize` 注解（现行系统实际生效的全集），下表为**已冻结**的最终配置。

| 模块 · 权限点 | super | 教练 | 测量员 | 队医 |
|---|---|---|---|---|
| 总览看板（菜单授权，无独立 perms） | ✅ | ✅ | ❌ | ❌ |
| 运动员档案 list/query | ✅ | ✅ | ✅ | ✅ |
| 运动员档案 add/edit/remove | ✅ | ❌ | ❌ | ❌ |
| 指标库 list/query | ✅ | ❌ | ✅（参照标准） | ❌ |
| 指标库 add/edit/remove | ✅ | ❌ | ❌ | ❌ |
| 测试模型库 list/query | ✅ | ❌ | ✅（参照标准） | ❌ |
| 测试模型库 add/edit/remove | ✅ | ❌ | ❌ | ❌ |
| 测试任务 list/query | ✅ | ❌ | ✅ | ❌ |
| 测试任务 add（创建/排期） | ✅ | ❌ | ❌ | ❌ |
| 测试任务 edit（报名/出勤等现场操作） | ✅ | ❌ | ✅ | ❌ |
| 测试任务 remove | ✅ | ❌ | ❌ | ❌ |
| 测试结果 list/query | ✅ | ✅（只读） | ✅ | ❌ |
| 测试结果 add/edit | ✅ | ❌ | ✅ | ❌ |
| 测试结果 remove | ✅ | ❌ | ❌ | ❌ |
| 体态测量 list/query | ✅ | ❌ | ✅ | ❌ |
| 体态测量 edit（录入/计算） | ✅ | ❌ | ✅ | ❌ |
| 体态测量 remove | ✅ | ❌ | ❌ | ❌ |
| PHV list/query | ✅ | ✅（只读，建议） | ✅ | ❌ |
| PHV edit（计算） | ✅ | ❌ | ✅ | ❌ |
| PHV remove | ✅ | ❌ | ❌ | ❌ |
| RTP list/query | ✅ | ✅（只读） | ❌ | ✅ |
| RTP edit/clear（评估处置） | ✅ | ❌ | ❌ | ✅ |
| 组合模型 list/query/add/edit/remove | ✅ | ❌ | ❌ | ❌ |
| 组合体能评分 list/query | ✅ | ✅（只读） | ❌ | ❌ |
| 组合体能评分 calculate/remove | ✅ | ❌ | ❌ | ❌ |
| 医疗记录 list/query | ✅ | ❌ | ❌ | ✅ |
| 医疗记录 add/edit | ✅ | ❌ | ❌ | ✅ |
| 医疗记录 remove | ✅ | ❌ | ❌ | ❌ |
| 报告 list/query/download | ✅ | ✅ | ❌ | ✅（医疗相关） |
| 报告 generate/remove | ✅ | ❌ | ❌ | ❌ |

说明：

- 「总览看板」菜单未设独立权限码，其页面数据来自各业务 list 接口，数据可见范围随各接口权限点收敛。
- 「测试任务 edit」一个权限点同时覆盖任务修改与现场报名/出勤操作，若要严格区分"排期"与"执行"，需拆分权限点（见 §8 R7）。

---

## 7. 改动点清单

### 7.1 后端

| # | 模块 | 改动 |
|---|---|---|
| BE-1 | 数据库 | `sys_role` 增加 `nav_visible`、`home_path`（仅提供 SQL，不直接写库） |
| BE-2 | ruoyi-common | `SysRole` 增加两字段与 getter/setter |
| BE-3 | ruoyi-system | `SysRoleMapper.xml`：insert/update/updateById/resultMap/查询列增加两字段 |
| BE-4 | ruoyi-admin | `getInfo` 聚合返回 `navVisible`、`homePath` |
| BE-5 | ruoyi-system | 用户/角色列表对非平台身份过滤 admin 记录 |
| BE-6 | ruoyi-system | 用户保存校验：禁止绑定 roleId=1；Portal 用户强制单角色 |
| BE-7 | ruoyi-system | 角色保存校验：business_admin 白名单保护；Portal 角色 home_path 必填校验 |
| BE-8 | — | 接口鉴权维持现有 `@PreAuthorize("@ss.hasPermi(...)")`，不新增鉴权机制 |

### 7.2 前端

| # | 范围 | 改动 |
|---|---|---|
| FE-1 | user store | state 增加 `navVisible`、`homePath`，getInfo 时写入；登出时清空 |
| FE-2 | 路由守卫 [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js) | 路由生成后：Portal 模式调 `toggleSideBarHide(true)` 并跳 `homePath`；标准模式确保 `false` |
| FE-3 | Layout | 复用现有 `sidebar.hide`；Portal 模式关闭标签页；Navbar 精简（隐藏搜索/全屏/大小屏等装饰项，保留退出与个人中心） |
| FE-4 | 角色管理页 | 表单增加「导航模式（标准/无导航专岗）」单选；选无导航时显示「落地页面」下拉（从菜单树选择已配置的菜单路由） |
| FE-5 | 用户管理页 | UI 门禁：admin 行不渲染；super 自身行禁用删除/停用；角色下拉剔除 admin 角色；专岗用户角色单选限制 |
| FE-6 | 异常处理 | Portal 模式访问无权限路由统一重定向 `homePath`；接口 403 提示保持现状 |

---

## 8. 风险与注意事项

| 编号 | 风险 | 对策 |
|---|---|---|
| R1 | 只隐藏前端页面、接口漏配权限点导致越权 | 每个专岗接口必须有 `@PreAuthorize`；交付前按矩阵逐个接口核验 |
| R2 | 历史脏数据（浏览器缓存、旧角色关联）使 admin 仍出现在 UI | 后端过滤为权威来源，前端再兜底剔除，双层防御 |
| R3 | 新增业务菜单后 super/专岗角色未补授权 → 功能"消失" | 纳入发版 checklist；或后续在菜单新增时提供"自动授予 super"选项（后续迭代） |
| R4 | Portal 模式与锁屏/初始密码改密弹窗冲突（改密页在标准 Layout 内） | 个人中心页本身为隐藏路由，Portal 模式可直接打开；需在实施时验证弹窗链路 |
| R5 | 专岗账号共用、弱密码 | 沿用密码策略配置（过期天数、初始密码强制修改已具备）；建议专岗账号一人一号 |
| R6 | home_path 配置错误导致登录后白屏/404 | 角色保存时校验路由存在性；后端兜底：home_path 无权限时回 404 并引导退出 |
| R7 | `apms:testTask:edit` 同时覆盖"改任务/报名/出勤"，无法只给执行权不给排期权 | 最小方案：测量员拿 edit 不拿 add/remove；若客户要求严格区分，再拆分权限点（需改 Controller/前端） |
| R8 | 运动员详情页路由 `/apms/athlete/detail/:id` 注册在 constantRoutes 中，所有登录用户路由可达 | 页面内数据接口均有 `apms:athlete:query` 权限点兜底，未授权时页面无数据；可接受，如需收敛再改动态路由 |

---

## 9. 初始化数据规划（仅提供 SQL，不直接执行写库）

实施时输出一份初始化脚本，内容包含：

1. `ALTER TABLE sys_role ADD COLUMN nav_visible char(1) DEFAULT '0' ..., ADD COLUMN home_path varchar(200) ...`
2. 插入 super 角色：`role_key='business_admin'`、`data_scope='1'`（全部数据）、`nav_visible='0'`。
3. 插入 super 用户（建议用户名 `super`，初始密码按项目加密规则生成 BCrypt 值），关联 super 角色。
4. super 角色菜单授权：按 §3.2 边界圈定的菜单 ID 批量插入 `sys_role_menu`（**菜单 ID 以实施环境实际数据为准**，脚本中用子查询按 perms/path 定位，避免硬写 ID）。
5. 插入客户确认后的专岗角色（`nav_visible='1'`，带 `home_path`），并按 §6 矩阵写入各角色的 `sys_role_menu` 授权。
6. admin 账号、admin 角色：**不做任何改动**。

脚本同时提供「回滚段」（删除新建账号/角色、恢复列），在 UAT 环境先验证再上客户环境。

---

## 10. 实施计划（建议）

| 阶段 | 内容 | 产出/验收 |
|---|---|---|
| P1 账号隔离 | BE-5/6/7、FE-5：super 账号建立、admin 对客户不可见、内置保护 | super 登录后全业务可用；任何页面/接口无法触及 admin |
| P2 Portal 模式 | BE-1~4、FE-1~3、FE-4：无导航模式闭环 | 专岗账号登录直达工作台，无侧栏，越权访问 404/403 |
| P3 岗位细化 | 按《岗位权限矩阵》配置专岗角色与权限点 | 每个岗位账号逐页面、逐按钮、逐接口验收 |
| P4 交付准备 | 初始化/回滚脚本、UAT 全量回归、操作手册增补 | 客户环境可重复部署 |

---

## 11. 评审决策记录（全部已冻结，2026-09-22）

| # | 决策项 | 结论 |
|---|---|---|
| D1 | super 技术菜单边界 | **菜单管理、系统监控、系统工具均不可见** |
| D2 | 工作台形态 | **复用现有列表页**，不为专岗新建聚合式工作台 |
| D3 | 行级数据权限 | **本期不做**；后续需要再启用 `@DataScope` |
| D4 | 专岗设置 | **3 个专岗：教练 / 测量员 / 队医**；测试执行与形态测量合并为「测量员」 |
| D5 | 日志 | **操作日志、登录日志保留给 super** |
| D6 | 专岗顶部栏 | **精简**为「品牌名 + 用户菜单（个人中心/修改密码/退出）」 |
| D7 | 账号规范 | super 用户名定为 **`super`**；专岗账号按「岗位.姓名」命名，如 `coach.zhang`、`tester.li`、`medic.wang` |
| D8 | 多角色 | **专岗账号强制单角色** |

---

> 决策已全部冻结，下一步按 §10 阶段拆分为可执行任务进入实施。
