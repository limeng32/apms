#!/usr/bin/env bash
# ======================================================================
# 【一次性运维脚本·在生产服务器以 root 运行】清空业务测试数据
# 配套 SQL：同目录 clear-business-data-20261010.sql
# 编制：2026-10-10
# ----------------------------------------------------------------------
# 固化顺序（任一环节失败即中止，绝不带伤继续）：
#   停后端 → 全库备份并三重校验 → 非交互执行清库 SQL → 启后端
#
# 用法（必须显式确认，杜绝误执行）：
#   bash clear-business-data-20261010.sh --yes-i-want-to-clear-prod
#
# 红线：本脚本只走 mysql 非交互 batch（读 stdin，遇 SQL 错误即停），
#       不使用 --force；请勿改用 mysql 交互 source（见 SQL 头注释）。
#
# 回滚：脚本失败且备份成功后，可用其打印的备份文件整库导回。
# ======================================================================
set -euo pipefail

CONFIRM_FLAG="--yes-i-want-to-clear-prod"
CONFIRM_SQL="YES-CLEAR-PROD-20261010"
SERVICE="apms-backend"
APP_PORT="${APP_PORT:-10080}"
MGMT_PORT="${MGMT_PORT:-10081}"
ENV_CONF="${ENV_CONF:-/etc/apms/env.conf}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/apms/backup}"
SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/clear-business-data-20261010.sql"
# 每次执行使用唯一时间戳目录：误执行第二次也不会覆盖第一次清库前的回滚点
RUN_TS="$(date '+%Y%m%d_%H%M%S')"
BACKUP_DIR="${BACKUP_ROOT}/manual-clear-${RUN_TS}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[CLEAR]${NC} $(date '+%H:%M:%S') ${*}"; }
warn() { echo -e "${YELLOW}[WARN ]${NC} ${*}"; }
err()  { echo -e "${RED}[ERR  ]${NC} ${*}" 1>&2; }

# ===== 0. 参数与前置 =====
[ "${1:-}" = "${CONFIRM_FLAG}" ] \
  || { err "必须显式确认：bash ${0} ${CONFIRM_FLAG}"; exit 2; }
[ "$(id -u)" -eq 0 ] || { err "需要 root 执行（停服/systemctl/读取 ${ENV_CONF}）"; exit 2; }
[ -f "${SQL_FILE}" ] || { err "找不到配套 SQL：${SQL_FILE}"; exit 2; }
[ -f "${ENV_CONF}" ] || { err "缺少 ${ENV_CONF}（生产环境配置），拒绝执行"; exit 2; }
command -v mysql >/dev/null 2>&1    || { err "未安装 mysql 客户端"; exit 2; }
command -v mysqldump >/dev/null 2>&1 || { err "未安装 mysqldump"; exit 2; }

# shellcheck disable=SC1090
set -a; source "${ENV_CONF}"; set +a
[ -n "${DB_NAME:-}" ] || { err "${ENV_CONF} 缺失 DB_NAME"; exit 2; }
[ -n "${DB_USER:-}" ] || { err "${ENV_CONF} 缺失 DB_USER"; exit 2; }
[ -n "${DB_PASS+x}" ] || { err "${ENV_CONF} 缺失 DB_PASS（可空但必须声明）"; exit 2; }
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

# 密码特殊字符安全透传；${1+"${@}"} 兼容无参调用与 macOS bash 3.2
mysql_cli()  { mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" --password="${DB_PASS}" "${DB_NAME}" --batch ${1+"${@}"}; }
mysql_dump() { mysqldump -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" --password="${DB_PASS}" --single-transaction --no-tablespaces --triggers --routines --events --databases "${DB_NAME}" ${1+"${@}"}; }

BACKUP_FILE=""   # 成功后填充，供失败分支提示回滚路径

start_backend() {
    log "启动 ${SERVICE}..."
    systemctl start "${SERVICE}" 2>/dev/null || { err "systemctl start ${SERVICE} 失败，请人工检查"; return 1; }
    local i code
    for i in $(seq 1 45); do
        code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${MGMT_PORT}/health" 2>/dev/null || echo "000")
        [ "${code}" = "200" ] && { log "  ✅ 后端已就绪（health=200）"; return 0; }
        sleep 2
    done
    warn "  后端已发出启动指令但 90s 内未探活到 ${MGMT_PORT}/health，请人工确认"
}

echo ""
warn "即将清空库 ${DB_NAME} 的业务测试数据（保留账号/权限/配置）。"
warn "本操作不可撤销，仅可通过备份回滚。3 秒后开始（Ctrl-C 可中止）..."
sleep 3
echo ""

# ===== 1. 先停后端并强制确认已停：确保备份之后不再有任何写入（否则恢复会丢失这段写入） =====
log "Step 1/4 停止后端 ${SERVICE}..."
systemctl stop "${SERVICE}" 2>/dev/null || true

# 不能只靠 stop 返回值：若 Java 仍 active，后续会在应用可能写库的情况下备份/TRUNCATE。
# 必须确认服务确已停止；仍 active 一律拒绝继续（此刻未备份未清库，线上状态原样，交人工处理）。
if systemctl is-active --quiet "${SERVICE}"; then
    err "${SERVICE} 仍处于 active，拒绝继续清库（避免在应用写库时备份/TRUNCATE）"
    err "请人工排查：systemctl status ${SERVICE}；确认可停后重新执行本脚本"
    exit 1
fi
log "  ✅ 后端已停止（is-active 非 active）"

# 纵深确认：业务端口 ${APP_PORT} 不得仍在监听（防 systemd 单元未识别但 Java 还在跑）
PORT_PID=""
if command -v ss >/dev/null 2>&1; then
    PORT_PID="$(ss -tlnpH "sport = :${APP_PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u | tr '\n' ' ' || true)"
elif command -v lsof >/dev/null 2>&1; then
    PORT_PID="$(lsof -tiTCP:"${APP_PORT}" -sTCP:LISTEN 2>/dev/null | sort -u | tr '\n' ' ' || true)"
fi
if [ -n "${PORT_PID// /}" ]; then
    err "端口 ${APP_PORT} 仍被进程监听（PID=${PORT_PID}），疑似 Java 未真正停止，拒绝继续清库"
    err "请人工确认并处理后重新执行本脚本"
    exit 1
fi
log "  ✅ 业务端口 ${APP_PORT} 无监听"

# ===== 2. 全库备份 + 三重校验（失败则重新拉起服务并中止，绝不带伤清库） =====
log "Step 2/4 全库逻辑备份..."
mkdir -p "${BACKUP_DIR}"
DB_BACKUP="${BACKUP_DIR}/apms-before-clear.sql.gz"
DB_TMP="${DB_BACKUP}.tmp"
DUMP_ERR="${BACKUP_DIR}/dump.err.log"
BACKUP_OK=0
for DB_TRY in 1 2 3; do
    : > "${DB_TMP}"; : > "${DUMP_ERR}"
    # set -o pipefail 保证 mysqldump 失败会被捕获，不会因 gzip 成功而「假成功」
    if mysql_dump 2>"${DUMP_ERR}" | gzip > "${DB_TMP}" \
       && gzip -t "${DB_TMP}" \
       && [ "$(gzip -dc "${DB_TMP}" 2>/dev/null | wc -c | tr -d ' ')" -ge 10240 ]; then
        BACKUP_OK=1; break
    fi
    [ "${DB_TRY}" -lt 3 ] && { warn "  第 ${DB_TRY} 次备份失败，3s 后重试..."; sleep 3; }
done
if [ "${BACKUP_OK}" -ne 1 ]; then
    grep -v -F 'Using a password on the command line interface can be insecure' "${DUMP_ERR}" 2>/dev/null | tail -5 | sed 's/^/    mysqldump: /' || true
    rm -f "${DB_TMP}"
    err "备份未通过校验（dump 状态/gzip 完整性/解压体积≥10KB 三重关卡之一失败）"
    err "为安全起见未执行任何清库。现重新拉起后端恢复服务。"
    start_backend || true
    exit 1
fi
mv "${DB_TMP}" "${DB_BACKUP}"
rm -f "${DUMP_ERR}"
BACKUP_FILE="${DB_BACKUP}"
log "  ✅ 备份完成并通过校验：${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# ===== 3. 非交互执行清库 SQL（同连接注入确认变量；无 --force，遇错即停） =====
log "Step 3/4 执行清库 SQL（非交互 batch，遇任何错误立即停止）..."
if ! ( echo "SET @CONFIRM_CLEAR := '${CONFIRM_SQL}';"; cat "${SQL_FILE}" ) | mysql_cli; then
    echo ""
    err "清库 SQL 执行中断（可能只执行了一部分 TRUNCATE）。"
    err "后端保持停止状态，请勿直接对外；用备份整库回滚："
    err "  gunzip -c '${BACKUP_FILE}' | mysql -h'${DB_HOST}' -P'${DB_PORT}' -u'${DB_USER}' -p'***' '${DB_NAME}'"
    err "回滚确认无误后再执行：systemctl start ${SERVICE}"
    exit 1
fi
log "  ✅ 清库 SQL 全部执行完成（请向上滚动核对「清理前/后」行数表）"

# ===== 4. 启动后端并探活 =====
log "Step 4/4 启动后端..."
start_backend || true

echo ""
log "=========================================="
log "  ✅ 完成：业务测试数据已清空，账号/配置保留"
log "  回滚备份：${BACKUP_FILE}"
log "  物理文件未动：/opt/apms/backend/uploadPath"
log "  Redis：发版会自动选择性清缓存；不发版请按 SQL 末尾说明手动处理"
log "=========================================="
echo ""
