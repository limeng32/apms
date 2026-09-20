/**
 * 登录页配置工具：默认值深合并、占位符插值、CSS 变量映射、URL 白名单
 */
import defaultConfig from './login.defaults'

/**
 * 5 个固定系统字体栈（只存枚举值，原始 font-family 由这里映射）
 */
export const FONT_STACKS = {
  // system 必须与全局 body 字体栈（assets/styles/index.scss）一致，保证登录页字体零变化
  system: `"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif`,
  pingfang: `"PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`,
  yahei: `"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, sans-serif`,
  heiti: `"Heiti SC", "SimHei", "PingFang SC", "Microsoft YaHei", sans-serif`,
  songti: `"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif`
}

function isPlainObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]'
}

/**
 * 递归合并：对象按 key 深度合并；数组与原始值整体覆盖（与库中保存语义一致）
 */
export function deepMerge(base, override) {
  if (!isPlainObject(override)) return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  Object.keys(override).forEach((key) => {
    const bv = base ? base[key] : undefined
    const ov = override[key]
    if (isPlainObject(bv) && isPlainObject(ov)) {
      out[key] = deepMerge(bv, ov)
    } else {
      out[key] = ov
    }
  })
  return out
}

/** 克隆默认配置（配置是纯 JSON 数据，JSON 序列化即可） */
export function cloneDefaults() {
  return JSON.parse(JSON.stringify(defaultConfig))
}

/**
 * 库中配置（可能为 {} 或缺字段）与默认值深度合并 → 完整配置
 */
export function mergeWithDefaults(raw) {
  return deepMerge(cloneDefaults(), isPlainObject(raw) ? raw : {})
}

/**
 * 文案占位符：{title} {year} {footerContent}
 */
export function interpolate(text, ctx) {
  if (typeof text !== 'string') return ''
  return text.replace(/\{(\w+)\}/g, (_, key) => (ctx[key] != null ? String(ctx[key]) : ''))
}

/**
 * #rrggbb / #rgb → rgba 字符串；无法解析时原样返回
 */
export function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return hex
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const px = (v, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${n}px` : fallback
}

/**
 * 配置 → CSS 变量键值对（绑定到 Renderer 根节点）
 */
export function toCssVars(config) {
  const c = mergeWithDefaults(config)
  const colors = c.colors
  const ty = c.typography
  const grad = colors.brandGradient
  const stops = Array.isArray(grad.stops) && grad.stops.length ? grad.stops : ['#16302a', '#1d3b33', '#27503f']
  const angle = Number(grad.angle) || 150

  return {
    '--login-brand-bg': `linear-gradient(${angle}deg, ${stops.join(', ')})`,
    '--login-accent': colors.accent,
    // 品牌区装饰光晕（由 accent 派生）
    '--login-glow-1': hexToRgba(colors.accent, 0.18),
    // 第二处光晕在原版中是独立色 #3fa96e@0.12，并非 accent 派生
    '--login-glow-2': hexToRgba(colors.glow2 || '#3fa96e', 0.12),
    '--login-btn-bg': colors.buttonBg,
    '--login-btn-hover': colors.buttonHover,
    '--login-btn-loading': colors.buttonLoading,
    '--login-text-brand': colors.textOnBrand,
    '--login-text-muted': colors.textOnBrandMuted,
    // 品牌区若干固定透明度文字（由 textOnBrand 派生，等价改造前的 rgba 白字）
    '--login-brand-sub': hexToRgba(colors.textOnBrand, 0.55),
    '--login-brand-feature': hexToRgba(colors.textOnBrand, 0.78),
    '--login-brand-foot': hexToRgba(colors.textOnBrand, 0.35),
    '--login-brand-border': hexToRgba(colors.textOnBrand, 0.08),
    '--login-text-1': colors.formTitle,
    '--login-text-2': colors.formSubText,
    '--login-border': colors.inputBorder,
    '--login-input-focus': colors.inputFocus,
    '--login-link': colors.link,
    '--login-page-bg': colors.pageBg,
    '--login-radius': px(c.layout.cardRadius, '10px'),
    '--login-hero-size': px(ty.heroSize, '38px'),
    '--login-hero-weight': String(Number(ty.heroWeight) || 700),
    '--login-brand-size': px(ty.brandNameSize, '22px'),
    '--login-form-title-size': px(ty.formTitleSize, '24px'),
    '--login-font-family': FONT_STACKS[ty.fontFamily] || FONT_STACKS.system,
    // 直接输出完整的两栏轨道值（1.1fr 合法且全浏览器兼容；不要用 calc(1.1 * 1fr)）
    '--login-split': `${Number(c.layout.splitRatio) || 1.1}fr 1fr`
  }
}

/**
 * 版权富文本解析（ICP 备案链接场景）
 *
 * 安全模型：白名单制，绝不使用 v-html。
 * - 仅识别 <a href="http(s)://...">文字</a>（可带 target="_blank"、rel）；
 * - 任何其他标签、事件属性、javascript:/data: 链接均不识别，整段按纯文本渲染（Vue 插值自动转义）；
 * - 返回分段数组，由 FooterRichText 组件渲染：[{type:'text',value}|{type:'link',label,url}]。
 *
 * @param {string} source 原始模板（可含 {year} 等占位符）
 * @param {object} ctx 占位符上下文
 */
const ANCHOR_RE = /<a\s+([^<>]*?)>([^<>]*)<\/a>/gi
const ATTR_RE = /\s*([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/y

function parseAnchorAttrs(attrText) {
  let pos = 0
  let href = null
  let target = null
  let rel = null
  while (pos < attrText.length) {
    ATTR_RE.lastIndex = pos
    const m = ATTR_RE.exec(attrText)
    if (!m || m.index !== pos) return null
    pos = m.index + m[0].length
    const name = m[1].toLowerCase()
    const val = m[2] !== undefined ? m[2] : m[3]
    if (name === 'href') href = val
    else if (name === 'target') target = val
    else if (name === 'rel') rel = val
    else return null // 白名单外属性（含 onclick 等）直接判非法
  }
  if (!href || !/^https?:\/\/.+$/i.test(href.trim())) return null
  if (target && !/^_blank$/i.test(target.trim())) return null
  if (rel && !/^[A-Za-z0-9 _-]{0,50}$/.test(rel)) return null
  return { href: href.trim() }
}

export function parseRichText(source, ctx) {
  const text = interpolate(source == null ? '' : String(source), ctx || {})
  const segments = []
  let last = 0
  ANCHOR_RE.lastIndex = 0
  let m
  while ((m = ANCHOR_RE.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) })
    const parsed = parseAnchorAttrs(m[1])
    if (parsed) {
      segments.push({ type: 'link', label: m[2], url: parsed.href })
    } else {
      // 非法 <a>：整段原样输出为文本（会被转义显示，不执行）
      segments.push({ type: 'text', value: m[0] })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}

/**
 * 忘记密码链接白名单（渲染层二次防护）：
 * 仅允许 http(s):// 绝对地址或单个 / 开头的站内路径；拒绝 javascript:/data:/file:///host
 * @returns 合法返回原 URL，否则返回空串（调用方退化为纯文本/点击无动作）
 */
export function safeUrl(url) {
  if (typeof url !== 'string') return ''
  const u = url.trim()
  if (!u) return ''
  if (/^(https?:)\/\//i.test(u)) return u
  if (/^\/(?!\/)/.test(u)) return u // 单斜杠开头的站内相对路径，//host 协议相对地址被排除
  return ''
}
