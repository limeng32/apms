# APMS 权限回归测试说明书（手测）

> 版本：v1.0
> 日期：2026-09-23
> 适用：APMS 权限体系（对应 [PERMISSION_DESIGN.md](file:///Users/limeng/Documents/trae_projects/apms/.trae/PERMISSION_DESIGN.md) v1.3）发布前 / 发版后的快速手工回归。
> 配套设计：[PERMISSION_DESIGN.md](file:///Users/limeng/Documents/trae_projects/apms/.trae/PERMISSION_DESIGN.md)；初始化：[permission_init.sql](file:///Users/limeng/Documents/trae_projects/apms/.trae/sql/permission_init.sql)

---

## 0. 怎么用这份说明书

- **时间紧（约 15 分钟）**：只跑 §2「快速冒烟清单」。
- **完整回归（约 60 分钟）**：§3 全部章节逐项打勾。
- 每步给出「操作 → 预期」，**预期与实际不符即记 FAIL**，记录实际提示原文与账号。
- §3.6（越权 API）与 F4/F5 需要命令行 curl（macOS 终端 / Windows 用 Git Bash）。

---

## 1. 测试环境与账号

| 项 | 值 |
|---|---|
| 前端地址 | http://localhost:5173 |
| 后端地址 | http://localhost:8080 |
| 后端接口前缀 | 直连 8080 时**无** `/dev-api`；页面内请求经 Vite 代理带 `/dev-api` |
| 数据库（只读核查） | apms-dev |

| 账号 | 密码 | 角色 | 类型 |
|---|---|---|---|
| `admin` | `admin123` | admin（平台保留） | 全权限，客户不可见 |
| `super` | `admin123` | business_admin（业务管理） | 客户侧最高 |
| `coach.zhang` | `admin123` | portal_coach（教练） | Portal 专岗 |
| `tester.li` | `admin123` | portal_tester（测量员） | Portal 专岗 |
| `medic.wang` | `admin123` | portal_medic（队医） | Portal 专岗 |

> 所有账号首登可能触发「初始密码修改」弹窗；测试环境可选择不改（点取消）。

**curl 取 token 的快捷方式**（后续命令中用 `$T` 代表）：

```bash
# super 的 token
T=$(curl -s -X POST http://localhost:8080/login -H "Content-Type: application/json" \
  -d '{"username":"super","password":"admin123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
```

---

## 2. 快速冒烟清单（P0，约 15 分钟）

| # | 操作 | 预期 | 结果 |
|---|---|---|---|
| S1 | admin 登录 | 左侧菜单**全部可见**（含菜单管理、系统监控、系统工具） | ☐ |
| S2 | super 登录 | 左侧仅「首页 / 系统管理 / APMS」；**无菜单管理、系统监控、系统工具** | ☐ |
| S3 | super → 系统管理 → 用户管理 | 列表 4 行：super、coach.zhang、tester.li、medic.wang；**无 admin/ry**；super 行开关灰、无删除按钮 | ☐ |
| S4 | super → 角色管理 | 4 行：business_admin（带「系统内置（只读）」标签、无操作按钮）+ 3 个 portal 行 | ☐ |
| S5 | super 打开教练角色修改 | Portal 开关开；落地页 `/apms/dashboard`；落地页下拉恰 6 项；菜单树父菜单半选。看完**取消** | ☐ |
| S6 | coach.zhang 登录 | 直达 `/apms/dashboard`；**无侧栏、无标签页**；顶部为品牌 Logo+品牌名+个人头像菜单；页面内无新增/编辑/删除按钮 | ☐ |
| S7 | 教练状态下地址栏输入 `/system/user` 回车 | 被弹回 `/apms/dashboard` | ☐ |
| S8 | tester.li 登录 | 直达 `/apms/testTask`，无侧栏 | ☐ |
| S9 | medic.wang 登录 | 直达 `/apms/medical`，无侧栏 | ☐ |
| S10 | 双窗口：B 窗 super 停用教练（用户行状态开关）；A 窗教练点任意操作 | A 窗弹「登录状态已过期，请重新登录」→ 跳登录页。测完 super **重新启用**教练 | ☐ |

S1–S10 全过即核心链路无回归。

---

## 3. 完整回归清单

### 3.1 admin 平台保留账号回归（约 5 分钟）

| # | 操作 | 预期 |
|---|---|---|
| A1 | admin 登录，看左侧菜单 | 菜单完整：系统管理（含菜单管理）、系统监控、系统工具、APMS 等全部可见 |
| A2 | 系统管理 → 用户管理 | 可见 admin、ry、super 及全部专岗用户 |
| A3 | 系统管理 → 角色管理 | 可见全部 6 个角色（admin、business_admin、3 个 portal 等） |
| A4 | business_admin 行 | **无**「只读」标签（只读仅针对 super 视角），4 个操作按钮齐全 |
| A5 | 用户管理 → super 行 | 状态开关**可用**（非灰）；行可勾选；修改/删除/重置密码/分配角色 4 按钮齐全；打开编辑后角色下拉**可用** |
| A6 | 随便打开一个角色的修改对话框再取消 | 正常打开、正常取消 |

### 3.2 super 菜单边界（约 3 分钟）

| # | 操作 | 预期 |
|---|---|---|
| B1 | super 登录后查看左侧菜单 | 仅有：首页、系统管理、APMS |
| B2 | 展开「系统管理」 | 含：用户/角色/部门/岗位/字典/参数/通知公告/日志管理/登录页设计；**不含菜单管理** |
| B3 | 展开「日志管理」 | 含操作日志、登录日志（D5 保留） |
| B4 | 左侧与头像菜单中寻找 | 无系统监控、无系统工具（D1） |
| B5 | 展开 APMS 目录 | 13 个业务菜单全部在列 |

### 3.3 super 用户管理（约 5 分钟）

| # | 操作 | 预期 |
|---|---|---|
| C1 | 进入用户管理 | 仅 4 行：super、coach.zhang、tester.li、medic.wang；admin/ry 不出现 |
| C2 | super 本行 | 状态开关**禁用**；仅「编辑」按钮（无更多/删除） |
| C3 | 打开 super 本行编辑 | 角色选择禁用；可改昵称/手机/邮箱等；取消 |
| C4 | 点「新增」 | 角色下拉**恰 3 项：教练、测量员、队医**；为**单选**；无 admin/business_admin |
| C5 | 三个专岗用户行 | 编辑/删除/更多/状态开关齐全 |
| C6 | 取消新增 | 对话框关闭，列表仍 4 行 |

### 3.4 super 角色管理表单（约 8 分钟）

逐个点行尾「编辑」打开，核对后一律**取消**（不要提交）：

| # | 对象 | 预期 |
|---|---|---|
| D1 | business_admin | 行带「系统内置（只读）」标签，**无任何操作按钮**，无法打开编辑 |
| D2 | 教练 portal_coach | 标题「修改角色」；Portal 模式开关**开**；落地页值 `/apms/dashboard` |
| D3 | 教练 → 点开落地页下拉 | **恰 6 项**：/apms/dashboard、/apms/athlete、/apms/testResult、/apms/phv、/apms/rtp、/apms/report |
| D4 | 教练 → 菜单权限树 | APMS 目录及 6 个已授页面父节点呈**半选**态，叶级按钮（详情/查询/下载等）勾选；系统管理目录不在树中 |
| D5 | 测量员 portal_tester | Portal 开关开；落地页 `/apms/testTask`；树中含测试任务/测试结果/体态测量/PHV、指标库/测试模型库等勾选 |
| D6 | 队医 portal_medic | Portal 开关开；落地页 `/apms/medical`；树中医疗记录、RTP、报告中心等勾选 |

### 3.5 D9 提权防护——非法新增必须拒绝（约 8 分钟，curl）

用 super token 依次执行下列 4 条，全部应被拒绝（HTTP 200 包裹的业务码 `500` 也算拒绝，以 msg 为准）：

```bash
# 场景1：角色名不带 portal_ 前缀
curl -s -X POST http://localhost:8080/system/role -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" \
  -d '{"roleName":"测试角色","roleKey":"testrole","roleSort":99,"status":"0","menuIds":[2201,2200]}'
# 预期 msg：仅允许创建专岗角色（角色权限须以 portal_ 开头）
```

```bash
# 场景2：portal 角色混入系统管理菜单（100=用户管理）
curl -s -X POST http://localhost:8080/system/role -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" \
  -d '{"roleName":"测试1","roleKey":"portal_test1","roleSort":99,"status":"0","portalMode":"1","homePath":"/apms/dashboard","menuIds":[2200,2201,100]}'
# 预期 msg：包含无权委派的权限：system:user:list
```

```bash
# 场景3：勾选 super 不可下放的「生成报告」按钮（22812）
curl -s -X POST http://localhost:8080/system/role -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" \
  -d '{"roleName":"测试2","roleKey":"portal_test2","roleSort":98,"status":"0","portalMode":"1","homePath":"/apms/report","menuIds":[2200,2281,22812]}'
# 预期 msg：包含无权委派的权限：apms:report:generate
```

```bash
# 场景4：落地页菜单未包含在本角色授权内
curl -s -X POST http://localhost:8080/system/role -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" \
  -d '{"roleName":"测试3","roleKey":"portal_test3","roleSort":97,"status":"0","portalMode":"1","homePath":"/apms/report","menuIds":[2200,2201]}'
# 预期 msg：落地页无效：须为本角色已授权的菜单页面
```

收尾：回角色列表确认仍只有 **4 行**（以上均应整笔回滚、无落库）。

### 3.6 越权 API 直调抽查（约 8 分钟，curl）

用 super token 执行，逐条核对 msg（对应设计 §5.5.5）：

| # | 命令 | 预期 msg |
|---|---|---|
| E1 | `curl -s http://localhost:8080/system/user/1 -H "Authorization: Bearer $T"` | 无权操作平台保留账号 |
| E2 | `curl -s http://localhost:8080/system/role/1 -H "Authorization: Bearer $T"` | 无权操作平台保留角色 |
| E3 | `curl -s -X PUT http://localhost:8080/system/user/changeStatus -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"userId":100,"status":"1"}'` | 当前用户不能停用 |
| E4 | `curl -s -X DELETE http://localhost:8080/system/user/100 -H "Authorization: Bearer $T"` | 当前用户不能删除 |
| E5 | `curl -s -X PUT "http://localhost:8080/system/user/authRole?userId=101&roleIds=100" -H "Authorization: Bearer $T"` | 业务管理角色为内置角色，不可修改、授权或删除 |
| E6 | `curl -s -X PUT "http://localhost:8080/system/user/authRole?userId=1&roleIds=101" -H "Authorization: Bearer $T"` | 无权操作平台保留账号 |
| E7 | `curl -s "http://localhost:8080/system/user/list" -H "Authorization: Bearer $T"` | rows 仅 super/coach.zhang/tester.li/medic.wang |
| E8 | `curl -s "http://localhost:8080/system/role/list" -H "Authorization: Bearer $T"` | rows 为 business_admin + 3 portal |
| E9 | `curl -s "http://localhost:8080/system/role/optionselect" -H "Authorization: Bearer $T"` | roles 为空（business_admin/admin 不可被分配） |

### 3.7 三专岗账号回归（约 15 分钟）

#### 教练 coach.zhang（只读分析岗）

| # | 操作 | 预期 |
|---|---|---|
| P1 | 登录 | 直达 `/apms/dashboard`；无侧栏、无标签页；顶部为品牌 Logo+品牌名+头像（个人中心/修改密码/退出），无搜索/全屏/布局控件 |
| P2 | 各已授页面（运动员档案、测试结果、PHV、RTP、组合评分、报告中心） | 可打开、有数据；工具栏**无**新增/编辑/删除/计算/生成/处置等写按钮 |
| P3 | 报告中心 | 可查看、可**下载**报告；无「生成」按钮 |
| P4 | 地址栏依次输入 `/apms/testTask`、`/system/user`、`/apms/medical` | 全部被弹回 `/apms/dashboard` |
| P5 | 头像菜单 → 修改密码 / 退出 | 功能正常 |

#### 测量员 tester.li（测量执行岗）

| # | 操作 | 预期 |
|---|---|---|
| T1 | 登录 | 直达 `/apms/testTask`，无侧栏 |
| T2 | 测试任务页 | 可见「执行/报名出勤」类操作；**无新增（排期）、无删除** |
| T3 | 测试结果页 | 可「录入」「修改」成绩；无删除 |
| T4 | 体态测量、PHV | 可录入/编辑/计算；无删除 |
| T5 | 指标库、测试模型库 | 可打开只读查看（参照标准），无新增/编辑 |
| T6 | 尝试打开医疗记录、RTP、报告中心（地址栏输入） | 弹回 `/apms/testTask` |

#### 队医 medic.wang（医疗保障岗）

| # | 操作 | 预期 |
|---|---|---|
| M1 | 登录 | 直达 `/apms/medical`，无侧栏 |
| M2 | 医疗记录页 | 可新增、修改；附件可**下载**；**无删除**、无附件删除 |
| M3 | RTP 风险预警页 | 可「评估处置」、可「清除」 |
| M4 | 报告中心 | 可查看、可下载（全部类型报告）；无生成/删除 |
| M5 | 运动员档案 | 可查看（只读），无新增/编辑/离队 |
| M6 | 地址栏输入 `/apms/testTask`、`/apms/bodyMeasure` | 弹回 `/apms/medical` |

#### 写边界接口抽查（curl，可选，每岗 1 条代表即可）

403 统一 msg：`没有权限，请联系管理员授权`。

```bash
# 教练新增运动员 → 403
TC=$(curl -s -X POST http://localhost:8080/login -H "Content-Type: application/json" \
  -d '{"username":"coach.zhang","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -X POST http://localhost:8080/apms/athlete -H "Authorization: Bearer $TC" \
  -H "Content-Type: application/json" -d '{}'

# 测量员创建任务（排期权在 super）→ 403；队医删医疗记录 → 403（同上换 token 与路径）
```

### 3.8 F1–F8 强制下线回归（约 15 分钟，双窗口）

**准备**：浏览器 A 登录目标专岗账号并保持登录；浏览器 B 登录 super。每条执行后：到 A 窗点任意操作（如查询/翻页/刷新列表），预期**弹「登录状态已过期，请重新登录」并跳登录页**；随后按「恢复」列还原。

> 建议 F2/F5 用一次性账号（super 新建 `tmp.f2`/`tmp.f5`，初始密码 admin123、单角色教练），避免动主账号。

| # | B 窗操作（super） | A 窗预期 | 测后恢复 |
|---|---|---|---|
| F1 | 用户管理 → 目标用户行状态开关置「停用」 | 下次操作 401 跳登录 | 开关置回启用，A 窗验证可重新登录 |
| F2 | 用户管理 → 删除一次性账号 `tmp.f2` | 下次操作 401 | 无需恢复（账号已删） |
| F3 | 编辑目标用户，角色从 A 岗改为 B 岗（如测量员→教练） | 下次操作 401；重登后落地页变为新岗位 | 改回原角色 |
| F4 | curl：`PUT /system/user/authRole?userId=<目标>&roleIds=101`（见 3.6 取 token 方式） | 下次操作 401 | 重登即可（角色以实际为准，必要时 super 改回） |
| F5 | 角色管理 → 教练行「更多/用户」→ 给一次性账号 `tmp.f5` 分配入角色（selectAll） | 该账号下次操作 401 | 删除一次性账号 |
| F6 | 用户管理 → 目标用户行「更多 → 重置密码」 | 下次操作 401；须用重置后的新密码登录 | 告知/记录新密码 |
| F7 | 角色管理 → portal 角色行状态开关置「停用」 | 该角色**全部在线用户**下次操作 401 | 置回启用，验证可重登 |
| F8a | 编辑 portal 角色，调整菜单权限（勾上再取消一个无关项后保持原配置提交）后**实际改变一次菜单集**提交 | 持有者下次操作 401；重登拿到新菜单 | 再编辑恢复原菜单集（持有者会再次被踢，属正常） |
| F8b | 编辑 portal 角色，修改落地页（如教练改为 /apms/athlete） | 持有者下次操作 401；重登落地页改变 | 改回原落地页 |

**反向用例（必须不踢）**：

| # | 操作 | 预期 |
|---|---|---|
| N1 | 目标用户自己在「个人中心 → 修改密码」改密（需原密码） | 修改成功，**当前会话继续可用**，不被踢 |
| N2 | super 仅修改专岗用户的昵称/手机/邮箱（角色不变） | 该用户会话**不失效** |
| N3 | super 仅修改 portal 角色的名称/顺序/备注（菜单与落地页不变） | 持有者会话**不失效** |

---

## 4. 通过标准与注意事项

### 4.1 通过标准

- 冒烟 S1–S10 必须 **10/10 通过**。
- 完整回归允许的 FAIL：**0**。出现 FAIL 先记录「账号 + 步骤 + 实际提示 + 截图」，修复后对相关章节重跑。
- 结束前确认环境还原：所有角色为「正常」、主账号密码为约定值、临时账号已删除。

### 4.2 测试注意事项（避免误报）

1. **浏览器地址栏直接访问接口一定 401**：JWT 只由页面 axios 自动加在 `Authorization` 头，地址栏导航不带该头；测接口必须用 curl 或页面内操作。
2. **判断结果看响应体的 `code`/`msg`**，不要只看 HTTP 状态码：业务拒绝常以 HTTP 200 包裹 `code:500`；权限不足为 HTTP 200 包裹 `code:403`。
3. **改密接口是 JSON body**（`{"oldPassword":"...","newPassword":"..."}`），不是 query 参数。
4. F1–F8 的语义是「**下次请求时被感知**」：停在页面上不动不会立即弹提示，去 A 窗做一次操作才能验证。
5. 页面长时间 HMR / 反复打开对话框可能出现孤儿遮罩或重复表格，属前端开发态现象；硬刷新（Ctrl/Cmd+Shift+R）后再测，不计为缺陷。
6. 本系统删除用户为**软删除**（`del_flag='2'`），删除后列表不可见即正确，数据库行仍存在。

### 4.3 交付提醒

- super 为客户侧最高账号，交付后请提示客户**尽快修改初始密码**。
- admin 账号信息对客户保密，客户侧任何页面不可见。
- 菜单管理不对 super 开放：后续新增业务菜单/权限点后，需交付方用 admin 给 super 及专岗角色补授权（纳入发版 checklist）。
