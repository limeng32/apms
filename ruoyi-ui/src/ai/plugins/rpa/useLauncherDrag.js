/**
 * RPA 悬浮球拖拽纯逻辑（无 Vue/DOM 依赖，可被 Node 桩测直接覆盖）。
 *
 * 坐标模型：wrapper 以 position:fixed + right/bottom 为 CSS 锚点，
 * 拖拽位移用 translate3d(dx, dy) 表达——向左/向上为负，向右/向下为正。
 * AssistantLauncher.vue 只负责把 DOM 事件翻译成对这里的调用。
 */

/** 点击与拖拽的位移阈值（px）：hypot 位移不超过该值按点击处理 */
export const DRAG_THRESHOLD = 6

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

/**
 * 计算本次手势的位移边界，保证悬浮球始终完整停在视口内。
 * @param {number} viewportW 视口宽
 * @param {number} viewportH 视口高
 * @param {number} size 悬浮球边长（正方形）
 * @param {number} anchorRight 手势开始时球右边距视口右沿的距离
 * @param {number} anchorBottom 手势开始时球下边距视口底沿的距离
 */
export function computeDragLimits(viewportW, viewportH, size, anchorRight, anchorBottom) {
  return {
    minDx: -(viewportW - size - anchorRight), // 最左：贴视口左沿
    maxDx: anchorRight,                        // 最右：回到 CSS 锚点，不越过右沿
    minDy: -(viewportH - size - anchorBottom),
    maxDy: anchorBottom
  }
}

/**
 * 依据手势当前增量计算收敛后的位置（含边界 clamp）。
 * @param {number} startDx 手势开始时累计 dx
 * @param {number} startDy 手势开始时累计 dy
 * @param {number} ddx 本次指针相对按下点的水平增量
 * @param {number} ddy 本次指针相对按下点的垂直增量
 */
export function nextPosition(startDx, startDy, ddx, ddy, limits) {
  return {
    dx: clamp(startDx + ddx, limits.minDx, limits.maxDx),
    dy: clamp(startDy + ddy, limits.minDy, limits.maxDy)
  }
}

/**
 * 区分「真实点击」与「拖拽收尾的 click」：
 * 真实 click 的坐标与按下点几乎重合；拖拽后浏览器补发的 click 落在释放点，位移超过阈值。
 * @returns {boolean} true=这是拖拽收尾，应吞掉 click 不打开面板
 */
export function isDragTail(downX, downY, clickX, clickY) {
  return Math.hypot(clickX - downX, clickY - downY) > DRAG_THRESHOLD
}

/**
 * 视口尺寸变化（旋转屏/窗口缩放）后把历史位置重新收敛进视口。
 * 通用安全边界：dx/dy 落在 [-(视口-球径), 0]，任何尺寸下都不会停在屏外。
 */
export function clampToViewport(dx, dy, viewportW, viewportH, size) {
  return {
    dx: clamp(dx, -(viewportW - size), 0),
    dy: clamp(dy, -(viewportH - size), 0)
  }
}
