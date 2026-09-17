#!/usr/bin/env bash
# ============================================================
# APMS 生产环境部署脚本（远程执行）
# ------------------------------------------------------------
# 用法：
#   bash deploy.sh [--skip-patch] [--skip-cache] [--version X.Y.Z-TIMESTAMP]
#
# 要求（由本地 build.sh 上传到 /opt/apms/upload/）：
#   /opt/apms/upload/
#     ├── apms.jar            (后端产物)
#     ├── dist/                      (前端产物)
#     ├── apms-backend.service       (systemd 文件)
#     ├── apms-nginx.conf            (nginx conf)
#     ├── patches/                   (SQL 增量补丁，可选)
#     │   └── patch-X.Y.Z-TIMESTAMP.sql
#
# 流程：
#   备份 DB → 备份产物 → 停服务 → systemd reset
#   → 应用 patches → 替换 jar/前端 → 清 Redis → 启服务 → 健康检查
# ============================================================
set -euo pipefail

# ===== 颜色与日志 =====
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC} $(date '+%H:%M:%S') $*"; }
info() { echo -e "${BLUE}[....]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR ]${NC} $*"; exit 1; }

# ===== 参数解析 =====
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

# ===== 配置（从 /etc/apms/env.conf 或硬编码 fallback）=====
if [ -f /etc/apms/env.conf ]; then
    set -a; source /etc/apms/env.conf; set +a
else
    # ==== ⚠️ 生产环境务必把这些移到 /etc/apms/env.conf 并 chmod 600 ====
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-3306}"
    DB_NAME="${DB_NAME:-ry-vue}"
    DB_USER="${DB_USER:-root}"
    DB_PASS="${DB_PASS:-!#111111qQ}"
    REDIS_HOST="${REDIS_HOST:-localhost}"
    REDIS_PORT="${REDIS_PORT:-6379}"
    REDIS_PASS="${REDIS_PASS:-}"
    PUBLIC_HOST="${PUBLIC_HOST:-39.97.246.69}"
    BINDIR="${BINDIR:-/opt/apms}"
fi

UPLOAD="$BINDIR/upload"
BACKUP="$BINDIR/backup"
LOGDIR="$BINDIR/logs"
JARDIR="$BINDIR/backend"
FRONTIR="$BINDIR/frontend"
PATCHES_UPLOAD="$UPLOAD/patches"
PATCHES_LOCAL="$BINDIR/patches"
SERVICE_NAME="apms-backend"

# ⚠️ 关键：密码里可能有 !#$ 等特殊字符，必须用函数形式避免 bash 解释
mysql_cli() { mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" --password="$DB_PASS" "$DB_NAME" "$@"; }
# mysqldump 必须指定 --databases "$DB_NAME"，否则会尝试 dump 所有 DB（包括 mysql 系统库），可能权限不够失败
mysql_dump() { mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" --password="$DB_PASS" --single-transaction --routines --triggers --databases "$DB_NAME" "$@"; }

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
    REDIS_OLD_VERSION=$(redis-cli $REDIS_ARGS GET "apms:version" 2>/dev/null || echo "")
fi

# ===== Step 1: 停服务 =====
log "Step 1: 停止后端服务..."
sudo systemctl reset-failed "$SERVICE_NAME" 2>/dev/null || true   # 防 auto-restart 计数锁死
if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    sudo systemctl stop "$SERVICE_NAME"
    log "  systemd stopped"
fi
# 兜底：端口释放
for _ in 1 2 3; do
    if ss -tlnp 2>/dev/null | grep -q ':8080'; then
        warn "  8080 端口仍被占用，强制释放..."
        sudo fuser -k 8080/tcp 2>/dev/null || sudo pkill -f "ruoyi-admin.*\.jar" 2>/dev/null || true
        sleep 2
    fi
done
if ss -tlnp 2>/dev/null | grep -q ':8080'; then
    err "  8080 端口无法释放，请手动 kill"
fi
log "  ✅ 8080 已释放"

# ===== Step 2: 全量备份（DB + 产物）=====
BACKUP_TS=$(date '+%Y%m%d_%H%M%S')
BKDIR="$BACKUP/$BACKUP_TS"
mkdir -p "$BKDIR"

log "Step 2: 数据库备份 → $BKDIR/db.sql.gz"
if mysql_dump 2>/dev/null | gzip > "$BKDIR/db.sql.gz"; then
    log "  ✅ DB 备份完成 ($(du -h "$BKDIR/db.sql.gz" | cut -f1))"
else
    warn "  DB 备份失败，继续部署（⚠️ 无法回滚）"
    rm -f "$BKDIR/db.sql.gz"
fi

log "  备份当前产物..."
[ -f "$JARDIR/apms.jar" ] && cp "$JARDIR/apms.jar" "$BKDIR/apms.jar" || true
[ -d "$FRONTIR/dist" ] && cp -a "$FRONTIR/dist" "$BKDIR/dist_old" || true

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
            if mysql_cli < "$patch" 2>&1 | tail -5; then
                END_MS=$(($(date +%s%N)/1000000))
                ELAPSED=$((END_MS - START_MS))
                mysql_cli -e "INSERT INTO apms_db_version (patch_name, version, checksum, description, applied_by, execution_ms) VALUES ('$pname', '$pversion', '$checksum', '$(echo "$pdesc" | sed "s/'//g")', 'deploy.sh', $ELAPSED);" 2>/dev/null || true
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
                log "    ✅ 成功 (${ELAPSED}ms)"
            else
                err "    ❌ $pname 执行失败！DB 已备份在 $BKDIR/db.sql.gz，建议回滚"
            fi
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

# ===== Step 5: systemd + Nginx =====
log "Step 5: 部署 systemd + Nginx..."
if [ -f "$UPLOAD/apms-backend.service" ]; then
    sudo cp -f "$UPLOAD/apms-backend.service" /etc/systemd/system/"$SERVICE_NAME".service
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
fi
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
        if redis-cli $REDIS_ARGS FLUSHDB 2>/dev/null; then
            # FLUSHDB 成功后写入新版本号，作为下次部署的对比基准
            redis-cli $REDIS_ARGS SET "apms:version" "$TARGET_VERSION" 2>/dev/null || true
            log "  ✅ Redis FLUSHDB + SET apms:version=$TARGET_VERSION"
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
log "Step 7: 启动后端..."
sudo systemctl reset-failed "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"

# 健康检查（90s 超时，分两阶段）
HEALTHY=0
for i in $(seq 1 45); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/apms/version" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        # 再验证版本号是否匹配
        RUNNING_VERSION=$(curl -s "http://localhost:8080/apms/version" 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "")
        log "  ✅ 后端启动 (第 ${i} 次轮询，版本=${RUNNING_VERSION})"
        if [ -n "$RUNNING_VERSION" ] && [ "$RUNNING_VERSION" != "unknown" ]; then
            log "  版本匹配: 目标=${TARGET_VERSION} 运行=${RUNNING_VERSION}"
        fi
        HEALTHY=1
        break
    fi
    # 检查 systemd 是否还在运行
    if ! sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        err "  systemd 已失败！查看 journal: journalctl -u $SERVICE_NAME -n 50 --no-pager"
    fi
    sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
    warn "  ❌ 90s 内未就绪，但 systemd 可能仍在启动中"
    warn "  查看日志: journalctl -u $SERVICE_NAME -n 100 --no-pager"
fi

# ===== Step 8: 外网验证 =====
if command -v curl >/dev/null 2>&1; then
    log "Step 8: 外网验证..."
    PUBLIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_HOST/" --max-time 10 2>/dev/null || echo "timeout")
    log "  http://$PUBLIC_HOST/ → HTTP $PUBLIC_CODE"
    API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_HOST/prod-api/captchaImage" --max-time 10 2>/dev/null || echo "timeout")
    log "  http://$PUBLIC_HOST/prod-api/captchaImage → HTTP $API_CODE"
fi

# ===== 完成 =====
echo ""
info "=========================================="
info "  ✅ 部署完成 → ${TARGET_VERSION}"
info "=========================================="
echo ""
info "  外网:    http://$PUBLIC_HOST/"
info "  版本:    http://localhost:8080/apms/version"
info "  日志:    tail -f $LOGDIR/backend.log"
info "  状态:    systemctl status $SERVICE_NAME"
info "  回滚:    # 如有问题"
info "           $JARDIR/uploadPath/db.sql.gz 恢复"
info "           cp $BKDIR/apms.jar $JARDIR/"
info "           sudo systemctl restart $SERVICE_NAME"
echo ""