// 跟手关闭阈值：滑动距离超过 max(80px, 视口宽度 25%) 即吸附关闭，否则回弹
const MIN_THRESHOLD = 80
const THRESHOLD_RATIO = 0.25
// 意向判定最小位移，避免点击/滚动抖动误触发
const INTENT_PX = 8
const SLIDE_MS = 220
// 与 touchViewport.js / roster-kit.scss 保持同一手机断点
const TOUCH_QUERY = '(max-width: 768px)'

function touchViewportActive() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(TOUCH_QUERY).matches
}

/**
 * 抽屉跟手右滑关闭指令（仅触摸视口 ≤768px 生效，面向右侧滑入的 RTL el-drawer）。
 *
 * 系统边缘返回手势网页无法禁用（见 useDrawerHistory 注释），本指令提供 App 式的
 * 面板内手势作为主交互：手指在抽屉任意位置横向右拖，面板与遮罩跟手位移，
 * 过阈值吸附关闭、未过阈值回弹；竖向滑动不接管，保证抽屉内正常滚动。
 *
 * 用法（script setup 中 import 后按 v-drawer-swipe 自动可用）：
 *   <div v-drawer-swipe="closeDrawer"> ...抽屉内容... </div>
 * closeDrawer 通常是 () => (visible.value = false)；若同时接入了 useDrawerHistory，
 * visible 变 false 后 history 标记位会由其自动回收，无需本指令关心。
 *
 * 实现要点：
 * - touchmove 以 { passive:false } 注册，仅在确认横向意向后 preventDefault，
 *   竖向滚动在被动监听阶段不被阻断；
 * - 位移与遮罩透明度走内联 style，关闭动画结束后统一清理，避免污染 EP 自身离场动画；
 * - 指令挂在插槽根元素，面板经 closest('.el-drawer') 解析，teleport 到 body 也能命中。
 */
export const vDrawerSwipe = {
  mounted(el, binding) {
    // 指令 mounted 已在组件 mounted 之后，无法再注册 onMounted，故不能用
    // useTouchViewport（其 ref 靠 onMounted 初始化，此处调用会永远停在 false）；
    // 指令是纯 DOM 逻辑，事件发生时直接读 matchMedia 既新鲜又无需响应式
    const panel = el.closest('.el-drawer')
    if (!panel) return
    const overlay = panel.closest('.el-overlay')

    let startX = 0
    let startY = 0
    let dx = 0
    let decided = false
    let horizontal = false
    let tracking = false

    const close = typeof binding.value === 'function' ? binding.value : null

    function clearInline() {
      panel.style.transition = ''
      panel.style.transform = ''
      panel.style.userSelect = ''
      if (overlay) {
        overlay.style.transition = ''
        overlay.style.opacity = ''
      }
    }

    function onTouchStart(e) {
      if (!touchViewportActive() || e.touches.length !== 1) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      dx = 0
      decided = false
      horizontal = false
      tracking = true
      panel.style.transition = 'none'
      panel.style.userSelect = 'none'
    }

    function onTouchMove(e) {
      if (!tracking || e.touches.length !== 1) return
      const t = e.touches[0]
      dx = t.clientX - startX
      const dy = t.clientY - startY

      if (!decided) {
        if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return
        decided = true
        horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
        if (!horizontal) {
          // 竖向意向：交还浏览器处理滚动，本次手势不再干预
          tracking = false
          panel.style.transition = ''
          panel.style.userSelect = ''
          return
        }
      }
      if (!horizontal) return

      e.preventDefault()
      // RTL 抽屉只允许向右拖（关闭方向），左拖产生阻尼为 0
      const clamped = Math.max(0, dx)
      panel.style.transform = `translateX(${clamped}px)`
      if (overlay) overlay.style.opacity = String(Math.max(0, 1 - clamped / window.innerWidth))
    }

    function onTouchEnd() {
      if (!tracking || !horizontal) {
        tracking = false
        return
      }
      tracking = false
      const threshold = Math.max(MIN_THRESHOLD, window.innerWidth * THRESHOLD_RATIO)
      panel.style.transition = `transform ${SLIDE_MS}ms ease`
      if (overlay) overlay.style.transition = `opacity ${SLIDE_MS}ms ease`

      if (dx >= threshold) {
        // 吸附：先滑出视口再切 v-model，避免 EP 离场动画从位移中途重播造成闪烁
        panel.style.transform = `translateX(${window.innerWidth}px)`
        if (overlay) overlay.style.opacity = '0'
        setTimeout(() => {
          close && close()
          // EP 离场动画期间面板已不可见，稍后清理内联样式交回 EP 样式体系
          setTimeout(clearInline, SLIDE_MS + 120)
        }, SLIDE_MS)
      } else {
        clearInline()
      }
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: false })
    panel.addEventListener('touchend', onTouchEnd, { passive: true })
    panel.addEventListener('touchcancel', onTouchEnd, { passive: true })

    el._drawerSwipeCleanup = () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
      panel.removeEventListener('touchend', onTouchEnd)
      panel.removeEventListener('touchcancel', onTouchEnd)
      clearInline()
    }
  },
  unmounted(el) {
    if (el && typeof el._drawerSwipeCleanup === 'function') {
      el._drawerSwipeCleanup()
      delete el._drawerSwipeCleanup
    }
  }
}
