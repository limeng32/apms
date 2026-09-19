#!/usr/bin/env bash
# ============================================================
# APMS 生产环境部署脚本（远程执行）
# ------------------------------------------------------------
# 用法：
#   bash deploy.sh                 # 完整部署（默认）
#   bash deploy.sh start|startup   # 只启动
#   bash deploy.sh stop|shutdown   # 只停止
#   bash deploy.sh restart         # 重启
#   bash deploy.sh deploy --skip-patch --version X.Y.Z
#
# 运行目录: /opt/apms/
#   ├── APPID              (PID 文件)
#   ├── backend/apms.jar   (后端)
#   ├── backend/uploadPath (Druid 上传路径)
#   ├── config/application.yml  (运行时配置，自动生成)
#   ├── logs/stdout.log    (启动日志)
#   ├── env.conf          (可覆盖 DB/Redis/端口)
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
        --help|-h)   sed -n '2,30p' "$0"; exit 0 ;;
        *)           err "未知参数: $1" ;;
    esac
done

# ===== 配置（从 env.conf 或硬编码 fallback）=====
if [ -f /etc/apms/env.conf ]; then
    set -a; source /etc/apms/env.conf; set +a
else
    err "生产部署要求 /etc/apms/env.conf 存在且 chmod 600，当前缺失 → 拒绝部署"
fi

# 这些变量允许 fallback（非敏感）
PROFILE="${PROFILE:-prod}"
APP_PORT="${APP_PORT:-10080}"
MGMT_PORT="${MGMT_PORT:-10081}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_DB="${REDIS_DB:-0}"
BINDIR="${BINDIR:-/opt/apms}"
# 外网验证/结尾汇总用的公网入口；env.conf 可覆盖。必须给默认值，否则 set -u 下第 574 行会 unbound
PUBLIC_HOST="${PUBLIC_HOST:-39.97.246.69}"

# 这些变量必须在 env.conf 里显式配置，缺失 → hard fail
[ -n "$DB_NAME" ] || err "env.conf 缺失 DB_NAME，拒绝部署（禁止 fallback）"
[ -n "$DB_USER" ] || err "env.conf 缺失 DB_USER，拒绝部署（禁止 fallback）"
[ -n "$DB_PASS" ] || err "env.conf 缺失 DB_PASS，拒绝部署（禁止 fallback）"
# REDIS_PASS 可以留空（表示无密码），但变量必须显式声明
[ -n "${REDIS_PASS+x}" ] || err "env.conf 缺失 REDIS_PASS（可空但必须声明），拒绝部署"

PIDFILE="$BINDIR/APPID"
UPLOAD="$BINDIR/upload"
BACKUP="$BINDIR/backup"
LOGDIR="$BINDIR/logs"
JARDIR="$BINDIR/backend"
JAR="$JARDIR/apms.jar"
FRONTIR="$BINDIR/frontend"
CONFIGDIR="$BINDIR/config"
PATCHES_UPLOAD="$UPLOAD/patches"
PATCHES_LOCAL="$BINDIR/patches"

# ⚠️ 关键：密码里可能有 !#$ 等特殊字符，必须用函数形式避免 bash 解释
mysql_cli() { mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" --password="$DB_PASS" "$DB_NAME" "$@"; }
# mysqldump 必须指定 --databases "$DB_NAME"，否则会尝试 dump 所有 DB（包括 mysql 系统库），可能权限不够失败
mysql_dump() { mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" --password="$DB_PASS" --single-transaction --no-tablespaces --triggers --databases "$DB_NAME" "$@"; }

# ===== do_stop: systemd 停止 =====
do_stop() {
    log "停止后端 (systemd service: apms-backend)..."

    # 先看 service 是否存在/运行
    if ! systemctl list-unit-files | grep -q '^apms-backend.service'; then
        warn "systemd service 不存在"
        # 兜底：按端口杀（macOS lsof / Linux ss）
        PIDS=""
        if command -v lsof >/dev/null 2>&1; then
            PIDS=$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true)
        fi
        if [ -z "$PIDS" ] && command -v ss >/dev/null 2>&1; then
            PIDS=$(ss -tlnp 2>/dev/null | grep ":${APP_PORT} " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
        fi
        if [ -n "$PIDS" ]; then
            warn "  端口 $APP_PORT 仍被占用 (PID=$PIDS)，强制 kill..."
            kill -9 $PIDS 2>/dev/null || true
        fi
        rm -f "$PIDFILE"
        return 0
    fi

    systemctl stop apms-backend 2>/dev/null
    # 等 15s 优雅退出
    for i in $(seq 1 15); do
        STATE=$(systemctl is-active apms-backend 2>/dev/null || echo "inactive")
        if [ "$STATE" = "inactive" ] || [ "$STATE" = "failed" ]; then
            rm -f "$PIDFILE"
            log "  ✅ 已停止 (state=$STATE)"
            return 0
        fi
        sleep 1
    done
    # 兜底 kill
    PIDS=$(systemctl show apms-backend.service -p MainPID --value 2>/dev/null || echo "")
    if [ -n "$PIDS" ] && [ "$PIDS" != "0" ]; then
        warn "  超时，强制 kill $PIDS"
        kill -9 "$PIDS" 2>/dev/null
        systemctl reset-failed apms-backend 2>/dev/null
    fi
    rm -f "$PIDFILE"
    log "  ✅ 已停止"
}

# ===== 找 Java 17（优先显式路径，fallback 到 PATH）=====
find_java17() {
    local -a CANDIDATES=(
        /usr/lib/jvm/java-17-openjdk/bin/java
        /usr/lib/jvm/java-17/bin/java
        /usr/lib/jvm/jre-17-openjdk/bin/java
        /opt/java/bin/java
    )
    for c in "${CANDIDATES[@]}"; do
        if [ -x "$c" ] && "$c" -version 2>&1 | grep -qE '"17\.|"21\.'; then
            echo "$c"; return 0
        fi
    done
    # fallback: PATH 里找版本 ≥17 的
    local path_java
    path_java=$(command -v java 2>/dev/null || echo "")
    if [ -n "$path_java" ] && "$path_java" -version 2>&1 | grep -qE '"(1[7-9]|2[0-9])\.'; then
        echo "$path_java"; return 0
    fi
    return 1
}

# ===== rollback: 恢复上一版产物 + 重启 =====
# 由 Step 4 在替换产物前备份到 $BKDIR（定义在部署流程里）
ROLLBACK_DIR="${ROLLBACK_DIR:-}"   # 部署流程里 Step 2 会设置 BKDIR，这里用它
rollback() {
    local FAIL_REASON="$1"
    echo ""
    warn "╔══════════════════════════════════════════════════════╗"
    warn "║  ❌ 部署失败: $FAIL_REASON"
    warn "║  🔄  自动回滚到上一版本..."
    warn "╚══════════════════════════════════════════════════════╝"
    echo ""

    # 1. 停服务
    do_stop || warn "do_stop 失败，继续回滚"

    # 2. 找备份目录（Step 2 写的）
    local LAST_BK
    LAST_BK=$(ls -dt "$BACKUP"/*/ 2>/dev/null | head -1)
    if [ -z "$LAST_BK" ] || [ ! -d "$LAST_BK" ]; then
        err "❌ 无可用备份目录，无法自动回滚！手动处理：systemctl reset-failed apms-backend"
        return 1
    fi
    log "回滚源: $LAST_BK"

    # 3. 恢复 jar
    if [ -f "$LAST_BK/apms.jar" ]; then
        cp -f "$LAST_BK/apms.jar" "$JAR"
        log "  ✅ 恢复 jar"
    else
        warn "  ⚠️  备份目录无 jar，跳过"
    fi

    # 4. 恢复 dist
    if [ -d "$LAST_BK/dist_old" ]; then
        rm -rf "$FRONTIR/dist"
        cp -a "$LAST_BK/dist_old" "$FRONTIR/dist"
        log "  ✅ 恢复 dist"
    else
        warn "  ⚠️  备份目录无 dist，跳过"
    fi

    # 5. 重启
    log "  重启 systemd..."
    systemctl reset-failed apms-backend 2>/dev/null
    systemctl start apms-backend 2>/dev/null || err "回滚后 systemctl start 失败"

    # 6. 健康检查（给回滚版本一个机会）
    local RB_OK=0
    for i in $(seq 1 30); do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${MGMT_PORT}/health" --max-time 3 2>/dev/null | grep -q "200"; then
            RB_OK=1
            break
        fi
        sleep 2
    done

    echo ""
    if [ "$RB_OK" -eq 1 ]; then
        warn "  ✅ 回滚完成，旧版本已就绪（${LAST_BK}）"
    else
        warn "  ❌ 回滚后旧版本也不健康！需要人工介入"
        warn "  日志: tail -f $LOGDIR/stdout.log"
        warn "  DB 备份还在: $LAST_BK/db.sql.gz"
    fi
    return 1   # 无论回滚成功与否，部署都是 fail
}

# ===== do_start: systemd 启动 =====
do_start() {
    JAVA_BIN=$(find_java17) || err "找不到 Java 17，请安装 /usr/lib/jvm/java-17-openjdk"
    log "Java: $JAVA_BIN ($("$JAVA_BIN" -version 2>&1 | head -1))"
    [ -f "$JAR" ] || err "jar 不存在: $JAR"

    # 写 env.conf + start-backend.sh（JAVA_BIN 用 find_java17 实测通过的路径）
    cat > "$BINDIR/env.conf" <<EOF
JAVA_BIN=$JAVA_BIN
PROFILE=$PROFILE
APP_PORT=$APP_PORT
MGMT_PORT=$MGMT_PORT
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT
REDIS_PASS=$REDIS_PASS
REDIS_DB=$REDIS_DB
EOF
    chmod 600 "$BINDIR/env.conf"
    log "env.conf 已更新 (chmod 600)"

    # 生成 start-backend.sh（systemd ExecStart 调这个）
    cat > "$BINDIR/start-backend.sh" <<'STARTSH'
#!/usr/bin/env bash
set -e
BINDIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$BINDIR/env.conf"
# JAVA_BIN 由 deploy.sh 执行 find_java17() 后写入 env.conf
# 这里必须存在，缺失说明 env.conf 不是最新的（手动重建或重跑 deploy）
[ -n "$JAVA_BIN" ] || { echo "❌ env.conf 缺失 JAVA_BIN" >&2; exit 1; }
JAR="$BINDIR/backend/apms.jar"
LOGDIR="$BINDIR/logs"
mkdir -p "$LOGDIR"
exec "$JAVA_BIN" \
  -Xms256m -Xmx512m \
  -DLOG_PATH="$LOGDIR" \
  -Druoyi.profile="$BINDIR/backend/uploadPath" \
  -jar "$JAR" \
  --spring.profiles.active=druid,"${PROFILE}" \
  --server.port="${APP_PORT}" \
  --management.server.port="${MGMT_PORT}" \
  "--spring.datasource.druid.master.url=jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&serverTimezone=GMT%2B8" \
  --spring.datasource.druid.master.username="${DB_USER}" \
  "--spring.datasource.druid.master.password=${DB_PASS}" \
  --spring.data.redis.database="${REDIS_DB}" \
  --spring.data.redis.host="${REDIS_HOST}" \
  --spring.data.redis.port="${REDIS_PORT}" \
  "--spring.data.redis.password=${REDIS_PASS}" \
  >> "$LOGDIR/stdout.log" 2>&1
STARTSH
    chmod +x "$BINDIR/start-backend.sh"
    log "start-backend.sh 已生成"

    # 同步 service 文件（唯一来源：build.sh 上传的 upload/apms-backend.service）
    local SERVICE_TARGET="/etc/systemd/system/apms-backend.service"
    if [ -f "$UPLOAD/apms-backend.service" ]; then
        cp -f "$UPLOAD/apms-backend.service" "$SERVICE_TARGET"
    else
        err "❌ 缺少 apms-backend.service（$UPLOAD/ 下未找到）"
    fi
    systemctl daemon-reload

    log "启动后端 (profile=$PROFILE, port=$APP_PORT)..."
    echo ""
    echo "=========================================="
    echo "  APMS Start (systemd)"
    echo "  service:  apms-backend"
    echo "  profile:  $PROFILE"
    echo "  port:     $APP_PORT (mgmt: $MGMT_PORT)"
    echo "=========================================="

    systemctl reset-failed apms-backend 2>/dev/null
    systemctl start apms-backend || err "systemctl start 失败"

    # 健康检查（90s）
    HEALTHY=0
    for i in $(seq 1 45); do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${MGMT_PORT}/health" 2>/dev/null || echo "000")
        if [ "$CODE" = "200" ]; then
            log "  ✅ 就绪 (第 ${i} 次轮询, health=200)"
            HEALTHY=1
            break
        fi
        # systemd 层面检查服务是否还活着（替代旧的 kill -0 $PID）
        if ! systemctl is-active --quiet apms-backend 2>/dev/null; then
            echo ""
            warn "  ❌ systemd 服务已退出!"
            warn "  日志: journalctl -u apms-backend -n 50 --no-pager"
            rollback "systemd 服务异常退出"
            exit 1
        fi
        sleep 2
    done

    if [ "$HEALTHY" -ne 1 ]; then
        echo ""
        warn "❌ 90s 内未就绪"
        warn "日志: tail -f $LOGDIR/stdout.log"
        echo ""
        rollback "健康检查超时 (MGMT_PORT=$MGMT_PORT)"
        exit 1
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

# ===== 版本号推导 =====
if [ -z "$TARGET_VERSION" ]; then
    # 从 jar 的 version.properties 读取
    if [ -f "$UPLOAD/apms.jar" ]; then
        TARGET_VERSION=$(unzip -p "$UPLOAD/apms.jar" BOOT-INF/classes/version.properties 2>/dev/null | grep '^app.version=' | cut -d= -f2 || echo "unknown")
    fi
fi
if [ -z "$TARGET_VERSION" ]; then
    TARGET_VERSION="0.0.0-$(date '+%m%d%H%M%S')"
fi
log "目标版本: ${BLUE}${TARGET_VERSION}${NC}"

echo ""
info "=========================================="
info "  APMS Deploy → ${TARGET_VERSION}"
info "=========================================="
echo ""

# ===== Step 0: 前置检查 =====
log "Step 0: 前置检查..."
command -v mysql  >/dev/null 2>&1 || err "mysql 客户端未安装"
command -v mysqldump >/dev/null 2>&1 || err "mysqldump 未安装"
command -v curl   >/dev/null 2>&1 || warn "curl 未安装，健康检查可能跳过"
command -v redis-cli >/dev/null 2>&1 || warn "redis-cli 未安装，将跳过缓存清理"
[ -f "$UPLOAD/apms.jar" ] || err "找不到 $UPLOAD/apms.jar"

mkdir -p "$JARDIR" "$FRONTIR" "$LOGDIR" "$BACKUP" "$PATCHES_LOCAL"
# uploadPath 必须存在（Druid 上传路径）
mkdir -p "$JARDIR/uploadPath"

# 读 Redis 里的已运行版本号（用于 Step 6 决定是否清缓存）
REDIS_ARGS="-h $REDIS_HOST -p $REDIS_PORT"
[ -n "$REDIS_PASS" ] && REDIS_ARGS="$REDIS_ARGS -a $REDIS_PASS"
REDIS_OLD_VERSION=""
if command -v redis-cli >/dev/null 2>&1; then
    REDIS_OLD_VERSION=$(redis-cli $REDIS_ARGS -n "$REDIS_DB" GET "apms:version" 2>/dev/null || echo "")
fi

# ===== 备份保留策略 =====
# 规则：保留"每天的第一个备份" + "最新一次备份"，其余删除。
# 仅处理形如 YYYYMMDD_HHMMSS 的备份目录（目录名即时间戳，字典序=时间序）。
# 最新备份就是本次部署的回滚点，恒在保留集合内，绝不删除。
prune_old_backups() {
    local all name d latest="" keep="" prev_date=""
    all=$(find "$BACKUP" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null \
          | grep -E '^[0-9]{8}_[0-9]{6}$' | sort || true)
    [ -z "$all" ] && return 0

    # 每天取最早一个；循环走完 latest 即最新一个
    while IFS= read -r name; do
        [ -z "$name" ] && continue
        d="${name%%_*}"
        if [ "$d" != "$prev_date" ]; then
            keep="${keep} ${name}"
            prev_date="$d"
        fi
        latest="$name"
    done <<< "$all"

    # 确保最新一个在保留集合（它可能同时是当天第一个，也可能不是）
    case " ${keep} " in
        *" ${latest} "*) ;;
        *) keep="${keep} ${latest}" ;;
    esac

    while IFS= read -r name; do
        [ -z "$name" ] && continue
        case " ${keep} " in
            *" ${name} "*) ;;
            *) rm -rf -- "$BACKUP/$name" 2>/dev/null \
                && log "  🧹 清理过期备份 ${name}" \
                || warn "  ⚠️ 无法删除过期备份 ${name}" ;;
        esac
    done <<< "$all"
}

# ===== Step 1: 停服务 =====
do_stop

# ===== Step 2: 全量备份（DB + 产物）=====
BACKUP_TS=$(date '+%Y%m%d_%H%M%S')
BKDIR="$BACKUP/$BACKUP_TS"
mkdir -p "$BKDIR"

log "Step 2: 数据库备份 → $BKDIR/db.sql.gz"
# 先写临时文件，成功且通过非空+gzip 完整性校验后再原子改名。
# 保证不变量：backup/<时间戳>/ 一旦存在，其 db.sql.gz 必然完整可解压（prune 无需再判合法性）。
DB_BACKUP_TMP="$BKDIR/db.sql.gz.tmp"
if mysql_dump 2>/dev/null | gzip > "$DB_BACKUP_TMP" \
   && [ -s "$DB_BACKUP_TMP" ] \
   && gzip -t "$DB_BACKUP_TMP"; then
    mv "$DB_BACKUP_TMP" "$BKDIR/db.sql.gz"
    log "  ✅ DB 备份完成 ($(du -h "$BKDIR/db.sql.gz" | cut -f1))"
else
    rm -rf -- "$BKDIR"
    err "❌ DB 备份失败，已清理无效备份目录，终止部署（P0 数据安全：无完整备份不允许执行 SQL patch）"
fi

log "  备份当前产物..."
[ -f "$JARDIR/apms.jar" ] && cp "$JARDIR/apms.jar" "$BKDIR/apms.jar" || true
[ -d "$FRONTIR/dist" ] && cp -a "$FRONTIR/dist" "$BKDIR/dist_old" || true

# 应用备份保留策略：本次备份已落盘（=最新），清理每天非首个且非最新的旧备份
prune_old_backups

# ===== Step 3: 应用 SQL Patches（Flyway-lite）=====
if [ "$SKIP_PATCH" -eq 1 ]; then
    warn "Step 3: 跳过 SQL patch (--skip-patch)"
else
    log "Step 3: 应用增量 SQL patches..."

    # 3a. 确保 apms_db_version 表存在（首次部署没有）
    HAS_VERSION_TABLE=$(mysql_cli -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME' AND table_name='apms_db_version';" 2>/dev/null || echo "0")
    if [ "$HAS_VERSION_TABLE" = "0" ]; then
        warn "  apms_db_version 表不存在，执行初始化..."
        if [ -f "$PATCHES_UPLOAD/000-init-version-table.sql" ]; then
            mysql_cli < "$PATCHES_UPLOAD/000-init-version-table.sql" 2>&1 | tail -3
            log "  ✅ 版本表初始化完成（基线 v0.0.1）"
        else
            # 内联兜底：直接建表 + 插入基线
            mysql_cli << 'EOSQL' 2>&1 | tail -3
CREATE TABLE IF NOT EXISTS apms_db_version (
    id BIGINT NOT NULL AUTO_INCREMENT,
    patch_name VARCHAR(128) NOT NULL,
    version VARCHAR(32) NOT NULL,
    checksum VARCHAR(64) DEFAULT NULL,
    description VARCHAR(256) DEFAULT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(64) DEFAULT 'deploy.sh',
    execution_ms INT DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_patch_name (patch_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='APMS 数据库版本';
INSERT INTO apms_db_version (patch_name, version, description)
SELECT 'init-v0.0.1', '0.0.1', '基线：存量 23 张表 + 种子数据'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM apms_db_version WHERE patch_name='init-v0.0.1');
EOSQL
            log "  ✅ 版本表兜底初始化完成"
        fi
    fi

    # 3b. 同步 patches 到本地目录
    if [ -d "$PATCHES_UPLOAD" ]; then
        cp -f "$PATCHES_UPLOAD"/*.sql "$PATCHES_LOCAL/" 2>/dev/null || true
    fi

    # 3c. 找出已应用的 patch（去重集合）
    declare -A APPLIED
    while IFS= read -r pname; do
        [ -n "$pname" ] && APPLIED["$pname"]=1
    done < <(mysql_cli -N -e "SELECT patch_name FROM apms_db_version;" 2>/dev/null)
    log "  已应用 patches: ${#APPLIED[@]} 个"

    # 3d. 逐个应用未执行的 patch
    APPLIED_COUNT=0
    if [ -d "$PATCHES_LOCAL" ]; then
        for patch in $(ls "$PATCHES_LOCAL"/*.sql 2>/dev/null | sort); do
            pname=$(basename "$patch")
            # 跳过初始化脚本（已在上面处理）
            [[ "$pname" == "000-init-version-table.sql" ]] && continue
            # 跳过已应用
            [ -n "${APPLIED[$pname]:-}" ] && continue

            # 从文件名解析版本号：patch-{version}-{timestamp}.sql
            pversion=$(echo "$pname" | sed 's/^patch-//; s/-[0-9]\{12\}\.sql$//')
            pdesc=$(head -5 "$patch" | grep -E '^-- .*变更|^-- Description|^-- 描述' | head -1 | sed 's/^-- *//' || echo "")
            checksum=$(sha256sum "$patch" | awk '{print $1}')

            log "  ▶ 应用 $pname (v$pversion)..."
            START_MS=$(($(date +%s%N)/1000000))
            PATCH_LOG=$(mktemp /tmp/apms-patch.XXXXXX.log)
            # 显式取 mysql 退出码：输出落临时文件、不经过管道，杜绝任何吞错可能
            set +e
            mysql_cli < "$patch" >"$PATCH_LOG" 2>&1
            PATCH_RC=$?
            set -e
            if [ "$PATCH_RC" -eq 0 ]; then
                END_MS=$(($(date +%s%N)/1000000))
                ELAPSED=$((END_MS - START_MS))
                mysql_cli -e "INSERT INTO apms_db_version (patch_name, version, checksum, description, applied_by, execution_ms) VALUES ('$pname', '$pversion', '$checksum', '$(echo "$pdesc" | sed "s/'//g")', 'deploy.sh', $ELAPSED);" 2>/dev/null \
                    || warn "    ⚠️ 版本记录写入失败（patch 幂等，下次部署会安全重跑）"
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
                log "    ✅ 成功 (${ELAPSED}ms)"
            else
                # 此刻处于"已停服、尚未替换 jar/dist"阶段：旧版本仍在 $JARDIR，先拉起保可用
                echo -e "${RED}    ❌ $pname 执行失败 (mysql rc=$PATCH_RC)，输出末尾：${NC}"
                tail -15 "$PATCH_LOG" | sed 's/^/      /'
                echo -e "${YELLOW}    🩺 旧产物未改动，尝试立即拉起旧版本以恢复线上服务...${NC}"
                if systemctl start apms-backend 2>/dev/null && sleep 3 && systemctl is-active --quiet apms-backend; then
                    warn "    ✅ 旧版本已重新拉起（active）；DB 备份: $BKDIR/db.sql.gz"
                else
                    warn "    ⚠️ 旧版本未能确认 active，请立即人工: systemctl status apms-backend"
                fi
                rm -f "$PATCH_LOG"
                err "🛑 SQL patch 失败 → 已中止部署（jar/dist 未替换、版本未记录）。修正 patch 后重跑即可"
            fi
            rm -f "$PATCH_LOG"
        done
    fi
    log "  ✅ SQL patches: $APPLIED_COUNT 个新 patch 已应用"
fi

# ===== Step 4: 替换产物 =====
log "Step 4: 替换产物..."
cp -f "$UPLOAD/apms.jar" "$JARDIR/apms.jar"
log "  jar: $(ls -lh "$JARDIR/apms.jar" | awk '{print $5}')"

if [ -d "$UPLOAD/dist" ]; then
    rm -rf "$FRONTIR/dist"
    cp -a "$UPLOAD/dist" "$FRONTIR/dist"
    log "  前端: $(find "$FRONTIR/dist" -type f | wc -l) files"
fi

# ===== Step 4.5: 生成外部运行时 yml =====
# 关键：用扁平属性名只覆盖叶子节点，不能用嵌套结构（会整体替换 jar 内 application-druid.yml 的 druid 配置树）
log "Step 4.5: 生成外部运行时配置..."
CONFIGDIR="$BINDIR/config"
mkdir -p "$CONFIGDIR"
cat > "$CONFIGDIR/application.yml" <<EOF
# APMS PROD 运行时配置（deploy.sh 自动生成，改 env.conf 后重跑即更新）
server.port: ${APP_PORT}
management.server.port: ${MGMT_PORT}

# 数据源 — 扁平属性只覆盖叶子，保留 jar 内 druid.yml 的连接池完整配置
spring.datasource.druid.master.url: jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=true&serverTimezone=GMT%2B8
spring.datasource.druid.master.username: ${DB_USER}
spring.datasource.druid.master.password: "${DB_PASS}"

# Redis — 同理扁平覆盖
spring.data.redis.database: ${REDIS_DB}
spring.data.redis.host: ${REDIS_HOST}
spring.data.redis.port: ${REDIS_PORT}
spring.data.redis.password: "${REDIS_PASS}"
EOF
log "  ✅ $CONFIGDIR/application.yml"

# ===== Step 5: Nginx =====
log "Step 5: 部署 Nginx..."
if [ -f "$UPLOAD/apms-nginx.conf" ]; then
    sudo cp -f "$UPLOAD/apms-nginx.conf" /etc/nginx/conf.d/apms.conf
    sudo nginx -t && sudo systemctl reload nginx
    log "  ✅ Nginx reloaded"
fi

# ===== Step 6: 清 Redis 缓存（版本驱动）=====
# 逻辑: 对比 Redis 中记录的旧版本 vs 本次部署的新版本
#       不一样 → FLUSHDB 清掉旧版本的 dict/config 缓存，写入新版本
#       一样   → 跳过（幂等，比如 --skip-patch 或纯前端迭代）
if [ "$SKIP_CACHE" -eq 1 ]; then
    warn "Step 6: 跳过 Redis 清缓存 (--skip-cache)"
elif [ "$REDIS_OLD_VERSION" != "$TARGET_VERSION" ]; then
    log "Step 6: 版本变更 → 清 Redis 缓存 (旧=${REDIS_OLD_VERSION:-<空>} → 新=$TARGET_VERSION)"
    if command -v redis-cli >/dev/null 2>&1; then
        # -n 指定 DB index，避免误清其他 DB 的数据
        if redis-cli $REDIS_ARGS -n "$REDIS_DB" FLUSHDB 2>/dev/null; then
            redis-cli $REDIS_ARGS -n "$REDIS_DB" SET "apms:version" "$TARGET_VERSION" 2>/dev/null || true
            log "  ✅ Redis DB $REDIS_DB FLUSHDB + SET apms:version=$TARGET_VERSION"
        else
            warn "  Redis FLUSHDB 失败，可能密码不对或 Redis 未启动"
        fi
    else
        warn "  redis-cli 未安装，跳过缓存清理"
    fi
else
    log "Step 6: 跳过 Redis 清缓存 (版本未变: $TARGET_VERSION)"
fi

# ===== Step 7: 启动后端 =====
do_start

# ===== Step 8: 外网验证 =====
FAIL_EXTERNAL=0
if command -v curl >/dev/null 2>&1 && [ -n "$PUBLIC_HOST" ]; then
    log "Step 8: 外网验证..."
    PUBLIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_HOST/" --max-time 10 2>/dev/null || echo "000")
    log "  http://$PUBLIC_HOST/ → HTTP $PUBLIC_CODE"
    if [ "$PUBLIC_CODE" != "200" ]; then
        warn "  ⚠️  首页非 200 (HTTP $PUBLIC_CODE)"
        FAIL_EXTERNAL=1
    fi
    API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_HOST/prod-api/captchaImage" --max-time 10 2>/dev/null || echo "000")
    log "  http://$PUBLIC_HOST/prod-api/captchaImage → HTTP $API_CODE"
    if [ "$API_CODE" != "200" ]; then
        warn "  ⚠️  API 非 200 (HTTP $API_CODE)"
        FAIL_EXTERNAL=1
    fi
fi

if [ "$FAIL_EXTERNAL" -eq 1 ]; then
    rollback "外网验证失败 (首页/API 非 200)"
    exit 1
fi

# ===== 完成 =====
echo ""
info "=========================================="
info "  ✅ 部署完成 → ${TARGET_VERSION}"
info "=========================================="
echo ""
info "  外网:    http://$PUBLIC_HOST/"
info "  API:     http://localhost:${APP_PORT}/apms/version"
info "  Health:  http://localhost:${MGMT_PORT}/health"
info "  Profile: $PROFILE"
info "  日志:    tail -f $LOGDIR/stdout.log"
info "  状态:    systemctl status apms-backend"
info "  回滚:    # 如有问题"
info "           cp $BKDIR/apms.jar $JARDIR/"
info "           systemctl restart apms-backend"
echo ""