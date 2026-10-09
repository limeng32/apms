/**
 * 驾驶舱 ECharts 浅/深双主题常量。
 * big=false：日常浅色（roster-kit 风格）；big=true：大屏模式深色科技风。
 */
export const STATUS_COLORS = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  none: '#CBD5E1',
  greenDark: '#4ADE80',
  amberDark: '#FBBF24',
  redDark: '#F87171',
  noneDark: '#475569'
}

/** 三态色（随大屏模式切换明暗） */
export function statusColor(level, big) {
  if (big) {
    return level === 'green' ? STATUS_COLORS.greenDark
      : level === 'amber' ? STATUS_COLORS.amberDark
      : level === 'red' ? STATUS_COLORS.redDark
      : STATUS_COLORS.noneDark
  }
  return STATUS_COLORS[level] || STATUS_COLORS.none
}

export function chartTheme(big = false) {
  return {
    axisLabel: { fontSize: 11, color: big ? '#8FA3C0' : '#94A3B8' },
    axisLabelDark: { fontSize: 12, color: big ? 'rgba(255,255,255,.82)' : '#475569' },
    splitLine: { lineStyle: { color: big ? 'rgba(148,163,191,.14)' : '#EEF2F7' } },
    tooltip: {
      backgroundColor: big ? 'rgba(10,18,32,.94)' : '#0F172A',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: '#fff', fontSize: 12 },
      extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.25);'
    },
    legendText: { fontSize: 11, color: big ? 'rgba(255,255,255,.68)' : '#64748B' }
  }
}

/** 统一入场动画：柱/条按数据下标错峰 */
export const GROW_ANIM_MS = 750
export function growDelay(idx) {
  return idx * 90
}

/**
 * tooltip.position 回调：浮层固定显示在指针右侧 14px；
 * 右侧空间不足（如悬停最右扇区）自动翻到指针左侧；纵向在视口内钳制。
 *
 * 配合 tooltip.appendToBody=true 使用：回调返回的是相对图表 DOM 的坐标，
 * ECharts 在 body 模式下会自动叠加图表容器的视口偏移，因此这里先按视口
 * 坐标计算再减回容器偏移。
 *
 * @param {HTMLElement} chartEl 图表容器元素
 * @param {[number,number]} point ECharts 回调的指针坐标（相对图表 DOM）
 * @param {{contentSize:[number,number], viewSize:[number,number]}} size
 */
export function tipRightPosition(chartEl, point, size) {
  const [cw, ch] = size.contentSize
  const rect = chartEl.getBoundingClientRect()
  const GAP = 14
  // 期望视口位置：默认指针右侧
  let vx = rect.left + point[0] + GAP
  if (vx + cw > window.innerWidth - 8) {
    // 右侧放不下 → 翻到指针左侧
    vx = rect.left + point[0] - cw - GAP
  }
  let vy = rect.top + point[1] - ch / 2
  vy = Math.max(8, Math.min(vy, window.innerHeight - ch - 8))
  return [vx - rect.left, vy - rect.top]
}
