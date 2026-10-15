# 手机短信登录 实施计划

## 一、需求与已确认决策

基于阿里云短信服务（签名「北京康耐特体育」、模板 `SMS_512565975`）新增「手机号 + 短信验证码」登录方式，与现有账号密码登录并列，作为登录卡片内的第二个 tab。

已与用户确认的四项决策：

1. **账号准入**：仅 `sys_user.phonenumber` 已存在且状态正常的账号可登录；未注册、已停用、已删除一律拒绝；一个手机号匹配多个活跃账号也拒绝（提示联系管理员）。**不自动开户**。
2. **防刷**：点「获取验证码」前强制通过现有拼图滑块；叠加同号 60 秒 1 条 / 每天 10 条、同 IP 每天 50 条、验证码错 5 次作废的频控。
3. **凭证存放**：AccessKeyId/Secret 走服务器 `env.conf`（chmod 600，不进 git），由部署脚本生成外部 `application.yml` 扁平属性；源码内只留空占位。签名/模板号非敏感，写在源码 yml 默认值中。
4. **演示站 aoti.apms.top**（纯前端 mock、无后端）：自动隐藏短信 tab。实现方式：tab 显示由 `GET /login/config` 返回的 `smsEnabled` 驱动（默认 false）；演示站该接口请求失败，前端静默回退默认值，天然隐藏。无需 VITE 构建开关，同一 dist 同时服务两站。

## 二、仓库调研结论

- 认证链路：`SysLoginController#login` → `SysLoginService.login`（滑块/图形验证码校验 → AuthenticationManager 走密码 → `TokenService.createToken(LoginUser)`）。短信登录不经过密码，可直接构造 `LoginUser` 后调 `createToken`；`UserDetailsServiceImpl#createLoginUser(SysUser)` 是 public 且不做密码校验，可直接复用装配权限。
- 滑块体系：`SliderCaptchaService.consumePass(uuid)` 提供一次性人机通过标记（Redis `slider_pass:`，3 分钟），发短信接口复用，无需新建人机校验。
- 开关模式：`ISysConfigService#selectSliderCaptchaEnabled()` 读 `sys_config`（key=`sys.account.sliderCaptchaEnabled`，缺省 false），短信开关仿此新增 `sys.account.smsLoginEnabled`。
- 登录页公开配置：`GET /login/config`（`ApmsLoginConfigController`，匿名 GET，已在 SecurityConfig 按方法精确放行）返回配置 map；前端 `loginThemeStore.loadConfig()` 失败静默回退内置默认（mock 不拦截该接口，演示站回退默认 → tab 隐藏）。
- 前端登录页：`login.vue` 通过 `LoginRenderer` 的 `#form` 插槽挂 `LoginFormFields`（设计器共用的纯展示组件）。tab 切换做在 `login.vue` 插槽内部，**不改 LoginFormFields / 设计器体系**。`SliderCaptcha.vue` 为常驻模态，父组件调 `open()`、监听 `@verified(uuid)`，可被「登录」与「获取验证码」两个动作复用。
- Redis：业务库 DB 1（UAT）/ DB 0（prod），与现有滑块/captcha key 同库；计数用 Spring Boot 自动配置的 `StringRedisTemplate`（INCR 需要字符串值）。
- 用户表：`sys_user.phonenumber varchar(11)` 无唯一索引、历史可能为空串/重复，查询必须带 `del_flag='0'` 且由 Service 判 0/1/多条。
- 部署：`deploy.sh`（prod Step 4.5）与 `deploy-uat.sh`（Step 5.5）都用 heredoc 生成扁平属性外部 `config/application.yml`；`env.conf` 缺敏感变量即 hard fail。两份脚本都要改。
- Java 17 / Spring Boot 4.1 / jakarta，阿里云新版 SDK `com.aliyun:dysmsapi20170525:4.6.0`（2026-07 发布，纯 HTTP 客户端，无 jakarta 冲突）。
- mock 不处理 `/login`（一键体验直接写 demo token 不走登录接口），本次**不需要任何 mock 改动**。

## 三、接口契约（前端对接依据）

1. `POST /sms/code`（匿名；`@RateLimiter` IP 60 秒 10 次兜底）
   - 入参 `{ phonenumber: "13800138000", sliderUuid: "..." }`
   - 成功 `{ code:200, msg:"操作成功" }`（不回显验证码、不回显是否注册的多余信息之外的差异文案——账号未关联时直接报错，不发短信）
   - 典型失败：滑块未通过 / 60 秒内重复发送 / 当日超限 / 手机号格式错 / 未关联账号 / 短信服务端错误（余额不足、频率超限等转友好文案，详情记日志）
2. `POST /login/sms`（匿名）
   - 入参 `{ phonenumber, code }`
   - 成功 `{ code:200, token:"..." }`，后续 `getInfo`/`getRouters` 与密码登录完全同链路
   - 失败：验证码错误（含剩余次数）、验证码过期、账号停用/删除/多账号冲突

## 四、改动文件清单

### 后端（Java）

- `pom.xml`（root）：`<properties>` 加 `aliyun.sms.version=4.6.0`；dependencyManagement 加 `com.aliyun:dysmsapi20170525`。
- `ruoyi-framework/pom.xml`：引入该依赖（发送器与登录服务都在 framework）。
- `ruoyi-admin/src/main/resources/application.yml`：新增
  ```yaml
  apms:
    sms:
      access-key-id: ""        # 仅允许外部 env.conf 注入，仓库保持空
      access-key-secret: ""
      sign-name: 北京康耐特体育
      template-code: SMS_512565975
      endpoint: dysmsapi.aliyuncs.com
      code-param: code         # 模板变量名，若控制台模板变量不同只改这里
  ```
- `ruoyi-common/.../constant/CacheConstants.java`：新增 5 个 key 前缀
  `sms:code:` / `sms:err:` / `sms:ttl:` / `sms:day:` / `sms:ipday:`。
- `ruoyi-common/.../core/domain/model/SmsSendBody.java`（新建）：phonenumber、sliderUuid。
- `ruoyi-common/.../core/domain/model/SmsLoginBody.java`（新建）：phonenumber、code。
- `ruoyi-system`：
  - `SysUserMapper.java` + `resources/mapper/system/SysUserMapper.xml`：`List<SysUser> selectUsersByPhoneNumber(String phonenumber)`（`where u.phonenumber=#{phonenumber} and u.phonenumber <> '' and u.del_flag='0'`）。
  - `ISysUserService` / `SysUserServiceImpl`：同名方法。
  - `ISysConfigService` / `SysConfigServiceImpl`：`selectSmsEnabled()`（key `sys.account.smsLoginEnabled`，缺省 false）。
- `ruoyi-framework/.../sms/SmsProperties.java`（新建）：`@Component @ConfigurationProperties(prefix="apms.sms")`，字段同上 yml。
- `ruoyi-framework/.../sms/AliyunSmsSender.java`（新建）：
  - Client 懒初始化（AK 为空时不初始化，发送抛「短信登录未配置」）；
  - `send(phone, code)`：TemplateParam 用 fastjson2 拼 `{"code":"xxxxxx"}`；判 `SendSmsResponse.body.code == "OK"`；
  - 错误码翻译：`isv.BUSINESS_LIMIT_CONTROL`→发送频率超限、`isv.AMOUNT_NOT_ENOUGH`→短信余额不足、签名/模板类→服务配置异常（原始 Code/Message 写日志，不抛给前端）。
- `ruoyi-framework/.../sms/SmsCodeService.java`（新建）：
  - 常量：重发间隔 60s、单号日 10 条、单 IP 日 50 条、码有效期 5 分钟、校验错误上限 5 次、6 位数字码；
  - `sendCode(phone, ip, sliderUuid)`：开关→手机号正则`^1[3-9]\d{9}$`→`sliderCaptchaService.consumePass`→账号存在性（不发短信直接拒绝未关联号码）→四级频控（StringRedisTemplate：间隔 key TTL 60s；日计数 key 存活到次日 0 点）→生成码存 `sms:code:`→发送；发送异常删间隔 key（允许立即重试），日计数保留；
  - `verify(phone, inputCode)`：取码为空抛过期；不匹配则 `sms:err:` INCR，达 5 次删验证码；成功删 code+err；随后查账号并校验删除/停用/多账号，返回 `SysUser`。
- `ruoyi-framework/.../web/service/SysLoginService.java`：新增 `loginBySms(phone, code)`——调 `smsCodeService.verify` 拿 user → `AsyncFactory.recordLogininfor(phone, 成功/失败, …)` → `recordLoginInfo` → `userDetailsService.createLoginUser(user)` → `tokenService.createToken`；不触密码、不触 AuthenticationManager。
- `ruoyi-admin/.../controller/common/SmsController.java`（新建）：
  - `POST /sms/code`：`@RateLimiter(time=60,count=10,limitType=IP)`，从 `IpUtils.getIpAddr()` 取 IP，调 `smsCodeService.sendCode`；
  - `POST /login/sms`：调 `loginService.loginBySms`，回 `{token}`。
- `ruoyi-framework/.../config/SecurityConfig.java`：permitAll 增加 `/sms/code`、`/login/sms`。
- `ruoyi-admin/.../controller/apms/ApmsLoginConfigController.java`：返回 map 追加 `smsEnabled = configService.selectSmsEnabled()`（注入 ISysConfigService）。

### SQL（只写补丁，用户本人执行）

- `patches/patch-0.0.8-<时间戳>.sql`（新建）：列名形式 INSERT，避免 config_id 冲突：
  ```sql
  INSERT INTO sys_config
    (config_name, config_key, config_value, config_type, create_by, create_time, remark)
  VALUES ('账号自助-短信登录开关', 'sys.account.smsLoginEnabled', 'false', 'Y',
          'admin', sysdate(), '是否开启手机号短信登录（true开启，false关闭）；需同时在 env.conf 配置阿里云短信 AK/SK');
  ```

### 部署脚本与配置模板

- `deploy/env.conf.example`：新增 SMS 段（4 个变量：`SMS_ACCESS_KEY_ID`、`SMS_ACCESS_KEY_SECRET`、`SMS_SIGN_NAME`（默认北京康耐特体育）、`SMS_TEMPLATE_CODE`（默认 SMS_512565975）），注释说明可空但必须显式声明。
- `deploy/deploy-uat.sh`：env.conf 校验段加 4 个变量的「可空必须声明」检查（同 REDIS_PASS 模式）；Step 5.5 heredoc 追加
  `apms.sms.access-key-id` / `access-key-secret` / `sign-name` / `template-code` 四个扁平属性。
- `deploy/deploy.sh`：同上（Step 4.5 heredoc，约 637 行；校验段约 73 行）。

### 前端（ruoyi-ui）

- `src/api/login.js`：`sendSmsCode(phonenumber, sliderUuid)` → POST `/sms/code`（isToken:false）；`smsLogin(phonenumber, code)` → POST `/login/sms`。
- `src/store/modules/user.js`：新增 action `loginBySms({phonenumber, code})`，成功后与现有 login 一致 `setToken` + `unlockScreen`。
- `src/views/login/SmsLoginForm.vue`（新建）：
  - 手机号输入（Phone 图标、maxlength 11、失焦正则校验）；
  - 验证码输入 + 右侧内嵌「获取验证码」按钮：点击先 `emit('need-slider')`（滑块开启时由 login.vue 弹模态），通过后调 `sendSmsCode`，**成功后**启动 60s 倒计时；失败保持可重试（遵循历史经验：不在请求前倒计时）；
  - 登录按钮样式与 `LoginFormFields` 完全一致（复用 `--login-*` CSS 变量与 `.lf-submit` 视觉），`emit('submit')` 由 login.vue 执行登录；
  - 不渲染「一键体验」之外的多余入口；一键体验按钮在两个 tab 下都保留（放在 tab 内容区外，由 login.vue 统一放置，避免重复）。
- `src/views/login/login.vue`：
  - `#form` 插槽内顶部加 tab 切换条（账号登录 / 短信登录，文字+下划线风格），`v-if="smsEnabled"` 才渲染切换条与短信表单；`smsEnabled = loginThemeStore.config.smsEnabled === true`（loadConfig 完成后响应式更新）；
  - 滑块动作分派：pendingSliderAction = `'password' | 'smsCode'`，`onSliderVerified(uuid)` 按动作分别走 `doLogin()` 或 `sendSmsCode(uuid)`；
  - 短信登录成功复用现有 redirect/query 跳转逻辑（抽成 `afterLoginSuccess()` 共用）；
  - storage-error 阻断态优先级不变；
  - 一键体验入口从 `LoginFormFields` 内移到 tab 条下方会牵动设计器，**不动**：短信 tab 下不放一键体验，一键体验仅账号 tab 可见（演示站短信 tab 隐藏，无损失）。
- 不改：`LoginFormFields.vue`、设计器、mock 任何文件。

### 版本

- `pom.xml` 的 `apms.version` 迭代为 `0.0.8-<实现时时间戳>`（定版时用户再去时间戳）。

## 五、实施顺序（依赖序）

1. root/framework pom 引入阿里云短信 SDK；`mvn dependency:tree` 确认无冲突。
2. application.yml 占位 + env.conf.example + 两份 deploy 脚本。
3. common：CacheConstants 5 个 key + 两个 Body。
4. system：手机号 Mapper/Service + 短信开关 config 方法。
5. framework：SmsProperties → AliyunSmsSender → SmsCodeService → SysLoginService.loginBySms。
6. admin：SmsController、SecurityConfig 白名单、ApmsLoginConfigController 暴露 smsEnabled。
7. SQL 补丁 + pom 版本号。
8. 前端 api → store → SmsLoginForm → login.vue 装配。
9. 全量验证。

## 六、依赖与注意事项

- 阿里云模板 `SMS_512565975` 必须为「验证码」类型且审核通过；模板变量名按 `${code}` 实现，若控制台实际变量名不同，仅改 `apms.sms.code-param`（常量/配置一处）。
- SDK Client 构造较重，用单例懒加载；AK/SK 为空时发送接口返回明确错误而不是启动失败（保证未配置环境正常启动）。
- `StringRedisTemplate` 计数 key 与 RedisCache 的 key 在同一 DB 同一前缀空间，互不冲突；日计数 key TTL 按「到次日 0 点秒数」设置。
- 短信登录成功后 `getInfo` 返回的初始密码/密码过期提醒逻辑不绕过：该链路只负责发 token，提醒仍由 getInfo + 前端既有逻辑处理（portal 四类角色豁免逻辑已在后端）。
- 登录日志 `sys_logininfor` 中用户名字段记录手机号（内部审计需要；与现有记录用户名明文的口径一致）。
- 前端倒计时基于服务端成功响应启动（历史经验：失败必须可重试，禁止乐观倒计时）。

## 七、验证

- 后端：`mvn clean package` 全量构建通过；`mvn dependency:tree | grep aliyun` 确认依赖收敛。
- 前端：`ruoyi-ui` 下 `npm run build:prod` 通过；`GetDiagnostics` 0 诊断；运行现有桩测（mock/登录相关）确保无回归。
- 联调（由用户本人执行，凭证不经手 Agent）：
  1. 用户在本地/UAT env.conf 填入真实 AK/SK，执行 SQL patch 并把 `sys.account.smsLoginEnabled` 置 true、清 Redis config 缓存（或随版本发布自动清）；
  2. 手机真机：滑块通过 → 60s 内收到短信 → 验证码登录成功进入系统；
  3. 异常路径：错码 5 次作废、过期、未关联手机号、停用账号、60s 重发、同号日上限；
  4. aoti 演示站：登录页无短信 tab（接口失败回退默认）。
- 部署：Agent 不执行部署、不执行 SQL；构建级验证最多本地 `npm run build` 与 mvn 打包。

## 八、风险与应对

- **SDK 传递依赖（tea-openapi 等）与 Spring Boot 4 冲突**：4.6.0 为 2026 年新版、纯 JDK HTTP 客户端，风险低；若 dependency:tree 发现冲突，降级 3.1.3 或退回零依赖手写阿里云 RPC V1.0 签名（HMAC-SHA1，约 150 行工具类）。
- **短信资损（接口被刷）**：强制滑块一次性标记 + 四级频控 + IP 注解限流 + sys_config 服务端熔断开关，五层防护；发送前校验账号存在性，不为无效号码花钱。
- **phonenumber 脏数据**：空串 SQL 过滤；多账号显式拒绝并提示管理员，不随机选号登录。
- **模板/签名未审核通过或变量名不符**：发送端错误码翻译会暴露为「短信服务配置异常」，日志含阿里云原始 Code/Message，便于定位；不影响密码登录主链路。
- **演示站误显示 tab**：tab 只依赖公开配置接口返回布尔，mock 站无后端必为默认 false；构建无需区分站点。
