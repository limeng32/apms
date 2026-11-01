#!/usr/bin/env bash
# ============================================================
# APMS UAT 环境部署脚本（本机执行）
# ------------------------------------------------------------
# 用法：
#   bash deploy-uat.sh [--build] [--skip-patch] [--skip-cache] [--version X.Y.Z-TIMESTAMP]
#                      [--edition standard|ai]
#
# 产品线 EDITION 取值优先级：命令行 --edition > .uat/env.conf 的 EDITION > 缺省 standard。
# 智能构建会以对应线别执行 build.sh --only-build --edition <线>。
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
CLI_EDITION=""    # 命令行 --edition（解析早于 env.conf source；最终值在 source 后裁定）
while [[ ${#} -gt 0 ]]; do
    case "${1}" in
        --build)      FORCE_BUILD=1; shift ;;
        --skip-patch) SKIP_PATCH=1; shift ;;
        --skip-cache) SKIP_CACHE=1; shift ;;
        --version) TARGET_VERSION="${2}"; shift 2 ;;
        --edition) CLI_EDITION="${2}"; shift 2 ;;
        --help|-h)   sed -n '2,30p' "${0}"; exit 0 ;;
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

# 阿里云短信：AK/SK 可空（留空=不启用短信登录，功能开关还受 sys_config 控制），但四个变量必须显式声明
[ -n "${SMS_ACCESS_KEY_ID+x}" ]     || err "env.conf 缺失 SMS_ACCESS_KEY_ID（可空但必须声明），拒绝部署"
[ -n "${SMS_ACCESS_KEY_SECRET+x}" ] || err "env.conf 缺失 SMS_ACCESS_KEY_SECRET（可空但必须声明），拒绝部署"
[ -n "${SMS_SIGN_NAME+x}" ]         || err "env.conf 缺失 SMS_SIGN_NAME（可空但必须声明），拒绝部署"
[ -n "${SMS_TEMPLATE_CODE+x}" ]     || err "env.conf 缺失 SMS_TEMPLATE_CODE（可空但必须声明），拒绝部署"
SMS_SIGN_NAME="${SMS_SIGN_NAME:-北京康耐特体育}"
SMS_TEMPLATE_CODE="${SMS_TEMPLATE_CODE:-SMS_512565975}"

# ===== 产品线裁定：命令行 > env.conf > 缺省 standard =====
# CONF_EDITION 是 env.conf 持久值（仅作缺省/兜底；UAT 不会把成功部署的线别回写 env.conf）
CONF_EDITION="${EDITION:-standard}"
EDITION="${CLI_EDITION:-${CONF_EDITION}}"
case "${EDITION}" in
    standard|ai) ;;
    *) err "非法 --edition: ${EDITION}（只允许 standard|ai）" ;;
esac

# 读取「部署前实际运行线别」：UAT 的运行线别只存在于上次成功部署生成的
# config/application.yml（app.edition），与 env.conf 的 CONF_EDITION 可能脱节
# （例如 env.conf=standard，但上次用 --edition ai 部署成功，实际跑的是 ai）。
# 回滚必须恢复此实际值，才能与备份的旧 jar/dist 成对；旧版本无该标记时回退 CONF_EDITION。
read_previous_edition() {
    local prev=""
    if [ -f "${CONFIGDIR}/application.yml" ]; then
        prev=$(grep -E '^app\.edition:' "${CONFIGDIR}/application.yml" 2>/dev/null | tail -1 \
            | sed -E 's/^app\.edition:[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')
    fi
    case "${prev}" in
        ai|standard) printf '%s' "${prev}" ;;
        *)           printf '%s' "${CONF_EDITION}" ;;
    esac
}

# 只读解析「本次部署最终生效的前端线别」（UAT 本地链路）：
# Step 4 会把较新的 ruoyi-ui/dist 同步到 upload/dist，随后 upload/dist 优先于现场 dist；
# 这里在不改任何文件的前提下预测同步结果，供停服前预检使用。结果置全局：
#   PREFLIGHT_FRONT_SOURCE = upload（含待同步）| existing
#   PREFLIGHT_DIST_EDITION = 将生效的 edition.txt 内容（空串=无标记/无前端）
resolve_uat_effective_front() {
    local target_dist="${PROJECT_ROOT}/ruoyi-ui/dist"
    local upload_dist="${UPLOAD}/dist"
    if [ -d "${target_dist}" ] && { [ ! -d "${upload_dist}" ] || [ "${target_dist}" -nt "${upload_dist}" ]; }; then
        PREFLIGHT_FRONT_SOURCE="upload"
        PREFLIGHT_DIST_EDITION=$(tr -d '[:space:]' < "${target_dist}/edition.txt" 2>/dev/null || echo "")
    elif [ -d "${upload_dist}" ]; then
        PREFLIGHT_FRONT_SOURCE="upload"
        PREFLIGHT_DIST_EDITION=$(tr -d '[:space:]' < "${upload_dist}/edition.txt" 2>/dev/null || echo "")
    else
        PREFLIGHT_FRONT_SOURCE="existing"
        PREFLIGHT_DIST_EDITION=""
        [ -f "${FRONTIR}/dist/edition.txt" ] && \
            PREFLIGHT_DIST_EDITION=$(tr -d '[:space:]' < "${FRONTIR}/dist/edition.txt" 2>/dev/null || echo "")
    fi
}

# 前端线别裁决（停服前预检与 Step 4 落盘前共用同一套规则）。
# $1=fail_action：prestop → 直接 err（服务未停、无任何变更）；否则 rollback（已停服窗口）。
assert_front_edition_ok() {
    local fail_action="${1:-prestop}"
    local fail_prefix
    if [ "${fail_action}" = "prestop" ]; then
        fail_prefix="停服前预检"
    else
        fail_prefix="落盘前校验"
    fi
    if [ "${PREFLIGHT_FRONT_SOURCE}" = "upload" ]; then
        if [ "${PREFLIGHT_DIST_EDITION}" != "${EDITION}" ]; then
            if [ "${fail_action}" = "prestop" ]; then
                err "${fail_prefix}失败：待部署前端 edition.txt='${PREFLIGHT_DIST_EDITION:-缺失}' 与目标 ${EDITION} 不一致。
    未停服、未执行 SQL、未替换任何产物。请用 build.sh --edition ${EDITION} 构建正确前端后重跑。"
            fi
            rollback "前端产物线别不匹配（edition.txt='${PREFLIGHT_DIST_EDITION:-缺失}'，目标 ${EDITION}）"
            exit 1
        fi
    else
        # 沿用服务器现有前端
        if [ -n "${PREFLIGHT_DIST_EDITION}" ] && [ "${PREFLIGHT_DIST_EDITION}" != "${EDITION}" ]; then
            if [ "${fail_action}" = "prestop" ]; then
                err "${fail_prefix}失败：服务器现有前端为 ${PREFLIGHT_DIST_EDITION}，本次目标 ${EDITION}，且无对应线别新前端。
    未停服、未执行 SQL。切线部署必须随包提供 ${EDITION} 前端（build.sh --edition ${EDITION}）。"
            fi
            rollback "现有前端线别 ${PREFLIGHT_DIST_EDITION} 与目标 ${EDITION} 冲突"
            exit 1
        fi
        if [ -z "${PREFLIGHT_DIST_EDITION}" ] && [ -d "${FRONTIR}/dist" ] && [ "${EDITION}" != "${PREVIOUS_EDITION}" ]; then
            if [ "${fail_action}" = "prestop" ]; then
                err "${fail_prefix}失败：检测到切线（${PREVIOUS_EDITION} → ${EDITION}），但现有前端无线别标记且无新前端，无法保证前后端同线。
    未停服、未执行 SQL。请用 build.sh --edition ${EDITION} 完整发版。"
            fi
            rollback "切线部署但现有前端无标记且无新前端（${PREVIOUS_EDITION} → ${EDITION}）"
            exit 1
        fi
    fi
}

# ⚠️ 密码里可能有 !#$ 等特殊字符，必须用函数形式避免 bash 解释
# ${1+"${@}"} 兼容 macOS 自带 bash 3.2：set -u 下无参调用时裸 "${@}" 会报 unbound variable
mysql_cli() { mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" --password="${DB_PASS}" "${DB_NAME}" ${1+"${@}"}; }
mysql_dump() { mysqldump -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" --password="${DB_PASS}" --single-transaction --routines --triggers --databases "${DB_NAME}" ${1+"${@}"}; }

# ===== 登录页设计器配置（apms_login_config）JSON 专项备份/恢复 =====
# 全库 dump 之外，把两套设计器配置单独导出为「可直接在设计器导入 JSON」的文件；
# 部署 SQL 补丁后校验行状态，缺失/JSON 非法时从最近备份自动导回（完好则零覆盖）。
# 三元组：config_key|config_name|备份文件名
LC_PAIRS="default|默认配置|portal
showcase|展示站配置|showcase"

# 用法: login_config_backup <本次备份目录>
login_config_backup() {
    local bkdir="${1}" triple key slug file rows
    [ -d "${bkdir}" ] || return 0
    while IFS='|' read -r key _name slug; do
        [ -z "${key}" ] && continue
        file="${bkdir}/login-config-${slug}.json"
        rows="$(mysql_cli --raw -N -e "SELECT config_json FROM apms_login_config WHERE config_key='${key}' AND config_json IS NOT NULL AND config_json <> '';" 2>/dev/null || true)"
        if [ -n "${rows}" ]; then
            printf '%s' "${rows}" > "${file}"
            log "  登录页配置（${key}）已备份 → ${file} ($(wc -c < "${file}" | tr -d ' ') bytes)"
        fi
    done <<EOF
${LC_PAIRS}
EOF
}

# 用法: login_config_restore <本次备份目录>
# 仅在配置行缺失或 JSON 非法时恢复；优先本次备份，其次历史备份目录中最新一份
login_config_restore() {
    local bkdir="${1}" triple key cname slug tbl_exists state file hex
    tbl_exists="$(mysql_cli -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='apms_login_config';" 2>/dev/null || echo "0")"
    if [ "${tbl_exists}" != "1" ]; then
        warn "  apms_login_config 表不存在，跳过登录页配置恢复（应用补丁后将自动建表）"
        return 0
    fi
    while IFS='|' read -r key cname slug; do
        [ -z "${key}" ] && continue
        state="$(mysql_cli -N -e "SELECT CASE WHEN COUNT(*)=0 THEN 'missing' WHEN JSON_VALID(config_json) THEN 'ok' ELSE 'invalid' END FROM apms_login_config WHERE config_key='${key}';" 2>/dev/null || echo "dberr")"
        case "${state}" in
            ok)
                log "  登录页配置（${key}）完好，无需恢复"
                ;;
            missing|invalid)
                file=""
                if [ -s "${bkdir}/login-config-${slug}.json" ]; then
                    file="${bkdir}/login-config-${slug}.json"
                else
                    file="$(ls -t "${BACKUP}"/*/login-config-"${slug}".json 2>/dev/null | head -1)"
                fi
                if [ -z "${file}" ] || [ ! -s "${file}" ]; then
                    warn "  登录页配置（${key}）状态为 ${state}，但无历史备份可恢复（首次部署属正常，前端使用内置默认）"
                    continue
                fi
                # hex 导回彻底避开 JSON 中引号/中文/反斜杠的 shell 转义问题（xxd 缺失时 od 兜底）
                hex="$(xxd -p "${file}" 2>/dev/null | tr -d '\n' || od -An -v -tx1 "${file}" | tr -d ' \n')"
                [ -n "${hex}" ] || { warn "  无法编码备份文件 ${file}，跳过"; continue; }
                mysql_cli <<EOSQL
SET @j := CONVERT(UNHEX('${hex}') USING utf8mb4);
INSERT INTO apms_login_config (config_key, config_name, config_json, schema_ver, status, create_by, create_time)
VALUES ('${key}', '${cname}', @j, 1, '0', 'deploy-restore', NOW())
ON DUPLICATE KEY UPDATE config_json=VALUES(config_json), schema_ver=1, status='0', update_by='deploy-restore', update_time=NOW();
EOSQL
                log "  ✅ 登录页配置（${key}）已从 ${file} 恢复"
                ;;
            *)
                warn "  登录页配置（${key}）状态校验异常（${state}），跳过自动恢复"
                ;;
        esac
    done <<EOF
${LC_PAIRS}
EOF
}

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

# 回滚闸门：0=正常部署启动（健康失败允许触发自动回滚）；1=回滚流程中启动旧版本
# （健康失败只报告人工介入，禁止再次 rollback，杜绝 do_start→rollback→do_start 递归）。
# 必须在文件顶层初始化（set -u 下函数引用才安全）。
ROLLBACK_IN_PROGRESS=0

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
    echo "  edition:  ${EDITION}"
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
        # 加载部署脚本生成的外部配置（.uat/config/application.yml，含短信 AK/SK 等）。
        # 目录位置以 / 结尾；optional: 保证目录缺失时不阻断启动；命令行参数优先级仍高于该文件
        "--spring.config.additional-location=optional:file:${CONFIGDIR}/"
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
            if [ "${ROLLBACK_IN_PROGRESS}" -eq 1 ]; then
                # 回滚模式：旧版本进程也退出，只报告并终止，禁止二次回滚
                err "  ❌ 回滚后的旧版本进程 ${PID} 也已退出！不再二次回滚，服务保持停止。
      请人工介入：tail -f ${LOGDIR}/stdout.log；恢复后手动 bash deploy/deploy-uat.sh start"
            fi
            err "  ❌ 进程 ${PID} 已退出! 查看: tail -f ${LOGDIR}/stdout.log"
        fi
        sleep 2
    done

    if [ "${HEALTHY}" -ne 1 ]; then
        warn "  ❌ 90s 内未就绪"
        warn "  日志: tail -f ${LOGDIR}/stdout.log"
        echo ""
        if [ "${ROLLBACK_IN_PROGRESS}" -eq 1 ]; then
            # 回滚模式：旧版本也起不来，递归到此为止（不允许再次 rollback）
            err "❌ 回滚后的旧版本 90s 内仍未就绪，自动回滚到此为止（不再二次回滚）。
    服务保持停止，请人工介入：
      - 日志: tail -f ${LOGDIR}/stdout.log
      - 确认旧版本可启动后手动拉起: bash deploy/deploy-uat.sh start
      - 本次备份目录仍保留，可手工核对/恢复"
        fi
        rollback "健康检查超时 (MGMT_PORT=${MGMT_PORT})"
        exit 1
    fi
    echo ""
}

# ===== rollback: 恢复上一版产物 + 重启（单次闸门，禁止嵌套/递归）=====
rollback() {
    # 防重入：回滚流程中 do_start 失败会以「回滚模式」直接终止，不应再次进入本函数
    if [ "${ROLLBACK_IN_PROGRESS:-0}" -eq 1 ]; then
        warn "⚠️ 已在回滚流程中，拒绝嵌套回滚（防止递归）；当前失败需人工介入"
        return 1
    fi
    ROLLBACK_IN_PROGRESS=1

    local FAIL_REASON="${1}"
    echo ""
    warn "╔══════════════════════════════════════════════════════╗"
    warn "║  ❌ 部署失败: ${FAIL_REASON}"
    warn "║  🔄  自动回滚到上一版本（线别恢复部署前实际值 ${PREVIOUS_EDITION:-${CONF_EDITION}}）..."
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
    # 4.5 恢复运行线别：必须与刚恢复的旧 jar/dist（上一次成功部署的产物）成对，
    #     使用部署开始时快照的实际运行值 PREVIOUS_EDITION（不是 env.conf 的 CONF_EDITION——
    #     CLI --edition 成功部署后 env.conf 与实际运行值会脱节）。
    ROLLBACK_EDITION="${PREVIOUS_EDITION:-${CONF_EDITION}}"
    case "${ROLLBACK_EDITION}" in
        standard|ai) ;;
        *) ROLLBACK_EDITION="standard" ;;
    esac
    mkdir -p "${CONFIGDIR}"
    if [ -f "${CONFIGDIR}/application.yml" ] && grep -q '^app.edition:' "${CONFIGDIR}/application.yml"; then
        sed -i.bak "s|^app.edition:.*|app.edition: ${ROLLBACK_EDITION}|" "${CONFIGDIR}/application.yml" && rm -f "${CONFIGDIR}/application.yml.bak"
    else
        printf '\napp.edition: %s\n' "${ROLLBACK_EDITION}" >> "${CONFIGDIR}/application.yml"
    fi
    log "  运行线别恢复为部署前实际值: app.edition=${ROLLBACK_EDITION}"
    # 5. 重新 nohup 启动旧版本（ROLLBACK_IN_PROGRESS=1：do_start 处于「回滚模式」，
    #    旧版本健康失败只报告人工介入，不会再回调 rollback，递归在此终止）
    log "  重启后端（回滚模式，失败不再二次回滚）..."
    do_start || true
    return 1
}

# ===== do_restart =====
do_restart() {
    do_stop
    sleep 1
    do_start
}

# ===== verify_edition_health: 管理端口 /health 与本次 EDITION 双向校验 =====
# ai：必须存在 "ai" 组件且 details.edition=ai；standard：必须不存在 "ai" 组件。
# 返回 0=一致，1=不一致（调用方据此 rollback）。
verify_edition_health() {
    local body
    body=$(curl -s --max-time 5 "http://localhost:${MGMT_PORT}/health" 2>/dev/null || echo "")
    [ -n "${body}" ] || return 1
    if [ "${EDITION}" = "ai" ]; then
        echo "${body}" | grep -Eq '"ai"[[:space:]]*:[[:space:]]*\{' || return 1
        echo "${body}" | grep -Eq '"edition"[[:space:]]*:[[:space:]]*"ai"' || return 1
    else
        echo "${body}" | grep -q '"ai"' && return 1
    fi
    return 0
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
# 后端（单 jar，与 Edition 无关）与前端（按 Edition 独立构建）分别判定新鲜度：
#   - 纯切换线别：dist/edition.txt 不符只触发前端重建，后端 jar 复用、绝不重打；
#   - 后端源码变更：只触发 Maven，前端 dist 线别已匹配且最新时不重建；
#   - --build：强制两端都重建。
_TARGET_JAR="${PROJECT_ROOT}/ruoyi-admin/target/apms.jar"
_VITE_DIST_IDX="${PROJECT_ROOT}/ruoyi-ui/dist/index.html"
_VITE_EDITION_FILE="${PROJECT_ROOT}/ruoyi-ui/dist/edition.txt"
DIST_EDITION=$(tr -d '[:space:]' < "${_VITE_EDITION_FILE}" 2>/dev/null || echo "")

BACKEND_NEED_BUILD=0
FRONTEND_NEED_BUILD=0
if [ "${FORCE_BUILD}" -eq 1 ]; then
    BACKEND_NEED_BUILD=1
    FRONTEND_NEED_BUILD=1
else
    # 后端：jar 缺失、pom 更新、或任一后端源码（排除 ruoyi-ui）新于 jar
    if [ ! -f "${_TARGET_JAR}" ] \
      || [ "${PROJECT_ROOT}/pom.xml" -nt "${_TARGET_JAR}" ] \
      || [ -n "$(find "${PROJECT_ROOT}" -path '*/src/*' -type f -not -path '*/ruoyi-ui/*' -newer "${_TARGET_JAR}" -print -quit 2>/dev/null)" ]; then
        BACKEND_NEED_BUILD=1
    fi
    # 前端：dist 缺失、线别不符（切线必重建前端）、或前端源码/配置新于 dist
    if [ ! -f "${_VITE_DIST_IDX}" ] \
      || [ "${DIST_EDITION}" != "${EDITION}" ] \
      || [ -n "$(find "${PROJECT_ROOT}/ruoyi-ui/src" "${PROJECT_ROOT}/ruoyi-ui/index.html" "${PROJECT_ROOT}/ruoyi-ui/vite.config.js" -type f -newer "${_VITE_DIST_IDX}" -print -quit 2>/dev/null)" ]; then
        FRONTEND_NEED_BUILD=1
    fi
fi

if [ "${BACKEND_NEED_BUILD}" -eq 0 ] && [ "${FRONTEND_NEED_BUILD}" -eq 0 ]; then
    log "前后端产物均为最新 (edition=${EDITION})，跳过构建（后端单 jar 不因切线重建）"
else
    _BUILD_ARGS=(--only-build --edition "${EDITION}")
    [ "${BACKEND_NEED_BUILD}" -eq 0 ]  && _BUILD_ARGS+=(--skip-maven)
    [ "${FRONTEND_NEED_BUILD}" -eq 0 ] && _BUILD_ARGS+=(--skip-frontend)
    log "智能构建 → 后端:$([ "${BACKEND_NEED_BUILD}" -eq 1 ] && echo 重建 || echo 复用) 前端:$([ "${FRONTEND_NEED_BUILD}" -eq 1 ] && echo "重建(${EDITION})" || echo 复用)"
    bash "${_SCRIPT_DIR}/build.sh" "${_BUILD_ARGS[@]}"
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

# 快照「部署前实际运行线别」（读取运行配置文件，与服务是否运行无关，故可在停服前完成）。
PREVIOUS_EDITION=$(read_previous_edition)
log "  线别快照: 部署前实际运行=${PREVIOUS_EDITION}；env.conf 持久值=${CONF_EDITION}；本次目标=${EDITION}"

# ===== Step 0.5: 停服前预检（产物完整性 + 前后端线别；可提前发现的打包错误必须在变更前拦截）=====
# 此阶段服务仍在运行、数据库未备份/未打补丁、任何产物未替换；不通过只 err 退出，现场零影响。
log "Step 0.5: 停服前预检（jar 存在性 + 前端线别）..."
[ -f "${_TARGET_JAR}" ] || err "停服前预检失败：后端 jar 不存在 ${_TARGET_JAR}，请先构建（mvn install 或去掉 --skip-maven）"
resolve_uat_effective_front
assert_front_edition_ok prestop
log "  预检通过：后端 jar 就绪；前端来源=${PREFLIGHT_FRONT_SOURCE}，生效 edition=${PREFLIGHT_DIST_EDITION:-无前端}，目标=${EDITION}"

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

# 登录页设计器配置：单导出两份可直接导入的 JSON（运营手工数据，额外留档）
log "  登录页设计器配置 JSON 备份..."
login_config_backup "${BKDIR}"

# ===== Step 3: SQL Patches =====
if [ "${SKIP_PATCH}" -eq 1 ]; then
    warn "Step 3: 跳过 SQL patch (--skip-patch)"
else
    log "Step 3: 应用 SQL patches（任一公共补丁失败即立即终止，不启动新版本）..."

    # 版本表初始化（幂等）：失败同属 SQL 执行失败，落日志后立即终止
    INIT_LOG="${BKDIR}/patch-init-version-table.log"
    set +e
    mysql_cli << 'EOSQL' >"${INIT_LOG}" 2>&1
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
    INIT_RC=${?}
    set -e
    if [ "${INIT_RC}" -ne 0 ]; then
        echo ""
        echo -e "${RED}    ❌ apms_db_version 版本表初始化失败，输出末尾：${NC}"
        grep -v -F 'Using a password on the command line interface can be insecure' "${INIT_LOG}" 2>/dev/null | tail -15 | sed 's/^/      /'
        err "🛑 SQL 初始化失败 → 立即终止部署，不启动新版本。服务已停止、旧产物未替换。DB 备份: ${BKDIR}/db.sql.gz；失败日志: ${INIT_LOG}"
    fi

    # 从 repo patches/ 同步（公共补丁平铺；本产品线不存在任何按线 SQL 目录）
    REPO_PATCHES="$(dirname "${0}")/../patches"
    if [ -d "${REPO_PATCHES}" ]; then
        cp -f "${REPO_PATCHES}"/*.sql "${PATCHES_LOCAL}/" 2>/dev/null || true
    fi

    # 已应用去重（macOS bash 3.2 不支持 declare -A，用 grep 替代）
    APPLIED_LIST=$(mysql_cli -N -e "SELECT patch_name FROM apms_db_version;" 2>/dev/null || true)
    APPLIED_COUNT_TOTAL=$(echo "${APPLIED_LIST}" | grep -c . 2>/dev/null || echo 0)
    log "  已应用 patches: ${APPLIED_COUNT_TOTAL} 个"

    # 逐个应用：失败立即终止（公共补丁是两线同一套迁移，绝不允许带病启动新版本）
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
            # 输出落本次备份目录的持久日志（不用 /tmp 临时文件，避免现场被清理）；
            # 显式取 mysql 退出码，不经过管道，杜绝任何吞错可能
            PATCH_LOG="${BKDIR}/patch-${pname}.log"
            set +e
            mysql_cli < "${patch}" >"${PATCH_LOG}" 2>&1
            PATCH_RC=${?}
            set -e
            if [ "${PATCH_RC}" -eq 0 ]; then
                END_MS=$(($(date +%s%N)/1000000))
                mysql_cli -e "INSERT INTO apms_db_version (patch_name, version, checksum, description, applied_by, execution_ms) VALUES ('${pname}', '${pversion}', '${checksum}', '$(echo "${pdesc}" | sed "s/'//g")', 'deploy-uat.sh', $((END_MS - START_MS)));" 2>/dev/null || true
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
                log "    ✅ 成功"
            else
                echo ""
                echo -e "${RED}    ❌ ${pname} 执行失败 (mysql rc=${PATCH_RC})，输出末尾：${NC}"
                grep -v -F 'Using a password on the command line interface can be insecure' "${PATCH_LOG}" 2>/dev/null | tail -15 | sed 's/^/      /'
                echo ""
                err "🛑 公共 SQL 补丁 ${pname} 失败 → 立即终止部署，不允许继续启动新版本。
    现场状态：服务已停止；旧 jar/dist 未替换（Step 4 未执行）；新版本未启动。
    DB 备份：${BKDIR}/db.sql.gz
    失败日志：${PATCH_LOG}
    人工处理：
      1) 查看失败日志与补丁 ${patch}，修正补丁（须保持幂等）后重跑：bash deploy/deploy-uat.sh [原参数]
      2) 若需先恢复旧版服务（旧产物未动）：bash deploy/deploy-uat.sh start"
            fi
        done
    fi
    log "  ✅ SQL patches: ${APPLIED_COUNT} 个新 patch 已应用"
fi

# 登录页设计器配置：缺失/JSON 非法时从备份自动导回（完好零覆盖；此时处于停服窗口，启动前就位）
log "Step 3.5: 校验并按需恢复登录页设计器配置..."
login_config_restore "${BKDIR}"

# ===== Step 4: 替换产物 =====
log "Step 4: 替换产物..."

# 先把当前运行产物备份到本次 BKDIR（rollback 依赖 ${LAST_BK}/apms.jar 与 dist_old）
if [ -f "${JARDIR}/apms.jar" ]; then
    cp -f "${JARDIR}/apms.jar" "${BKDIR}/apms.jar"
fi
if [ -d "${FRONTIR}/dist" ]; then
    rm -rf "${BKDIR}/dist_old"
    cp -a "${FRONTIR}/dist" "${BKDIR}/dist_old"
fi

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

# 自动同步 vite dist → upload/dist（如果 dist 更新）
_VITE_DIST="${PROJECT_ROOT}/ruoyi-ui/dist"
if [ -d "${_VITE_DIST}" ]; then
    if [ ! -d "${UPLOAD}/dist" ] || [ "${_VITE_DIST}" -nt "${UPLOAD}/dist" ]; then
        rm -rf "${UPLOAD}/dist"
        cp -a "${_VITE_DIST}" "${UPLOAD}/dist"
        log "  自动同步: ruoyi-ui/dist → upload/dist"
    fi
fi

# 前端线别第二道闸（落盘前）：target→upload 同步已完成，按 upload 实际状态重新解析，
# 复用与停服前预检相同的裁决；此处已停服且旧产物已备份，失败走 rollback。
if [ -d "${UPLOAD}/dist" ]; then
    PREFLIGHT_FRONT_SOURCE="upload"
    PREFLIGHT_DIST_EDITION=$(tr -d '[:space:]' < "${UPLOAD}/dist/edition.txt" 2>/dev/null || echo "")
else
    PREFLIGHT_FRONT_SOURCE="existing"
    PREFLIGHT_DIST_EDITION=""
    [ -f "${FRONTIR}/dist/edition.txt" ] && \
        PREFLIGHT_DIST_EDITION=$(tr -d '[:space:]' < "${FRONTIR}/dist/edition.txt" 2>/dev/null || echo "")
fi
assert_front_edition_ok rollback
log "  前端线别落盘校验通过（来源=${PREFLIGHT_FRONT_SOURCE}，生效 edition=${PREFLIGHT_DIST_EDITION:-无前端}，目标=${EDITION}）"
[ "${PREFLIGHT_FRONT_SOURCE}" = "existing" ] && warn "  本次无新 dist，沿用现有前端（edition=${PREFLIGHT_DIST_EDITION:-无标记}）；仅建议同线后端升级"

cp -f "${UPLOAD}/apms.jar" "${JARDIR}/apms.jar"
log "  jar: $(ls -lh "${JARDIR}/apms.jar" | awk '{print $5}')"

if [ "${PREFLIGHT_FRONT_SOURCE}" = "upload" ]; then
    rm -rf "${FRONTIR}/dist"
    cp -a "${UPLOAD}/dist" "${FRONTIR}/dist"
    log "  前端: $(find "${FRONTIR}/dist" -type f | wc -l | tr -d ' ') files（edition=${PREFLIGHT_DIST_EDITION}）"
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

# 产品线（部署级）：standard 不装配 AI；ai 注册 AI 插件。回滚时由脚本改回 env.conf 持久值
app.edition: ${EDITION}

spring.datasource.druid.master.url: jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=false&serverTimezone=GMT%2B8
spring.datasource.druid.master.username: ${DB_USER}
spring.datasource.druid.master.password: "${DB_PASS}"

spring.data.redis.database: ${REDIS_DB}
spring.data.redis.host: ${REDIS_HOST}
spring.data.redis.port: ${REDIS_PORT}
spring.data.redis.password: "${REDIS_PASS}"

# 阿里云短信 — AK/SK 由 env.conf 注入；留空时发短信接口报错（不阻断启动），功能另受 sys_config 开关控制
apms.sms.access-key-id: ${SMS_ACCESS_KEY_ID}
apms.sms.access-key-secret: "${SMS_ACCESS_KEY_SECRET}"
apms.sms.sign-name: ${SMS_SIGN_NAME}
apms.sms.template-code: ${SMS_TEMPLATE_CODE}
EOF
# 内含 DB/Redis 密码与短信 AK/SK：仅运行账号可读，禁止同机其他用户读取
chmod 600 "${CONFIGDIR}/application.yml"
log "  ✅ ${CONFIGDIR}/application.yml (权限 600, app.edition=${EDITION})"

# ===== Step 6: 启动后端 =====
do_start

# ===== Step 6.5: 运行线别校验（/health 与本次 EDITION 必须一致，失败即回滚）=====
log "Step 6.5: 校验运行线别（期望 ${EDITION}）..."
if ! verify_edition_health; then
    rollback "运行线别与 EDITION=${EDITION} 不一致（管理端口 /health 校验失败）"
    exit 1
fi
log "  ✅ 运行线别校验通过: ${EDITION}"

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
info "  Edition: ${EDITION}（持久值 ${CONF_EDITION}）"
info "  日志:    tail -f ${LOGDIR}/stdout.log"
info "  PID:     ${PIDFILE} ($(cat "${PIDFILE}" 2>/dev/null))"
echo ""
