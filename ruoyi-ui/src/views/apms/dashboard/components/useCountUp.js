import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * 数字滚动（rAF easeOutCubic）。
 * @param {import('vue').Ref<number>|function} source 目标数值来源（ref 或 getter）
 * @param {{duration?:number, decimals?:number}} options
 * @returns {import('vue').Ref<string|number>} 直接用于模板插值的显示值
 */
export function useCountUp(source, options = {}) {
  const duration = options.duration ?? 900
  const decimals = options.decimals ?? 0
  const display = ref(decimals > 0 ? (0).toFixed(decimals) : 0)
  let raf = 0

  const reduced = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function render(v) {
    display.value = decimals > 0 ? Number(v).toFixed(decimals) : Math.round(v)
  }

  function run(to) {
    cancelAnimationFrame(raf)
    if (reduced) { render(to); return }
    const begin = parseFloat(display.value) || 0
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      render(begin + (to - begin) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  watch(source, (v) => run(Number(v) || 0), { immediate: true })
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return display
}
