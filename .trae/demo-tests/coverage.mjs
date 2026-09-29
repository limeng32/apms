/**
 * 演示模式 · API 覆盖率门禁（不依赖无头浏览器）
 *
 * 扫描 src/api/apms 目录下全部 .js 中 request({ url, method }) 调用，
 * 与 src/mock/handlers 注册表做 method+路径（支持 :param 段）比对：
 *   - 任意一个 api 接口没有对应 handler → 退出码 1
 *   - 私有下载端点（downloadXxx 直接返回 URL 字符串）不在此列，
 *     它们由 fetch 直发，已在视图层 isDemoMode 守卫，脚本仅做白名单提示。
 *
 * 运行：node .trae/demo-tests/coverage.mjs
 */
import { register } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

register(new URL('./hooks.mjs', import.meta.url))
const { UI_SRC } = await import('./hooks.mjs')
const src = (p) => pathToFileURL(`${UI_SRC}/${p}.js`).href

globalThis.__VITE_ENV__ = { DEV: false, VITE_APP_BASE_API: '/dev-api' }
globalThis.sessionStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}
}

const { handlers } = await import(src('mock/handlers/index'))

/* ---------------- 从 api 源码提取路由 ---------------- */

const API_DIR = `${UI_SRC}/api/apms`
const entries = []
for (const file of readdirSync(API_DIR).filter(f => f.endsWith('.js')).sort()) {
  const code = readFileSync(`${API_DIR}/${file}`, 'utf8')
  // request({ ... url: ... , method: 'x' ... })
  const callRe = /request\(\{[\s\S]*?\}\)/g
  let m
  while ((m = callRe.exec(code))) {
    const block = m[0]
    const urlM = block.match(/url:\s*([^\n,}]+)/)
    if (!urlM) continue
    let expr = urlM[1].trim()
    // 'literal' 或 'literal/' + id（+ '/latest'）
    let path
    if (/^'[^']*'$/.test(expr)) {
      path = expr.slice(1, -1)
    } else {
      const parts = expr.split('+').map(p => p.trim())
      path = parts.map(p => {
        if (/^'[^']*'$/.test(p)) return p.slice(1, -1)
        if (/^\w+$/.test(p)) return ':p'
        throw new Error(`${file}: 无法解析 url 表达式 ${expr}`)
      }).join('')
    }
    const methodM = block.match(/method:\s*'(\w+)'/)
    const method = (methodM ? methodM[1] : 'get').toLowerCase()
    entries.push({ file: file.replace(/\.js$/, ''), method, path })
  }
}

/* ---------------- 匹配 handler 表 ---------------- */

function compile(pattern) {
  return pattern.split('/').map(seg => (seg.startsWith(':') ? { dyn: true } : { lit: seg }))
}
const compiled = handlers.map(h => ({ method: h.method, segs: compile(h.pattern), pattern: h.pattern }))

function hasHandler(method, path) {
  const ps = path.split('/')
  return compiled.some(h => {
    if (h.method !== method || h.segs.length !== ps.length) return false
    return h.segs.every((s, i) => s.dyn || s.lit === ps[i])
  })
}

/* ---------------- 视图层守卫的下载端点白名单（仅提示） ---------------- */

const guardedDownloads = [
  '/apms/medical-record/file/download/:p',
  '/apms/report/download/:p'
]

/* ---------------- 比对输出 ---------------- */

const missing = []
for (const e of entries) {
  if (!hasHandler(e.method, e.path)) missing.push(e)
}

const uniq = new Set(entries.map(e => `${e.method.toUpperCase()} ${e.path}`))
console.log('================ 演示 Mock API 覆盖率 ================')
console.log(`api 文件：${new Set(entries.map(e => e.file)).size} 个；去重接口：${uniq.size} 个；handler：${handlers.length} 条`)
if (missing.length) {
  console.log(`未覆盖 ${missing.length} 个：`)
  missing.forEach(e => console.log(`  ✗ [${e.file}] ${e.method.toUpperCase()} ${e.path}`))
  process.exit(1)
}
console.log('全部 api 接口均有 handler 覆盖 ✅')
console.log(`视图层 fetch 直发、已做 isDemoMode 守卫的下载端点 ${guardedDownloads.length} 个（不要求 handler）：`)
guardedDownloads.forEach(p => console.log(`  · ${p}`))
