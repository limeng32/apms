/**
 * 多入口域名判定
 *
 * 同一份前端 dist 服务两个生产入口：
 *  - aoti.apms.top：完整登录/业务系统（默认形态）
 *  - www.apms.top / apms.top（裸域）：纯品牌展示页（无登录表单/客户 logo，
 *    一切路由收敛到落地页）
 *
 * 模式差异全部在前端按 hostname 判定，nginx 仅声明多个 server_name。
 * 命中域名可用构建期变量 VITE_SHOWCASE_HOSTS（逗号分隔）覆盖，默认 www.apms.top 与裸域 apms.top。
 */

const DEFAULT_SHOWCASE_HOSTS = 'www.apms.top,apms.top'
const DEV_PREVIEW_KEY = 'apms_showcase_preview'

function configuredHosts() {
  const raw = import.meta.env.VITE_SHOWCASE_HOSTS || DEFAULT_SHOWCASE_HOSTS
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * 是否为「本机/内网」环境：此类环境即使是 production 构建（如本机 UAT）
 * 也允许用 ?showcase=1 旁路预览展示页。
 * 含 localhost、loopback 与 RFC1918 私网段；真实生产域名、公网 IP 不在内。
 */
function isLocalLikeHost(host) {
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true
  const m = host.match(/^172\.(\d{1,2})\./)
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31
}

/**
 * 当前访问是否处于「品牌展示」入口。
 *
 * 预览旁路（dev server 与本机/内网 UAT；生产域名构建与公网访问均不存在）：
 *  - 访问任意 URL 带 ?showcase=1 → 开启本标签会话的展示模式并写入 sessionStorage
 *    （随后守卫把路径收敛到 /，查询串会消失，故需会话内保持）
 *  - ?showcase=0 → 关闭展示预览
 */
export function isShowcaseHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (configuredHosts().includes(host)) return true

  if (import.meta.env.DEV || isLocalLikeHost(host)) {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('showcase') === '1') {
        sessionStorage.setItem(DEV_PREVIEW_KEY, '1')
        return true
      }
      if (params.get('showcase') === '0') {
        sessionStorage.removeItem(DEV_PREVIEW_KEY)
        return false
      }
      return sessionStorage.getItem(DEV_PREVIEW_KEY) === '1'
    } catch (e) {
      // 隐私模式等场景 sessionStorage 不可用：仅当次请求带查询串时生效（上方已 return）
      return false
    }
  }
  return false
}
