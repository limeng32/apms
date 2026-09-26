/**
 * 整体字体栈（只存枚举值，原始 font-family 由这里映射）
 * 登录页（login.utils.js）与后台管理（applyGlobalBrand）共用同一份，避免两处漂移。
 * 同时给出 macOS / Windows 系统字体名，缺字库时按栈逐级回退（最后才落 sans/serif）。
 */
export const FONT_STACKS = {
  // 以下三个为历史枚举，仅用于兼容旧配置数据；设计器目前只开放 heiti / songti
  system: `"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif`,
  pingfang: `"PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif`,
  yahei: `"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, sans-serif`,
  // 黑体（无衬线）：mac Heiti SC / Win SimHei 优先，逐级回退到苹方/雅黑
  heiti: `"Heiti SC", "SimHei", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`,
  // 宋体（衬线）：mac Songti SC/STSong / Win SimSun/NSimSun，最后回退通用衬线
  songti: `"Songti SC", "STSong", "SimSun", "NSimSun", "Noto Serif CJK SC", serif`
}

/** 整体字体允许选择的枚举（设计器目前只开放黑体 / 宋体；其他历史值归一为黑体） */
export const APP_FONT_FAMILIES = ['heiti', 'songti']

/** 取整体字体最终 CSS font-family（非法/历史枚举统一回退黑体，视觉与系统默认无衬线最接近） */
export function resolveAppFontStack(value) {
  return FONT_STACKS[APP_FONT_FAMILIES.includes(value) ? value : 'heiti']
}

// 处理主题样式
export function handleThemeStyle(theme) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const primary = isDark ? softenPrimaryForDark(theme) : theme
  document.documentElement.style.setProperty('--el-color-primary', primary)
  for (let i = 1; i <= 9; i++) {
    document.documentElement.style.setProperty(`--el-color-primary-light-${i}`, `${getLightColor(primary, i / 10)}`)
  }
  for (let i = 1; i <= 9; i++) {
    document.documentElement.style.setProperty(`--el-color-primary-dark-${i}`, `${getDarkColor(primary, i / 10)}`)
  }
}

/**
 * 将首页设计器配置推广到系统全局：
 * - 品牌色 colors.accent        → Element 主色（--el-color-primary 及明暗派生）+ 菜单激活辅助变量
 * - 品牌渐变 colors.brandGradient（含角度）→ --brand-gradient（侧栏深色主题等全局消费）
 * - 圆角 layout.cardRadius      → Element 圆角变量（按钮/输入框/卡片/弹窗）
 */
export function applyGlobalBrand(config) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const colors = (config && config.colors) || {}
  const layout = (config && config.layout) || {}

  // 品牌色：仅接受合法 6 位十六进制，脏数据回退系统默认主色
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(String(colors.accent)) ? colors.accent : '#2c8a57'
  handleThemeStyle(brandColor)
  root.style.setProperty('--brand-color', brandColor)
  // 侧栏激活态文字与底色（sidebar.scss 消费；浅/深侧栏通用）
  root.style.setProperty('--current-color', brandColor)
  root.style.setProperty('--current-color-dark-bg', hexWithAlpha(brandColor, 0.18))
  root.style.setProperty('--current-color-light', getLightColor(brandColor, 0.82))

  // 整体字体（登录页设计器 typography.fontFamily：heiti | songti）
  // 写 --el-font-family 让 Element Plus 组件（按钮/输入/表格/弹窗等）整体跟随，
  // --app-font-family 供 body 与业务页自定义样式消费；两者同源，保证后台字体统一。
  const fontStack = resolveAppFontStack(config && config.typography ? config.typography.fontFamily : undefined)
  root.style.setProperty('--app-font-family', fontStack)
  root.style.setProperty('--el-font-family', fontStack)

  // 品牌渐变 + 角度
  const g = colors.brandGradient || {}
  const stops = Array.isArray(g.stops)
    ? g.stops.filter((s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s))
    : []
  const angle = Number(g.angle)
  if (stops.length >= 2 && Number.isFinite(angle)) {
    root.style.setProperty('--brand-gradient', `linear-gradient(${angle}deg, ${stops.join(', ')})`)
  }

  // 圆角：base 同步 small 派生（small 约为 base 的一半）
  const radius = Number(layout.cardRadius)
  if (Number.isFinite(radius)) {
    const r = Math.max(0, Math.round(radius))
    root.style.setProperty('--brand-radius', `${r}px`)
    root.style.setProperty('--el-border-radius-base', `${r}px`)
    root.style.setProperty('--el-border-radius-small', `${Math.round(r / 2)}px`)
    root.style.setProperty('--el-card-border-radius', `${r}px`)
    root.style.setProperty('--el-dialog-border-radius', `${r}px`)
  }
}

/** hex 颜色转 rgba() 字符串 */
function hexWithAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 混合两种十六进制颜色 */
export function mixHexColors(fg, bg, t) {
  const a = hexToRgb(String(fg).replace('#', ''))
  const b = hexToRgb(String(bg).replace('#', ''))
  const out = [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t))
  return rgbToHex(out[0], out[1], out[2])
}

/** 暗色模式下柔化主题色 */
export function softenPrimaryForDark(theme) {
  return mixHexColors(theme, '#2d3036', 0.34)
}

// hex颜色转rgb颜色
export function hexToRgb(str) {
  str = str.replace('#', '')
  let hexs = str.match(/../g)
  for (let i = 0; i < 3; i++) {
    hexs[i] = parseInt(hexs[i], 16)
  }
  return hexs
}

// rgb颜色转Hex颜色
export function rgbToHex(r, g, b) {
  let hexs = [r.toString(16), g.toString(16), b.toString(16)]
  for (let i = 0; i < 3; i++) {
    if (hexs[i].length == 1) {
      hexs[i] = `0${hexs[i]}`
    }
  }
  return `#${hexs.join('')}`
}

// 变浅颜色值
export function getLightColor(color, level) {
  let rgb = hexToRgb(color)
  for (let i = 0; i < 3; i++) {
    rgb[i] = Math.floor((255 - rgb[i]) * level + rgb[i])
  }
  return rgbToHex(rgb[0], rgb[1], rgb[2])
}

// 变深颜色值
export function getDarkColor(color, level) {
  let rgb = hexToRgb(color)
  for (let i = 0; i < 3; i++) {
    rgb[i] = Math.floor(rgb[i] * (1 - level))
  }
  return rgbToHex(rgb[0], rgb[1], rgb[2])
}
