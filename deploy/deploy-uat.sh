#!/usr/bin/env bash
# ============================================================
# APMS UAT 环境部署脚本（本机执行）
# ------------------------------------------------------------
# 用法：
#   bash deploy-uat.sh [--build] [--skip-patch] [--skip-cache] [--version X.Y.Z-TIMESTAMP]
#
# 默认智能构建：产物缺失或源码比产物新时，自动执行 build.sh --only-build；
# --build 强制重新构建。start/stop/restart 子命令不触发构建。
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
log()  { echo -e "${GREEN}[INFO]${NC} $(date '+%H:%M:%S') ${*}"; }
info() { echo -e "${BLUE}[....]${NC} ${*}"; }
warn() { echo -e "${YELLOW}[WARN]${NC} ${*}"; }
err()  { echo -e "${RED}[ERR ]${NC} ${*}"; exit 1; }

# ===== 参数解析（第一个参数可能是子命令，也可能直接是 flag）=====
KNOWN_CMD="^(start|startup|stop|shutdown|restart|deploy)$"
if [ -n "${1:-}" ] && [[ "${1}" =~ ${KNOWN_CMD} ]]; then
    CMD="${1}"; shift
else
    CMD="deploy"   # 默认完整部署，第一个参数保留给 flag 循环
fi
SKIP_PATCH=0
SKIP_CACHE=0
FORCE_BUILD=0
TARGET_VERSION=""
while [[ ${#} -gt 0 ]]; do
    case "${1}" in
        --build)      FORCE_BUILD=1; shift ;;
        --skip-patch) SKIP_PATCH=1; shift ;;
        --skip-cache) SKIP_CACHE=1; shift ;;
        --version) TARGET_VERSION="${2}"; shift 2 ;;
        --help|-h)   sed -n '2,25p' "${0}"; exit 0 ;;
        *)           err "未知参数: ${1}" ;;
    esac
done

# ===== 配置（本机 UAT 默认值）=====
_SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"
PROJECT_ROOT="$(cd "${_SCRIPT_DIR}/.." && pwd)"
BINDIR="${BINDIR:-${PROJECT_ROOT}/.uat}"
PIDFILE="${BINDIR}/APPID"
UPLOAD="${BINDIR}/upload"
BACKUP="${BINDIR}/backup"
LOGDIR="${BINDIR}/logs"
JARDIR="${BINDIR}/backend"
JAR="${JARDIR}/apms.jar"
FRONTIR="${BINDIR}/frontend"
CONFIGDIR="${BINDIR}/config"
PATCHES_LOCAL="${BINDIR}/patches"

# env.conf 覆盖 —— 生产安全策略：缺失即 hard fail，绝不 fallback
if [ ! -f "${BINDIR}/env.conf" ]; then
    err "UAT 部署要求 ${BINDIR}/env.conf 存在且 chmod 600，当前缺失 → 拒绝部署"
fi
set -a; source "${BINDIR}/env.conf"; set +a

# 这些变量允许 fallback（非敏感）
PROFILE="${PROFILE:-uat}"
APP_PORT="${APP_PORT:-9080}"
MGMT_PORT="${MGMT_PORT:-9081}"
NGINX_LISTEN="${NGINX_LISTEN:-80}"
REDIS_DB="${REDIS_DB:-1}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost:${NGINX_LISTEN}}"

# 这些变量必须显式声明，缺失 → hard fail
[ -n "${DB_NAME}" ] || err "env.conf 缺失 DB_NAME，拒绝部署（禁止 fallback）"
[ -n "${DB_USER}" ] || err "env.conf 缺失 DB_USER，拒绝部署（禁止 fallback）"
[ -n "${DB_PASS}" ] || err "env.conf 缺失 DB_PASS，拒绝部署（禁止 fallback）"
[ -n "${REDIS_PASS+x}" ] || err "env.conf 缺失 REDIS_PASS（可空但必须声明），拒绝部署"

# ⚠️ 密码里可能有 !#$ 等特殊字符，必须用函数形式避免 bash 解释
# ${1+"${@}"} 兼容 macOS 自带 bash 3.2：set -u 下无参调用时裸 "${@}" 会报 unbound variable
mysql_cli() { mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" --password="${DB_PASS}" "${DB_NAME}" ${1+"${@}"}; }
mysql_dump() { mysqldump -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" --password="${DB_PASS}" --single-transaction --routines --triggers --databases "${DB_NAME}" ${1+"${@}"}; }

# ===== flush_redis_keep: 选择性清 Redis（发版不再踢用户）=====
# 删除目标 DB 内全部 key，但保留指定前缀的 key（RuoYi 登录态前缀 login_tokens:）。
# 依赖调用点已装配的全局 REDIS_ARGS / REDIS_DB。SCAN 快照落临时文件后分批 DEL（每批
# 500；--scan 按行输出，DEL 入参用 printf 转 NUL + xargs -0 兼容含空格的 key；
# RuoYi key 仅含冒号/字母数字/中文，不含换行），避免 KEYS/FLUSHDB 阻塞与误删。
# 输出 "<保留数> <删除数>"；SCAN 失败返回非 0，调用方按「未做任何变更」处理。
flush_redis_keep() {
    local prefix="${1}" key scan_file
    local kept=0 removed=0 i out
    local -a del_keys=()
    scan_file="$(mktemp -t apmsrediskey.XXXXXX)" || return 1
    if ! redis-cli ${REDIS_ARGS} -n "${REDIS_DB}" --scan > "${scan_file}" 2>/dev/null; then
        rm -f "${scan_file}"; return 1
    fi
    while IFS= read -r key; do
        [ -z "${key}" ] && continue
        case "${key}" in
            "${prefix}"*) kept=$((kept + 1)) ;;
            *)         del_keys+=("${key}") ;;
        esac
    done < "${scan_file}"
    rm -f "${scan_file}"
    for ((i = 0; i < ${#del_keys[@]}; i += 500)); do
        out=$(printf '%s\0' "${del_keys[@]:i:500}" \
            | xargs -0 redis-cli ${REDIS_ARGS} -n "${REDIS_DB}" DEL 2>/dev/null) || return 1
        removed=$((removed + ${out:-0}))
    done
    echo "${kept} ${removed}"
}

# ===== do_stop: 停止后端进程 =====
do_stop() {
    log "停止后端 (PID file: ${PIDFILE}, port: ${APP_PORT})..."

    if [ -f "${PIDFILE}" ]; then
        PID=$(cat "${PIDFILE}" 2>/dev/null | tr -d '[:space:]')
        if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
            kill "${PID}" 2>/dev/null && log "  已发送 SIGTERM 给 ${PID}"
            for i in $(seq 1 10); do
                if ! kill -0 "${PID}" 2>/dev/null; then
                    rm -f "${PIDFILE}"
                    log "  ✅ 进程已退出 (${PID})"
                    return 0
                fi
                sleep 1
            done
            kill -9 "${PID}" 2>/dev/null
            rm -f "${PIDFILE}"
            warn "  超时，已 SIGKILL ${PID}"
        else
            warn "  PID 文件残留，清理"
            rm -f "${PIDFILE}"
        fi
    fi

    # 兜底：按端口杀
    PIDS=$(lsof -tiTCP:"${APP_PORT}" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "${PIDS}" ]; then
        warn "  端口 ${APP_PORT} 仍被占用 (PID=${PIDS})，强制 kill..."
        kill -9 ${PIDS} 2>/dev/null || true
        sleep 1
    fi

    if lsof -tiTCP:"${APP_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
        err "  ❌ 端口 ${APP_PORT} 仍被占用"
    fi
    log "  ✅ 端口 ${APP_PORT} / ${MGMT_PORT} 已释放"
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
        if [ -x "${c}" ] && "${c}" -version 2>&1 | grep -qE '"17\.|"21\.'; then
            echo "${c}"; return 0
        fi
    done
    local path_java
    path_java=$(command -v java 2>/dev/null || echo "")
    if [ -n "${path_java}" ] && "${path_java}" -version 2>&1 | grep -qE '"(1[7-9]|2[0-9])\.'; then
        echo "${path_java}"; return 0
    fi
    return 1
}

# ===== do_start: 启动后端进程 =====
do_start() {
    JAVA_BIN=$(find_java17) || err "找不到 Java 17"
    log "Java: ${JAVA_BIN} ($("${JAVA_BIN}" -version 2>&1 | head -1))"
    [ -f "${JAR}" ] || err "jar 不存在: ${JAR}"
    mkdir -p "${LOGDIR}" "$(dirname "${PIDFILE}")"

    if [ -f "${PIDFILE}" ]; then
        OLD_PID=$(cat "${PIDFILE}" 2>/dev/null | tr -d '[:space:]')
        if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
            warn "进程已在运行! PID=${OLD_PID}"
            return 0
        fi
        rm -f "${PIDFILE}"
    fi

    log "启动后端 (profile=${PROFILE}, port=${APP_PORT})..."
    echo ""
    echo "=========================================="
    echo "  APMS UAT Start"
    echo "  jar:      ${JAR}"
    echo "  profile:  druid,${PROFILE}"
    echo "  port:     ${APP_PORT} (mgmt: ${MGMT_PORT})"
    echo "  config:   ${CONFIGDIR:-<jar内默认>}"
    echo "  pidfile:  ${PIDFILE}"
    echo "=========================================="

    local -a JAVA_OPTS=(
        -Xms128m -Xmx384m
        -DLOG_PATH="${LOGDIR}"
        -Druoyi.profile="${JARDIR}/uploadPath"
    )
    local -a SPRING_ARGS=(
        -jar "${JAR}"
        "--spring.profiles.active=druid,${PROFILE}"
        "--server.port=${APP_PORT}"
        "--management.server.port=${MGMT_PORT}"
        "--spring.datasource.druid.master.url=jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=false&serverTimezone=GMT%2B8"
        "--spring.datasource.druid.master.username=${DB_USER}"
        "--spring.datasource.druid.master.password=${DB_PASS}"
        "--spring.data.redis.database=${REDIS_DB}"
        "--spring.data.redis.host=${REDIS_HOST}"
        "--spring.data.redis.port=${REDIS_PORT}"
    )
    [ -n "${REDIS_PASS}" ] && SPRING_ARGS+=("--spring.data.redis.password=${REDIS_PASS}")

    nohup "${JAVA_BIN}" "${JAVA_OPTS[@]}" "${SPRING_ARGS[@]}" > "${LOGDIR}/stdout.log" 2>&1 &
    PID=${!}
    echo "${PID}" > "${PIDFILE}"
    log "  ✅ 启动 PID=${PID} (写入 ${PIDFILE})"

    # 健康检查（90s）
    HEALTHY=0
    for i in $(seq 1 45); do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${MGMT_PORT}/health" 2>/dev/null || echo "000")
        if [ "${CODE}" = "200" ]; then
            log "  ✅ 就绪 (第 ${i} 次轮询, health=200)"
            HEALTHY=1
            break
        fi
        if ! kill -0 "${PID}" 2>/dev/null; then
            rm -f "${PIDFILE}"
            err "  ❌ 进程 ${PID} 已退出! 查看: tail -f ${LOGDIR}/stdout.log"
        fi
        sleep 2
    done

    if [ "${HEALTHY}" -ne 1 ]; then
        warn "  ❌ 90s 内未就绪"
        warn "  日志: tail -f ${LOGDIR}/stdout.log"
        echo ""
        rollback "健康检查超时 (MGMT_PORT=${MGMT_PORT})"
        exit 1
    fi
    echo ""
}

# ===== rollback: 恢复上一版产物 + 重启 =====
rollback() {
    local FAIL_REASON="${1}"
    echo ""
    warn "╔══════════════════════════════════════════════════════╗"
    warn "║  ❌ 部署失败: ${FAIL_REASON}"
    warn "║  🔄  自动回滚到上一版本..."
    warn "╚══════════════════════════════════════════════════════╝"
    echo ""

    # 1. 停服务
    do_stop || warn "do_stop 失败，继续回滚"

    # 2. 找备份目录
    local LAST_BK
    LAST_BK=$(ls -dt "${BACKUP}"/*/ 2>/dev/null | head -1)
    if [ -z "${LAST_BK}" ] || [ ! -d "${LAST_BK}" ]; then
        err "❌ 无可用备份目录，无法自动回滚！手动 kill Java 进程 + 恢复旧产物"
        return 1
    fi
    log "回滚源: ${LAST_BK}"

    # 3. 恢复 jar
    if [ -f "${LAST_BK}/apms.jar" ]; then
        cp -f "${LAST_BK}/apms.jar" "${JAR}"
        log "  ✅ 恢复 jar"
    fi
    # 4. 恢复 dist
    if [ -d "${LAST_BK}/dist_old" ]; then
        rm -rf "${FRONTIR}/dist"
        cp -a "${LAST_BK}/dist_old" "${FRONTIR}/dist"
        log "  ✅ 恢复 dist"
    fi
    # 5. 重新 nohup 启动（复用 do_start 的逻辑，但通过 env.conf 读参数）
    log "  重启后端..."
    # do_start 会读 env.conf，里面有 APP_PORT/MGMT_PORT 等
    do_start || true   # do_start 里有自己的健康检查 + rollback 递归保护
    return 1
}

# ===== do_restart =====
do_restart() {
    do_stop
    sleep 1
    do_start
}

# ===== 子命令 dispatch =====
case "${CMD}" in
    start|startup)   do_start; exit 0 ;;
    stop|shutdown)   do_stop;  exit 0 ;;
    restart)         do_restart; exit 0 ;;
    deploy|"")       : ;;  # 走下面的完整部署流程
    *)               err "未知子命令: ${CMD} (可用: start|stop|restart|deploy)" ;;
esac

# ===== 智能构建检查（仅 deploy；start/stop/restart 已在上面退出）=====
# 检测产物缺失或源码比产物新，命中则自动本地构建；--build 强制构建
_TARGET_JAR="${PROJECT_ROOT}/ruoyi-admin/target/apms.jar"
_VITE_DIST_IDX="${PROJECT_ROOT}/ruoyi-ui/dist/index.html"
NEED_BUILD=0
if [ "${FORCE_BUILD}" -eq 1 ]; then
    NEED_BUILD=1
elif [ ! -f "${_TARGET_JAR}" ] || [ ! -f "${_VITE_DIST_IDX}" ]; then
    NEED_BUILD=1
elif [ "${PROJECT_ROOT}/pom.xml" -nt "${_TARGET_JAR}" ] \
  || [ -n "$(find "${PROJECT_ROOT}" -path '*/src/*' -type f -not -path '*/ruoyi-ui/*' -newer "${_TARGET_JAR}" -print -quit 2>/dev/null)" ] \
  || [ -n "$(find "${PROJECT_ROOT}/ruoyi-ui/src" "${PROJECT_ROOT}/ruoyi-ui/index.html" "${PROJECT_ROOT}/ruoyi-ui/vite.config.js" -type f -newer "${_VITE_DIST_IDX}" -print -quit 2>/dev/null)" ]; then
    NEED_BUILD=1
fi
if [ "${NEED_BUILD}" -eq 1 ]; then
    log "产物缺失或源码已更新 → 本地构建 (build.sh --only-build)..."
    bash "${_SCRIPT_DIR}/build.sh" --only-build
else
    log "构建产物为最新，跳过构建"
fi

# ===== 版本号推导（优先从 mvn target 读，避免 upload 里是旧 jar）=====
_TARGET_JAR="${PROJECT_ROOT}/ruoyi-admin/target/apms.jar"
if [ -z "${TARGET_VERSION}" ] && [ -f "${_TARGET_JAR}" ]; then
    TARGET_VERSION=$(unzip -p "${_TARGET_JAR}" BOOT-INF/classes/version.properties 2>/dev/null | grep '^app.version=' | cut -d= -f2 || echo "")
fi
if [ -z "${TARGET_VERSION}" ] && [ -f "${UPLOAD}/apms.jar" ]; then
    TARGET_VERSION=$(unzip -p "${UPLOAD}/apms.jar" BOOT-INF/classes/version.properties 2>/dev/null | grep '^app.version=' | cut -d= -f2 || echo "")
fi
[ -z "${TARGET_VERSION}" ] && TARGET_VERSION="0.0.0-$(date '+%m%d%H%M%S')"
log "目标版本: ${BLUE}${TARGET_VERSION}${NC} (profile=${PROFILE}, app=${APP_PORT}, mgmt=${MGMT_PORT})"

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

mkdir -p "${JARDIR}" "${FRONTIR}/dist" "${LOGDIR}" "${BACKUP}" "${PATCHES_LOCAL}"
mkdir -p "${JARDIR}/uploadPath"    # Druid 上传路径

# 确认 DB 可连接
mysql_cli -e "SELECT 1" >/dev/null 2>&1 || err "无法连接 MySQL ${DB_HOST}:${DB_PORT}/${DB_NAME}"
# 确认 Redis 可连接
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" PING >/dev/null 2>&1 || warn "Redis 连接失败"

# 读 Redis 里的已运行版本号（Redis DB 1）
REDIS_ARGS="-h ${REDIS_HOST} -p ${REDIS_PORT}"
[ -n "${REDIS_PASS}" ] && REDIS_ARGS="${REDIS_ARGS} -a ${REDIS_PASS}"
REDIS_OLD_VERSION=$(redis-cli ${REDIS_ARGS} -n "${REDIS_DB}" GET "apms:version" 2>/dev/null || echo "")
log "  旧版本: ${REDIS_OLD_VERSION:-<空>} (Redis DB ${REDIS_DB})"

# ===== Step 1: 停服务 =====
do_stop

# ===== Step 2: DB 备份 =====
BACKUP_TS=$(date '+%Y%m%d_%H%M%S')
BKDIR="${BACKUP}/${BACKUP_TS}"
mkdir -p "${BKDIR}"

log "Step 2: 数据库备份 → ${BKDIR}/db.sql.gz"
# 瞬态失败（连接抖动/构建后系统高负载）重试 3 次；mysqldump 的 stderr 落文件不再丢弃；
# 临时文件经 gzip 完整性 + 解压体积校验后才原子改名，空备份绝不进入回滚链
DB_BACKUP_TMP="${BKDIR}/db.sql.gz.tmp"
DB_DUMP_ERR="${BKDIR}/dump.err.log"
DB_BACKUP_OK=0
for DB_BACKUP_TRY in 1 2 3; do
    : > "${DB_BACKUP_TMP}"
    : > "${DB_DUMP_ERR}"
    if mysql_dump 2>"${DB_DUMP_ERR}" | gzip > "${DB_BACKUP_TMP}" \
       && gzip -t "${DB_BACKUP_TMP}" 2>/dev/null \
       && [ "$(gzip -dc "${DB_BACKUP_TMP}" 2>/dev/null | wc -c | tr -d ' ')" -ge 10240 ]; then
        DB_BACKUP_OK=1
        break
    fi
    if [ "${DB_BACKUP_TRY}" -lt 3 ]; then
        warn "  第 ${DB_BACKUP_TRY} 次备份失败，3s 后重试..."
        sleep 3
    fi
done
if [ "${DB_BACKUP_OK}" -eq 1 ]; then
    mv "${DB_BACKUP_TMP}" "${BKDIR}/db.sql.gz"
    rm -f "${DB_DUMP_ERR}"
    log "  ✅ DB 备份完成 ($(du -h "${BKDIR}/db.sql.gz" | cut -f1))"
else
    grep -v -F 'Using a password on the command line interface can be insecure' "${DB_DUMP_ERR}" 2>/dev/null | tail -5 | sed 's/^/    mysqldump: /' || true
    err "❌ DB 备份失败（3 次均失败），终止部署（P0 数据安全：无完整备份不允许执行 SQL patch）。现场保留: ${BKDIR}"
fi

# ===== Step 3: SQL Patches =====
if [ "${SKIP_PATCH}" -eq 1 ]; then
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
    REPO_PATCHES="$(dirname "${0}")/../patches"
    if [ -d "${REPO_PATCHES}" ]; then
        cp -f "${REPO_PATCHES}"/*.sql "${PATCHES_LOCAL}/" 2>/dev/null || true
    fi

    # 已应用去重（macOS bash 3.2 不支持 declare -A，用 grep 替代）
    APPLIED_LIST=$(mysql_cli -N -e "SELECT patch_name FROM apms_db_version;" 2>/dev/null || true)
    APPLIED_COUNT_TOTAL=$(echo "${APPLIED_LIST}" | grep -c . 2>/dev/null || echo 0)
    log "  已应用 patches: ${APPLIED_COUNT_TOTAL} 个"

    # 逐个应用
    APPLIED_COUNT=0
    if [ -d "${PATCHES_LOCAL}" ]; then
        for patch in $(ls "${PATCHES_LOCAL}"/*.sql 2>/dev/null | sort); do
            pname=$(basename "${patch}")
            [[ "${pname}" == "000-init-version-table.sql" ]] && continue
            # grep -qx 整行精确匹配（已应用则跳过）
            if [ -n "${APPLIED_LIST}" ] && echo "${APPLIED_LIST}" | grep -qx "${pname}"; then
                continue
            fi

            pversion=$(echo "${pname}" | sed 's/^patch-//; s/-[0-9]\{12\}\.sql$//')
            pdesc=$(head -5 "${patch}" | grep -E '^-- ' | head -1 | sed 's/^-- *//' || echo "")
            checksum=$(sha256sum "${patch}" | awk '{print $1}')

            log "  ▶ ${pname} (v${pversion})..."
            START_MS=$(($(date +%s%N)/1000000))
            if mysql_cli < "${patch}" 2>&1 | tail -5; then
                END_MS=$(($(date +%s%N)/1000000))
                mysql_cli -e "INSERT INTO apms_db_version (patch_name, version, checksum, description, applied_by, execution_ms) VALUES ('${pname}', '${pversion}', '${checksum}', '$(echo "${pdesc}" | sed "s/'//g")', 'deploy-uat.sh', $((END_MS - START_MS)));" 2>/dev/null || true
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
                log "    ✅ 成功"
            else
                warn "    ❌ ${pname} 执行失败（继续）"
            fi
        done
    fi
    log "  ✅ SQL patches: ${APPLIED_COUNT} 个新 patch 已应用"
fi

# ===== Step 4: 替换产物 =====
log "Step 4: 替换产物..."

# 自动同步 mvn target → upload（如果 target 更新）
_TARGET_JAR="${PROJECT_ROOT}/ruoyi-admin/target/apms.jar"
if [ -f "${_TARGET_JAR}" ]; then
    if [ ! -f "${UPLOAD}/apms.jar" ] || [ "${_TARGET_JAR}" -nt "${UPLOAD}/apms.jar" ]; then
        mkdir -p "${UPLOAD}"
        cp -f "${_TARGET_JAR}" "${UPLOAD}/apms.jar"
        log "  自动同步: ruoyi-admin/target/apms.jar → upload/apms.jar"
    fi
fi
[ -f "${UPLOAD}/apms.jar" ] || err "找不到 apms.jar（请先 mvn clean package）"
cp -f "${UPLOAD}/apms.jar" "${JARDIR}/apms.jar"
log "  jar: $(ls -lh "${JARDIR}/apms.jar" | awk '{print $5}')"

# 自动同步 vite dist → upload/dist（如果 dist 更新）
_VITE_DIST="${PROJECT_ROOT}/ruoyi-ui/dist"
if [ -d "${_VITE_DIST}" ]; then
    if [ ! -d "${UPLOAD}/dist" ] || [ "${_VITE_DIST}" -nt "${UPLOAD}/dist" ]; then
        rm -rf "${UPLOAD}/dist"
        cp -a "${_VITE_DIST}" "${UPLOAD}/dist"
        log "  自动同步: ruoyi-ui/dist → upload/dist"
    fi
fi

if [ -d "${UPLOAD}/dist" ]; then
    rm -rf "${FRONTIR}/dist"
    cp -a "${UPLOAD}/dist" "${FRONTIR}/dist"
    log "  前端: $(find "${FRONTIR}/dist" -type f | wc -l | tr -d ' ') files"
fi

# ===== Step 5: Redis 选择性清缓存（版本驱动）=====
# 版本变更时删除 dict/config 等旧缓存，但保留 login_tokens:* 登录态（发版不踢在线用户）
if [ "${SKIP_CACHE}" -eq 1 ]; then
    warn "Step 5: 跳过 Redis 清缓存 (--skip-cache)"
elif [ "${REDIS_OLD_VERSION}" != "${TARGET_VERSION}" ]; then
    log "Step 5: 版本变更 → 选择性清理 Redis DB ${REDIS_DB}（保留 login_tokens 登录态）"
    if flush_result="$(flush_redis_keep "login_tokens:")"; then
        kept_n="$(echo "${flush_result}" | awk '{print $1}')"
        removed_n="$(echo "${flush_result}" | awk '{print $2}')"
        redis-cli ${REDIS_ARGS} -n "${REDIS_DB}" SET "apms:version" "${TARGET_VERSION}" 2>/dev/null || true
        log "  ✅ Redis DB ${REDIS_DB}: 删除 ${removed_n} 个旧缓存 key，保留 ${kept_n} 个登录态 key；apms:version=${TARGET_VERSION}"
    else
        warn "  Redis 选择性清理失败（未执行 FLUSHDB，登录态与缓存均保持原状）"
    fi
else
    log "Step 5: 跳过 Redis 清缓存 (版本未变: ${TARGET_VERSION})"
fi

# ===== Step 5.5: 生成外部运行时 yml =====
# 关键：用扁平属性名只覆盖叶子节点，不能用嵌套结构（会整体替换 jar 内 druid.yml 的 druid 配置树）
log "Step 5.5: 生成外部运行时配置..."
mkdir -p "${CONFIGDIR}"
cat > "${CONFIGDIR}/application.yml" <<EOF
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
log "  ✅ ${CONFIGDIR}/application.yml"

# ===== Step 6: 启动后端 =====
do_start

# ===== Step 7: Nginx reload =====
log "Step 7: Nginx reload..."
NGINX_BIN=$(which nginx 2>/dev/null || echo "")
if [ -n "${NGINX_BIN}" ]; then
    # macOS BSD grep 不支持 -oE，用 awk 提取 --conf-path
    NGINX_CONF_DIR="$("${NGINX_BIN}" -V 2>&1 | awk -F'--conf-path=' '{print $2}' | awk '{print $1}' | xargs dirname)/servers"
    if "${NGINX_BIN}" -t 2>/dev/null; then
        # 如果 nginx 没启动则 start，否则 reload
        if ! pgrep nginx >/dev/null 2>&1; then
            "${NGINX_BIN}" 2>/dev/null && log "  ✅ Nginx started" || warn "  Nginx start 失败"
        else
            "${NGINX_BIN}" -s reload 2>/dev/null && log "  ✅ Nginx reloaded" || warn "  Nginx reload 失败"
        fi
    else
        warn "  nginx -t 失败，检查 ${NGINX_CONF_DIR}"
    fi
else
    warn "  nginx 未安装，跳过 reload"
fi

# ===== Step 8: 外网验证 =====
FAIL_EXTERNAL=0
if command -v curl >/dev/null 2>&1 && [ -n "${PUBLIC_HOST}" ]; then
    log "Step 8: 外网验证..."
    PUBLIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${PUBLIC_HOST}/" --max-time 10 2>/dev/null || echo "000")
    log "  http://${PUBLIC_HOST}/ → HTTP ${PUBLIC_CODE}"
    if [ "${PUBLIC_CODE}" != "200" ]; then
        warn "  ⚠️  首页非 200 (HTTP ${PUBLIC_CODE})"
        FAIL_EXTERNAL=1
    fi
    API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${PUBLIC_HOST}/prod-api/captchaImage" --max-time 10 2>/dev/null || echo "000")
    log "  http://${PUBLIC_HOST}/prod-api/captchaImage → HTTP ${API_CODE}"
    if [ "${API_CODE}" != "200" ]; then
        warn "  ⚠️  API 非 200 (HTTP ${API_CODE})"
        FAIL_EXTERNAL=1
    fi
fi

if [ "${FAIL_EXTERNAL}" -eq 1 ]; then
    rollback "外网验证失败 (首页/API 非 200)"
    exit 1
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
info "  Profile: ${PROFILE}"
info "  日志:    tail -f ${LOGDIR}/stdout.log"
info "  PID:     ${PIDFILE} ($(cat "${PIDFILE}" 2>/dev/null))"
echo ""
