/**
 * el-dialog 跟手右滑关闭指令（仅触摸视口 ≤768px 生效）。
 *
 * 与 vDrawerSwipe 同构、复用同一套手势内核（touchViewportActive/findHorizontalScroller），
 * 区别仅在面板解析（.el-dialog）与关闭通道（binding 回调 → 组件自己的 v-model）。
 *
 * 为什么用指令而不是 document 委托：
 * 委托方案在 .el-dialog 上写内联 transform 与 EP 自身开关动画（同样作用 transform）冲突，
 * 清理依赖定时器，快速重开时残留 transform 会把弹窗压在屏外（表现为「再次打开弹窗消失」）。
 * 指令与组件同生命周期：unmounted 必然移除监听并清理内联样式，touchstart 再防御性清一次，
 * 关闭直接调组件 v-model，不走模拟点击，嵌套弹窗（teleport 到 body）各自挂载天然隔离。
 *
 * 常规用法：无需手动挂载——SwipeDialog 全局包装（components/SwipeDialog，main.js 覆盖
 * 注册 ElDialog）已给所有 el-dialog 的默认插槽注入本指令，关闭走 ElDialog.handleClose()。
 * 仅全局包装不适用的特殊场景才手动挂载：
 *   <el-dialog v-model="visible">
 *     <div v-dialog-swipe="() => (visible = false)"> ...弹窗内容... </div>
 *   </el-dialog>
 * 非 el-dialog 的自定义 teleport 浮层（bottom sheet/侧栏等）：根节点加 class
 * swipe-panel 后直接挂指令，binding 传该浮层自己的关闭函数：
 *   <aside class="swipe-panel" v-dialog-swipe="() => store.closePanel()"> ... </aside>
 *
 * 豁免：自带横滑语义的容器加 class .dialog-swipe-ignore（如网格录入的测项翻页列表，
 * 其 overflow-x:hidden 无法被 findHorizontalScroller 识别）；输入控件内的触摸默认放行。
 */
import { findHorizontalScroller, touchViewportActive } from './drawerSwipe'

const MIN_THRESHOLD = 80
const THRESHOLD_RATIO = 0.25
const INTENT_PX = 8
const SLIDE_MS = 220
// EP dialog 离场动画时长（--el-transition-duration 默认 300ms）+ 余量：
// 超过此时长 Vue Transition 已把 overlay 置 display:none，清理内联样式用户不可见
const EP_LEAVE_MS = 380
const INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"], .el-input, .el-textarea, .el-select'
const IGNORE_SELECTOR = '.dialog-swipe-ignore'

export const vDialogSwipe = {
  mounted(el, binding) {
    // 面板解析两类：
    // 1) .el-dialog —— SwipeDialog 全局包装与手动挂载的 EP 弹窗；
    // 2) .swipe-panel —— 非 el-dialog 的自定义 teleport 浮层约定（如 RPA 助手 bottom sheet），
    //    在浮层根节点加该 class 即可复用整套手势内核，无需另写手势代码。
    const panel = el.closest('.el-dialog') || el.closest('.swipe-panel')
    if (!panel) return
    // 幂等：全局 SwipeDialog 包装与历史手动挂载可能在同一 panel 上各挂一次，
    // 先挂载的实例接管，后者直接放弃，避免双实例同时写内联 transform 互相打架
    if (panel.__dialogSwipeBound) return
    panel.__dialogSwipeBound = true
    // 自定义浮层没有 .el-overlay/.el-overlay-dialog，以下两者为 null，
    // 遮罩淡出与 EP 关键帧压制逻辑自动跳过（各调用点均有 null 保护）
    const overlay = panel.closest('.el-overlay')
    // EP 离场关键帧实际作用在 .el-overlay 与 .el-overlay-dialog 上（dialog-fade/modal-fade）
    const overlayDialog = panel.closest('.el-overlay-dialog')
    const close = typeof binding.value === 'function' ? binding.value : null

    let startX = 0
    let startY = 0
    let startTarget = null
    let dx = 0
    let decided = false
    let horizontal = false
    let tracking = false
    let cleanupTimer = null

    function clearInline() {
      if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null }
      panel.style.transition = ''
      panel.style.transform = ''
      panel.style.userSelect = ''
      // animation 残留必须一并清：否则下次打开会压制 EP 进场动画（弹窗无淡入直接出现）
      panel.style.animation = ''
      for (const node of [overlay, overlayDialog]) {
        if (!node) continue
        node.style.transition = ''
        node.style.opacity = ''
        node.style.removeProperty('animation')
      }
    }

    /**
     * 压制 EP 离场 animation：EP 用 CSS @keyframes 播 dialog-fade-out/modal-fade-out，
     * 其 0% 关键帧（opacity:1、translateZ(0)）会覆盖手势写入的内联终态，
     * 导致 close 瞬间弹窗从屏外跳回原位再淡出（用户感知为「闪一下」）。
     * important 内联优先级高于动画类选择器，压制后元素保持手势滑出终态，
     * 直到 EP 卸载（display:none），再由延时清理交还样式体系。
     */
    function suppressEpLeaveAnimation() {
      for (const node of [overlay, overlayDialog]) {
        node && node.style.setProperty('animation', 'none', 'important')
      }
    }

    function onTouchStart(e) {
      if (!touchViewportActive() || e.touches.length !== 1) return
      const target = e.target
      // 输入控件：文本选择/光标定位优先；豁免容器：自带横滑语义（分页列表等）
      if (target.closest(INPUT_SELECTOR) || target.closest(IGNORE_SELECTOR)) {
        tracking = false
        return
      }
      // 防御：清理任何历史残留的手势内联样式，避免与 EP 进场动画叠加导致弹窗位置异常
      clearInline()
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      startTarget = target
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
          tracking = false
          panel.style.transition = ''
          panel.style.userSelect = ''
          return
        }
      }
      if (!horizontal) return

      // 弹窗内横滚区（表格/芯片条）未到边缘时交还原生滚动
      if (findHorizontalScroller(panel, startTarget, dx)) {
        tracking = false
        panel.style.transition = ''
        panel.style.userSelect = ''
        return
      }

      e.preventDefault()
      // 只允许向右拖（关闭方向），左拖阻尼为 0
      panel.style.transform = `translateX(${Math.max(0, dx)}px)`
      if (overlay) overlay.style.opacity = String(Math.max(0, 1 - Math.max(0, dx) / window.innerWidth))
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
        // 阶段一：手势自己的跟手滑出（内联 transition），视觉连续无跳变
        panel.style.transform = `translateX(${window.innerWidth}px)`
        if (overlay) overlay.style.opacity = '0'
        setTimeout(() => {
          // 阶段二：滑出完成后先压制 EP 离场关键帧，再切 v-model——
          // 否则 dialog-fade-out 的 0% 帧会把弹窗从屏外拉回原位，产生闪烁
          suppressEpLeaveAnimation()
          close && close()
          // 阶段三：等 EP 离场动画窗口结束（overlay 已 display:none）再清理，
          // 此时任何样式切换都不可见；touchstart/unmounted 另有兜底
          cleanupTimer = setTimeout(clearInline, EP_LEAVE_MS)
        }, SLIDE_MS)
      } else {
        clearInline()
      }
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: false })
    panel.addEventListener('touchend', onTouchEnd, { passive: true })
    panel.addEventListener('touchcancel', onTouchEnd, { passive: true })

    el._dialogSwipeCleanup = () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
      panel.removeEventListener('touchend', onTouchEnd)
      panel.removeEventListener('touchcancel', onTouchEnd)
      clearInline()
    }
  },
  unmounted(el) {
    if (el && typeof el._dialogSwipeCleanup === 'function') {
      const panel = el.closest('.el-dialog')
      if (panel) delete panel.__dialogSwipeBound
      el._dialogSwipeCleanup()
      delete el._dialogSwipeCleanup
    }
  }
}
