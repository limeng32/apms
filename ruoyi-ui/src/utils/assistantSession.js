import { isDemoMode } from '@/utils/auth'

const STORAGE_KEY = 'apms_assistant_session'
const MAX_MESSAGES = 30
const MAX_BYTES = 32 * 1024

function currentMode() {
  return isDemoMode() ? 'demo' : 'real'
}

function ownerOf(userId) {
  return { mode: currentMode(), userId: userId == null ? 'anon' : String(userId) }
}

/**
 * 读取当前账号/模式的会话；owner 不匹配、损坏或存储不可用时一律丢弃。
 * @param {number|string} userId
 * @returns {Array}
 */
export function loadAssistantSession(userId) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const payload = JSON.parse(raw)
    const owner = ownerOf(userId)
    if (!payload || !payload.owner
      || payload.owner.mode !== owner.mode
      || String(payload.owner.userId) !== owner.userId) {
      sessionStorage.removeItem(STORAGE_KEY)
      return []
    }
    return Array.isArray(payload.messages) ? payload.messages.slice(-MAX_MESSAGES) : []
  } catch (e) {
    try { sessionStorage.removeItem(STORAGE_KEY) } catch (ignored) { /* ignore */ }
    return []
  }
}

/**
 * 保存会话（仅文本与动作，不存 token/手机号等凭证）。
 * @param {number|string} userId
 * @param {Array} messages
 */
export function saveAssistantSession(userId, messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    clearAssistantSession()
    return
  }
  const payload = {
    owner: ownerOf(userId),
    messages: messages.slice(-MAX_MESSAGES).map(m => ({
      id: m.id,
      role: m.role,
      text: m.fullText || m.text || '',
      intent: m.intent || null,
      action: m.action || null,
      error: m.error || null,
      createdAt: m.createdAt || Date.now()
    })),
    updatedAt: Date.now()
  }
  const raw = JSON.stringify(payload)
  if (raw.length > MAX_BYTES) {
    payload.messages = payload.messages.slice(-10)
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    // 存储不可用时不阻断助手
  }
}

/** 清除会话（logout / Demo 切换 / 401）。同时广播事件让已挂载的助手立即重置内存态。 */
export function clearAssistantSession(notify = true) {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch (e) { /* ignore */ }
  if (!notify) return
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apms:assistant-reset'))
    }
  } catch (e) { /* ignore */ }
}
