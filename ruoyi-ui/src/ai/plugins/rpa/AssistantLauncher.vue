<template>
  <!-- wrapper 统一承载 pointer 与 click：setPointerCapture 会把鼠标兼容 click 重定向到 capture
       元素（本 div），若 @click 挂在内层 button，web 端点击将收不到；触摸端 click 按 hit-test
       落 button 再冒泡到本 div，因此 click 挂 wrapper 可同时兼容鼠标/触摸/键盘（button 激活冒泡）。 -->
  <!-- 面板展开后隐藏气泡（遮罩已接管全屏，再留气泡只会视觉重叠/干扰点击）；
       关闭面板后 store.open 回 false，气泡自动恢复显示。is-panel-open 的 z-index 提升随之移除。 -->
  <div
    v-if="!store.open"
    ref="dragRef"
    class="as-launcher-drag"
    :class="{ 'is-dragging': dragging }"
    :style="dragStyle"
    role="button"
    tabindex="0"
    title="APMS 助手（Alt+A）"
    aria-label="打开 APMS 助手"
    @pointerdown="onPointerDown"
    @click="onClick"
    @keydown.enter.prevent="store.toggle()"
    @keydown.space.prevent="store.toggle()"
  >
    <button type="button" class="as-launcher" tabindex="-1" aria-hidden="true">
      <el-icon><ChatDotRound /></el-icon>
    </button>
  </div>
  <AssistantPanel />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import useAssistantStore from './assistantStore'
import AssistantPanel from './AssistantPanel.vue'
import {
  DRAG_THRESHOLD,
  computeDragLimits,
  nextPosition,
  isDragTail,
  clampToViewport
} from './useLauncherDrag'

const store = useAssistantStore()
const userStore = useUserStore()

/* ------------------------------ 悬浮球拖拽（鼠标/触摸统一走 Pointer Events） ------------------------------ */
const dragRef = ref(null)
const dragging = ref(false)
const pos = reactive({ dx: 0, dy: 0 }) // 相对 CSS 锚点（right/bottom）的位移：左移/上移为负
const dragStyle = computed(() =>
  pos.dx !== 0 || pos.dy !== 0 ? { transform: `translate3d(${pos.dx}px, ${pos.dy}px, 0)` } : {}
)

const gesture = { x: 0, y: 0, dx: 0, dy: 0, limits: null }
// 按下点：click 时与之比对距离来区分「点击」与「拖拽收尾的 click」，无状态、不跨手势残留
let pressPoint = null

function computeLimits() {
  const el = dragRef.value
  if (!el) return
  const size = el.offsetWidth || 48
  const rect = el.getBoundingClientRect()
  // 锚点间距：wrapper 用 right/bottom 固定，扣除当前位移还原初始锚点
  const anchorRight = window.innerWidth - rect.right + pos.dx
  const anchorBottom = window.innerHeight - rect.bottom + pos.dy
  gesture.limits = computeDragLimits(window.innerWidth, window.innerHeight, size, anchorRight, anchorBottom)
}

function onPointerDown(e) {
  // 仅主键（鼠标左键 / 触摸 / 笔）触发，避免右键等干扰
  if (e.button !== undefined && e.button !== 0) return
  dragging.value = false
  pressPoint = { x: e.clientX, y: e.clientY }
  gesture.x = e.clientX
  gesture.y = e.clientY
  gesture.dx = pos.dx
  gesture.dy = pos.dy
  computeLimits()
  // pointer capture 保证拖出元素后仍能收到 move/up
  e.currentTarget.setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
  window.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onPointerMove(e) {
  const ddx = e.clientX - gesture.x
  const ddy = e.clientY - gesture.y
  if (!dragging.value && Math.hypot(ddx, ddy) <= DRAG_THRESHOLD) return
  dragging.value = true
  const next = nextPosition(gesture.dx, gesture.dy, ddx, ddy, gesture.limits)
  pos.dx = next.dx
  pos.dy = next.dy
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove)
  dragging.value = false
}

function onClick(e) {
  // pressPoint 为空（无前置 pointerdown 的合成 click/辅助技术场景）一律放行；
  // 真实点击坐标与按下点几乎重合，拖拽收尾的 click 位移超阈值，吞掉不打开面板
  if (pressPoint && isDragTail(pressPoint.x, pressPoint.y, e.clientX, e.clientY)) return
  store.toggle()
}

// 旋转屏/窗口尺寸变化后重新收敛到视口内，防止悬浮球停在屏外
function onResize() {
  const el = dragRef.value
  if (!el) return
  const next = clampToViewport(pos.dx, pos.dy, window.innerWidth, window.innerHeight, el.offsetWidth || 48)
  pos.dx = next.dx
  pos.dy = next.dy
}

function onKeydown(e) {
  if (e.altKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault()
    store.toggle()
    return
  }
  if (e.key === 'Escape' && store.open) {
    store.closePanel()
  }
}

function onSessionReset() {
  store.resetSession(false)
}

onMounted(() => {
  store.initialize()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('apms:assistant-reset', onSessionReset)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('apms:assistant-reset', onSessionReset)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onPointerMove)
  store.stopTyping()
})

watch([() => userStore.id, () => userStore.token], () => {
  store.resetSession(false)
  store.initialize()
})
</script>

<style>
.rk-assistant-highlight {
  outline: 3px solid var(--el-color-primary, #2563eb) !important;
  outline-offset: 3px !important;
  border-radius: 6px !important;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12) !important;
  transition: outline-color 0.2s ease, box-shadow 0.2s ease;
}
</style>

<style scoped>
/* 定位与拖拽收口在 wrapper；按钮自身只负责外观与 hover 动效 */
.as-launcher-drag {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2100;
  width: 48px;
  height: 48px;
  /* 关键：触摸拖拽时禁止浏览器滚屏/缩放手势抢占 pointer 事件 */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  cursor: grab;
}
.as-launcher-drag.is-dragging {
  cursor: grabbing;
}
/* 键盘焦点可见（焦点已从内层 button 上移到 wrapper）；鼠标点击不残留焦点环 */
.as-launcher-drag:focus-visible {
  outline: 3px solid var(--el-color-primary, #2563eb);
  outline-offset: 3px;
  border-radius: 50%;
}
.as-launcher-drag:focus:not(:focus-visible) {
  outline: none;
}
.as-launcher {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, var(--el-color-primary), #06b6d4);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.28);
  cursor: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.as-launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(37, 99, 235, 0.36);
}
.as-launcher.is-open {
  opacity: 0.85;
}
@media (max-width: 768px) {
  .as-launcher-drag {
    right: 14px;
    bottom: 14px;
    width: 44px;
    height: 44px;
  }
}
</style>
