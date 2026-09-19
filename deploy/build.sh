#!/usr/bin/env bash
# ============================================================
# APMS 本地构建 + 远程部署（本地执行）
# ------------------------------------------------------------
# 用法：
#   # 1. 从 pom.xml 读取 <apms.version>（推荐，pom 是版本真相源）
#   bash build.sh
#
#   # 2. 临时覆盖版本号（不建议，定版应改 pom）
#   bash build.sh --version 0.0.2-0917143015
#
#   # 3. 只构建不部署
#   bash build.sh --only-build
#
# 这个脚本做的事：
#   (1) Maven clean package -DskipTests（注入 apms.version）
#   (2) Vue vite build
#   (3) ssh + scp 上传产物到远程 /opt/apms/upload/
#   (4) ssh 远程执行 deploy.sh
# ============================================================
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-<YOUR_SERVER_IP>}"
# deploy.sh 内部直接执行 systemctl/cp /etc/systemd/system/
# 需要 root 权限，因此默认 root。
#
# 生产安全加固（可选但推荐）：
#   1. 创建 deploy 账户 + SSH key，禁止密码登录
#   2. 配置 NOPASSWD sudoers 只放行必要命令：
#      /etc/sudoers.d/apms-deploy:
#        deploy ALL=(root) NOPASSWD: \
#          /usr/bin/systemctl stop apms-backend, \
#          /usr/bin/systemctl start apms-backend, \
#          /usr/bin/systemctl restart apms-backend, \
#          /usr/bin/systemctl status apms-backend, \
#          /usr/bin/systemctl daemon-reload, \
#          /usr/bin/systemctl reset-failed apms-backend, \
#          /usr/bin/cp, \
#          /usr/sbin/nginx, \
#          /usr/bin/mkdir, \
#          /usr/bin/chmod
#   3. 远端调用改成 sudo:
#      REMOTE_USER=deploy bash deploy/build.sh
#      (build.sh 内部 ssh 命令会自动加 sudo)
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/apms}"
# SSH 选项：默认强制验证 host key（生产安全）
# 开发期如果想临时跳过（⚠️ 仅内网/本地开发），执行：
#   KNOWN_HOSTS_FILE=/dev/null bash deploy/build.sh
SSH_OPTS=()
if [ "${KNOWN_HOSTS_FILE:-}" = "/dev/null" ]; then
    SSH_OPTS+=(-o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no)
fi
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[LOCAL]${NC} $(date '+%H:%M:%S') $*"; }
warn() { echo -e "${YELLOW}[WARN ]${NC} $*"; }
err()  { echo -e "${RED}[ERR  ]${NC} $*"; exit 1; }

# ===== 参数 =====
VERSION=""
ONLY_BUILD=0
DEPLOY_SKIP_ARGS=""    # 透传给远程 deploy.sh 的额外参数
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        --only-build) ONLY_BUILD=1; shift ;;
        --skip-patch) DEPLOY_SKIP_ARGS="$DEPLOY_SKIP_ARGS --skip-patch"; shift ;;
        --skip-cache) DEPLOY_SKIP_ARGS="$DEPLOY_SKIP_ARGS --skip-cache"; shift ;;
        *) err "未知参数: $1" ;;
    esac
done

# 版本号：优先 --version 参数，否则读 pom.xml <apms.version>
if [ -z "$VERSION" ]; then
    VERSION=$(grep '<apms.version>' "$PROJECT_ROOT/pom.xml" | head -1 | sed 's/.*<apms.version>\(.*\)<\/apms.version>.*/\1/')
    log "版本来自 pom.xml: $VERSION"
else
    log "版本来自 --version 参数: $VERSION"
fi
[ -z "$VERSION" ] && err "无法确定版本号：pom.xml 没有 <apms.version> 也没传 --version"

cd "$PROJECT_ROOT"

echo ""
echo "=========================================="
echo "  APMS Build → ${VERSION}"
echo "=========================================="
echo ""

# ===== Step 1: Maven 后端 =====
log "Step 1: Maven 后端构建..."
mvn clean package -DskipTests -q -Dapms.version="$VERSION"
JAR_FILE="$PROJECT_ROOT/ruoyi-admin/target/apms.jar"
[ -f "$JAR_FILE" ] || err "jar 未生成"
# 验证版本注入
INJECTED_VERSION=$(unzip -p "$JAR_FILE" BOOT-INF/classes/version.properties 2>/dev/null | grep '^app.version=' | cut -d= -f2)
log "  jar: $(ls -lh "$JAR_FILE" | awk '{print $5}')"
log "  版本注入验证: ${INJECTED_VERSION:-⚠️ 未注入}"

# ===== Step 2: Vue 前端 =====
log "Step 2: Vue 前端构建..."
cd "$PROJECT_ROOT/ruoyi-ui"
if [ -d node_modules ]; then
    npx vite build 2>&1 | tail -5 || err "Vite build 失败"
else
    warn "  node_modules 不存在，跳过前端构建"
fi
cd "$PROJECT_ROOT"

if [ "$ONLY_BUILD" -eq 1 ]; then
    log "✅ Build 完成 (--only-build)，产物位置："
    echo "  $JAR_FILE"
    echo "  $PROJECT_ROOT/ruoyi-ui/dist/"
    exit 0
fi

# ===== Step 3: 准备上传目录 =====
log "Step 3: 上传到 $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/"
ssh "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR/upload/patches"

# 3a. 上传 jar
scp "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$JAR_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/apms.jar" >/dev/null 2>&1

# 3b. 上传前端 dist
if [ -d "$PROJECT_ROOT/ruoyi-ui/dist" ]; then
    if command -v rsync >/dev/null 2>&1; then
        RSYNC_SSH="ssh"
        [ "${KNOWN_HOSTS_FILE:-}" = "/dev/null" ] && RSYNC_SSH="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
        rsync -avz --delete -e "$RSYNC_SSH" "$PROJECT_ROOT/ruoyi-ui/dist/" \
            "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/dist/" >/dev/null 2>&1 || \
        scp -r "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$PROJECT_ROOT/ruoyi-ui/dist/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/dist"
    else
        scp -r "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$PROJECT_ROOT/ruoyi-ui/dist/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/dist"
    fi
fi

# 3c. 上传 deploy 配置文件（含 apms-backend.service，首次部署必须）
for f in apms-nginx.conf apms-backend.service; do
    if [ -f "$PROJECT_ROOT/deploy/$f" ]; then
        scp "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$PROJECT_ROOT/deploy/$f" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/$f" >/dev/null 2>&1
    fi
done

# 3d. 上传 patches（增量）
# 生产安全：patches 上传失败必须中止，防止"漏传 SQL patch 却照常发布"导致库结构落后于代码
if [ -d "$PROJECT_ROOT/patches" ] && [ "$(ls -A "$PROJECT_ROOT/patches/"*.sql 2>/dev/null | wc -l)" -gt 0 ]; then
    RSYNC_SSH="ssh"
    [ "${KNOWN_HOSTS_FILE:-}" = "/dev/null" ] && RSYNC_SSH="ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
    LOCAL_PATCH_CNT=$(ls "$PROJECT_ROOT/patches/"*.sql 2>/dev/null | wc -l | tr -d '[:space:]')

    if rsync -az -e "$RSYNC_SSH" "$PROJECT_ROOT/patches/" \
        "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/patches/" >/dev/null 2>&1; then
        log "  patches rsync 完成"
    else
        warn "  rsync 失败/不可用，回退 scp..."
        scp -r "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$PROJECT_ROOT/patches/"*.sql \
            "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/upload/patches/" >/dev/null 2>&1 \
            || err "patches 上传失败（rsync/scp 均失败），已中止发布以避免漏执行 SQL patch"
    fi

    # 远端校验：upload/patches 下 .sql 数量必须与本地一致，不一致立即中止
    REMOTE_PATCH_CNT=$(ssh "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$REMOTE_USER@$REMOTE_HOST" \
        "ls $REMOTE_DIR/upload/patches/*.sql 2>/dev/null | wc -l" 2>/dev/null | tr -d '[:space:]')
    if [ "${REMOTE_PATCH_CNT:-0}" != "$LOCAL_PATCH_CNT" ]; then
        err "patches 校验失败：本地 $LOCAL_PATCH_CNT 个，远端 ${REMOTE_PATCH_CNT:-?} 个，已中止发布"
    fi
    log "  patches 校验通过（远端 $REMOTE_PATCH_CNT / 本地 $LOCAL_PATCH_CNT）"
fi

log "  ✅ 上传完成"

# ===== Step 4: 远程执行 deploy.sh =====
log "Step 4: 远程执行 deploy.sh --version $VERSION $DEPLOY_SKIP_ARGS"
scp "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$PROJECT_ROOT/deploy/deploy.sh" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/deploy.sh" >/dev/null 2>&1

# 非 root 用户自动加 sudo（需要 NOPASSWD sudoers 配置）
REMOTE_SUDO=""
[ "$REMOTE_USER" != "root" ] && REMOTE_SUDO="sudo"

ssh "${SSH_OPTS[@]+"${SSH_OPTS[@]}"}" "$REMOTE_USER@$REMOTE_HOST" \
    "$REMOTE_SUDO bash $REMOTE_DIR/deploy.sh --version $VERSION $DEPLOY_SKIP_ARGS"

echo ""
log "=========================================="
log "  ✅ 全流程完成 → ${VERSION}"
log "=========================================="
echo ""