import { nextTick } from 'vue'
import { checkPermi } from '@/utils/permission'

const HIGHLIGHT_CLASS = 'rk-assistant-highlight'
const WAIT_TIMEOUT_MS = 5000

const TARGETS = {
  'athlete-add': '[data-rpa="athlete-add"]'
}

function normalizePath(path) {
  if (!path) return ''
  let p = String(path).split('?')[0].split('#')[0]
  p = p.replace(/\/+/g, '/')
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

function isCatchAllRoute(resolved) {
  const matched = resolved && resolved.matched
  if (!matched || !matched.length) return true
  return matched.some(r => r.path === '/:pathMatch(.*)*' || r.path.includes('pathMatch'))
}

function nextFrames(count = 2) {
  return new Promise(resolve => {
    let n = 0
    const tick = () => {
      n += 1
      if (n >= count) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(HIGHLIGHT_CLASS))
}

/**
 * 等待页面内锚点出现；超时 resolve null，不 reject。
 */
function waitForAnchor(key, { isCancelled } = {}) {
  const selector = TARGETS[key]
  if (!selector) return Promise.resolve(null)

  return new Promise(resolve => {
    let observer = null
    let timer = null
    let settled = false

    const finish = (el) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (observer) observer.disconnect()
      resolve(el || null)
    }

    const find = () => {
      if (isCancelled && isCancelled()) {
        finish(null)
        return null
      }
      return document.querySelector(selector)
    }

    timer = setTimeout(() => finish(null), WAIT_TIMEOUT_MS)
    const immediate = find()
    if (immediate) {
      finish(immediate)
      return
    }
    observer = new MutationObserver(() => {
      const el = find()
      if (el) finish(el)
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
}

function highlight(el, durationMs) {
  if (!el) return
  clearHighlights()
  el.classList.add(HIGHLIGHT_CLASS)
  try {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch (e) {
    // 旧浏览器忽略平滑滚动
  }
  setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), durationMs || 3000)
}

/**
 * 执行 navigate（+ highlightKey）。失败只返回原因，不抛错。
 * @param {object} action 后端下发动作
 * @param {object} ctx { router, allowedPaths, actionSeq }
 */
export async function runAction(action, ctx) {
  if (!action || action.type !== 'navigate') {
    return { ok: false, reason: 'unsupported-action' }
  }
  const path = normalizePath(action.path)
  if (!path || !ctx.allowedPaths || !ctx.allowedPaths.has(path)) {
    return { ok: false, reason: 'route-not-allowed' }
  }

  const resolved = ctx.router.resolve(path)
  const matched = resolved.matched || []
  const last = matched[matched.length - 1]
  if (isCatchAllRoute(resolved) || !last || !last.name) {
    return { ok: false, reason: 'route-not-found' }
  }

  const seq = ctx.actionSeq
  const isCurrent = () => (ctx.isCurrent ? ctx.isCurrent() : seq === ctx.actionSeq)
  await ctx.router.push(path)
  if (!isCurrent()) return { ok: false, reason: 'superseded' }
  if (normalizePath(ctx.router.currentRoute.value.path) !== path) {
    return { ok: false, reason: 'not-on-target' }
  }

  if (!action.highlightKey) {
    return { ok: true, highlighted: false }
  }
  if (action.requiresPerm && !checkPermi(action.requiresPerm)) {
    return { ok: true, highlighted: false, reason: 'no-perm' }
  }

  await nextTick()
  await nextFrames(2)
  if (!isCurrent()) return { ok: false, reason: 'superseded' }

  const el = await waitForAnchor(action.highlightKey, {
    isCancelled: () => !isCurrent()
      || normalizePath(ctx.router.currentRoute.value.path) !== path
  })
  if (!el) {
    return { ok: true, highlighted: false, reason: 'anchor-not-found' }
  }
  if (!isCurrent()) return { ok: false, reason: 'superseded' }
  highlight(el, action.durationMs)
  return { ok: true, highlighted: true }
}

export { clearHighlights }
