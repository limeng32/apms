# 若依管理系统初始化文档

> 版本：RuoYi-Vue 3.9.2（后端 Spring Boot 4.x + 前端 Vue3 + Element Plus）
> 数据库：MySQL 8.0
> 生成日期：2026-09-12

---

## 一、环境要求

| 组件 | 版本要求 | 本机实际版本 |
|------|---------|------------|
| JDK | 17+ | OpenJDK 17.0.10 |
| Maven | 3.6+ | 3.9.6 |
| MySQL | 8.0+ | 8.0.46 |
| Redis | 3.0+ | 最新版 |
| Node.js | 16+ | 26.7.0 |
| npm | 8+ | 11.19.0 |

---

## 二、项目结构

```
apms/
├── ruoyi-admin/        # 后端启动模块（Spring Boot 入口）
├── ruoyi-common/       # 通用工具模块
├── ruoyi-framework/    # 框架核心模块（安全、数据源、Redis等）
├── ruoyi-system/       # 系统业务模块
├── ruoyi-quartz/       # 定时任务模块
├── ruoyi-generator/    # 代码生成模块
├── ruoyi-ui/           # 前端项目（Vue3 + Vite + Element Plus）
├── sql/                # 数据库脚本
│   ├── ry_20260417.sql # 主库脚本
│   └── quartz.sql      # 定时任务表脚本
└── pom.xml             # Maven 父工程
```

---

## 三、MySQL 数据库初始化

### 3.1 安装 MySQL 8.0

```bash
brew install mysql@8.0
brew services start mysql@8.0
```

### 3.2 设置 root 密码并创建数据库

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY '!#111111qQ';
CREATE DATABASE IF NOT EXISTS `ry-vue` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 3.3 导入数据脚本

```bash
# 导入主库脚本
mysql -uroot -p'!#111111qQ' ry-vue < sql/ry_20260417.sql

# 导入定时任务表
mysql -uroot -p'!#111111qQ' ry-vue < sql/quartz.sql
```

> 导入完成后，数据库共 **31 张表**。

---

## 四、Redis 启动

```bash
# 方式一：brew 服务（需权限）
brew services start redis

# 方式二：直接后台启动
redis-server --daemonize yes

# 验证
redis-cli ping   # 返回 PONG
```

---

## 五、后端配置与启动

### 5.1 数据源配置

文件：`ruoyi-admin/src/main/resources/application-druid.yml`

```yaml
spring:
    datasource:
        druid:
            master:
                url: jdbc:mysql://localhost:3306/ry-vue?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&serverTimezone=GMT%2B8
                username: root
                password: "!#111111qQ"
```

### 5.2 文件上传路径

文件：`ruoyi-admin/src/main/resources/application.yml`

```yaml
ruoyi:
  profile: /Users/limeng/Documents/trae_projects/apms/uploadPath
```

### 5.3 日志路径

文件：`ruoyi-admin/src/main/resources/logback.xml`

```xml
<property name="log.path" value="/Users/limeng/Documents/trae_projects/apms/logs" />
```

### 5.4 Redis 配置（默认无密码）

文件：`ruoyi-admin/src/main/resources/application.yml`

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      database: 0
      password:
```

### 5.5 构建与启动

```bash
# 完整构建（首次）
mvn clean install -DskipTests

# 启动后端
java -jar ruoyi-admin/target/ruoyi-admin.jar
```

> 启动成功标志：控制台出现 `若依启动成功` 字样，端口 **8080**。

---

## 六、前端配置与启动

### 6.1 API 代理配置

文件：`ruoyi-ui/vite.config.js`

```javascript
const baseUrl = 'http://localhost:8080'  // 后端接口地址

server: {
  port: 80,
  proxy: {
    '/dev-api': {
      target: baseUrl,
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/dev-api/, '')
    }
  }
}
```

### 6.2 安装依赖与启动

```bash
cd ruoyi-ui
npm install
npm run dev
```

> 启动成功标志：控制台输出 `Local: http://localhost:80/`。

---

## 七、访问与登录

| 项目 | 值 |
|------|-----|
| 前端地址 | http://localhost:80 |
| 后端地址 | http://localhost:8080 |
| 登录账号 | `admin` |
| 登录密码 | `admin123` |
| Druid 监控 | http://localhost:8080/druid （账号 ruoyi / 密码 123456） |
| Swagger 文档 | http://localhost:8080/swagger-ui.html |

---

## 八、常用命令速查

```bash
# 后端热启动（开发时）
mvn spring-boot:run -pl ruoyi-admin

# 后端重新打包
mvn package -pl ruoyi-admin -DskipTests

# 前端构建生产包
cd ruoyi-ui && npm run build:prod

# 停止后端
kill $(lsof -t -i:8080)

# 停止前端
kill $(lsof -t -i:80)

# 停止 Redis
redis-cli shutdown
```

---

## 九、常见问题

### Q1：后端启动报 `FileNotFoundException: /home/ruoyi/logs/...`
A：日志路径硬编码为 Linux 路径，需修改 `logback.xml` 中的 `log.path` 为本机可写路径（见 5.3）。

### Q2：前端端口 80 被占用
A：修改 `ruoyi-ui/vite.config.js` 中 `server.port` 为其他端口（如 8081）。

### Q3：数据库密码含特殊字符连接失败
A：在 YAML 中用双引号包裹密码，如 `password: "!#111111qQ"`。

### Q4：`mvn spring-boot:run` 报找不到主类
A：不要在父工程直接运行，先 `mvn install` 后用 `java -jar` 启动，或进入 `ruoyi-admin` 目录运行。

### Q5：验证码不显示
A：检查 Redis 是否已启动（若依验证码存 Redis）。
