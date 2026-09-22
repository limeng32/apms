# APMS 权限体系设计方案

> 版本：v1.3（决策已冻结）
> 日期：2026-09-22
> 状态：**全部决策已冻结**，可按 §10 拆任务进入实施。
> v1.1 D9：委派权限集合；v1.2 D10：可管理对象边界；v1.3 D11：强制下线（含 F8 Portal 角色变更）；期间将 `nav_visible` 更名为 `portal_mode`，DELEGATABLE 校验细化为「C/F 白名单 + M 祖先闭包」，super 角色集合锁定为 {business_admin}。

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
│ 专岗账号（教练、测量员、队医）                          │
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
| 队医 `portal_medic` | `/apms/medical`（医疗记录） | 医疗记录登记维护、RTP 状态评估与处置（含清除）、查阅与下载**全部报告**；运动员档案只读 |

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
| `portal_mode` | char(1)，默认 `0` | `0`=标准模式（显示导航）；`1`=Portal 模式（无导航） |
| `home_path` | varchar(200)，可空 | Portal 模式登录落地路由，如 `/apms/testTask`；标准模式忽略 |

涉及改动：`SysRole` 实体、角色新增/编辑表单、`SysRoleMapper`（insert/update/resultMap）、`getInfo` 返回值。

`getInfo` 增加返回：

```json
{
  "portalMode": true,
  "homePath": "/apms/testTask"
}
```

聚合规则：用户角色中任一角色 `portal_mode=1` 即为 Portal 模式（配合 §5.3「专岗账号强制单角色」，不存在歧义）。

### 4.3 备选方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 角色加字段 | `portal_mode` + `home_path` | 语义清晰、配置集中、端到端最直接；可在角色管理页可视化维护 | 加 2 列、改动实体与 mapper | **推荐** |
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
  - 角色的 `portal_mode=1` 时校验 `home_path`：①必填；②能对应到一个菜单页面（C 型菜单）；③**该菜单的 menuId 必须包含在本角色提交的 menuIds 中**（已授权）。任一不满足拒绝，防止「路径真实但角色无此菜单」导致登录后不可达。

### 5.2 内置保护判定白名单

新增保护不再加字段，统一以稳定标识判定（最小改动）：

- 平台保留：`userId=1` / `roleId=1`（沿用现状）。
- 业务保留：role_key 白名单常量，初版仅 `business_admin`（super 角色）。
- 后续若有其他受保护业务角色，在常量中追加 role_key 即可。

### 5.3 专岗账号规则

- **强制单角色**：专岗账号只能绑定一个 `portal_mode=1` 的角色。用户保存时后端校验，不允许同时叠加标准模式角色（避免模式冲突）。
- super 可对专岗账号执行：新建、重置密码、停用/启用、调整其专岗角色（换岗）、删除。
- 专岗账号不分配部门/岗位（已冻结：本期不做行级数据权限）。

### 5.4 委派权限集合（DELEGATABLE）与提权防护【D9，最高优先级】

#### 5.4.1 已确认的安全漏洞（代码事实）

前端角色编辑的菜单树对非 admin 确实按自身权限过滤（[selectMenuList](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/impl/SysMenuServiceImpl.java#L74-L88)），正常 UI 下 super 看不到系统监控等菜单；**但后端写接口没有对应约束**：

- [SysRoleController.add/edit](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/SysRoleController.java#L91-L125) 直接接收客户端提交的 `menuIds[]`；
- [insertRoleMenu](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/impl/SysRoleServiceImpl.java#L293-L310) 将其**原样写入** `sys_role_menu`，未验证「提交的 menuIds ⊆ 当前操作者有权委派的集合」；
- `checkRoleAllowed` 仅拦截 roleId=1。

攻击路径（绕过前端直调 API）：

```
super
  → POST /system/role，创建 evil_role，menuIds 填入系统监控/用户管理等任意菜单
  → PUT /system/role/authUser/selectAll，把 evil_role 分给账号（含 super 自己）
  → 完成提权
```

这与本方案「前端可被绕过，后端才是安全边界」的原则冲突，必须在 Service 层封堵。

#### 5.4.2 冻结规则

| 操作者 | 可操作的角色范围 | 可委派的 menuIds 范围 |
|---|---|---|
| admin（userId=1） | 不限制 | 不限制 |
| business_admin（super） | **仅 `role_key` 以 `portal_` 开头的专岗角色**；不能新建/修改/停用/删除 `business_admin` 与 `admin`，也不能创建非 portal 角色 | **必须全部落在 DELEGATABLE 集合内**，否则整笔请求拒绝 |

**不采用**「menuIds ⊆ super 自己的 menuIds」：super 自身持有用户管理、角色管理、日志、登录页设计等权限，这些同样不应被下放。委派边界是一个独立的、更小的显式集合。

#### 5.4.3 DELEGATABLE 集合定义

判定标识不硬编码 menu_id（各环境 ID 不同），以**稳定的权限码 perms** 定义白名单；总览看板无 perms，以 component 路径单列：

| 模块 | 可委派权限码（F/C 菜单行的 perms） |
|---|---|
| 总览看板 | component = `apms/dashboard/index`（无 perms，单独识别） |
| 运动员档案 | `apms:athlete:list`、`apms:athlete:query` |
| 指标库 | `apms:indicator:list`、`apms:indicator:query` |
| 测试模型库 | `apms:testModel:list`、`apms:testModel:query` |
| 测试任务 | `apms:testTask:list`、`apms:testTask:query`、`apms:testTask:edit` |
| 测试结果 | `apms:testResult:list/query/add/edit` |
| 体态测量 | `apms:body:list/query/edit` |
| PHV 成熟度 | `apms:phv:list/query/edit` |
| RTP 风险预警 | `apms:rtp:list/query/edit/clear` |
| 组合体能评分 | `apms:comboScore:list/query` |
| 医疗记录 | `apms:medicalRecord:list/query/add/edit` |
| 报告中心 | `apms:report:list/query/download` |

**明确排除（即使 super 自己拥有也不可委派）：**

- 一切 `system:*`（含用户/角色/菜单/部门/岗位/字典/参数/通知/日志/登录页设计）、`monitor:*`、`tool:*`；
- 组合模型整菜单（`apms:comboModel:*`）；
- 各模块的 `remove`、运动员档案的 `add/edit/export`、指标库与测试模型库的 `add/edit`、测试任务的 `add`、测试结果的 `remove`、体态测量的 `remove`、PHV 的 `remove`、组合评分的 `calculate/remove`、医疗记录的 `remove`、报告的 `generate/remove`。

该集合即 §6 矩阵中三岗授权的并集；矩阵若调整，集合同步调整，二者保持一致。

**关于目录型菜单（M）——不维护目录白名单，用祖先闭包：**

菜单树由 M（目录）/ C（页面）/ F（按钮）组成；M 行通常 `perms=''`、`component=Layout`，无法直接进 perms 白名单。授权勾选时提交的 menuIds 除 C/F 外还会包含其上级 M（如「APMS」目录）。处理规则：

1. 白名单只判定 **C/F 功能节点**（perms 或看板 component）；
2. 从每个**通过白名单的 C/F** 沿 `parent_id` 向上追溯（用 [selectMenuById](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/resources/mapper/system/SysMenuMapper.xml#L122) 逐级取父节点）直到根，把途经的 **M 祖先**并入，构成 `allowedMenuIds` 闭包；
3. 最终只判定 `submittedMenuIds ⊆ allowedMenuIds`。

这样：①功能菜单成树所必需的目录节点不会因无 perms 被误伤；②不属于任何已授权功能祖先的目录（如「系统管理」「系统监控」）不在闭包内，混入即被拒。

#### 5.4.4 后端校验落地点（缺一不可）

> 分工：**C3 为 D9 权限内容校验**（本节核心）；C1/C2、C4–C8 中的“对象是否为 portal_* / 是否触达 admin”属 **D10 对象边界**，实现时统一由 §5.5 `ManagedBoundary` 承担，本表作为需求总清单保留。

| # | 写操作 | 校验内容（操作者为 super 时） |
|---|---|---|
| C1 | `insertRole` | 新角色 role_key 必须以 `portal_` 开头、`portal_mode=1`、`home_path` 必填且其菜单必须在提交的 menuIds 中 |
| C2 | `updateRole` | 先加载旧角色，其 role_key 必须以 `portal_` 开头；角色模式/key 不可变更为非 portal；`home_path` 变更时同样校验「菜单存在且在提交 menuIds 中」 |
| C3 | C1/C2 共同 | ①加载提交的 C/F 菜单行，逐个校验 perms ∈ DELEGATABLE_PERMS 或 component ∈ DELEGATABLE_COMPONENTS（看板）；②由通过校验的 C/F 向上追溯 M 祖先，构造 `allowedMenuIds` 闭包；③提交的全部 menuIds（含 M）必须 ⊆ 闭包。**任一不满足抛 ServiceException，整笔回滚** |
| C4 | `changeStatus`（启停） | 目标角色必须是 `portal_*` |
| C5 | `authDataScope` | 目标角色必须是 `portal_*`（专岗角色无需自定义数据范围，dataScope 固定默认） |
| C6 | `deleteRoleByIds` | 每个目标角色必须是 `portal_*` |
| C7 | 用户新增/修改、分配角色 | 提交的 roleIds 必须全部为 `portal_*` 角色；禁止绑定 admin/business_admin |
| C8 | 角色分配用户（authUser 相关接口） | 目标角色必须是 `portal_*`，目标用户必须是 super 可管理的用户（非 admin） |

实现建议：

- 在 ruoyi-common 新增常量类（如 `DelegationConstants`），持有 `Set<String> DELEGATABLE_PERMS` 与 `Set<String> DELEGATABLE_COMPONENTS`（看板）；提供角色 key 前缀常量 `PORTAL_ROLE_PREFIX = "portal_"` 与受保护 key 集合 `{admin, business_admin}`。
- 在 SysRoleServiceImpl 内新增私有校验方法（如 `checkDelegatable(role)`），在 insert/update 等方法入口统一调用；判定操作者身份用 `SecurityUtils`，admin 直接放行。**不新增鉴权框架，仅在现有 Service 事务内加校验。**
- 异常信息明确指出越界菜单（如「包含无权委派的权限：apms:xxx」），便于排障与审计；写操作已有操作日志记录。

#### 5.4.5 数据前置条件：按钮型（F）菜单必须存在

RuoYi 的按钮级权限码承载在 `menu_type='F'` 的菜单行上，角色只能被授予已存在的菜单行。现行 2200 系列种子（patch-0.0.2）只含 13 个 C 菜单、**无对应 F 行**（仅旧版 2000 系列种子里有运动员档案 5 个 F 行）。若环境中确实缺失，则：

- 初始化脚本须按 §5.4.3 集合**补齐各 APMS 模块的 F 型菜单行**（perms 即集合中的权限码，挂在对应 C 菜单下）；
- 否则 §6 矩阵中的 `add/edit/download/clear` 等权限无行可授，专岗只能拿到 list。

实施前以 SQL 查询现网 `sys_menu` 实际 F 行情况，缺什么补什么（只给 SQL）。

### 5.5 客户侧可管理对象边界（统一门禁）【D10，最高优先级】

#### 5.5.1 问题：现有校验是“点状”的，且两种 check 都构不成边界

RuoYi 的用户/角色写入口分散在约 20 个接口，现有两类校验：

- `checkUserAllowed` / `checkRoleAllowed`：**只拦硬编码 ID=1**，不保护 business_admin，且并非每个入口都调用；
- `checkUserDataScope` / `checkRoleDataScope`：验证“数据范围”，而 super 的 dataScope=1（全部数据），**对 super 一律放行**——它不是对象边界。

逐入口核实的缺口（代码事实）：

| 接口 | 当前校验 | 对 super 的实际结果 |
|---|---|---|
| GET /system/user/{userId} | checkUserDataScope | **可查 admin 详情**（DataScope 全通过） |
| GET /system/user/authRole/{userId} | 无 | **可打开 admin 的授权角色页** |
| PUT /system/user/authRole | checkUserDataScope + checkRoleDataScope，**无 checkUserAllowed** | **可给 userId=1 授权任意角色**；可绑定 roleId=1 |
| POST /system/user（新增） | checkRoleDataScope(roleIds) | **新用户可绑定 admin 角色** |
| POST /system/user/export | 无 | 导出含 admin |
| GET /system/role/{roleId} | checkRoleDataScope | **可查 admin 角色详情** |
| GET /system/role/optionselect | 无 | 下拉返回**全部角色含 admin** |
| GET /system/role/authUser/allocatedList | 无角色边界 | **可查 admin 角色下的用户** |
| GET /system/role/authUser/unallocatedList | 无角色边界 | 同上 |
| PUT /system/role/authUser/cancel(/cancelAll) | 无 | **可取消任意角色的任意用户授权** |
| PUT /system/role/authUser/selectAll | checkRoleDataScope | **可给任意角色（含 admin）分配用户** |
| GET /system/role/deptTree/{roleId} | 无 | 可查 admin 角色部门树 |
| POST /system/role/export | 无 | 导出含 admin |
| PUT /system/role（修改/dataScope/changeStatus）、DELETE | checkRoleAllowed | 只拦 roleId=1；**business_admin 不在保护** |
| DELETE/PUT(resetPwd/changeStatus) /system/user | checkUserAllowed | 只拦 userId=1；**super 自身账号缺保护** |

结论：不能采用“哪个页面发现 admin 就过滤一下”。必须把规则集中为**一个**对象边界，并强制覆盖全部入口（列表、详情、选择框、授权、删除、状态修改、导出）。

#### 5.5.2 边界模型（三类对象 × 操作）

操作语义：**R** 查询（详情/列表/选择框/导出）、**W** 修改（资料/状态/数据范围）、**G** 授权（给用户授角色 / 给角色分配用户 / 菜单授权）、**D** 删除。

| 对象 | 对 super 的边界 |
|---|---|
| **admin 用户**（userId=1） | R/W/G/D **全部禁止**——列表、详情、选择框、导出中永不可见 |
| **admin 角色**（roleId=1, key=`admin`） | R/W/G/D **全部禁止**；不可被查询、修改、分配给任何用户 |
| **super 用户自身** | R 允许；可改昵称/手机/邮箱/密码等基础信息；**不可 D 删除、不可停用；角色集合不可变更——恒等于 `{business_admin}`**（见下条说明） |
| **business_admin 角色**（super 角色） | R 允许（列表可见、只读）；**W/G/D 禁止**：不可修改、不可解绑、不可停用/删除、**不可分配给别人** |
| **专岗用户**（持有 portal 角色的用户） | R/W/G/D **完整管理**（建号、改资料、重置密码、启停、换岗、删除） |
| **portal_* 角色** | R/W/G/D **完整管理**；其中菜单授权 G 受 D9 DELEGATABLE 集合约束（§5.4） |

派生硬规则（授权接口逐条适用）：

1. super **永不可** 查询/修改 userId=1，给 userId=1 授权；
2. super **永不可** 查询/修改 roleId=1，把 roleId=1 分配给任何用户；
3. super **不可**把 business_admin 角色分配给任何用户（含自己再绑一次），不可解绑自身 business_admin；
4. 用户保存/授权的 roleIds：除“super 自己维持 business_admin”这一既有事实外，可写集合**仅为 portal_* 角色**；
5. 任何针对角色的用户分配/取消：目标角色必须是 portal_*。
6. **super 用户的角色集合必须恒等于 `{business_admin}`**，不得额外挂任何 portal_* 角色，也不得解绑 business_admin。原因有二：
   - Portal 判定规则是「任一角色 `portal_mode=1` 即进入 Portal」，若误给 super 叠加 `portal_coach`，super 会直接变成 Portal 用户；
   - RuoYi 的 `updateUser()` 先 `deleteUserRoleByUserId` 再按提交 roleIds 重建，而 super 可分配角色下拉（optionselect 过滤后）只有 portal_*，走通用编辑会把 business_admin 洗掉。
   
   因此：**target 为 super 用户时，通用用户编辑接口不接受 roleIds 变更**（后端忽略/拒绝该字段并强制保留 `{business_admin}`）；仅允许改昵称/手机/邮箱等基础字段与走个人中心改密；前端用户管理页中 super 行的角色选择直接禁用。

#### 5.5.3 统一门禁组件（集中判定，一处实现）

在 ruoyi-framework 新增一个 Spring 组件（如 `ManagedBoundary`），作为 super 触达用户/角色的**唯一判定出口**；判定依据为稳定标识（userId/roleId 与 role_key 前缀/白名单，常量复用 §5.4 的 `DelegationConstants`），**admin 操作者直接全放行**：

```
// 用户边界
assertUserManageable(Long userId, Access op)            // 单个
assertUsersManageable(Long[] userIds, Access op)        // 批量：逐个校验，任一越界即拒绝
// 角色边界
assertRoleManageable(Long roleId, Access op)            // 内部加载 role_key 判定类别
assertRolesManageable(Long[] roleIds, Access op)
// 列表/下拉/导出：服务端过滤
List<SysUser> filterUsers(List<SysUser>)                 // 剔除 userId=1（super 视角）
List<SysRole> filterRoles(List<SysRole>, boolean forAssign)
        // 列表/导出：保留 business_admin(只读)+portal_*，剔除 admin
        // forAssign=true（角色选择框/授权下拉）：仅返回 portal_*
```

设计约束：

- 判定方法集中在此组件，Controller/Service **不得各自重写** admin 过滤逻辑，避免规则再次发散；
- 越界统一抛 `ServiceException`（消息指明对象与操作），写操作在 Service 事务内调用、随事务回滚；
- 操作类型用枚举（READ/WRITE/GRANT/DELETE），与 §5.5.2 矩阵一一对应；
- 不新增鉴权框架，仍是 Service 层普通强校验。

#### 5.5.4 查询层 SQL 兜底（防数据穿透）

仅靠出口过滤无法防止“漏调”，对**会返回行数据**的查询在 Mapper 层加固定条件（对非平台身份生效）：

| 查询 | 兜底条件 |
|---|---|
| `selectUserList`（列表/导出共用） | 追加 `u.user_id <> 1` |
| `selectRoleList`（列表/导出/DataScope 共用） | 追加 `r.role_id <> 1`；business_admin 保留可见（只读） |
| `selectAllocatedList` / `selectUnallocatedList` | 入口先经 `assertRoleManageable(roleId, READ)`（仅 portal 可查）；行级追加 `u.user_id <> 1` |
| `optionselect` 角色选择框 | 非 admin 仅返回 `role_key LIKE 'portal\_%'`（可分配集合）；business_admin/admin 不返回 |
| 详情类（/{userId}、/{roleId}、authRole/{userId}、deptTree/{roleId}） | 入口统一改为先调对应 `assert...Manageable(id, READ)` |

> SQL 条件与门禁组件双层：SQL 负责“行不返回”，组件负责“写操作拒绝 + 单一真相源”。

#### 5.5.5 全入口覆盖矩阵（交付验收清单）

下表每个入口都必须接入门禁；P1 验收时逐行用 super 直调 API 实测（含越权参数）。

| 入口 | super 接入的门禁 |
|---|---|
| GET /system/user/list、POST /export | SQL 过滤 userId=1 + filterUsers |
| GET /system/user/{userId} | assertUserManageable(userId, R) |
| POST /system/user | assertRolesManageable(roleIds, G)（仅 portal） |
| PUT /system/user | assertUserManageable(userId, W) + roleIds G 校验 |
| DELETE /system/user/{userIds} | assertUsersManageable(userIds, D) |
| PUT /system/user/resetPwd、/changeStatus | assertUserManageable(userId, W)；自身停用拒绝 |
| GET /system/user/authRole/{userId} | assertUserManageable(userId, R)；角色列表 filterRoles(forAssign) |
| PUT /system/user/authRole | **assertUserManageable(userId, G)** + assertRolesManageable(roleIds, G) |
| GET /system/role/list、POST /export | SQL 过滤 roleId=1（保留自身只读） |
| GET /system/role/{roleId}、/deptTree/{roleId} | assertRoleManageable(roleId, R) |
| POST /system/role | 新角色 key 必须 portal_ 前缀（§5.4 C1） |
| PUT /system/role、/dataScope、/changeStatus | assertRoleManageable(roleId, W)；菜单部分走 D9 |
| DELETE /system/role/{roleIds} | assertRolesManageable(roleIds, D) |
| GET /system/role/optionselect | filterRoles(forAssign=true)：仅 portal_* |
| GET /system/role/authUser/allocatedList、unallocatedList | assertRoleManageable(roleId, R) + SQL userId=1 过滤 |
| PUT /system/role/authUser/cancel、/cancelAll、/selectAll | assertRoleManageable(roleId, G) + assertUsersManageable(userIds, G) |

#### 5.5.6 与 D9 的分工

- **D9（§5.4）** 管「权限内容」：portal 角色的 menuIds 只能取自 DELEGATABLE 集合；
- **D10（§5.5）** 管「对象可达性」：哪些用户/角色可以被 super 查询、修改、授权、删除。

两层校验在角色/用户写事务中同时生效，缺一不可。

### 5.6 用户级操作强制下线（Force Logout）【D11】

#### 5.6.1 运行时问题（代码事实）

身份解析链路为：`JWT → uuid → Redis 中的 LoginUser → SecurityContext`。

- [JwtAuthenticationTokenFilter](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/security/filter/JwtAuthenticationTokenFilter.java#L34-L41) 每次请求直接取用 Redis 缓存的 LoginUser（[getLoginUser](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/web/service/TokenService.java#L63-L84)），**不复查数据库**中的用户状态/角色；
- 现有的 [refreshPermissionByRoleId](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/web/service/TokenService.java#L240-L269) 仅在「角色权限本身变更」（PUT /system/role）后刷新持有者权限；
- 停用用户、删除用户、改变用户角色、重置密码这些**用户级操作没有任何在线会话处理**。

后果：后台显示账号已停用，该用户已登录的浏览器仍可继续操作直至 token 过期（默认 30 分钟滑动续期），权限语义不成立。

#### 5.6.2 冻结规则：权限/状态变更后重新登录

不做复杂的在线动态同步。**以下操作一旦成功，目标用户的全部在线会话立即失效，需重新登录**：

| # | 操作 | 接口 | 触发条件 |
|---|---|---|---|
| F1 | 停用用户 | PUT /system/user/changeStatus | 新状态为**停用**（启用不踢） |
| F2 | 删除用户 | DELETE /system/user/{userIds} | 无条件 |
| F3 | 改变用户角色 | PUT /system/user | **变更前后 roleId 集合不一致时**（仅改昵称等资料不踢） |
| F4 | 用户授权角色 | PUT /system/user/authRole | 无条件 |
| F5 | 角色分配/取消用户 | PUT /system/role/authUser/selectAll、/cancel、/cancelAll | 踢被操作的 userIds |
| F6 | 重置密码 | PUT /system/user/resetPwd | 无条件（改密后以新密码重新登录） |
| F7 | 停用角色 | PUT /system/role/changeStatus | 新状态为**停用**（启用不踢）；持有该角色的全部在线用户下线 |
| F8 | **修改 Portal 角色定义** | PUT /system/role | 该角色为 portal_* 且 **menuIds 或 home_path 发生变化时**；持有该角色的全部在线用户下线（替代现有的 `refreshPermissionByRoleId` 热刷新） |

排除：

- super 停用/删除自身已被 D10 禁止；super 改自身资料/密码走个人中心，不在上表；
- 角色删除（DELETE /system/role）有「已分配用户不可删除」前置拦截，无残留会话问题；
- 用户自己在个人中心修改密码（/system/user/profile/updatePwd，需原密码）**不触发**强制下线，自己继续使用。

#### 5.6.3 实现方式

**TokenService 新增方法**（复用现有扫描模式，无需新增 Redis key 约定）：

```
// 按用户ID强制下线：扫描 login_tokens:*，匹配 LoginUser.user.userId ∈ userIds 的全部键并删除
public void forceLogoutByUserIds(Long[] userIds)
// 按角色ID强制下线：扫描中匹配持有该角色的 LoginUser，删除其全部会话键
public void forceLogoutByRoleId(Long roleId)
```

要点：

- Redis 键为 `login_tokens:{uuid}`（CacheConstants.LOGIN_TOKEN_KEY），同一用户多设备/多浏览器登录有多个 uuid，扫描可**一次性全部踢出**；
- 调用时机：**Controller 在 Service 写操作成功返回之后**调用（与现有 `refreshPermissionByRoleId` 在 edit 成功后调用的位置一致），确保事务提交成功才踢人，避免回滚误踢；
- F3 的新旧角色比对：操作前经 `roleService.selectRoleListByUserId(userId)` 取旧集合，与提交 roleIds 比较，不同才调用；
- F5 三个接口目前在 Controller 中无任何校验，接入时与 D10 对 authUser 系列的门禁改造一起做；
- F7 在角色 changeStatus 成功后调用 `forceLogoutByRoleId`（角色 edit 接口已有 checkRoleAllowed/refreshPermission 链路；super 仅能对 portal_* 角色操作，由 D10 保证）。
- **F8 取代 portal 角色的权限热刷新**：[SysRoleController.edit](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/SysRoleController.java#L127-L131) 成功后，对 **portal_* 角色**不再调用 `refreshPermissionByRoleId`（它只刷新 Redis 中 LoginUser.permissions，前端已加载的动态路由、portalMode、homePath 都不会同步），改为 `forceLogoutByRoleId(roleId)`，持有者下次请求即 401，重新登录后拿到新路由与新 home_path。判定“是否变化”：menuIds 可比对新旧 `sys_role_menu` 集合，home_path 比对旧值；仅改角色名称等不踢。非 portal 角色（仅 admin 可编辑）仍走原 refreshPermission 逻辑。

#### 5.6.4 失效后的链路（前端零改动）

```
Redis 会话删除
  → 目标用户下一次请求 getLoginUser 返回 null，过滤器不设置认证
  → @PreAuthorize 拦截，AuthenticationEntryPoint 返回 401
  → 前端 request.js 现有 401 处理：弹窗「登录状态已过期，请重新登录」→ 跳转登录页
```

- 语义为「**下一次操作时被感知**」：用户停留在页面不操作则无提示，不做 WebSocket 主动推送（项目规模下可接受）；
- 前端无需改动；如后续希望提示文案明确为「账号已被管理员停用/强制下线」，需后端在 401 响应中携带细分原因码，列为后续可选，本期不做。

#### 5.6.5 角色停用（已确认）

**角色停用**（PUT /system/role/changeStatus）后，持有该角色的在线用户同样强制下线，即上表 F7：TokenService 提供 `forceLogoutByRoleId(roleId)`，在停用成功后调用。适用范围：admin 停用任意角色、super 停用 portal_* 角色（business_admin/admin 由 D10 禁止停用）。

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
| 报告 list/query/download | ✅ | ✅ | ❌ | ✅（全部报告） |
| 报告 generate/remove | ✅ | ❌ | ❌ | ❌ |

说明：

- 「总览看板」菜单未设独立权限码，其页面数据来自各业务 list 接口，数据可见范围随各接口权限点收敛。
- 「测试任务 edit」一个权限点同时覆盖任务修改与现场报名/出勤操作，若要严格区分"排期"与"执行"，需拆分权限点（见 §8 R7）。
- **报告权限不区分类型**：`apms:report:*` 在 RBAC 层没有“仅医疗相关报告”这一过滤维度（本期不做行级/字段级过滤）。故队医持有报告读取权限即等于可查看**全部类型报告**，文档不写“医疗相关报告”。如后续需要按类型隔离，再在报告查询链路增加类型过滤。

---

## 7. 改动点清单

### 7.1 后端

| # | 模块 | 改动 |
|---|---|---|
| BE-1 | 数据库 | `sys_role` 增加 `portal_mode`、`home_path`（仅提供 SQL，不直接写库） |
| BE-2 | ruoyi-common | `SysRole` 增加两字段与 getter/setter |
| BE-3 | ruoyi-system | `SysRoleMapper.xml`：insert/update/updateById/resultMap/查询列增加两字段 |
| BE-4 | ruoyi-admin | `getInfo` 聚合返回 `portalMode`、`homePath` |
| BE-5 | ruoyi-framework | **新增 `ManagedBoundary` 统一门禁组件**（D10）：assertUser(s)/Role(s)Manageable、filterUsers/filterRoles；Access 枚举 R/W/G/D；admin 放行 |
| BE-6 | ruoyi-system | 用户保存/授权校验：roleIds 除自身 business_admin 外仅可 portal_*；禁止绑定/分配 admin 与 business_admin；Portal 用户强制单角色；**编辑 super 用户时拒绝/忽略 roleIds 变更，角色集合恒为 {business_admin}** |
| BE-7 | ruoyi-system | 角色保存校验：Portal 角色 home_path 必填、且落地菜单必须已在角色 menuIds 中（随 menuIds/home_path 每次修改一起校验）；business_admin 只读保护 |
| BE-8 | ruoyi-common | 新增 `DelegationConstants`：DELEGATABLE_PERMS / DELEGATABLE_COMPONENTS / portal 前缀与受保护 key |
| BE-9 | ruoyi-system | **D9 提权防护**：角色新增/修改菜单部分强制 DELEGATABLE 校验——C/F perms 白名单 + 向上追溯 M 祖先闭包，submittedMenuIds ⊆ 闭包（§5.4 C3） |
| BE-10 | ruoyi-system | **D10 全入口接入**：按 §5.5.5 矩阵，列表/详情/选择框/授权/删除/状态/导出逐个接入 ManagedBoundary（含 authRole、optionselect、allocated/unallocated、authUser 系列） |
| BE-11 | ruoyi-system | **SQL 兜底**：selectUserList 追加 user_id<>1；selectRoleList 追加 role_id<>1；分配列表入口角色边界 + 行级过滤；optionselect 非 admin 仅返回 portal_*（§5.5.4） |
| BE-12 | ruoyi-system | 现网缺失 APMS 按钮型 F 菜单时，初始化脚本补齐（perms 取 DELEGATABLE 集合） |
| BE-13 | ruoyi-framework | **D11 强制下线**：TokenService 新增 `forceLogoutByUserIds` 与 `forceLogoutByRoleId`（扫描 login_tokens:* 按 userId/roleId 删键）；用户停用/删除/换角色/重置密码、角色停用、**Portal 角色 menuIds/home_path 修改（F8，替代 refreshPermission 热刷新）**接口成功后接入（§5.6 F1–F8） |
| BE-14 | — | 接口鉴权维持现有 `@PreAuthorize("@ss.hasPermi(...)")`，不新增鉴权机制；前端复用现有 401 重新登录逻辑 |

### 7.2 前端

| # | 范围 | 改动 |
|---|---|---|
| FE-1 | user store | state 增加 `portalMode`、`homePath`，getInfo 时写入；登出时清空 |
| FE-2 | 路由守卫 [permission.js](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/permission.js) | 路由生成后：Portal 模式调 `toggleSideBarHide(true)` 并跳 `homePath`；标准模式确保 `false` |
| FE-3 | Layout | 复用现有 `sidebar.hide`；Portal 模式关闭标签页；Navbar 精简（隐藏搜索/全屏/大小屏等装饰项，保留退出与个人中心） |
| FE-4 | 角色管理页 | 表单增加「专岗模式（标准/Portal 无导航）」开关，勾选即 `portal_mode=1`；勾选时显示「落地页面」下拉；super 编辑 portal 角色时，授权菜单树只呈现 DELEGATABLE 集合（后端 C3 校验为准） |
| FE-5 | 用户管理页 | UI 门禁：admin 行不渲染；super 自身行禁用删除/停用、**角色选择禁用（角色恒为 business_admin，不可挂 portal_*）**；角色下拉剔除 admin 角色；专岗用户角色单选限制 |
| FE-6 | 异常处理 | Portal 模式访问无权限路由统一重定向 `homePath`；接口 403 提示保持现状 |

---

## 8. 风险与注意事项

| 编号 | 风险 | 对策 |
|---|---|---|
| R1 | 只隐藏前端页面、接口漏配权限点导致越权 | 每个专岗接口必须有 `@PreAuthorize`；交付前按矩阵逐个接口核验 |
| R1.1 | **super 绕过前端直调角色接口，提交任意 menuIds 实现提权（已从代码确认存在）** | **BE-8/BE-9：Service 层强制 DELEGATABLE 委派集合校验（§5.4）**；交付前用越权 API 用例实测 |
| R1.2 | **对象边界缺口（已逐接口确认）**：详情/授权/选择框/分配列表等约 15 个入口对 super 不设防，可查/改 admin、给 userId=1 授权、绑定 roleId=1 | **BE-5/10/11：ManagedBoundary 统一门禁 + SQL 兜底，按 §5.5.5 矩阵逐入口实测** |
| R2 | 历史脏数据（浏览器缓存、旧角色关联）使 admin 仍出现在 UI | 后端过滤为权威来源，前端再兜底剔除，双层防御 |
| R3 | 新增业务菜单后 super/专岗角色未补授权 → 功能"消失" | 纳入发版 checklist；或后续在菜单新增时提供"自动授予 super"选项（后续迭代） |
| R4 | Portal 模式与锁屏/初始密码改密弹窗冲突（改密页在标准 Layout 内） | 个人中心页本身为隐藏路由，Portal 模式可直接打开；需在实施时验证弹窗链路 |
| R5 | 专岗账号共用、弱密码 | 沿用密码策略配置（过期天数、初始密码强制修改已具备）；建议专岗账号一人一号 |
| R6 | home_path 配置错误（路径不存在，或角色未被授予该菜单）导致登录后白屏/404 | 角色保存时校验「菜单存在 ∧ menuId ∈ 本角色 menuIds」；后端兜底：home_path 无权限时回 404 并引导退出 |
| R7 | `apms:testTask:edit` 同时覆盖"改任务/报名/出勤"，无法只给执行权不给排期权 | 最小方案：测量员拿 edit 不拿 add/remove；若客户要求严格区分，再拆分权限点（需改 Controller/前端） |
| R8 | 运动员详情页路由 `/apms/athlete/detail/:id` 注册在 constantRoutes 中，所有登录用户路由可达 | 页面内数据接口均有 `apms:athlete:query` 权限点兜底，未授权时页面无数据；可接受，如需收敛再改动态路由 |
| R9 | 现网可能缺失 APMS 按钮型 F 菜单，矩阵中的 add/edit 等权限无行可授 | 实施前先查现网 F 行；BE-12 在初始化脚本中补齐（§5.4.5） |
| R10 | 账号停用/删除/换角色/重置密码、角色停用、Portal 角色 menuIds/home_path 修改后，已登录会话不失效（默认 token 30 分钟滑动续期；refreshPermission 只刷 Redis perms，不带动态路由/portalMode/homePath） | **BE-13：F1–F8 强制下线（§5.6）**；验收用双浏览器实测：操作后目标浏览器下一次请求即 401 跳登录页，重登后状态/路由/落地页均为最新 |
| R11 | 强制下线在下次请求时才被感知，停留不操作的用户无即时提示 | 项目规模下接受，不做 WebSocket 推送；会话删除即安全边界成立 |

---

## 9. 初始化数据规划（仅提供 SQL，不直接执行写库）

实施时输出一份初始化脚本，内容包含：

1. `ALTER TABLE sys_role ADD COLUMN portal_mode char(1) DEFAULT '0' ..., ADD COLUMN home_path varchar(200) ...`
2. 插入 super 角色：`role_key='business_admin'`、`data_scope='1'`（全部数据）、`portal_mode='0'`。
3. 插入 super 用户（建议用户名 `super`，初始密码按项目加密规则生成 BCrypt 值），关联 super 角色。
4. super 角色菜单授权：按 §3.2 边界圈定的菜单 ID 批量插入 `sys_role_menu`（**菜单 ID 以实施环境实际数据为准**，脚本中用子查询按 perms/path 定位，避免硬写 ID）。
5. 插入客户确认后的专岗角色（`portal_mode='1'`，带 `home_path`），并按 §6 矩阵写入各角色的 `sys_role_menu` 授权。
6. 先查询现网 APMS 按钮型 F 菜单，**缺失则补齐**（perms 取 §5.4.3 DELEGATABLE 集合），确保按钮级权限可被授予。
7. admin 账号、admin 角色：**不做任何改动**。

脚本同时提供「回滚段」（删除新建账号/角色、恢复列），在 UAT 环境先验证再上客户环境。

---

## 10. 实施计划（建议）

| 阶段 | 内容 | 产出/验收 |
|---|---|---|
| P1 账号隔离、对象边界与提权防护 | BE-5~13（**BE-8/9 委派闭包校验、BE-5/10/11 对象门禁与 SQL 兜底、BE-13 强制下线**）、FE-5：super 账号建立、admin 全入口不可达、内置角色保护、super 角色不可变更、DELEGATABLE 越权封堵（含 M 闭包）、用户/角色级操作即时失效 | super 全业务可用；按 §5.5.5 逐接口直调实测：admin 用户/角色不可查改授权；evil_role + 任意 menuIds/混入系统目录均被拒；business_admin 不可改/分配；super 自身角色不可编辑；停用/删除/换角色/重置密码、停用角色、改 Portal 角色定义后目标在线账号下次请求即 401 |
| P2 Portal 模式 | BE-1~4、FE-1~4：无导航模式闭环 | 专岗账号登录直达工作台，无侧栏，越权访问 404/403 |
| P3 岗位细化 | 按《岗位权限矩阵》配置专岗角色与权限点 | 每个岗位账号逐页面、逐按钮、逐接口验收 |
| P4 交付准备 | 初始化/回滚脚本（含 F 菜单补齐）、UAT 全量回归、操作手册增补 | 客户环境可重复部署 |

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
| D9 | 权限内容提权防护 | super 委派给 portal 角色的 menuIds **必须全部属于 DELEGATABLE 闭包**（§5.4：C/F perms 白名单 ∪ 其 M 祖先目录，为 §6 三岗授权并集）；不采用「menuIds ⊆ 自身权限」；Service 层强校验，admin 不限制 |
| D10 | 对象可达边界 | 设立集中的 **ManagedBoundary 统一门禁**（§5.5）：admin 用户/角色对 super 在列表/详情/选择框/授权/删除/状态/导出**全部不可达**；business_admin 角色只读、不可改/解绑/分配；**super 自身不可删除/停用、角色集合恒为 {business_admin} 不可变更**；portal_* 可完整管理。门禁 + SQL 双层，按 §5.5.5 矩阵覆盖全部入口 |
| D11 | 会话即时失效 | 用户**停用/删除/角色改变/重置密码成功后强制下线**，**角色停用、Portal 角色 menuIds/home_path 修改同样踢全部持有者（F8 替代权限热刷新）**（§5.6 F1–F8）：TokenService 扫描 `login_tokens:*` 按 userId/roleId 删键，下次请求走现有 401 链路重新登录；不做在线动态路由热更新与主动推送；前端零改动 |

---

> 决策 D1–D11 **已全部冻结，无遗留项**。下一步按 §10 阶段拆分为可执行任务进入实施。
