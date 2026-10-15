# 登录方式收敛 + 分角色手机号管理 实施计划

## 需求（用户已逐项确认）

1. 登录页默认**只显示短信登录**；连续点击主 Logo 6 次（后门）才显示账号/密码登录。
2. 新增开关「是否允许 admin 通过密码登录」（sys_config 热开关，默认 true）；后门调出后**所有有密码账号**都能密码登录，仅 admin 账号受此开关约束（关闭时 admin 即使调出后门也不能密码登录）。
3. **新建用户可只绑手机号、不配密码**：admin、super 新建时均可「免短信验证码」直接绑定手机号；系统生成随机密码，账号仅能短信登录（密码不可知、不回显）。
4. **改号/绑号分角色**：
   - **admin**（平台内置 userId=1）：可给任意用户**免验证码**绑定新手机号、免验证码解绑。
   - **super**（userId=100/roleId=200/role_key=super）：可给**本部门数据范围内、角色为 portal_* 专岗**的用户绑定新手机号（**必须该手机号短信验证码**），并可对同范围用户**免验证码解绑**。
5. 本人自助绑定（个人中心）维持现状：必须短信验证码。

## Repository Research（现状）

- 登录页 [login.vue](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/views/login.vue)：tab 由后端 `smsEnabled` 控制，有账号/短信两个表单；主 Logo 在 LoginRenderer 内。
- 密码登录 [SysLoginService.login()](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-framework/src/main/java/com/ruoyi/framework/web/service/SysLoginService.java#L77)；IP 黑名单 `checkLoginIp` 已有；无「按账号关密码登录」逻辑。
- 开关范式：[SysConfigServiceImpl.selectSmsLoginEnabled()](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-system/src/main/java/com/ruoyi/system/service/impl/SysConfigServiceImpl.java)（fail-closed、缺省 false）。
- 新建用户 [SysUserController.add()](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/SysUserController.java#L133) → `insertUser`（必传 password，BCrypt 加密）；用户表单在 system/user/index.vue，密码必填规则 + phonenumber 仅校验格式。
- 手机号绑定表 `apms_user_phone`；现有接口在 [UserPhoneController](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-admin/src/main/java/com/ruoyi/web/controller/system/UserPhoneController.java)：本人 bind（要码）/unbind；管理员仅 **list + 强制 unbind**，**没有管理员代绑接口**。
- 校验能力：`ManagedBoundary.assertUserManageable`、`userService.checkUserDataScope`、`DelegationConstants.isPortalRole(roleKey)`、`SecurityUtils.isAdmin(userId)`。
- 短信验证码服务 `SmsCodeService.verifyForBind(phone, code)`（消费 bind 码）；行锁绑定 `ApmsUserPhoneServiceImpl.bindPhone(userId, phone, operator)`（账号内 ≤3、uk(user_id,phone)）。
- 角色：admin=userId1/role1（isAdmin 全放行）；super=userId100/role200/role_key=super（data_scope=1，非 isAdmin，靠实际授权）。

## Files and Modules

### 后端
- `ruoyi-system/.../service/ISysConfigService.java` + `impl/SysConfigServiceImpl.java`：新增 `selectAdminPasswordLoginEnabled()`（key=`sys.login.adminPasswordEnabled`，**缺省 true**，即默认允许）。
- `ruoyi-framework/.../web/service/SysLoginService.java`：密码认证成功后、签发 token 前，按 **userId=1L**（不是 userName）判断：`loginUser.getUserId().equals(1L) && !configService.selectAdminPasswordLoginEnabled()` → 抛 `ServiceException("管理员密码登录已关闭")`。即使管理员用户名被改、或将来出现同名 admin 普通账号，身份判断也不会错。
- `ruoyi-common/.../model/`：新增 `AdminBindPhoneBody`（userId、phonenumber，无 code）。
- `ruoyi-admin/.../common/SmsController.java` 或 `UserPhoneController`：新增管理员发码/免码绑定接口。
- `UserPhoneController.java`：
  - 新增 `POST /system/user/phone/bind`（管理员代绑）：admin 免码；super 必须带一次性 bind 验证码 + 校验目标用户在数据范围内且为 portal 角色。
  - super 绑定前需发码：复用 `POST /sms/code scene=bind`，但 super 给他人绑号时发码要带 **targetUserId**，场景校验改为"目标用户数据范围内 + portal + 号码未与目标账号重复"。
- `ruoyi-framework/.../sms/SmsCodeService.java`：
  - 新增 `sendCodeForAdminBind(adminUserId, targetUserId, phone, ip, sliderUuid)`（仅 super 走，逻辑同 bind 但目标用户由管理员指定）。
  - `verifyForAdminBind(adminUserId, targetUserId, phone, code)`：消费码后校验授权。
  - admin 免码路径不经验证码。
- 新增授权判定组件方法（建议放 `ManagedBoundary`）：
  - `canManagePhone(userId, op)`：isPlatformAdmin → 全允许；否则需 `system:user:edit` + 数据范围内 + 目标用户含 portal_* 角色；返回 boolean 或抛异常。
  - 复用 `userService.checkUserDataScope` + 查用户角色集（roleService.selectRolesByUserId）。
- `ruoyi-admin/.../system/SysUserController.add()` + `SysUserServiceImpl.insertUser()`：
  - **硬性校验：登录密码与登录手机号至少提供一项，否则拒绝新建**（防止生成"随机密码 + 无绑定手机号"的无法登录账号）。
    - 两者都不填 → 抛 `ServiceException("请至少设置登录密码或登录手机号其中一项")`（前端同步拦截，后端为最终闸）。
  - 密码为空但提供了手机号：生成 32 位随机强密码（SecureRandom，BCrypt 入库，明文不返回/不记录），账号初始只能短信登录。
  - 密码非空：按现有密码规则加密入库（可同时再绑手机号）。
  - 说明：随机密码只保证初始无已知密码，**不代表永久禁用密码登录**——日后管理员"重置密码"后该账号仍可经后门密码登录，与"所有有密码账号可走后门"一致，无需额外标记字段。
  - 支持 body 携带 `loginPhonenumber`（首期 1 个）：在同一事务插入 `apms_user_phone` 绑定（admin/super 新建均免码，号码归属由建号管理员负责录入）。
- 新增权限点：管理员代绑手机号 `system:user:phonebind`（super、admin 授予；admin 隐式全有）。

### SQL 补丁（patches/，幂等，用户本人执行）
- 新增 `sys_config`：`sys.login.adminPasswordEnabled=true`。
- role 200(super) 授予 `system:user:phonebind`（复用已有的 system:user:edit 也可，但独立权限点更清晰——**采用复用 system:user:edit，不新增权限点**，减少菜单/权限面；绑定接口用 @PreAuthorize('system:user:edit') + 业务三闸）。
  - 结论：**不新增菜单/权限点**，super 已有 system:user:edit（2453 补丁刚授予 1002）。
- 无表结构变更（apms_user_phone 已支持）。

### 前端
- `views/login/login.vue` + `SmsLoginForm.vue`/`LoginFormFields.vue`：
  - 默认只渲染短信 tab；账号表单隐藏。
  - 在 LoginRenderer 主 Logo 上包点击计数：6 次（约 1.5s 窗口内连续）后显示账号 tab，并给一次性提示。状态仅内存，刷新恢复隐藏。
- `views/system/user/index.vue` 新增/编辑表单：
  - 密码字段改为**可选**（去掉必填规则），旁边提示"留空则生成随机密码，用户仅可短信登录"。
  - 新增「登录手机号」输入（新建时可选，11 位校验；admin/super 均直接填、免码）。
  - 编辑用户弹窗/行操作：admin 与 super 看到「绑定手机号」入口按权限区分 UI：
    - admin：直接输入号码即可绑定（无验证码框）。
    - super：弹窗内号码 + 验证码（复用 SliderCaptcha 发码）+ 绑定；目标限 portal 用户（非 portal 不显示该入口）。
  - 解绑按钮：admin 对任意、super 对数据范围内 portal 用户可见。
- API `api/apms/userPhone.js`：新增 `adminBindPhone`、（super 走 sendSmsCode bind + adminBind 带 code）。
- 用户管理管理员弹窗 UserPhoneAdminDialog.vue 已存在（查看/强制解绑），扩展「绑定新手机号」按钮，按当前角色渲染免码/要码两种表单。

## Implementation Steps

1. 后端开关 `selectAdminPasswordLoginEnabled` + 密码登录拦截 admin（默认放行，关闭才拦）。
2. 后端手机号管理授权判定（ManagedBoundary 增加 portal+数据范围判定）。
3. 管理员代绑接口：免码(admin) / 要码(super) 两条路径；super 发码（带 targetUserId）+ 验码。
4. 新建用户：密码可空(随机密码) + 事务内绑定 loginPhonenumber（admin/super 免码）。
5. SQL 补丁：sys_config 开关（默认 true）。
6. 前端登录页后门（连点 Logo 6 次）。
7. 前端用户管理：新建表单密码可选+手机号；管理弹窗分角色绑定 UI；解绑按钮显隐。
8. 联调与构建验证（mvn package、npm build）。

## Dependencies and Considerations

- admin 密码开关默认 **true**（不改变上线当下行为，避免管理员被锁；需要时再关）。
- 后门仅是 UI 隐藏，**安全边界在后端**：短信仍是主登录、admin 密码可被开关关闭；隐藏入口不视为强安全措施。
- super 给 portal 用户绑号仍要验证码，防止 super 越权把自己控制不住的号码挂到员工账号；解绑不要码（删除操作，原号使用者可能已离场，要码会卡死）。
- admin 免码绑号是最高信任操作，全程记 `@Log` 审计（操作人/目标用户/号码）。
- 随机密码账号：BCrypt 入库，明文不返回前端、不写日志；用户若日后需密码登录须管理员"重置密码"。
- 新建时绑定号码同样要校验"目标新账号内不重复"；跨账号一号多绑仍允许（既有规则）。
- 前端菜单/权限：复用 system:user:edit，不新增权限点。

## Validation

- 登录页默认只见短信 tab；连点 Logo 6 次出现账号 tab；刷新恢复。
- 开关 true：userId=1 后门密码登录成功；置 false：userId=1 被拒（提示"管理员密码登录已关闭"），其他有密码账号仍可登录；验证改不改 userName 都只认 userId=1。
- 新建校验：密码与手机号都不填 → 前后端均拒绝；只填手机号 → 随机密码、该号可短信登录；只填密码 → 正常密码账号；两者都填 → 均可登录。
- 随机密码账号后续被管理员"重置密码"后，可经后门用新密码登录。
- admin 新建用户只填手机号：成功、随机密码、该号可短信登录。
- admin 给任意用户免码绑号/解绑成功并有审计日志。
- super 新建用户免码绑号成功；super 给本部门 portal 用户绑号必须码正确才成功；给非 portal/外部门用户绑定/解绑均被后端拒绝；解绑免码成功。
- mvn clean package、npm run build:prod 通过，0 诊断。

## Risks

- 后门被非管理员发现：仅 UI 隐藏，后端不放松，且 admin 密码可热关闭，风险可接受。
- super 越权绑号：后端 portal 角色 + 数据范围 + 验证码三重校验，不信任前端显隐。
- 免码新建号码填错：属管理员操作责任，绑定后可由管理员解绑纠正；记审计。
