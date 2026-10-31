/**
 * AI 功能表（运行时门控数据源）。
 *
 * - ai 部署：GET /apms/ai/features 返回 edition 与各插件开关；
 * - standard 部署：无此端点（404 / 框架 NoResource），静默降级为无插件；
 * - demo 模式：不发请求，已注册插件全部视为启用。
 *
 * 刻意使用 fetch + 手工 Bearer 而非全局 request：standard 线的 404/500 不应触发
 * 全局错误弹窗（风格与 api/loginConfig 的静默回退一致）。
 */
import { reactive } from 'vue'
import { getToken, isDemoMode } from '@/utils/auth'
import plugins from './registry'

const BASE = import.meta.env.VITE_APP_BASE_API || ''

export const aiState = reactive({
  edition: 'standard',
  loaded: false,
  plugins: {}
})

/** 某插件当前是否启用（未加载完时一律 false，避免闪现） */
export function pluginEnabled(key) {
  return aiState.loaded === true && !!(aiState.plugins[key] && aiState.plugins[key].enabled)
}

function demoSnapshot() {
  const map = {}
  for (const p of plugins) {
    map[p.key] = { enabled: true, name: p.name }
  }
  return { edition: 'ai', plugins: map }
}

let inflight = null

export function loadAiFeatures() {
  if (inflight) return inflight

  if (isDemoMode()) {
    Object.assign(aiState, demoSnapshot(), { loaded: true })
    inflight = Promise.resolve(aiState)
    return inflight
  }

  inflight = (async () => {
    try {
      const token = getToken()
      const res = await fetch(`${BASE}/apms/ai/features`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      if (!body || body.code !== 200 || !body.data) throw new Error('bad payload')
      aiState.edition = body.data.edition === 'ai' ? 'ai' : 'standard'
      aiState.plugins = body.data.plugins || {}
      aiState.loaded = true
    } catch (e) {
      // standard 线端点不存在 / 网络异常：静默视为无 AI 能力
      aiState.edition = 'standard'
      aiState.plugins = {}
      aiState.loaded = true
    }
    return aiState
  })()
  return inflight
}
