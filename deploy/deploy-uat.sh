#!/usr/bin/env bash
# ============================================================
# APMS UAT 环境部署脚本（本机执行）
# ------------------------------------------------------------
# 用法：
#   bash deploy-uat.sh [--skip-patch] [--skip-cache] [--version X.Y.Z-TIMESTAMP]
#
# 前提：已执行 build.sh 完成打包，产物在 upload/ 目录
#
# 目录结构:
#   /opt/apms-uat/
#     ├── backend/apms.jar
#     ├── frontend/dist/
#     ├── patches/              (SQL patches，共享 repo patches/)
#     ├── backup/
#     ├── logs/
#     └── env.conf
#
# 访问: http://localhost:8088/     (nginx)
#       http://localhost:9080/apms/version
#       http://localhost:9081/health
# ============================================================
set -euo pipefail

# ===== 颜色与日志 =====
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC} $(date '+%H:%M:%S') $*"; }
info() { echo -e "${BLUE}[....]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR ]${NC} $*"; exit 1; }

# ===== 参数解析（第一个参数可能是子命令，也可能直接是 flag）=====
KNOWN_CMD="^(start|startup|stop|shutdown|restart|deploy)$"
if [ -n "${1:-}" ] && [[ "$1" =~ $KNOWN_CMD ]]; then
    CMD="$1"; shift
else
    CMD="deploy"   # 默认完整部署，第一个参数保留给 flag 循环
fi
SKIP_PATCH=0
SKIP_CACHE=0
TARGET_VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-patch) SKIP_PATCH=1; shift ;;
        --skip-cache) SKIP_CACHE=1; shift ;;
        --version) TARGET_VERSION="$2"; shift 2 ;;
        --help|-h)   sed -n '2,25p' "$0"; exit 0 ;;
        *)           err "未知参数: $1" ;;
    esac
done

# ===== 配置（本机 UAT 默认值）=====
_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$_SCRIPT_DIR/.." && pwd)"
BINDIR="${BINDIR:-$PROJECT_ROOT/.uat}"
PIDFILE="$BINDIR/APPID"
UPLOAD="$BINDIR/upload"
BACKUP="$BINDIR/backup"
LOGDIR="$BINDIR/logs"
JARDIR="$BINDIR/backend"
JAR="$JARDIR/apms.jar"
FRONTIR="$BINDIR/frontend"
CONFIGDIR="$BINDIR/config"
PATCHES_LOCAL="$BINDIR/patches"

# env.conf 覆盖
if [ -f "$BINDIR/env.conf" ]; then
    set -a; source "$BINDIR/env.conf"; set +a
fi
PROFILE="${PROFILE:-uat}"
APP_PORT="${APP_PORT:-9080}"
MGMT_PORT="${MGMT_PORT:-9081}"
NGINX_LISTEN="${NGINX_LISTEN:-80}"
DB_NAME="${DB_NAME:-apms-uat}"
REDIS_DB="${REDIS_DB:-1}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost:$NGINX_LISTEN}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-!#111111qQ}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASS:-}"

# ⚠️ 密码里可能有 !#$ 等特殊字符，必须用函数形式避免 bash 解释
mysql_cli() { mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" --password="$DB_PASS" "$DB_NAME" "$@"; }
mysql_dump() { mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" --password="$DB_PASS" --single-transaction --routines --triggers --databases "$DB_NAME" "$@"; }

# ===== do_stop: 停止后端进程 =====
do_stop() {
    log "停止后端 (PID file: $PIDFILE, port: $APP_PORT)..."

    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE" 2>/dev/null | tr -d '[:space:]')
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null && log "  已发送 SIGTERM 给 $PID"
            for i in $(seq 1 10); do
                if ! kill -0 "$PID" 2>/dev/null; then
                    rm -f "$PIDFILE"
                    log "  ✅ 进程已退出 ($PID)"
                    return 0
                fi
                sleep 1
            done
            kill -9 "$PID" 2>/dev/null
            rm -f "$PIDFILE"
            warn "  超时，已 SIGKILL $PID"
        else
            warn "  PID 文件残留，清理"
            rm -f "$PIDFILE"
        fi
    fi

    # 兜底：按端口杀
    PIDS=$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        warn "  端口 $APP_PORT 仍被占用 (PID=$PIDS)，强制 kill..."
        kill -9 $PIDS 2>/dev/null || true
        sleep 1
    fi

    if lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        err "  ❌ 端口 $APP_PORT 仍被占用"
    fi
    log "  ✅ 端口 $APP_PORT / $MGMT_PORT 已释放"
}

# ===== 找 Java 17 =====
find_java17() {
    local -a CANDIDATES=(
        /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/java
        /usr/local/opt/openjdk@17/bin/java
        /opt/homebrew/opt/openjdk@17/bin/java
        /usr/lib/jvm/java-17-openjdk/bin/java
    )
    for c in "${CANDIDATES[@]}"; do
        if [ -x "$c" ] && "$c" -version 2>&1 | grep -qE '"17\.|"21\.'; then
            echo "$c"; return 0
        fi
    done
    local path_java
    path_java=$(command -v java 2>/dev/null || echo "")
    if [ -n "$path_java" ] && "$path_java" -version 2>&1 | grep -qE '"(1[7-9]|2[0-9])\.'; then
        echo "$path_java"; return 0
    fi
    return 1
}

# ===== do_start: 启动后端进程 =====
do_start() {
    JAVA_BIN=$(find_java17) || err "找不到 Java 17"
    log "Java: $JAVA_BIN ($("$JAVA_BIN" -version 2>&1 | head -1))"
    [ -f "$JAR" ] || err "jar 不存在: $JAR"
    mkdir -p "$LOGDIR" "$(dirname "$PIDFILE")"

    if [ -f "$PIDFILE" ]; then
        OLD_PID=$(cat "$PIDFILE" 2>/dev/null | tr -d '[:space:]')
        if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
            warn "进程已在运行! PID=$OLD_PID"
            return 0
        fi
        rm -f "$PIDFILE"
    fi

    log "启动后端 (profile=$PROFILE, port=$APP_PORT)..."
    echo ""
    echo "=========================================="
    echo "  APMS UAT Start"
    echo "  jar:      $JAR"
    echo "  profile:  druid,$PROFILE"
    echo "  port:     $APP_PORT (mgmt: $MGMT_PORT)"
    echo "  config:   ${CONFIGDIR:-<jar内默认>}"
    echo "  pidfile:  $PIDFILE"
    echo "=========================================="

    local -a JAVA_OPTS=(
        -Xms128m -Xmx384m
        -DLOG_PATH="$LOGDIR"
        -Druoyi.profile="$JARDIR/uploadPath"
    )
    local -a SPRING_ARGS=(
        -jar "$JAR"
        "--spring.profiles.active=druid,$PROFILE"
        "--server.port=$APP_PORT"
        "--management.server.port=$MGMT_PORT"
        "--spring.datasource.druid.master.url=jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=false&serverTimezone=GMT%2B8"
        "--spring.datasource.druid.master.username=$DB_USER"
        "--spring.datasource.druid.master.password=$DB_PASS"
        "--spring.data.redis.database=$REDIS_DB"
        "--spring.data.redis.host=$REDIS_HOST"
        "--spring.data.redis.port=$REDIS_PORT"
    )
    [ -n "$REDIS_PASS" ] && SPRING_ARGS+=("--spring.data.redis.password=$REDIS_PASS")

    nohup "$JAVA_BIN" "${JAVA_OPTS[@]}" "${SPRING_ARGS[@]}" > "$LOGDIR/stdout.log" 2>&1 &
    PID=$!
    echo "$PID" > "$PIDFILE"
    log "  ✅ 启动 PID=$PID (写入 $PIDFILE)"

    # 健康检查（90s）
    HEALTHY=0
    for i in $(seq 1 45); do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${MGMT_PORT}/health" 2>/dev/null || echo "000")
        if [ "$CODE" = "200" ]; then
            log "  ✅ 就绪 (第 ${i} 次轮询, health=200)"
            HEALTHY=1
            break
        fi
        if ! kill -0 "$PID" 2>/dev/null; then
            rm -f "$PIDFILE"
            err "  ❌ 进程 $PID 已退出! 查看: tail -f $LOGDIR/stdout.log"
        fi
        sleep 2
    done

    if [ "$HEALTHY" -ne 1 ]; then
        warn "  ❌ 90s 内未就绪，可能还在启动中"
        warn "  日志: tail -f $LOGDIR/stdout.log"
    fi
    echo ""
}

# ===== do_restart =====
do_restart() {
    do_stop
    sleep 1
    do_start
}

# ===== 子命令 dispatch =====
case "$CMD" in
    start|startup)   do_start; exit 0 ;;
    stop|shutdown)   do_stop;  exit 0 ;;
    restart)         do_restart; exit 0 ;;
    deploy|"")       : ;;  # 走下面的完整部署流程
    *)               err "未知子命令: $CMD (可用: start|stop|restart|deploy)" ;;
esac

# ===== 版本号推导（优先从 mvn target 读，避免 upload 里是旧 jar）=====
_TARGET_JAR="$PROJECT_ROOT/ruoyi-admin/target/apms.jar"
if [ -z "$TARGET_VERSION" ] && [ -f "$_TARGET_JAR" ]; then
    TARGET_VERSION=$(unzip -p "$_TARGET_JAR" BOOT-INF/classes/version.properties 2>/dev/null | grep '^app.version=' | cut -d= -f2 || echo "")
fi
if [ -z "$TARGET_VERSION" ] && [ -f "$UPLOAD/apms.jar" ]; then
    TARGET_VERSION=$(unzip -p "$UPLOAD/apms.jar" BOOT-INF/classes/version.properties 2>/dev/null | grep '^app.version=' | cut -d= -f2 || echo "")
fi
[ -z "$TARGET_VERSION" ] && TARGET_VERSION="0.0.0-$(date '+%m%d%H%M%S')"
log "目标版本: ${BLUE}${TARGET_VERSION}${NC} (profile=$PROFILE, app=$APP_PORT, mgmt=$MGMT_PORT)"

echo ""
info "=========================================="
info "  APMS UAT Deploy → ${TARGET_VERSION}"
info "=========================================="
echo ""

# ===== Step 0: 前置检查 =====
log "Step 0: 前置检查..."
command -v java      >/dev/null 2>&1 || err "Java 未安装"
command -v mysql     >/dev/null 2>&1 || err "mysql 客户端未安装"
command -v mysqldump >/dev/null 2>&1 || err "mysqldump 未安装"
command -v curl      >/dev/null 2>&1 || warn "curl 未安装，健康检查可能跳过"
command -v redis-cli  >/dev/null 2>&1 || warn "redis-cli 未安装，将跳过缓存清理"
command -v nginx      >/dev/null 2>&1 || warn "nginx 未安装"

mkdir -p "$JARDIR" "$FRONTIR/dist" "$LOGDIR" "$BACKUP" "$PATCHES_LOCAL"
mkdir -p "$JARDIR/uploadPath"    # Druid 上传路径

# 确认 DB 可连接
mysql_cli -e "SELECT 1" >/dev/null 2>&1 || err "无法连接 MySQL $DB_HOST:$DB_PORT/$DB_NAME"
# 确认 Redis 可连接
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING >/dev/null 2>&1 || warn "Redis 连接失败"

# 读 Redis 里的已运行版本号（Redis DB 1）
REDIS_ARGS="-h $REDIS_HOST -p $REDIS_PORT"
[ -n "$REDIS_PASS" ] && REDIS_ARGS="$REDIS_ARGS -a $REDIS_PASS"
REDIS_OLD_VERSION=$(redis-cli $REDIS_ARGS -n "$REDIS_DB" GET "apms:version" 2>/dev/null || echo "")
log "  旧版本: ${REDIS_OLD_VERSION:-<空>} (Redis DB $REDIS_DB)"

# ===== Step 1: 停服务 =====
do_stop

# ===== Step 2: DB 备份 =====
BACKUP_TS=$(date '+%Y%m%d_%H%M%S')
BKDIR="$BACKUP/$BACKUP_TS"
mkdir -p "$BKDIR"

log "Step 2: 数据库备份 → $BKDIR/db.sql.gz"
if mysql_dump 2>/dev/null | gzip > "$BKDIR/db.sql.gz"; then
    log "  ✅ DB 备份完成 ($(du -h "$BKDIR/db.sql.gz" | cut -f1))"
else
    warn "  DB 备份失败，继续部署"
    rm -f "$BKDIR/db.sql.gz"
fi

# ===== Step 3: SQL Patches =====
if [ "$SKIP_PATCH" -eq 1 ]; then
    warn "Step 3: 跳过 SQL patch (--skip-patch)"
else
    log "Step 3: 应用 SQL patches..."

    # 版本表初始化（幂等）
    mysql_cli << 'EOSQL' 2>&1 | tail -3
CREATE TABLE IF NOT EXISTS apms_db_version (
    id BIGINT NOT NULL AUTO_INCREMENT,
    patch_name VARCHAR(128) NOT NULL,
    version VARCHAR(32) NOT NULL,
    checksum VARCHAR(64) DEFAULT NULL,
    description VARCHAR(256) DEFAULT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(64) DEFAULT 'deploy-uat.sh',
    execution_ms INT DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_patch_name (patch_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APMS 数据库版本';
EOSQL

    # 从 repo patches/ 同步
    REPO_PATCHES="$(dirname "$0")/../patches"
    if [ -d "$REPO_PATCHES" ]; then
        cp -f "$REPO_PATCHES"/*.sql "$PATCHES_LOCAL/" 2>/dev/null || true
    fi

    # 已应用去重（macOS bash 3.2 不支持 declare -A，用 grep 替代）
    APPLIED_LIST=$(mysql_cli -N -e "SELECT patch_name FROM apms_db_version;" 2>/dev/null || true)
    APPLIED_COUNT_TOTAL=$(echo "$APPLIED_LIST" | grep -c . 2>/dev/null || echo 0)
    log "  已应用 patches: $APPLIED_COUNT_TOTAL 个"

    # 逐个应用
    APPLIED_COUNT=0
    if [ -d "$PATCHES_LOCAL" ]; then
        for patch in $(ls "$PATCHES_LOCAL"/*.sql 2>/dev/null | sort); do
            pname=$(basename "$patch")
            [[ "$pname" == "000-init-version-table.sql" ]] && continue
            # grep -qx 整行精确匹配（已应用则跳过）
            if [ -n "$APPLIED_LIST" ] && echo "$APPLIED_LIST" | grep -qx "$pname"; then
                continue
            fi

            pversion=$(echo "$pname" | sed 's/^patch-//; s/-[0-9]\{12\}\.sql$//')
            pdesc=$(head -5 "$patch" | grep -E '^-- ' | head -1 | sed 's/^-- *//' || echo "")
            checksum=$(sha256sum "$patch" | awk '{print $1}')

            log "  ▶ $pname (v$pversion)..."
            START_MS=$(($(date +%s%N)/1000000))
            if mysql_cli < "$patch" 2>&1 | tail -5; then
                END_MS=$(($(date +%s%N)/1000000))
                mysql_cli -e "INSERT INTO apms_db_version (patch_name, version, checksum, description, applied_by, execution_ms) VALUES ('$pname', '$pversion', '$checksum', '$(echo "$pdesc" | sed "s/'//g")', 'deploy-uat.sh', $((END_MS - START_MS)));" 2>/dev/null || true
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
                log "    ✅ 成功"
            else
                warn "    ❌ $pname 执行失败（继续）"
            fi
        done
    fi
    log "  ✅ SQL patches: $APPLIED_COUNT 个新 patch 已应用"
fi

# ===== Step 4: 替换产物 =====
log "Step 4: 替换产物..."

# 自动同步 mvn target → upload（如果 target 更新）
_TARGET_JAR="$PROJECT_ROOT/ruoyi-admin/target/apms.jar"
if [ -f "$_TARGET_JAR" ]; then
    if [ ! -f "$UPLOAD/apms.jar" ] || [ "$_TARGET_JAR" -nt "$UPLOAD/apms.jar" ]; then
        mkdir -p "$UPLOAD"
        cp -f "$_TARGET_JAR" "$UPLOAD/apms.jar"
        log "  自动同步: ruoyi-admin/target/apms.jar → upload/apms.jar"
    fi
fi
[ -f "$UPLOAD/apms.jar" ] || err "找不到 apms.jar（请先 mvn clean package）"
cp -f "$UPLOAD/apms.jar" "$JARDIR/apms.jar"
log "  jar: $(ls -lh "$JARDIR/apms.jar" | awk '{print $5}')"

# 自动同步 vite dist → upload/dist（如果 dist 更新）
_VITE_DIST="$PROJECT_ROOT/ruoyi-ui/dist"
if [ -d "$_VITE_DIST" ]; then
    if [ ! -d "$UPLOAD/dist" ] || [ "$_VITE_DIST" -nt "$UPLOAD/dist" ]; then
        rm -rf "$UPLOAD/dist"
        cp -a "$_VITE_DIST" "$UPLOAD/dist"
        log "  自动同步: ruoyi-ui/dist → upload/dist"
    fi
fi

if [ -d "$UPLOAD/dist" ]; then
    rm -rf "$FRONTIR/dist"
    cp -a "$UPLOAD/dist" "$FRONTIR/dist"
    log "  前端: $(find "$FRONTIR/dist" -type f | wc -l | tr -d ' ') files"
fi

# ===== Step 5: Redis 清缓存（版本驱动）=====
if [ "$SKIP_CACHE" -eq 1 ]; then
    warn "Step 5: 跳过 Redis 清缓存 (--skip-cache)"
elif [ "$REDIS_OLD_VERSION" != "$TARGET_VERSION" ]; then
    log "Step 5: 版本变更 → Redis DB $REDIS_DB FLUSHDB"
    if redis-cli $REDIS_ARGS -n "$REDIS_DB" FLUSHDB 2>/dev/null; then
        redis-cli $REDIS_ARGS -n "$REDIS_DB" SET "apms:version" "$TARGET_VERSION" 2>/dev/null || true
        log "  ✅ Redis DB $REDIS_DB FLUSHDB + apms:version=$TARGET_VERSION"
    else
        warn "  Redis FLUSHDB 失败"
    fi
else
    log "Step 5: 跳过 Redis 清缓存 (版本未变: $TARGET_VERSION)"
fi

# ===== Step 5.5: 生成外部运行时 yml =====
# 关键：用扁平属性名只覆盖叶子节点，不能用嵌套结构（会整体替换 jar 内 druid.yml 的 druid 配置树）
log "Step 5.5: 生成外部运行时配置..."
mkdir -p "$CONFIGDIR"
cat > "$CONFIGDIR/application.yml" <<EOF
# APMS UAT 运行时配置（deploy-uat.sh 自动生成，改 env.conf 后重跑即更新）
server.port: ${APP_PORT}
management.server.port: ${MGMT_PORT}

spring.datasource.druid.master.url: jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=false&serverTimezone=GMT%2B8
spring.datasource.druid.master.username: ${DB_USER}
spring.datasource.druid.master.password: "${DB_PASS}"

spring.data.redis.database: ${REDIS_DB}
spring.data.redis.host: ${REDIS_HOST}
spring.data.redis.port: ${REDIS_PORT}
spring.data.redis.password: "${REDIS_PASS}"
EOF
log "  ✅ $CONFIGDIR/application.yml"

# ===== Step 6: 启动后端 =====
do_start

# ===== Step 7: Nginx reload =====
log "Step 7: Nginx reload..."
NGINX_BIN=$(which nginx 2>/dev/null || echo "")
if [ -n "$NGINX_BIN" ]; then
    # macOS BSD grep 不支持 -oE，用 awk 提取 --conf-path
    NGINX_CONF_DIR="$("$NGINX_BIN" -V 2>&1 | awk -F'--conf-path=' '{print $2}' | awk '{print $1}' | xargs dirname)/servers"
    if "$NGINX_BIN" -t 2>/dev/null; then
        # 如果 nginx 没启动则 start，否则 reload
        if ! pgrep nginx >/dev/null 2>&1; then
            "$NGINX_BIN" 2>/dev/null && log "  ✅ Nginx started" || warn "  Nginx start 失败"
        else
            "$NGINX_BIN" -s reload 2>/dev/null && log "  ✅ Nginx reloaded" || warn "  Nginx reload 失败"
        fi
    else
        warn "  nginx -t 失败，检查 $NGINX_CONF_DIR"
    fi
else
    warn "  nginx 未安装，跳过 reload"
fi

# ===== 完成 =====
echo ""
info "=========================================="
info "  ✅ UAT 部署完成 → ${TARGET_VERSION}"
info "=========================================="
echo ""
info "  入口:    http://${PUBLIC_HOST}/"
info "  API:     http://localhost:${APP_PORT}/apms/version"
info "  Health:  http://localhost:${MGMT_PORT}/health"
info "  Profile: $PROFILE"
info "  日志:    tail -f $LOGDIR/stdout.log"
info "  PID:     $PIDFILE ($(cat "$PIDFILE" 2>/dev/null))"
echo ""
