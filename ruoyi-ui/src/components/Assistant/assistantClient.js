import { ElMessageBox } from 'element-plus'
import request, { isRelogin } from '@/utils/request'
import { getToken, isDemoMode } from '@/utils/auth'
import useUserStore from '@/store/modules/user'
import { demoCapabilities, demoChatStream } from './assistantDemo'
import { parseSse } from './assistantSse'

const BASE = import.meta.env.VITE_APP_BASE_API || ''

export class AssistantError extends Error {
  constructor(message, status = 0, code = 'UNKNOWN', retryable = true) {
    super(message)
    this.name = 'AssistantError'
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

/**
 * capabilities：真实模式走 axios（自动 baseURL/Bearer/Demo Adapter）；
 * 演示模式在任何网络调用前直接返回本地能力表。
 */
export async function getCapabilities() {
  if (isDemoMode()) return demoCapabilities()
  const res = await request({ url: '/apms/assistant/capabilities', method: 'get' })
  return res.data
}

/**
 * chat：SSE 无法走 axios，fetch 手工拼 baseURL + Bearer；Demo 本地分流。
 */
export async function streamChat(payload, { onEvent, signal } = {}) {
  if (isDemoMode()) {
    return demoChatStream(payload, { onEvent, signal })
  }

  const token = getToken()
  let res
  try {
    res = await fetch(`${BASE}/apms/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal
    })
  } catch (e) {
    if (e && e.name === 'AbortError') throw e
    throw new AssistantError('网络异常，请检查连接后重试', 0, 'NETWORK', true)
  }

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok || !contentType.includes('text/event-stream')) {
    throw await toAssistantError(res)
  }
  try {
    await parseSse(res.body, onEvent)
  } catch (e) {
    if (e && e.name === 'AbortError') throw e
    if (e instanceof AssistantError) throw e
    throw new AssistantError((e && e.message) || '流式解析失败', 0, 'STREAM_ERROR', true)
  }
}

async function toAssistantError(res) {
  const status = res.status
  let body = null
  let text = ''
  try {
    text = await res.text()
    body = text ? JSON.parse(text) : null
  } catch (e) {
    body = null
  }
  const code = body && body.code
  const msg = (body && body.msg) || text || '助手请求失败'

  if (status === 401 || code === 401) {
    promptRelogin(msg)
    return new AssistantError('登录状态已过期，请重新登录', 401, 'UNAUTHORIZED', false)
  }
  if (status === 403 || code === 403) {
    return new AssistantError(msg || '当前账号无权限使用该能力', 403, 'FORBIDDEN', false)
  }
  if (status === 429 || code === 429) {
    const retry = res.headers.get('retry-after')
    return new AssistantError(
      retry ? `请求过于频繁，请 ${retry} 秒后再试` : (msg || '请求过于频繁，请稍后再试'),
      429, 'RATE_LIMITED', true
    )
  }
  if (status === 413) {
    return new AssistantError(msg || '请求内容过大', 413, 'PAYLOAD_TOO_LARGE', false)
  }
  if (status >= 500 || code === 500) {
    return new AssistantError(msg || '服务暂时不可用，请稍后重试', 500, 'SERVER_ERROR', true)
  }
  if (code === 601) {
    return new AssistantError(msg || '操作未完成', 601, 'BUSINESS_ERROR', false)
  }
  return new AssistantError(msg || '助手请求失败', status, code || 'HTTP_ERROR', status >= 500)
}

function promptRelogin(msg) {
  if (isRelogin.show) return
  isRelogin.show = true
  ElMessageBox.confirm(msg || '登录状态已过期，您可以继续留在该页面，或者重新登录', '系统提示', {
    confirmButtonText: '重新登录',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    isRelogin.show = false
    useUserStore().logOut().then(() => {
      location.href = '/index'
    })
  }).catch(() => {
    isRelogin.show = false
  })
}
