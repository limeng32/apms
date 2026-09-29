/**
 * 演示模式 · Demo Mock 引擎
 *
 * 三部分：
 * 1. normalizeRequest(config) —— adapter 第一道工序（P0，详见 demo_mode_plan.md §五）。
 *    请求拦截器已把 GET 的 config.params 用 tansParams 拼进 config.url 并清空 params，
 *    adapter 拿到的永远是 '/x/list?pageNum=1'、params={}，必须先规范化再匹配；
 * 2. mockDispatch(ctx) —— method+path 精确/参数段匹配 handler，未匹配不静默成功；
 * 3. demoAdapter(config) —— 挂到 axios config.adapter，返回完整 AxiosResponse。
 */
import { handlers } from './handlers/index.js'

/* Vite 构建期替换；Node 桩测环境由 loader 改写为 globalThis.__VITE_ENV__ */
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
function isStrict() {
  return ENV.DEV === true || ENV.VITE_DEMO_MOCK_STRICT === 'true'
}

/* ----------------------------- 参数扁平化（config.params 残留） ----------------------------- */

/**
 * query 参数写入：同时兼容两种数组序列化
 * - 重复键：a=1&a=2 → { a: ['1','2'] }（axios 默认风格）
 * - 方括号下标：a[0]=1&a[1]=2 → { a: ['1','2'] }（RuoYi tansParams 风格，
 *   花名册年龄组 ageGroups 即此形态，纯数字下标按数组合并，其余按下标对象处理）
 */
function appendQuery(target, rawKey, value) {
  const m = /^([^[\]]+)\[([^[\]]*)\]$/.exec(rawKey)
  if (m) {
    const [, name, idx] = m
    if (target[name] === undefined) target[name] = /^\d+$/.test(idx) ? [] : {}
    target[name][/^\d+$/.test(idx) ? Number(idx) : idx] = value
    return
  }
  if (Object.prototype.hasOwnProperty.call(target, rawKey)) {
    if (!Array.isArray(target[rawKey])) target[rawKey] = [target[rawKey]]
    target[rawKey].push(value)
  } else {
    target[rawKey] = value
  }
}

function flattenParams(params, target) {
  if (!params || typeof params !== 'object') return
  const walk = (prefix, value) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          Object.keys(item).forEach(k => walk(`${prefix}[${i}][${k}]`, item[k]))
        } else {
          appendQuery(target, `${prefix}[${i}]`, String(item))
        }
      })
    } else if (typeof value === 'object') {
      Object.keys(value).forEach(k => walk(`${prefix}[${k}]`, value[k]))
    } else {
      // 与 axios 默认 URL 序列化一致：query 值一律字符串
      appendQuery(target, prefix, String(value))
    }
  }
  Object.keys(params).forEach(key => walk(key, params[key]))
}

/* --------------------------------- normalizeRequest --------------------------------- */

export function normalizeRequest(config) {
  const method = (config.method || 'get').toLowerCase()

  // 自定义 adapter 收到的 url 正常不含 baseURL（buildFullPath 由默认 adapter 内部完成），
  // 这里防御性剥一次前缀。
  let rawUrl = config.url || ''
  if (config.baseURL && rawUrl.startsWith(config.baseURL)) {
    rawUrl = rawUrl.slice(config.baseURL.length)
  }
  const u = new URL(rawUrl, 'http://demo.local')

  // searchParams → 普通对象；方括号下标按数组合并，同名重复键也收为数组
  const query = {}
  for (const [key, value] of u.searchParams.entries()) {
    appendQuery(query, key, value)
  }
  // GET 的 params 已被拦截器清空；非 GET 若用 params（POST ?taskId= 等），axios 默认
  // 在 adapter 内才序列化——此处补拍，使 handler 统一只从 ctx.query 取参。
  flattenParams(config.params, query)

  // POST/PUT 的 config.data 已被 axios transformRequest 序列化为 JSON 字符串；
  // 防御：拿到对象时直用（字符串才 parse），数组/标量原样保留。
  let body = config.data
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (trimmed) {
      try { body = JSON.parse(trimmed) } catch (e) { /* 非 JSON 体（如 form 串），保留原串 */ }
    } else {
      body = {}
    }
  }
  if (body === undefined || body === null) body = {}

  return { method, path: u.pathname, query, body, rawConfig: config }
}

/* --------------------------------- 路由匹配 --------------------------------- */

function compilePattern(pattern) {
  return pattern.split('/').map(seg => (
    seg.startsWith(':') ? { key: seg.slice(1) } : { lit: seg }
  ))
}

const exactRoutes = new Map()
const paramRoutes = []
for (const def of handlers) {
  if (def.pattern.includes(':')) {
    paramRoutes.push({ ...def, segs: compilePattern(def.pattern) })
  } else {
    exactRoutes.set(`${def.method} ${def.pattern}`, def)
  }
}

function matchRoute(method, path) {
  const exact = exactRoutes.get(`${method} ${path}`)
  if (exact) return { def: exact, params: {} }
  const pathSegs = path.split('/')
  outer: for (const routeDef of paramRoutes) {
    if (routeDef.method !== method) continue
    const patternSegs = routeDef.segs
    if (patternSegs.length !== pathSegs.length) continue
    const params = {}
    for (let i = 0; i < patternSegs.length; i++) {
      const patternSeg = patternSegs[i]
      const pathSeg = pathSegs[i]
      if (Object.prototype.hasOwnProperty.call(patternSeg, 'lit')) {
        if (patternSeg.lit !== pathSeg) continue outer
      } else {
        if (!pathSeg) continue outer
        params[patternSeg.key] = decodeURIComponent(pathSeg)
      }
    }
    return { def: routeDef, params }
  }
  return null
}

/* --------------------------------- 未匹配策略 --------------------------------- */

function missResponse(ctx) {
  // 任何环境、任何方法，未匹配都先打 error，控制台零容忍
  console.error('[DEMO MOCK MISS]', ctx.method.toUpperCase(), ctx.path, ctx.query)
  // 惰性读取：env 正常构建期是静态常量；惰性求值对行为无影响，且便于 Node 桩测切换模式
  if (isStrict() || ctx.method !== 'get') {
    // strict：GET 也 601（逼出"有菜单没数据"）；lenient：写操作仍不允许假成功
    return {
      code: 601,
      msg: isStrict()
        ? `演示数据接口尚未实现：${ctx.method.toUpperCase()} ${ctx.path}`
        : '演示环境暂不支持此操作'
    }
  }
  // lenient：未匹配 GET 给空态 200，页面呈现空列表/空详情
  return { code: 200, msg: '操作成功', rows: [], total: 0, data: null }
}

export function mockDispatch(ctx) {
  const matched = matchRoute(ctx.method, ctx.path)
  if (!matched) return missResponse(ctx)
  ctx.params = matched.params
  return matched.def.handle(ctx)
}

/* --------------------------------- adapter --------------------------------- */

export function demoAdapter(config) {
  return new Promise((resolve, reject) => {
    try {
      const ctx = normalizeRequest(config)
      const result = mockDispatch(ctx)
      Promise.resolve(result).then((data) => {
        // 完整 AxiosResponse；request.responseType 供现有响应拦截器判 blob（演示无 blob）
        resolve({
          data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: { responseType: config.responseType }
        })
      }).catch(reject)
    } catch (err) {
      reject(err)
    }
  })
}
