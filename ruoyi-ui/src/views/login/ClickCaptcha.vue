<template>
  <!-- 模态框默认不渲染节点（组件常驻，仅用于挂载时探测后端开关）；Teleport 到 body 避免被登录页变换/裁切 -->
  <Teleport to="body">
    <div v-if="visible" class="cc-mask" @click.self="close">
      <div class="cc-modal" role="dialog" aria-modal="true" aria-label="安全验证">
        <div class="cc-modal-head">
          <span class="cc-modal-title">安全验证</span>
          <button type="button" class="cc-modal-close" title="关闭" aria-label="关闭验证" @click="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <!-- 点击顺序提示：彩色圆点 + 形状简称 -->
        <div class="cc-prompt">
          <span class="cc-prompt-label">请依次点击</span>
          <template v-for="(t, i) in challenge.targets" :key="i">
            <span class="cc-chip">
              <i class="cc-chip-no">{{ i + 1 }}</i>
              <i class="cc-chip-dot" :style="{ background: colorMeta[t.color]?.hex || '#94a3b8' }"></i>
              <b>{{ labelOf(t) }}</b>
            </span>
            <span v-if="i < challenge.targets.length - 1" class="cc-chip-arrow">→</span>
          </template>
        </div>

        <div class="cc" :class="{ 'is-ok': state === 'success' }">
          <!-- 点选画布（服务端生成的静态图：5 个彩色图形，宽度自适应） -->
          <div
            ref="boardRef"
            class="cc-board"
            :style="{ aspectRatio: (challenge.width || 300) + ' / ' + (challenge.height || 190) }"
            @click="onBoardClick"
          >
            <img v-if="challenge.img" :src="challenge.img" class="cc-img" alt="" draggable="false">
            <div v-else class="cc-loading">验证码加载中…</div>

            <!-- 已点击位置：序号标记；点击标记可撤销该点（不触发画布加点） -->
            <button
              v-for="(p, i) in clicks"
              :key="i"
              type="button"
              class="cc-marker"
              :style="{ left: (p.x / (challenge.width || 300) * 100) + '%', top: (p.y / (challenge.height || 190) * 100) + '%' }"
              :aria-label="'撤销第 ' + (i + 1) + ' 个点击'"
              @click.stop="removeClick(i)"
            >{{ i + 1 }}</button>

            <div v-if="state === 'success'" class="cc-ok-mask">
              <el-icon><CircleCheckFilled /></el-icon>
              <span>验证通过</span>
            </div>

            <button type="button" class="cc-refresh" title="换一张" aria-label="刷新验证码" @click.stop="manualRefresh">
              <el-icon><Refresh /></el-icon>
            </button>
          </div>

          <!-- 操作行：重选清空已点；凑齐 3 点后可提交 -->
          <div class="cc-actions">
            <button type="button" class="cc-btn-reset" :disabled="!clicks.length || state === 'checking'" @click="resetClicks">
              重选
            </button>
            <button
              type="button"
              class="cc-btn-submit"
              :disabled="clicks.length !== TARGET_COUNT || state !== 'idle'"
              @click="submit"
            >{{ state === 'checking' ? '校验中…' : '确认验证' }}</button>
          </div>

          <!-- 局部错误条：实色白底红字，不使用全局通知 -->
          <div v-if="failMsg" class="cc-error" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
            </svg>
            <span>{{ failMsg }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * 彩色图形点选验证码（模态框，Web + H5，无拖拽/无动画，低端机友好）
 *
 * 交互契约与旧 SliderCaptcha 完全一致，调用方无需改动逻辑：
 *   - 组件常驻，挂载时探测后端开关（GET /captcha/click 的 enabled）；
 *   - 父级点击登录/发码前调用 open()：关闭时返回 false 直接放行，开启时弹窗拉题；
 *   - 按提示顺序点满 3 个图形 → 确认验证，通过后 emit('verified', uuid)，
 *     父级携带 uuid 发起登录/发码，服务端一次性消费。
 *
 * 安全要点：图形坐标只存在服务端 Redis，前端仅拿到形状/颜色文案与静态图；
 * 点击坐标按显示比例换算回画布坐标提交；挑战成败均一次性消费，失败立即换新题。
 */
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { CircleCheckFilled, Refresh } from '@element-plus/icons-vue'
import { getClickCaptcha, checkClickCaptcha } from '@/api/login'

const emit = defineEmits(['verified', 'enabled-change'])

const TARGET_COUNT = 3

const visible = ref(false)
const boardRef = ref(null)

const challenge = reactive({ uuid: '', img: '', width: 300, height: 190, targets: [] })
// idle=待点击 loading=加载图 checking=服务端校验 success=通过 fail=失败（已换新题）
const state = ref('idle')
const clicks = ref([])
const failMsg = ref('')

// 后端开关（挂载时由首次请求探测）
const enabled = ref(false)

// 组件存活标志：卸载后不再发起新请求
let alive = true
// 当前挑战是否已被服务端消费（校验成功/失败后一次性答案即失效，需换新题）
let consumed = false
// 拉题请求序号：丢弃过期响应，杜绝并发请求导致的 uuid/图错配
let loadSeq = 0
let closeTimer = null
let msgTimer = null

const colorMeta = {
  red: { name: '红', hex: '#E53935' },
  blue: { name: '蓝', hex: '#1E88E5' },
  yellow: { name: '黄', hex: '#F9A825' },
  green: { name: '绿', hex: '#43A047' },
  purple: { name: '紫', hex: '#8E24AA' }
}
const shapeName = { circle: '圆', square: '方', triangle: '三角', star: '星', diamond: '菱' }
function labelOf(t) {
  return (colorMeta[t.color]?.name || '') + (shapeName[t.shape] || '')
}

async function loadChallenge(preserveMsg = false) {
  if (!alive) return
  const seq = ++loadSeq
  state.value = 'loading'
  clicks.value = []
  if (!preserveMsg) failMsg.value = ''
  try {
    const res = await getClickCaptcha()
    if (!alive || seq !== loadSeq) return
    enabled.value = res.enabled === true
    emit('enabled-change', enabled.value)
    if (!enabled.value) return
    consumed = false
    challenge.uuid = res.uuid
    challenge.img = res.img
    challenge.width = res.width || 300
    challenge.height = res.height || 190
    challenge.targets = Array.isArray(res.targets) ? res.targets : []
    state.value = 'idle'
    if (preserveMsg) {
      // 新题就位后错误条再保留 2s，便于用户看清失败原因
      clearTimeout(msgTimer)
      msgTimer = setTimeout(() => { if (alive) failMsg.value = '' }, 2000)
    }
  } catch (e) {
    if (!alive || seq !== loadSeq) return
    failMsg.value = '验证码加载失败，请点击右上角刷新重试'
    state.value = 'fail'
    consumed = true
  }
}

function manualRefresh() {
  loadChallenge()
}

function resetClicks() {
  clicks.value = []
  failMsg.value = ''
}

/** 画布点击：换算为画布逻辑坐标（与服务端 300×190 同坐标系） */
function onBoardClick(e) {
  if (state.value !== 'idle' || consumed || !challenge.uuid) return
  if (clicks.value.length >= TARGET_COUNT) return
  const el = boardRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = Math.round((e.clientX - rect.left) / rect.width * challenge.width)
  const y = Math.round((e.clientY - rect.top) / rect.height * challenge.height)
  clicks.value.push({
    x: Math.max(0, Math.min(challenge.width, x)),
    y: Math.max(0, Math.min(challenge.height, y))
  })
  failMsg.value = ''
}

/** 点击序号标记：撤销该点，后续序号自然前移 */
function removeClick(i) {
  if (state.value !== 'idle') return
  clicks.value.splice(i, 1)
}

async function submit() {
  if (clicks.value.length !== TARGET_COUNT || state.value !== 'idle') return
  state.value = 'checking'
  try {
    await checkClickCaptcha({ uuid: challenge.uuid, points: clicks.value })
    if (!alive) return
    consumed = true
    state.value = 'success'
    emit('verified', challenge.uuid)
    // 短暂展示成功态后自动收起，父级随即发起登录/发码
    clearTimeout(closeTimer)
    closeTimer = setTimeout(close, 450)
  } catch (err) {
    if (!alive) return
    // 一次性答案已被服务端消费：立即换新题（错误条保留 2s）
    state.value = 'fail'
    consumed = true
    failMsg.value = (err && err.message) ? err.message : '验证失败，请重试'
    loadChallenge(true)
  }
}

/**
 * 打开模态：验证关闭时同步返回 false（调用方直接继续）；开启则弹窗并返回 true。
 * 注意必须同步返回布尔值——调用方以 if (!open()) 判定，async 包装的 Promise 恒为 truthy。
 * 挂载时已预取且未被消费的挑战直接复用，避免慢网下重复并发请求。
 */
function open() {
  if (!enabled.value) return false
  clearTimeout(closeTimer)
  clearTimeout(msgTimer)
  failMsg.value = ''
  visible.value = true
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onEsc)
  nextTick(() => {
    const hasUsable = state.value === 'idle' && !!challenge.uuid && !consumed
    if (!hasUsable) loadChallenge()
    else clicks.value = []
  })
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
  clearTimeout(msgTimer)
}

defineExpose({ open, close })

onMounted(() => {
  // 仅探测开关 + 预取第一道题，模态不展示
  loadChallenge()
})
onBeforeUnmount(() => {
  alive = false
  clearTimeout(closeTimer)
  clearTimeout(msgTimer)
  close()
})
</script>

<style lang="scss" scoped>
/* 无任何入场/过渡动画：遮罩与弹层直接显示，低端机零渲染负担；不使用 backdrop-filter */
.cc-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, .45);
}
.cc-modal {
  width: 100%;
  max-width: 340px;
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, .35);
}
.cc-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cc-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: .5px;
}
.cc-modal-close {
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
  svg { width: 15px; height: 15px; }
  &:hover { background: #f1f5f9; color: #475569; }
}

/* 顺序提示行 */
.cc-prompt {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #334155;
}
.cc-prompt-label { color: #64748b; margin-right: 2px; }
.cc-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 3px;
  border-radius: 999px;
  background: #f1f5f9;
  b { font-weight: 600; color: #0f172a; font-size: 12.5px; }
}
.cc-chip-no {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-style: normal;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
.cc-chip-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(15, 23, 42, .15);
}
.cc-chip-arrow { color: #94a3b8; font-size: 12px; }

.cc {
  width: 100%;
  user-select: none;
}
.cc-board {
  position: relative;
  width: 100%;
  aspect-ratio: 300 / 190;
  border-radius: 10px;
  overflow: hidden;
  background: #e2e8f0;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  cursor: crosshair;
  touch-action: manipulation;
}
.cc-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.cc-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 13px;
}

/* 已点序号标记：大号触控热区（34px），点击即撤销 */
.cc-marker {
  position: absolute;
  z-index: 2;
  width: 28px;
  height: 28px;
  margin: -14px 0 0 -14px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(15, 23, 42, .35);
  cursor: pointer;
  padding: 0;
}
.cc-ok-mask {
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
.cc-refresh {
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
  &:hover { background: rgba(15, 23, 42, .7); }
}

.cc-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.cc-btn-reset,
.cc-btn-submit {
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.cc-btn-reset {
  width: 92px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  &:hover:not(:disabled) { background: #f8fafc; }
}
.cc-btn-submit {
  flex: 1;
  border: none;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  &:hover:not(:disabled) { background: #1d4ed8; }
}
.cc-btn-reset:disabled,
.cc-btn-submit:disabled {
  cursor: not-allowed;
  opacity: .55;
}

/* 局部错误条：实色不透明、白底红字 */
.cc-error {
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
</style>
