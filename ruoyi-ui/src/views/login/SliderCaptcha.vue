<template>
  <!-- 模态框默认不渲染节点（组件常驻，仅用于挂载时探测后端开关）；Teleport 到 body 避免被登录页变换/裁切影响 -->
  <Teleport to="body">
    <div v-if="visible" class="sc-mask" @click.self="close">
      <div class="sc-modal" role="dialog" aria-modal="true" aria-label="安全验证">
        <div class="sc-modal-head">
          <span class="sc-modal-title">安全验证</span>
          <button type="button" class="sc-modal-close" title="关闭" aria-label="关闭验证" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div class="sc" :class="{ 'is-ok': state === 'success', 'is-fail': state === 'fail' }">
          <!-- 拼图画布（服务端生成：背景+缺口+拼图块，宽度自适应，H5 全宽） -->
          <div ref="boardRef" class="sc-board" :style="{ aspectRatio: (challenge.width || 300) + ' / ' + (challenge.height || 128) }">
            <img v-if="challenge.img" :src="challenge.img" class="sc-bg" alt="" draggable="false" @load="calcScale"/>
            <img
              v-if="challenge.sliderImg && state !== 'success'"
              :src="challenge.sliderImg"
              class="sc-piece"
              alt=""
              draggable="false"
              :style="{ width: pieceW + 'px', height: pieceW + 'px', left: delta + 'px', top: pieceTop + 'px' }"
            />
            <div v-if="state === 'success'" class="sc-ok-mask">
              <el-icon><CircleCheckFilled /></el-icon>
              <span>验证通过</span>
            </div>
            <button type="button" class="sc-refresh" title="换一张" @click="manualRefresh" aria-label="刷新验证码">
              <el-icon><Refresh /></el-icon>
            </button>
          </div>

          <!-- 拖拽轨道（pointer events 统一鼠标/触摸；touch-action:none 阻止移动端滚动干扰）。
               fail 态旧题已锁定，点击轨道任意处立即手动换题（网络失败时的兜底入口） -->
          <div
            ref="trackRef"
            class="sc-track"
            :class="{ 'is-fail-clickable': state === 'fail' }"
            @pointerdown="onDown"
            @click="onTrackClick"
          >
            <div class="sc-track-fill" :style="{ width: dragX + HANDLE_SIZE + 'px' }"></div>
            <span class="sc-track-tip">{{ tipText }}</span>
            <div
              ref="handleRef"
              class="sc-handle"
              :style="{ left: dragX + 'px', width: HANDLE_SIZE + 'px', height: HANDLE_SIZE + 'px' }"
            >
              <el-icon v-if="state === 'success'"><Check /></el-icon>
              <el-icon v-else-if="checking" class="is-loading"><Loading /></el-icon>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6"/>
              </svg>
            </div>
          </div>
          <!-- 局部错误条：与模态同层（z-index 高于背景遮罩），不被 backdrop blur 糊住 -->
          <transition name="sc-err-fade">
            <div v-if="failMsg" class="sc-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
              </svg>
              <span>{{ failMsg }}</span>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * 真人拖拽拼图验证码（模态框，Web + H5）
 *
 * 交互：组件常驻并在挂载时探测后端开关；点击登录按钮时父级调用 open()：
 *   - 滑块关闭：open() 返回 false，父级直接走登录；
 *   - 滑块开启：弹出模态并加载新挑战，拖动校验通过后 emit('verified', uuid)，
 *     父级携带 uuid 发起登录，服务端一次性消费。
 *
 * 安全要点：缺口位置由服务端生成且不下发，前端仅按显示比例回传拖动位移，
 * 服务端判误差/耗时/轨迹点。
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { CircleCheckFilled, Check, Loading, Refresh } from '@element-plus/icons-vue'
import { getSliderCaptcha, checkSliderCaptcha } from '@/api/login'

const emit = defineEmits(['verified', 'enabled-change'])

const visible = ref(false)
const boardRef = ref(null)
const trackRef = ref(null)
const handleRef = ref(null)

const challenge = reactive({ uuid: '', img: '', sliderImg: '', pieceY: 0, width: 300, height: 128 })
// idle=待拖动 dragging=拖动中 checking=服务端校验 success=通过 fail=失败 loading=加载图
const state = ref('idle')
const checking = ref(false)
// 局部错误文案（校验失败/网络失败时在模态内清晰展示，替代会被遮罩糊住的全局通知）
const failMsg = ref('')

// 手柄固定 40px（轨道 42px），不随画布缩放，避免比轨道还高、两端错位
const HANDLE_SIZE = 40
// 拼图块图像自然尺寸 53（后端 S+R+2*PAD，四周 2px 留白防止白边被裁）
const PIECE_SIZE = 53
// 块内留白：拼图形状左沿距图像左沿 2px，提交形状位移时需补回
const PIECE_PAD = 2

// 拖拽状态（display 像素）：dragX=手柄左沿，delta=拼图块图像左沿（按两者可行动程比例换算）
const dragX = ref(0)
const scale = ref(1)
let startX = 0
let startDrag = 0
let startTime = 0
let pointCount = 0
let dragging = false
let closeTimer = null
let retryTimer = null

// 拼图块显示尺寸
const pieceW = computed(() => PIECE_SIZE * scale.value)
const pieceTop = computed(() => challenge.pieceY * scale.value)
// 手柄行程 → 拼图块行程的比例映射：手柄拖到轨道尽头时，拼图块恰好贴齐画布右沿
const delta = computed(() => {
  const boardW = boardRef.value ? boardRef.value.clientWidth : 0
  const trackW = trackRef.value ? trackRef.value.clientWidth : boardW
  const pieceMax = boardW - pieceW.value
  const handleMax = trackW - HANDLE_SIZE
  return handleMax > 0 ? dragX.value * pieceMax / handleMax : 0
})

const tipText = computed(() => {
  switch (state.value) {
    case 'loading': return '验证码加载中…'
    case 'dragging': return ''
    case 'checking': return '校验中…'
    case 'success': return '验证通过'
    case 'fail': return '验证失败，即将换一张（或点击此处立即刷新）'
    default: return '按住滑块向右拖动，完成拼图'
  }
})

function calcScale() {
  if (boardRef.value) {
    scale.value = boardRef.value.clientWidth / (challenge.width || 300)
  }
}
function onResize() { if (visible.value) calcScale() }

// 组件存活标志：卸载后不再发起新请求（避免登录跳转瞬间留下孤儿 XHR）
let alive = true
// 当前挑战是否已被服务端消费（校验成功/失败后一次性答案即失效，需换新题）
let consumed = false
// 拉题请求序号：丢弃过期响应，杜绝「自动换题 + 手动刷新」并发导致的 uuid/图错配
let loadSeq = 0

async function loadChallenge() {
  if (!alive) return
  const seq = ++loadSeq
  // 任何途径换题都先取消挂起的自动重试，避免叠加多个定时器
  clearTimeout(retryTimer)
  state.value = 'loading'
  failMsg.value = ''
  resetPosition()
  try {
    const res = await getSliderCaptcha()
    if (!alive || seq !== loadSeq) return // 已有更新的请求，丢弃过期响应
    enabled.value = res.sliderEnabled === true
    emit('enabled-change', enabled.value)
    if (!enabled.value) return
    consumed = false
    challenge.uuid = res.uuid
    challenge.img = res.img
    challenge.sliderImg = res.sliderImg
    challenge.pieceY = res.pieceY
    challenge.width = res.width
    challenge.height = res.height
    // 图片渲染后再量尺寸（@load 也会触发一次，双保险）
    requestAnimationFrame(calcScale)
    state.value = 'idle'
  } catch (e) {
    if (!alive || seq !== loadSeq) return
    // 网络/服务异常：保留旧图不清屏，置 fail 并提示点击重试（右上角刷新或点轨道）
    failMsg.value = '验证码加载失败，请点击右上角刷新重试'
    state.value = 'fail'
    consumed = true
  }
}

// 手动刷新（右上角按钮）：清掉自动重试定时器后立即换题
function manualRefresh() {
  clearTimeout(retryTimer)
  loadChallenge()
}

// fail 态点击轨道：立即换题（正常拖动的 click 不触发，因为成功拖拱乐于 idle/checking 态）
function onTrackClick() {
  if (state.value === 'fail') manualRefresh()
}

// 后端开关（挂载时由首次 loadChallenge 探测）
const enabled = ref(false)

function resetPosition() {
  dragX.value = 0
  pointCount = 0
}

function maxDrag() {
  // 手柄不超出轨道右沿
  return trackRef.value ? trackRef.value.clientWidth - HANDLE_SIZE : 0
}

function onDown(e) {
  // 旧题已消费（校验完/等待换题）、加载中、成功、校验中：一律禁止起拖，
  // 否则失败后 1.6s 内拖的是后端已删除的旧 uuid，必报「验证已失效」并叠加失败
  if (checking.value) return
  if (['success', 'loading', 'fail'].includes(state.value)) return
  if (consumed || !challenge.uuid) return
  dragging = true
  failMsg.value = ''
  startX = e.clientX
  startDrag = dragX.value
  startTime = Date.now()
  pointCount = 0
  state.value = 'dragging'
  handleRef.value?.setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onMove(e) {
  if (!dragging) return
  pointCount += 1
  let d = startDrag + (e.clientX - startX)
  d = Math.max(0, Math.min(maxDrag(), d))
  dragX.value = d
}

async function onUp() {
  if (!dragging) return
  dragging = false
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  if (state.value !== 'dragging') return

  const duration = Date.now() - startTime
  // delta 是拼图块「图像」左沿，补 PIECE_PAD 才是形状左沿（服务端答案坐标）
  const x = Math.round(delta.value / scale.value) + PIECE_PAD
  // 极小位移视为未完成，直接复位
  if (dragX.value < 4) {
    resetPosition()
    state.value = 'idle'
    return
  }
  checking.value = true
  state.value = 'checking'
  try {
    await checkSliderCaptcha({ uuid: challenge.uuid, x, duration, points: pointCount })
    if (!alive) return
    consumed = true
    state.value = 'success'
    checking.value = false
    emit('verified', challenge.uuid)
    // 短暂展示成功态后自动收起，父级随即发起登录
    clearTimeout(closeTimer)
    closeTimer = setTimeout(close, 420)
  } catch (err) {
    if (!alive) return
    checking.value = false
    state.value = 'fail'
    consumed = true
    // 手柄/拼图块立即回到起点，避免停在错误位置；旧题已锁定不可再拖（onDown 拦截 fail）
    resetPosition()
    // 局部清晰提示（silent 请求已抑制全局通知）；取后端业务文案，兜底通用提示
    failMsg.value = (err && err.message) ? err.message : '验证失败，请重试'
    // 失败抖动后换新挑战（一次性答案已被服务端消费）；延迟足够看清错误条
    retryTimer = setTimeout(loadChallenge, 1600)
  }
}

/**
 * 打开模态：滑块关闭时返回 false（调用方直接登录）；开启则弹窗。
 * 挂载时已预取且未被消费的挑战直接复用（避免与预取请求重复并发同 URL 请求，
 * 慢网下产生无意义的竞态/中止）；仅在没有可用题目时才重新拉取。
 */
async function open() {
  if (!enabled.value) return false
  clearTimeout(closeTimer)
  clearTimeout(retryTimer)
  visible.value = true
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onEsc)
  await nextTick()
  const hasUsable = state.value === 'idle' && !!challenge.uuid && !consumed
  if (!hasUsable) loadChallenge()
  else { resetPosition(); calcScale() }
  return true
}

function onEsc(e) {
  if (e.key === 'Escape') close()
}

function close() {
  visible.value = false
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onEsc)
  clearTimeout(closeTimer)
  clearTimeout(retryTimer)
}

defineExpose({ open, close })

onMounted(() => {
  // 仅探测开关 + 预取第一道题，模态不展示
  loadChallenge()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  alive = false
  clearTimeout(closeTimer)
  clearTimeout(retryTimer)
  close()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})
</script>

<style lang="scss" scoped>
.sc-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, .45);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: sc-fade .18s ease;
}
.sc-modal {
  width: 100%;
  max-width: 340px;
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, .35);
  animation: sc-pop .2s cubic-bezier(.2, .9, .3, 1.2);
}
@keyframes sc-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sc-pop {
  from { opacity: 0; transform: translateY(8px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.sc-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sc-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: .5px;
}
.sc-modal-close {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s ease, color .15s ease;
  svg { width: 15px; height: 15px; }
  &:hover { background: #f1f5f9; color: #475569; }
}

.sc {
  width: 100%;
  user-select: none;
}
.sc-board {
  position: relative;
  width: 100%;
  /* 宽高比由后端下发尺寸内联绑定（300 / 128），此处仅兜底 */
  aspect-ratio: 300 / 128;
  border-radius: 10px;
  overflow: hidden;
  background: #e2e8f0;
  box-shadow: 0 0 0 1px var(--login-border, #e2e8f0) inset;
}
.sc-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.sc-piece {
  position: absolute;
  z-index: 2;
  transition: left .08s ease;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, .35));
}
.sc.is-fail .sc-piece {
  animation: sc-shake .4s ease;
}
@keyframes sc-shake {
  0%, 100% { margin-left: 0; }
  25% { margin-left: -5px; }
  50% { margin-left: 5px; }
  75% { margin-left: -3px; }
}
.sc-ok-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(15, 23, 42, .45);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  .el-icon { font-size: 22px; color: #34d399; }
}
.sc-refresh {
  position: absolute;
  z-index: 4;
  right: 8px;
  top: 8px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: rgba(15, 23, 42, .45);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s ease;
  &:hover { background: rgba(15, 23, 42, .7); }
}

.sc-track {
  position: relative;
  margin-top: 10px;
  height: 42px;
  border-radius: 8px;
  background: #f1f5f9;
  box-shadow: 0 0 0 1px var(--login-border, #e2e8f0) inset;
  touch-action: none;
  cursor: pointer;
}
/* fail 态旧题锁定，轨道作为「点击换一张」的兜底热区 */
.sc-track.is-fail-clickable { cursor: pointer; }
/* 局部错误条：模态内部同层，实色不透明、白底红字，绝不被背景遮罩虚化 */
.sc-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 12.5px;
  line-height: 1.5;
  svg { width: 15px; height: 15px; flex: none; }
}
.sc-err-fade-enter-active, .sc-err-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.sc-err-fade-enter-from, .sc-err-fade-leave-to { opacity: 0; transform: translateY(-3px); }
.sc-track-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 8px 0 0 8px;
  background: linear-gradient(90deg, rgba(37, 99, 235, .18), rgba(6, 182, 212, .28));
}
.sc-track-tip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  color: #64748b;
  pointer-events: none;
  padding-left: 20px;
}
.sc-handle {
  position: absolute;
  top: 1px;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #fff;
  color: #2563eb;
  box-shadow: 0 2px 8px rgba(15, 23, 42, .18), 0 0 0 1px #e2e8f0;
  cursor: grab;
  touch-action: none;
  z-index: 2;
  transition: background .15s ease, color .15s ease;
  &:active { cursor: grabbing; }
  .el-icon, svg { font-size: 18px; width: 18px; height: 18px; }
}
.sc.is-ok {
  .sc-handle { background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; border-color: transparent; }
  .sc-track { box-shadow: 0 0 0 1px #86efac inset; }
  .sc-track-tip { color: #16a34a; }
}
.sc.is-fail {
  .sc-handle { color: #dc2626; }
}
.is-loading { animation: sc-rot 1s linear infinite; }
@keyframes sc-rot { to { transform: rotate(360deg); } }
</style>
