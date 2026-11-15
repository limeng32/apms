import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTouchViewport } from './touchViewport'

/**
 * 抽屉接管「系统返回」（iOS 屏幕左沿滑动、Android 返回手势/返回键、浏览器后退键）。
 *
 * 背景：H5 上抽屉打开时，系统返回手势默认作用于浏览器 history——直接路由后退/离开页面，
 * 用户预期却是关闭抽屉。iOS 边缘手势在页面之外、无法用 touch 事件 preventDefault 拦截，
 * 唯一可靠手段是 history 栈接管：
 *   1) 抽屉打开时 pushState 压入一个与当前 URL 相同的标记位（路由无感知、地址栏不变）；
 *   2) 用户触发系统返回 → 浏览器弹出该标记位并派发 popstate → 此时仅关闭抽屉，URL/路由不变；
 *   3) 用户走关闭按钮/遮罩/Esc/编程式 v-model=false 关闭 → 主动 history.back() 弹出标记位，
 *      回流的 popstate 因 pushed 已复位而成为 no-op，不重复操作抽屉。
 *
 * 嵌套抽屉天然支持：每个实例各自 push/pop，history 栈 LIFO 顺序与视觉层级一致，
 * 系统返回总是先关最上层抽屉。
 *
 * 默认仅触摸视口（≤768px）激活，桌面端抽屉行为完全不变；传 { touchOnly:false } 可全端启用。
 *
 * 已知限制：抽屉打开期间若发生路由跳转（本应用抽屉内不切路由，实际不会触发），
 * 卸载时不主动 history.back() 以免与路由栈冲突；残留标记位 URL 与当前一致，
 * 最坏情况是用户需要多按一次返回，无数据与安全副作用。
 *
 * @param {import('vue').Ref<boolean>} visible 抽屉开关（el-drawer v-model 绑定的 ref/computed）
 * @param {{ touchOnly?: boolean }} [options]
 */
export function useDrawerHistory(visible, options = {}) {
  const { touchOnly = true } = options
  const { isTouchViewport } = useTouchViewport()
  // 本实例是否已压入标记位（同时承担「popstate 是否归我管」的判定）
  const pushed = ref(false)

  function active() {
    return !touchOnly || isTouchViewport.value
  }

  function stripMarker() {
    const s = history.state
    if (!s || !Object.prototype.hasOwnProperty.call(s, 'apmsDrawer')) return
    const { apmsDrawer, ...rest } = s
    // 同 URL replaceState 不产生新历史条目，仅清掉本模块命名空间的残留键，
    // 兼容「抽屉打开期间刷新页面」后 marker 被 vue-router 合并进基准 state 的边界
    history.replaceState(rest, '', location.href)
  }

  function onPopState() {
    // 非本实例压入的历史（按钮关闭回流、其它抽屉/页面的 popstate）不干预抽屉开关，
    // 但仍顺手清理 marker 键，保证命名空间不泄漏
    if (pushed.value) {
      pushed.value = false
      // 系统返回路径：浏览器已弹出标记位，这里只关抽屉；按钮关闭路径下 visible 已是 false
      if (visible.value) visible.value = false
    }
    stripMarker()
  }

  watch(
    () => visible.value,
    (open) => {
      if (!active()) return
      if (open) {
        if (!pushed.value) {
          // 合并而非替换：保留 vue-router 的 current/position/scroll 等 state 键，
          // URL 保持不变，仅压栈；apmsDrawer 为本模块命名空间标记
          history.pushState({ ...(history.state || {}), apmsDrawer: true }, '', location.href)
          pushed.value = true
        }
      } else if (pushed.value) {
        // 非系统返回路径关闭：先复位再 back，回流 popstate 即 no-op，杜绝重复关闭/循环
        pushed.value = false
        history.back()
      }
    }
  )

  onMounted(() => window.addEventListener('popstate', onPopState))
  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPopState)
    pushed.value = false
  })

  return { pushed }
}
