/**
 * 登录页配置工具：默认值深合并、占位符插值、CSS 变量映射、URL 白名单
 */
import defaultConfig from './login.defaults'
// 字体栈唯一事实源在 @/utils/theme（登录页与后台整体共用），这里转出供渲染层/设计器复用
import { FONT_STACKS, APP_FONT_FAMILIES } from '@/utils/theme'

export { FONT_STACKS }

function isPlainObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]'
}

/**
 * 内置 logo 库：shield 为定制内联 SVG（Render 中特殊处理），
 * nosc 为随包发布的位图（public/login-assets/，customImage=true），
 * 其余均为已全局注册的 Element Plus 图标组件名。
 * 与后端 LOGO_BUILTINS 白名单保持一致。
 */
export const BUILTIN_LOGOS = [
  { value: 'shield', label: '盾牌（默认）', customSvg: true },
  { value: 'nosc', label: '奥体中心', customImage: '/login-assets/nosc-logo.png' },
  { value: 'Trophy', label: '奖杯' },
  { value: 'Medal', label: '奖牌' },
  { value: 'Star', label: '星星' },
  { value: 'Flag', label: '旗帜' },
  { value: 'Aim', label: '目标' },
  { value: 'Basketball', label: '篮球' },
  { value: 'Football', label: '足球' }
]
export const BUILTIN_LOGO_VALUES = BUILTIN_LOGOS.map((l) => l.value)

/** 取内置位图 logo 地址（shield/EP 图标等非位图 key 返回空串） */
export function builtinLogoImage(key) {
  const hit = BUILTIN_LOGOS.find((l) => l.value === key)
  return hit?.customImage || ''
}

/**
 * 是否为位图类 logo（内置位图如 nosc，或已可渲染的上传 image）。
 * 位图走「宽度主导、高度按图片比例自适应」；矢量（盾牌/EP 图标）走宽高双维。
 */
export function isBitmapLogo(logo = {}) {
  if (!logo || typeof logo !== 'object') return false
  if (logo.type === 'image') return !!mediaUrl(logo.value)
  if (logo.type === 'builtin') return !!builtinLogoImage(logo.value)
  return false
}

/**
 * 内置背景库：随包发布的静态资源（ruoyi-ui/public/login-assets/），
 * 不经过 /profile/ 上传通道；value 为配置中保存的枚举 key。
 * 与后端 BACKGROUND_BUILTINS 白名单保持一致。
 */
export const BUILTIN_BACKGROUNDS = [
  {
    value: 'tech',
    label: '深色科技球场（默认）',
    // 构建后位于站点根路径 /login-assets/ 下（vite public 目录原样拷贝）；
    // 目录名不能用 /login/，否则会与前端路由 /login 同名，nginx try_files $uri/
    // 命中真实目录且无 index.html 时直接 403，SPA 回退失效
    image: '/login-assets/login-visual.png',
    texture: '/login-assets/pitch-lines.svg'
  }
]
export const BUILTIN_BACKGROUND_VALUES = BUILTIN_BACKGROUNDS.map((b) => b.value)

/** 动态装饰特效枚举（与后端 BACKGROUND_EFFECTS 一致） */
export const BACKGROUND_EFFECTS = [
  { value: 'none', label: '关闭' },
  { value: 'particles', label: '粒子漂浮' },
  { value: 'radar', label: '雷达扫描' },
  { value: 'all', label: '粒子 + 雷达' }
]

/** 取内置背景主图地址（非白名单 key 返回空串） */
export function builtinBgImage(key) {
  const hit = BUILTIN_BACKGROUNDS.find((b) => b.value === key)
  return hit ? hit.image : ''
}
/** 取内置背景线稿纹理地址（非白名单 key 返回空串） */
export function builtinBgTexture(key) {
  const hit = BUILTIN_BACKGROUNDS.find((b) => b.value === key)
  return hit ? hit.texture : ''
}

/**
 * 生成稳定的漂浮粒子数据（只在组件挂载时生成一次并缓存，
 * 模板仅做 CSS transform/opacity 动画，避免闪烁与重排）。
 */
export function createParticles(count = 28) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 2 + Math.random() * 3,
    delay: -Math.random() * 8,
    duration: 5 + Math.random() * 6,
    opacity: 0.25 + Math.random() * 0.45,
    cyan: Math.random() > 0.3
  }))
}

/** 版权方 logo 像素调整范围（与后端校验一致） */
export const LOGO_LIMITS = { sizeMin: 16, sizeMax: 200, offsetMin: -100, offsetMax: 100 }

/**
 * 客户方 logo 水平偏移单独放宽：
 * 它锚定在登录框左缘（右栏 360px 居中列），左/右两侧的可用空间都比
 * 左栏版权方 logo 大，X 需要更大行程（右栏/全屏舞台内横移）。
 * Y 行程仍与版权方一致（LOGO_LIMITS.offsetMin/Max）。与后端校验一致。
 */
export const CLIENT_LOGO_OFFSET_X_LIMITS = { min: -200, max: 400 }

/**
 * 客户方 logo 尺寸单独放宽：宽度上限 300（奥体等横版官方 logo 需要更大展示宽度），
 * 高度仍与版权方一致（16~200）。与后端校验一致。
 */
export const CLIENT_LOGO_SIZE_LIMITS = { min: 16, max: 300 }

/**
 * Logo 上下留白范围（与后端校验一致）。
 * 上方高度最小 0；下方高度允许 -100（负 margin，可把下一区块上提/叠加）；上限均 200。
 */
export const LOGO_SPACE_LIMITS = { topMin: 0, bottomMin: -100, max: 200 }

/**
 * 尺寸夹取；bounds 可覆盖默认 [sizeMin, sizeMax]（客户方 logo 宽度用 CLIENT_LOGO_SIZE_LIMITS）
 */
export function clampLogoSize(v, fallback = 42, bounds = null) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  const min = bounds && Number.isFinite(bounds.min) ? bounds.min : LOGO_LIMITS.sizeMin
  const max = bounds && Number.isFinite(bounds.max) ? bounds.max : LOGO_LIMITS.sizeMax
  return Math.min(max, Math.max(min, Math.round(n)))
}
export function clampLogoOffset(v, bounds = null) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  const min = bounds && Number.isFinite(bounds.min) ? bounds.min : LOGO_LIMITS.offsetMin
  const max = bounds && Number.isFinite(bounds.max) ? bounds.max : LOGO_LIMITS.offsetMax
  return Math.min(max, Math.max(min, Math.round(n)))
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
  const merged = deepMerge(cloneDefaults(), isPlainObject(raw) ? raw : {})
  // 整体字体目前只开放黑体/宋体；历史枚举（system/pingfang/yahei）统一归一为黑体，
  // 保证设计器 radio 始终有选中项、后台 --el-font-family 始终为合法字体栈
  if (!APP_FONT_FAMILIES.includes(merged.typography.fontFamily)) {
    merged.typography.fontFamily = 'heiti'
  }
  return merged
}

/**
 * 按设备解析最终配置：
 * - 桌面端：完整配置原样返回（mobile 子树不参与渲染）；
 * - 移动端：以完整配置为底，用 mobile 子树覆盖「布局相关」字段
 *   （layout、brand.logo、brand.logoClient、brand.logoSpace、background），
 * 品牌名/副标题、Hero、表单、版权、主题色、字体、favicon、圆角仍共享。
 *
 * @param {object} raw 库中/编辑器原始配置
 * @param {boolean} isMobile 当前是否按移动端渲染
 */
export function resolveDeviceConfig(raw, isMobile) {
  const full = mergeWithDefaults(raw)
  if (!isMobile || !isPlainObject(full.mobile)) return full
  const m = full.mobile
  return deepMerge(full, {
    layout: m.layout,
    brand: {
      logo: m.brand && m.brand.logo,
      logoClient: m.brand && m.brand.logoClient,
      logoSpace: m.brand && m.brand.logoSpace
    },
    background: m.background
  })
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
/** 把渐变配置 {enabled, angle, stops} 拼成 CSS linear-gradient；未启用/非法时返回 'none' 由样式层回退纯色 */
function gradientCss(g) {
  if (!g || !g.enabled) return 'none'
  const gs = Array.isArray(g.stops) && g.stops.length >= 2 ? g.stops : null
  if (!gs) return 'none'
  const a = Number(g.angle)
  return `linear-gradient(${Number.isFinite(a) ? a : 90}deg, ${gs.join(', ')})`
}

export function toCssVars(config) {
  const c = mergeWithDefaults(config)
  const colors = c.colors
  const ty = c.typography
  const grad = colors.brandGradient
  const stops = Array.isArray(grad.stops) && grad.stops.length ? grad.stops : ['#0a1120', '#0f172a', '#111b31']
  const angle = Number(grad.angle) || 150

  const heroGradient = gradientCss(colors.heroGradient)
  const buttonGradient = gradientCss(colors.buttonGradient)
  // 按钮渐变辉光：取按钮渐变第一色派生阴影（无法解析时给蓝调兜底）
  const glowFrom = colors.buttonGradient?.enabled && colors.buttonGradient?.stops?.[0]
  const btnGlow = hexToRgba(typeof glowFrom === 'string' ? glowFrom : '#2563eb', 0.4)

  return {
    '--login-brand-bg': `linear-gradient(${angle}deg, ${stops.join(', ')})`,
    '--login-accent': colors.accent,
    // 渐变文字/按钮（'none' 时样式层回退纯色 accent / buttonBg）
    '--login-hero-gradient': heroGradient,
    '--login-btn-gradient': buttonGradient,
    '--login-btn-glow': btnGlow,
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
    '--login-font-family': FONT_STACKS[ty.fontFamily] || FONT_STACKS.heiti,
    // 直接输出完整的两栏轨道值（1.1fr 合法且全浏览器兼容；不要用 calc(1.1 * 1fr)）
    '--login-split': `${Number(c.layout.splitRatio) || 1.1}fr 1fr`,
    // Logo 上下留白：split（左右分栏）与 overlay（居中卡片/全屏背景）各自独立
    '--login-logo-top-split': px(c.brand?.logoSpace?.split?.top, '56px'),
    '--login-logo-bottom-split': px(c.brand?.logoSpace?.split?.bottom, '0px'),
    '--login-logo-top-overlay': px(c.brand?.logoSpace?.overlay?.top, '40px'),
    '--login-logo-bottom-overlay': px(c.brand?.logoSpace?.overlay?.bottom, '22px')
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
 * 上传接口返回的 url 可能是绝对地址（http://host/profile/...）。
 * 配置中只允许保存环境无关的 /profile/ 相对路径：
 * 取 URL 的 pathname，必须以 /profile/ 开头才归一化，否则返回空串（调用方报错）。
 */
export function normalizeProfileUrl(url) {
  if (typeof url !== 'string' || !url) return ''
  if (url.startsWith('/profile/')) return url
  try {
    const u = new URL(url, window.location.origin)
    if (u.pathname.startsWith('/profile/')) return u.pathname
  } catch (e) { /* 非法 URL 落为空 */ }
  return ''
}

/**
 * 媒体显示地址：库中只存 /profile/ 相对路径；
 * 显示时按项目惯例前缀 VITE_APP_BASE_API（dev 走 vite 代理，prod 走 nginx）。
 */
export function mediaUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/profile/')) return ''
  return import.meta.env.VITE_APP_BASE_API + path
}

/**
 * 登录页 favicon / 标题动态化（仅登录路由期间生效，离开时由调用方恢复）
 * 媒体路径白名单与后端一致：仅 /profile/ 开头。
 *
 * 关键点：页面上同时存在多个 rel 含 icon 的 <link> 且都无 sizes 时，
 * Chrome 等浏览器会采用先声明的那个（index.html 中的 /favicon.ico），
 * 仅追加新链接不会替换标签页图标。因此启用动态 favicon 时必须先把
 * 原始 icon 链接「停用」（改写 rel 为非 icon token，原 rel 暂存），
 * 保证唯一候选；恢复时再还原。
 */
const DYN_ICON_FLAG = 'data-login-dynamic'
const ORIG_REL_ATTR = 'data-login-original-rel'
// index.html 内联引导脚本（Safari 兼容）写入的初始图标标记
const BOOT_ATTR = 'data-login-favicon'
// 与 index.html 内联脚本共用的 localStorage 键：保存解析后的站内媒体 URL
const FAV_STORAGE_KEY = 'apms_login_favicon'
const ICON_LINKS = "link[rel~='icon']"
// 非标准 rel token：浏览器不会把它当 favicon 候选
const DISABLED_REL = 'login-icon-disabled'

/**
 * 随包默认 favicon 地址（带构建号查询串）。
 * /favicon.ico 位于 public、不参与 Vite 内容哈希，而 nginx 对 .ico 有 7 天强缓存，
 * 故用构建号版本化：重新部署后 URL 变化，浏览器自动拉新（与 index.html 的 link 同源）。
 */
/* global __BUILD_ID__ */
export const DEFAULT_FAVICON_HREF = `/favicon.ico?v=${__BUILD_ID__}`

function findDynamicIconLink() {
  return (
    document.querySelector(`${ICON_LINKS}[${DYN_ICON_FLAG}]`) ||
    document.querySelector(`link[${BOOT_ATTR}]`)
  )
}

function disableOriginalIconLinks() {
  document.querySelectorAll(ICON_LINKS).forEach((link) => {
    if (link.getAttribute(DYN_ICON_FLAG) || link.hasAttribute(BOOT_ATTR)) return
    if (!link.hasAttribute(ORIG_REL_ATTR)) {
      link.setAttribute(ORIG_REL_ATTR, link.getAttribute('rel') || 'icon')
    }
    link.setAttribute('rel', DISABLED_REL)
  })
}

function restoreOriginalIconLinks() {
  document.querySelectorAll(`link[${ORIG_REL_ATTR}]`).forEach((link) => {
    link.setAttribute('rel', link.getAttribute(ORIG_REL_ATTR))
    link.removeAttribute(ORIG_REL_ATTR)
  })
}

/**
 * @param {string=} favicon undefined=配置尚未加载（不触碰图标，保留 index.html
 *   引导脚本写入的 Safari 兼容链接）；null=明确无配置（清除并恢复 favicon.ico）；
 *   字符串=/profile/ PNG 相对路径。
 */
export function applyLoginHead({ favicon, title }) {
  // favicon === undefined：配置还没回来，只处理标题，绝不能把引导链接误删
  if (favicon !== undefined) {
    const href = mediaUrl(favicon)
    let dyn = findDynamicIconLink()

    if (href) {
      disableOriginalIconLinks()
      // 供下一次整页加载时 index.html 内联引导脚本同步使用（Safari 兼容）
      try { localStorage.setItem(FAV_STORAGE_KEY, href) } catch (e) { /* ignore */ }
      if (!dyn) {
        dyn = document.createElement('link')
        dyn.setAttribute(DYN_ICON_FLAG, '1')
        document.getElementsByTagName('head')[0].appendChild(dyn)
      }
      // 接管引导链接：补上动态标记（restore 时可识别移除）
      dyn.setAttribute(DYN_ICON_FLAG, '1')
      dyn.removeAttribute(BOOT_ATTR)
      // 先写属性再赋 href，确保插入到 head 后触发一次完整的图标重新选取
      dyn.setAttribute('rel', 'icon')
      dyn.setAttribute('type', 'image/png')
      dyn.href = href
    } else {
      // 明确无配置（或被清除）：移除动态/引导链接、恢复原始 favicon、清引导缓存
      try { localStorage.removeItem(FAV_STORAGE_KEY) } catch (e) { /* ignore */ }
      if (dyn) dyn.parentNode.removeChild(dyn)
      restoreOriginalIconLinks()
    }
  }
  if (title) document.title = title
}

export function restoreLoginHead() {
  // 注意：不清 localStorage——下次整页加载 /login 时 Safari 引导脚本仍要用它
  const dyn = findDynamicIconLink()
  if (dyn) dyn.parentNode.removeChild(dyn)
  restoreOriginalIconLinks()
  document.title = import.meta.env.VITE_APP_TITLE
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
