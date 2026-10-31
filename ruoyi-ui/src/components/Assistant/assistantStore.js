import { defineStore } from 'pinia'
import router from '@/router'
import useUserStore from '@/store/modules/user'
import { isDemoMode } from '@/utils/auth'
import { loadAssistantSession, saveAssistantSession, clearAssistantSession } from '@/utils/assistantSession'
import { getCapabilities, streamChat } from './assistantClient'
import { runAction, clearHighlights } from './assistantActions'

const TYPE_INTERVAL_MS = 20
const TYPE_STEP = 2
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16)}`
  }
  // 最后兜底：时间戳 + 随机数，保证仍是 v4 形态
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${rand().slice(0, 8)}-${rand().slice(0, 4)}-4${rand().slice(0, 3)}-a${rand().slice(0, 3)}-${rand()}${rand().slice(0, 4)}`
}

function freshMessage(role, text) {
  return {
    id: uuid(),
    role,
    text: role === 'user' ? text : '',
    fullText: role === 'user' ? text : '',
    visibleLength: role === 'user' ? text.length : 0,
    pending: role === 'assistant',
    streamEnded: role === 'user',
    stopped: false,
    error: '',
    intent: '',
    action: null,
    actionState: '',
    createdAt: Date.now()
  }
}

const useAssistantStore = defineStore('assistant', {
  state: () => ({
    open: false,
    owner: { mode: '', userId: '' },
    initialized: false,
    messages: [],
    suggestions: [],
    allowedPathList: [],
    capabilityLoaded: false,
    loading: false,
    sessionId: uuid(),
    actionSeq: 0,
    abortController: null,
    typeTimer: null
  }),
  getters: {
    allowedPaths: (state) => new Set(state.allowedPathList),
    hasMessages: (state) => state.messages.length > 0
  },
  actions: {
    async initialize() {
      const userStore = useUserStore()
      const owner = { mode: isDemoMode() ? 'demo' : 'real', userId: String(userStore.id || 'anon') }
      if (this.initialized && this.owner.mode === owner.mode && this.owner.userId === owner.userId) {
        return
      }
      const stored = loadAssistantSession(userStore.id)
      this.resetSession(false, false)
      this.owner = owner
      this.initialized = true
      this.messages = stored.map(m => ({
        id: m.id || uuid(),
        role: m.role || 'assistant',
        text: m.text || '',
        fullText: m.text || '',
        visibleLength: (m.text || '').length,
        pending: false,
        streamEnded: true,
        stopped: false,
        error: m.error || '',
        intent: m.intent || '',
        action: m.action || null,
        actionState: '',
        createdAt: m.createdAt || Date.now()
      }))
      if (!this.capabilityLoaded) await this.loadCapabilities()
    },

    async loadCapabilities() {
      try {
        const data = await getCapabilities()
        if (data) {
          this.allowedPathList = Array.isArray(data.paths) ? data.paths.slice() : []
          this.suggestions = Array.isArray(data.suggestions) ? data.suggestions.slice() : []
          this.capabilityLoaded = true
        }
      } catch (e) {
        // 能力预热失败不阻塞对话；动作执行时仍会用空集合兜底
        this.allowedPathList = []
      }
    },

    toggle() {
      this.open = !this.open
      if (this.open) this.loadCapabilities()
    },

    openPanel() {
      this.open = true
      this.loadCapabilities()
    },

    closePanel() {
      this.open = false
    },

    ensureSessionId() {
      if (typeof this.sessionId === 'string' && UUID_V4.test(this.sessionId)) {
        return this.sessionId
      }
      // HMR / 旧缓存可能留下 undefined 或非 UUID 的 sessionId
      this.sessionId = uuid()
      return this.sessionId
    },

    async send(rawText) {
      const text = String(rawText || '').trim()
      if (!text || this.loading) return
      if (!this.capabilityLoaded) await this.loadCapabilities()

      this.messages.push(freshMessage('user', text))
      const reply = freshMessage('assistant', '')
      this.messages.push(reply)
      this.loading = true
      this.abortController = new AbortController()

      const payload = {
        sessionId: this.ensureSessionId(),
        message: text.slice(0, 1000),
        context: {
          route: router.currentRoute.value.path,
          pageTitle: router.currentRoute.value.meta?.title || ''
        }
      }

      try {
        await streamChat(payload, {
          signal: this.abortController.signal,
          onEvent: (event, data) => this.handleEvent(reply, event, data)
        })
      } catch (e) {
        if (e && e.name === 'AbortError') {
          reply.stopped = true
        } else {
          reply.error = (e && e.message) || '助手请求失败'
        }
        this.stopTyping()
        reply.pending = false
        reply.streamEnded = true
        this.loading = false
        this.persist()
      }
    },

    handleEvent(message, event, data) {
      if (!message) return
      if (event === 'meta') {
        message.messageId = data?.messageId || ''
        return
      }
      if (event === 'delta') {
        const text = data?.text || ''
        if (text) {
          message.fullText += text
          this.startTyping(message)
        }
        return
      }
      if (event === 'action') {
        message.action = {
          type: data?.type,
          path: data?.path,
          label: data?.label,
          highlightKey: data?.highlightKey,
          requiresPerm: data?.requiresPerm,
          durationMs: data?.durationMs
        }
        return
      }
      if (event === 'done') {
        message.streamEnded = true
        this.finishTypingIfDone(message)
        return
      }
      if (event === 'error') {
        message.error = data?.msg || '助手暂时不可用'
        message.streamEnded = true
        message.pending = false
        this.stopTyping()
        this.loading = false
        this.persist()
      }
    },

    startTyping(message) {
      if (this.typeTimer) return
      this.typeTimer = setInterval(() => {
        const current = this.activeTypingMessage()
        if (!current) {
          this.stopTyping()
          return
        }
        if (current.visibleLength < current.fullText.length) {
          current.visibleLength = Math.min(
            current.fullText.length,
            current.visibleLength + TYPE_STEP
          )
        }
        this.finishTypingIfDone(current)
      }, TYPE_INTERVAL_MS)
    },

    activeTypingMessage() {
      for (let i = this.messages.length - 1; i >= 0; i -= 1) {
        const m = this.messages[i]
        if (m.role === 'assistant' && m.pending) return m
      }
      return null
    },

    finishTypingIfDone(message) {
      if (!message || !message.streamEnded) return
      if (message.visibleLength >= message.fullText.length) {
        message.pending = false
        this.stopTyping()
        this.loading = false
        this.persist()
      }
    },

    stopTyping() {
      if (this.typeTimer) {
        clearInterval(this.typeTimer)
        this.typeTimer = null
      }
    },

    stop() {
      const current = this.activeTypingMessage()
      if (current) {
        current.stopped = true
        current.visibleLength = current.fullText.length
        current.pending = false
      }
      this.stopTyping()
      this.loading = false
      if (this.abortController) {
        this.abortController.abort()
        this.abortController = null
      }
      this.persist()
    },

    async executeAction(message) {
      const action = message && message.action
      if (!action) return
      this.actionSeq += 1
      const seq = this.actionSeq
      message.actionState = 'running'
      const result = await runAction(action, {
        router,
        allowedPaths: this.allowedPaths,
        actionSeq: seq,
        isCurrent: () => this.actionSeq === seq
      })
      message.actionState = result.ok ? (result.highlighted ? 'highlighted' : 'navigated') : 'failed'
      if (result.reason === 'anchor-not-found' || result.reason === 'no-perm') {
        message.actionState = 'navigated'
      }
      if (result.ok) this.open = false
      return result
    },

    clear() {
      this.resetSession(true)
    },

    resetSession(close = false, clearStorage = true) {
      this.stopTyping()
      if (this.abortController) {
        this.abortController.abort()
        this.abortController = null
      }
      this.messages = []
      this.loading = false
      this.actionSeq += 1
      this.sessionId = uuid()
      this.owner = { mode: '', userId: '' }
      this.initialized = false
      this.capabilityLoaded = false
      this.allowedPathList = []
      this.suggestions = []
      if (clearStorage) clearAssistantSession(false)
      clearHighlights()
      if (close) this.open = false
    },

    persist() {
      if (!this.initialized) return
      try {
        const userStore = useUserStore()
        const stable = this.messages.filter(m => !m.pending)
        saveAssistantSession(userStore.id, stable)
      } catch (e) {
        // 存储失败不阻断
      }
    }
  }
})

export default useAssistantStore
