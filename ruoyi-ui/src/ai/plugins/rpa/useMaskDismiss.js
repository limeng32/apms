/**
 * 助手面板遮罩点击判定（纯逻辑，无 Vue/DOM 依赖，可被 Node 桩测直接覆盖）。
 *
 * 设计取舍：不用 @click.self（要求 target===currentTarget 精确相等，动画期/事件合成
 * 差异下易漏判），也不依赖子元素 @click.stop 的跨元素冒泡协调；改为在遮罩单一 click
 * handler 里用 closest 判断事件目标是否落在面板内——对深层子组件、DOM 重排都鲁棒。
 */
export const PANEL_SELECTOR = '.as-panel'

/**
 * @param {EventTarget|null|undefined} target pointer/click 事件的 target
 * @returns {boolean} true=点击落在面板内部（含任意深层元素），遮罩不应关闭；false=遮罩空白，应关闭
 */
export function clickIsInsidePanel(target) {
  return !!(target && typeof target.closest === 'function' && target.closest(PANEL_SELECTOR))
}

/**
 * 遮罩关闭手势状态机：判定锚定在 pointerdown（DOM 稳定期），click 只读取记录的起源。
 *
 * 解决的问题：点击面板内元素（如建议 chip）会触发 send → 建议区 v-if 卸载，
 * 若在 click 阶段才读 target.closest，脱离文档的 target 祖先链断裂会返回 null，
 * 被误判为「点了遮罩」而关闭面板。pointerdown 早于一切 click 逻辑，此时 target 必然仍在文档内。
 *
 * @returns {{notePointerDown: Function, shouldDismissOnClick: Function, reset: Function}}
 */
export function createDismissState() {
  let downInside = false
  return {
    /** @param {EventTarget} target pointerdown 的 target（此时 DOM 未被本次交互改变） */
    notePointerDown(target) {
      downInside = clickIsInsidePanel(target)
    },
    /** @returns {boolean} 本次手势是否应关闭遮罩：仅当手势起源于遮罩空白时为 true */
    shouldDismissOnClick() {
      return !downInside
    },
    reset() {
      downInside = false
    }
  }
}
