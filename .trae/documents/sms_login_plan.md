# 手机短信登录 实施计划

## 一、需求与已确认决策

基于阿里云短信服务（签名「北京康耐特体育」、模板 `SMS_512565975`）新增「手机号 + 短信验证码」登录方式，与现有账号密码登录并列，作为登录卡片内的第二个 tab。

**一个账号最多绑定 3 个登录手机号，任一绑定号码收码均可登录该账号；一个手机号全局只能绑定一个账号**（否则一条验证码无法确定登录身份，数据库唯一约束兜底）。

已与用户确认的六项决策：

1. **账号准入**：仅绑定表中存在且账号状态正常的手机号可登录；未绑定、账号停用/已删除一律拒绝，**不自动开户**。
2. **防刷**：点「获取验证码」前强制通过现有拼图滑块；叠加同号 60 秒 1 条 / 每天 10 条（登录+绑定合计）、同 IP 每天 50 条、验证码错 5 次作废。**验证码一次性消费**：校验成功必须原子删除验证码与错误计数（Lua 完成「比较→消费」，杜绝 5 分钟内并发重放换多个 token）；阿里云发送失败时同步删除刚写入的验证码（用户收不到的码不得残留）。
3. **凭证存放**：AccessKeyId/Secret 走服务器 `env.conf`（chmod 600，不进 git），部署脚本生成外部 `application.yml` 扁平属性；源码内只留空占位。签名/模板号非敏感，写源码 yml 默认值。
4. **演示站 aoti.apms.top**（纯前端 mock、无后端）：登录页自动隐藏短信 tab——tab 显示由 `GET /login/config` 返回的 `smsEnabled` 驱动（默认 false），演示站接口失败静默回退默认。同一 dist 同时服务两站，无需构建开关。
5. **绑定入口：两边都要**。个人中心自助管理（添加必须输入新号码收到的短信验证码验证所有权，可自行解绑，满 3 个不可再加）；管理员在用户管理页可查看每个账号的绑定号码并强制解绑（管理员不可直接添加，添加只能本人收码完成）。
6. **历史数据**：新建绑定表为短信登录唯一依据；补丁把现有 `sys_user.phonenumber` 迁移为每个账号的首个绑定号；`sys_user.phonenumber` 字段保留，语义改为「联系手机号」（资料用途），现有用户管理/个人资料表单不动。
7. **安全对齐**：短信登录不得绕过密码登录已有的安全闸——`sys.login.blackIPList` IP 黑名单抽成 `checkLoginIp()` 供两种登录共用；发码接口的 `@RateLimiter` 必须显式 `limitType = LimitType.IP`（DEFAULT 模式 key 不带 IP，会变成全站合计限额）。

## 二、仓库调研结论

- 认证链路：`SysLoginController#login` → `SysLoginService.login`（验证码 → AuthenticationManager 密码校验 → `TokenService.createToken(LoginUser)`）。短信登录不经过密码，校验短信码后直接用 `UserDetailsServiceImpl#createLoginUser(SysUser)`（public、不校验密码）构造 LoginUser 再 createToken。
- 滑块体系：`SliderCaptchaService.consumePass(uuid)` 一次性人机标记（Redis `slider_pass:`，3 分钟），登录发码与绑定发码都复用。
- 开关模式：`ISysConfigService#selectSliderCaptchaEnabled()` 读 `sys_config`（缺省 false），短信开关仿此新增 `sys.account.smsLoginEnabled`。
- 公开配置：`GET /login/config`（匿名 GET 已放行）返回配置 map，前端 `loginThemeStore.loadConfig()` 失败静默回退默认（mock 不拦该接口 → 演示站 tab 隐藏）。
- 前端登录页：`login.vue` 经 `LoginRenderer#form` 插槽挂 `LoginFormFields`（设计器共用纯展示组件）。tab 做在插槽内，**不改设计器体系**；`SliderCaptcha.vue` 模态由父组件 open + @verified(uuid)，可被「密码登录」「登录发码」「绑定发码」三动作复用（父级用 pendingAction 分派）。
- 个人中心：`views/system/user/profile/index.vue` 左信息卡 + 右侧 `el-tabs`（基本资料 userInfo / 修改密码 resetPwd），新增第三个 tab 即可；后端 `SysProfileController` 挂 `/system/user/profile`。
- 用户管理：`views/system/user/index.vue` 花名册风，行操作下拉已有编辑/重置密码/删除等项，追加「登录手机号」项；权限复用 `system:user:list`（查看）/ `system:user:edit`（强制解绑），**不新增菜单与权限项**。
- Redis：业务库 DB 1(UAT)/0(prod)；计数用 Spring Boot 自动配置的 `StringRedisTemplate`。
- 部署：`deploy.sh` Step 4.5、`deploy-uat.sh` Step 5.5 均以 heredoc 生成扁平属性外部 yml；env.conf 缺变量 hard fail。
- Java 17 / Spring Boot 4.1 / jakarta；阿里云 SDK `com.aliyun:dysmsapi20170525:4.6.0`（2026-07，纯 HTTP 客户端，无 jakarta 冲突）。
- mock 不处理 `/login`；个人中心 profile 已有只读 mock。新增只读 GET 需补 mock（见 4.5），写操作由现有引擎 601 统一拦截。

## 三、接口契约

匿名：
1. `POST /sms/code`（@RateLimiter IP 60s/10 次兜底）
   - 入参 `{ phonenumber, scene, sliderUuid }`，scene = `login` | `bind`
   - login：号码无绑定记录 → 拒绝且不发码；bind：必须登录态调用；号码已被任何账号绑定 → 拒绝；当前用户已绑 3 个 → 拒绝
   - 成功 `{code:200}`；失败含滑块/频控/格式/服务端错误友好文案
2. `POST /login/sms`（匿名）：`{ phonenumber, code }` → 成功 `{code:200, token}`，后续 getInfo/getRouters 同密码链路

登录态·个人中心（`/system/user/profile/phone`）：
3. `GET /list`：我的绑定列表 `[{id, phonenumber, createTime}]` + 上限提示
4. `POST /bind`：`{ phonenumber, code }`（code 为 bind 场景短信码）→ 成功返回新列表
5. `DELETE /unbind/{id}`：仅能删本人的绑定

登录态·管理员（`/system/user/phone`，复用 system:user:list / system:user:edit）：
6. `GET /list/{userId}`：指定账号绑定列表
7. `DELETE /unbind/{id}`：强制解绑任意账号

## 四、改动文件清单

### 4.1 后端 - 依赖与配置

- `pom.xml`：properties 加 `aliyun.sms.version=4.6.0`，dependencyManagement 加 `com.aliyun:dysmsapi20170525`。
- `ruoyi-framework/pom.xml`：引入该依赖。
- `ruoyi-admin/src/main/resources/application.yml`：新增
  ```yaml
  apms:
    sms:
      access-key-id: ""        # 仅外部 env.conf 注入
      access-key-secret: ""
      sign-name: 北京康耐特体育
      template-code: SMS_512565975
      endpoint: dysmsapi.aliyuncs.com
      code-param: code         # 模板变量名，控制台不一致只改这里
  ```
- `deploy/env.conf.example`：新增 SMS 段 `SMS_ACCESS_KEY_ID` / `SMS_ACCESS_KEY_SECRET` / `SMS_SIGN_NAME` / `SMS_TEMPLATE_CODE`（可空必须显式声明）。
- `deploy/deploy.sh`（校验段约 L73、Step 4.5 heredoc 约 L637）与 `deploy/deploy-uat.sh`（校验段约 L91、Step 5.5 约 L536）：加变量校验 + 生成 4 个 `apms.sms.*` 扁平属性。

### 4.2 后端 - common

- `constant/CacheConstants.java`：新增
  `SMS_CODE_KEY="sms:code:"`、`SMS_ERR_KEY="sms:err:"`、`SMS_TTL_KEY="sms:ttl:"`、`SMS_DAY_KEY="sms:day:"`、`SMS_IPDAY_KEY="sms:ipday:"`（key 内带 scene/phone/日期维度）。
- 新建 `core/domain/model/SmsSendBody`：phonenumber、scene、sliderUuid。
- 新建 `core/domain/model/SmsLoginBody`：phonenumber、code。

### 4.3 后端 - system（绑定关系 + 开关）

- 新建 `domain/apms/ApmsUserPhone.java`：id、userId、phonenumber + 审计字段。
- 新建 `mapper/apms/ApmsUserPhoneMapper.java` + `resources/mapper/apms/ApmsUserPhoneMapper.xml`：
  `selectByUserId`、`selectByPhone`、`countByUserId`、`insertApmsUserPhone`、`deleteApmsUserPhoneById`。
- 新建 `service/apms/IApmsUserPhoneService.java` + `impl/ApmsUserPhoneServiceImpl.java`。
- `ISysConfigService` / `SysConfigServiceImpl`：`selectSmsEnabled()`（key `sys.account.smsLoginEnabled`，缺省 false）。

### 4.4 后端 - framework / admin

- `framework/sms/SmsProperties.java`（新建）：`@Component @ConfigurationProperties(prefix="apms.sms")`。
- `framework/sms/AliyunSmsSender.java`（新建）：Client 单例懒加载（AK 空不初始化，发送报「短信登录未配置」）；`send(phone, code)` 用 fastjson2 拼 `{"code":"..."}`；`isv.BUSINESS_LIMIT_CONTROL`→频率超限、`isv.AMOUNT_NOT_ENOUGH`→余额不足、其余→服务配置异常（原始 Code/Message 仅日志）。
- `framework/sms/SmsCodeService.java`（新建）：
  - 常量：间隔 60s、单号日 10 条、单 IP 日 50 条、码 5 分钟、错 5 次、6 位数字；
  - 验证码生成：静态单例 `java.security.SecureRandom`（禁止 ThreadLocalRandom/Math.random），`100000 + secureRandom.nextInt(900000)`；
  - `sendCode(phone, scene, ip, sliderUuid)`：开关 → 正则`^1[3-9]\d{9}$` → consumePass → 场景校验（login：绑定存在；bind：号码未被占 + userId 绑定数<3）→ 频控四查（StringRedisTemplate，日 key TTL 至次日 0 点）→ **Lua 脚本 A 写码（SET code EX 300 + DEL err，一次往返，发新码即清零旧错误计数）** → 调阿里云发送；**发送异常时删除 code/err/ttl 三个 key**（用户收不到的码不得残留；日计数保留计费），异常照常抛出；
  - **校验消费用 Lua 脚本 B 原子完成（StringRedisTemplate + DefaultRedisScript）**，杜绝并发两次都校验成功：
    ```lua
    -- KEYS[1]=codeKey  KEYS[2]=errKey   ARGV[1]=input  ARGV[2]=maxErr  ARGV[3]=errTtlSec
    local stored = redis.call('GET', KEYS[1])
    if stored == false then return -1 end          -- 无码：过期/未发送/已消费
    if stored == ARGV[1] then
      redis.call('DEL', KEYS[1], KEYS[2])          -- 成功：一次性消费，码与错误计数同删
      return 0
    end
    local n = redis.call('INCR', KEYS[2])          -- 失败：原子 INCR
    redis.call('EXPIRE', KEYS[2], ARGV[3])
    if n >= tonumber(ARGV[2]) then
      redis.call('DEL', KEYS[1])                   -- 第 5 次错误：验证码当场作废
    end
    return n                                       -- 返回第几次错误（供剩余次数提示）
    ```
    返回约定：`0` 成功 / `-1` 无码（过期/已使用）/ `n>=5` 已作废 / `1..4` 错误（提示剩余 `5-n` 次）。Service 层映射为三种 ServiceException；
  - `verifyForLogin(phone, input)`：脚本 B → 成功后绑定表查 userId → 查 SysUser 并校验删除/停用 → 返回 SysUser；
  - `verifyForBind(userId, phone, input)`：脚本 B → 成功后再验号码未被占 + 绑定数<3（防止发码后被并发抢占），由绑定服务落库。
- `framework/web/service/SysLoginService.java`：
  - 新增 `checkLoginIp()`：把现有 `loginPreCheck()` 末尾的 `sys.login.blackIPList` 校验（含 AsyncFactory 失败日志 + BlackListException）原样抽出；`loginPreCheck()` 改为调用它，**密码登录行为零变化**；
  - 新增 `loginBySms(phone, code)`：先 `checkLoginIp()` → `smsCodeService.verifyForLogin` 拿 user → AsyncFactory 成功/失败日志（手机号）→ recordLoginInfo → createLoginUser → createToken；不触密码、不触 AuthenticationManager。
- `admin/controller/common/SmsController.java`（新建）：
  - `@RateLimiter(time = 60, count = 10, limitType = LimitType.IP)` 必须显式写全（若依 DEFAULT 模式 key 不带 IP，漏写会退化为全站合计每分钟 10 次）；
  - `POST /sms/code`（bind 场景从 SecurityUtils 取 userId，匿名场景缺失即拒）、`POST /login/sms`；
  - `/sms/code` 与 `/login/sms` 两个匿名路径都加进 SecurityConfig 白名单。
- `admin/controller/system/UserPhoneController.java`（新建）：个人中心三个 + 管理员两个接口（共 5 个，按权限/路径区分；个人中心接口从 LoginUser 取 userId 防越权）。
- `framework/config/SecurityConfig.java`：permitAll 加 `/sms/code`、`/login/sms`。
- `admin/controller/apms/ApmsLoginConfigController.java`：返回 map 追加 `smsEnabled`。

### 4.5 SQL 补丁（只写文件，用户本人执行）

`patches/patch-0.0.9-<时间戳>.sql`（新建）：
1. 建表：
   ```sql
   CREATE TABLE apms_user_phone (
     id BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
     user_id BIGINT NOT NULL COMMENT '用户ID',
     phonenumber VARCHAR(11) NOT NULL COMMENT '登录手机号',
     create_by VARCHAR(64) DEFAULT '',
     create_time DATETIME,
     update_by VARCHAR(64) DEFAULT '',
     update_time DATETIME,
     PRIMARY KEY (id),
     UNIQUE KEY uk_phonenumber (phonenumber),
     KEY idx_user_id (user_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='账号-登录手机号绑定（每账号最多3个）';
   ```
2. 迁移历史号码（仅合法号段、未删除账号；重复号码归最早账号，其余不迁移）：
   ```sql
   INSERT INTO apms_user_phone (user_id, phonenumber, create_by, create_time)
   SELECT MIN(user_id), phonenumber, 'system', NOW()
   FROM sys_user
   WHERE phonenumber REGEXP '^1[3-9][0-9]{9}$' AND phonenumber <> '' AND del_flag='0'
   GROUP BY phonenumber;
   ```
   补丁头部注释附冲突排查 SQL（`GROUP BY phonenumber HAVING COUNT(*)>1`）与每账号迁移后数量核对 SQL，供用户执行前后核对。
3. `sys_config` 插入 `sys.account.smsLoginEnabled=false`（列名形式，避免 config_id 冲突）。

### 4.6 前端 ruoyi-ui

- `src/api/login.js`：`sendSmsCode(phonenumber, scene, sliderUuid)`、`smsLogin(phonenumber, code)`。
- 新建 `src/api/apms/userPhone.js`：myList / bindPhone / unbindMine / adminList / adminUnbind。
- `src/store/modules/user.js`：action `loginBySms({phonenumber, code})`，成功后 setToken + unlockScreen。
- 新建 `views/login/SmsLoginForm.vue`：手机号 + 验证码（内嵌获取按钮）；点获取先请求滑块（emit need-slider），成功后 60s 倒计时，失败可重试；emit submit 由 login.vue 登录。视觉复用 `--login-*` 变量。
- `views/login/login.vue`：#form 插槽内加 tab 条（`v-if="smsEnabled"`，smsEnabled 读 loginThemeStore.config.smsEnabled）；滑块 pendingAction 三分派（password / loginSms / bindSms）；抽 afterLoginSuccess 共用跳转；一键体验仍只在账号 tab（LoginFormFields 不动）。
- `views/system/user/profile/index.vue`：加第三个 tab「登录手机号」；新建 `profile/UserPhonePanel.vue`：
  - 列表显示 号码/绑定时间/解绑，头部「n/3」；
  - 添加弹窗：手机号 → 获取验证码（bind 场景，先走滑块）→ 输码 → 确认绑定；满 3 个禁用添加。
- `views/system/user/index.vue`：行操作下拉加「登录手机号」（list 权限）；新建 `user/UserPhoneAdminDialog.vue`：只读号码列表 + 强制解绑（edit 权限，二次确认，说明不需验证码）。
- `src/mock/handlers/framework.js`：补两条只读 GET（我的绑定列表、管理员按用户查列表，返回演示固定数据/空数组）；写操作沿用引擎 601。
- 不改：`LoginFormFields.vue`、登录页设计器、用户新增/编辑表单与联系手机号字段。

### 4.7 版本

`pom.xml` 的 `apms.version` → `0.0.9-<实现时时间戳>`（定版再去时间戳）。

## 五、实施顺序

1. pom 依赖 + dependency:tree 收敛检查。
2. yml 占位 + env.conf.example + 两份 deploy 脚本。
3. common：常量 + 两个 Body。
4. SQL patch（建表/迁移/开关）。
5. system：绑定实体/Mapper/Service + 短信开关。
6. framework：Properties → Sender → CodeService（两场景）→ loginBySms。
7. admin：SmsController、UserPhoneController、SecurityConfig、login/config 暴露开关。
8. 前端：api/store → 登录页 tab → 个人中心面板 → 管理员弹窗 → mock 只读补充。
9. 版本 bump + 全量验证。

## 六、依赖与注意事项

- 模板必须为验证码类型且审核通过；变量按 `${code}`，不符只改 `apms.sms.code-param`。
- Client 单例懒加载，AK 为空不阻断应用启动，仅短信接口报错。
- 日计数 key 跨场景共用（同一手机每天总量 10 条）；码 key 带 scene，登录码不能用于绑定、反之亦然。
- **验证码安全（强约束）**：SecureRandom 生成；写码与清错计数、比较与消费均走 Redis Lua 单脚本原子完成；成功即一次性消费，禁止先 GET 比对再 DEL 的两步写法（并发下可重放）；阿里云发送失败必须回滚删除刚写的 code。
- **安全闸复用**：IP 黑名单必须抽公共方法，密码登录原逻辑零改动，短信登录显式调用；发码注解必须带 `limitType = LimitType.IP`（代码评审重点检查项）。
- 个人中心/管理员两个写接口均做归属与权限校验：解绑本人只认自己 userId；管理员走 `@PreAuthorize` 且操作记操作日志（@Log）。
- 管理员强制解绑不影响该账号已签发的在线 token。
- 登录日志用户名记手机号，与现有明文记录口径一致。
- 绑定/解绑不做密码再校验（已登录态 + 绑定需短信验权）；如需更高安全等级，后续可加。
- 前端倒计时仅在服务端成功后启动（历史经验）。

## 七、验证

- `mvn clean package` 通过；dependency:tree 确认 aliyun/tea 依赖无冲突。
- `npm run build:prod` 通过；GetDiagnostics 0 诊断；现有桩测全绿 + 为 SmsCodeService 补桩测（SecureRandom 码生成、Lua 返回值映射、频控分支、发送失败回滚、bind 并发抢占）。
- **安全专项验证**：
  1. 同一验证码并发两次调 `/login/sms`（curl 并发）：恰好一次成功、第二次报已失效；成功后 Redis 中 code/err 均不存在；
  2. 连续错码第 5 次后码立即作废（即使第 5 次输入的是正确码也拒绝，需重新获取）；重新获取后旧错误计数清零；
  3. 阿里云发送失败（故意配错 AK）后 Redis 无 code 残留、60s 间隔 key 也已释放可立即重试；
  4. 在 `sys.login.blackIPList` 配置当前 IP：密码登录与短信登录同时被拦；移除后均恢复；
  5. 确认 `/sms/code` 注解编译后为 `LimitType.IP`（检查源码与限流 key 实际带 IP）。
- 联调（用户本人执行，AK/SK 与真实短信不经手 Agent）：
  1. 执行 patch（先跑注释中的冲突/核对 SQL），env.conf 配 AK/SK，sys_config 开关置 true；
  2. 登录页：滑块→收码→登录；错码/过期/未绑定/停用/频控各异常路径；
  3. 个人中心：绑定第 2、3 个号码（新号收码）、第 4 个被拒、解绑、重复绑定他人号码被拒；
  4. 管理员：查看他人绑定、强制解绑；
  5. 历史号码迁移后可用原手机号直接登录；
  6. aoti 演示站：无短信 tab，个人中心新 tab 列表走 mock 不报错。
- SQL 与部署均由用户执行；Agent 最多本地 mvn 打包与 npm build。

## 八、风险与应对

- **SDK 依赖冲突**：4.6.0 风险低；冲突则降 3.1.3 或零依赖手写阿里云 RPC V1.0 签名（HMAC-SHA1）。
- **短信资损**：滑块 + 四级频控 + IP 注解限流 + 服务端开关熔断 + login 场景无绑定不发码/bind 场景已占用不发码。
- **迁移重复号码**：唯一索引 + MIN(user_id) 归并，补丁附排查/核对 SQL，执行前后可验；被跳过账号可登录后自助绑定其它号码。
- **phonenumber 脏数据**：正则+空串过滤；登录时一个 phone 唯一约束保证恰好一条绑定。
- **模板/签名异常**：错误码翻译 + 日志原始信息，不影响密码登录主链路。
- **演示站误显**：tab 只依赖公开配置布尔值，无后端必回退隐藏；个人中心新接口补只读 mock。
