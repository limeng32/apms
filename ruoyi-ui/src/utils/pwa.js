/**
 * 业务站（aoti.apms.top）PWA 全屏支持：仅生产环境 + 非展示站入口启用。
 *
 * 背景：安卓大屏通过 Chrome「添加到主屏幕」进入网站。挂上 Web App Manifest
 * （display: fullscreen）并注册 Service Worker 后，Chrome 会把站点识别为
 * 可安装 PWA——从主屏幕图标启动时无地址栏/标签栏、全屏运行，无需用户点击。
 *
 * 展示站（www/apms.top）不注入 manifest、不注册 SW，保持普通网页形态；
 * 开发环境（dev/本机 UAT）同样不启用，避免 SW 干扰本地调试。
 * Service Worker 本身不拦截任何请求（见 public/sw.js），无缓存副作用。
 */
import { isShowcaseHost } from '@/utils/entry'

const MANIFEST_HREF = '/pwa/manifest-aoti.json'
const SW_URL = '/sw.js'
const THEME_COLOR = '#0a1120'

function injectManifest() {
  if (document.querySelector('link[rel="manifest"]')) return
  const link = document.createElement('link')
  link.rel = 'manifest'
  link.href = MANIFEST_HREF
  document.head.appendChild(link)

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = THEME_COLOR
    document.head.appendChild(meta)
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // 任何注册失败均静默：PWA 增强不可用时页面仍是普通网页，不影响登录
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL).catch(() => {})
  })
}

export function setupPortalPwa() {
  if (!import.meta.env.PROD) return
  if (isShowcaseHost()) return
  injectManifest()
  registerServiceWorker()
}
