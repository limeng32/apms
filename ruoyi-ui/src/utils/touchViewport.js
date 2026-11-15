import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * 触摸窄屏（H5）视口判断，断点与 roster-kit.scss 的手机端媒体查询一致（max-width: 768px）。
 *
 * 用途：主从列表在桌面端保留「整行点击开抽屉」，H5 端整行点击易误触（滚动/勾选时擦碰），
 * 改用显式「详情」按钮入口。各页 handleRowClick 入口用 isTouchViewport() 守卫：
 *   const { isTouchViewport } = useTouchViewport()
 *   function handleRowClick(row) {
 *     if (isTouchViewport.value) return   // H5 仅详情按钮可开抽屉
 *     ...
 *   }
 *
 * 响应式：监听 matchMedia change，旋转/缩放窗口实时更新；SSR/不支持 matchMedia 时按非触摸处理。
 */
const TOUCH_QUERY = '(max-width: 768px)'

export function useTouchViewport() {
  const isTouchViewport = ref(false)
  let mql = null

  function update(e) {
    isTouchViewport.value = e ? e.matches : (mql ? mql.matches : false)
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(TOUCH_QUERY)
    update({ matches: mql.matches })
    // Safari <14 用 addListener，现代浏览器用 addEventListener
    if (mql.addEventListener) mql.addEventListener('change', update)
    else if (mql.addListener) mql.addListener(update)
  })

  onBeforeUnmount(() => {
    if (!mql) return
    if (mql.removeEventListener) mql.removeEventListener('change', update)
    else if (mql.removeListener) mql.removeListener(update)
  })

  return { isTouchViewport }
}
