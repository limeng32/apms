<template>
  <!-- 步骤二：账号选择（一个手机号绑定多个账号时） -->
  <div v-if="step === 'select'" class="lf-form sms-select">
    <div class="sms-select-title">请选择登录账号</div>
    <div class="sms-select-sub">该手机号绑定了 {{ accounts.length }} 个账号，5 分钟内选择有效</div>
    <button
      v-for="acc in accounts"
      :key="acc.userId"
      type="button"
      class="sms-account-card"
      :disabled="selecting"
      @click="onPick(acc)"
    >
      <span class="sms-account-name">{{ acc.nickName || acc.userName }}</span>
      <span class="sms-account-meta">
        <span class="sms-account-user">{{ acc.userName }}</span>
        <span v-if="acc.deptName" class="sms-account-dot">·</span>
        <span v-if="acc.deptName">{{ acc.deptName }}</span>
      </span>
      <svg class="sms-account-arrow" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 6 6 6-6 6"/>
      </svg>
    </button>
    <button type="button" class="sms-select-back" @click="backToForm">返回重新验证</button>
  </div>

  <!-- 步骤一：手机号 + 验证码 -->
  <el-form
    v-else
    ref="formRef"
    :model="form"
    :rules="rules"
    class="lf-form sms-form"
    size="large"
    @submit.prevent
  >
    <el-form-item prop="phonenumber">
      <el-input
        v-model="form.phonenumber"
        type="tel"
        maxlength="11"
        inputmode="numeric"
        auto-complete="off"
        placeholder="请输入已绑定的手机号"
        @input="form.phonenumber = form.phonenumber.replace(/\D/g, '')"
      >
        <template #prefix><el-icon><Iphone/></el-icon></template>
      </el-input>
    </el-form-item>

    <el-form-item prop="code">
      <el-input
        v-model="form.code"
        type="text"
        maxlength="6"
        inputmode="numeric"
        auto-complete="one-time-code"
        placeholder="请输入短信验证码"
        @input="form.code = form.code.replace(/\D/g, '')"
        @keyup.enter="emit('submit', { ...form })"
      >
        <template #prefix><el-icon><Key/></el-icon></template>
        <template #suffix>
          <button
            type="button"
            class="sms-code-btn"
            :disabled="countdown > 0 || sending"
            @click="onClickSend"
          >
            {{ sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
          </button>
        </template>
      </el-input>
    </el-form-item>

    <el-form-item style="width:100%;">
      <el-button
        :loading="loading"
        type="primary"
        class="lf-submit"
        @click.prevent="onSubmit"
      >
        <span v-if="!loading" class="lf-submit-label">
          短信登录
          <svg
            class="lf-submit-arrow" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </span>
        <span v-else>登录中…</span>
      </el-button>
    </el-form-item>

    <!-- 一键体验入口：与账号密码表单同位（登录按钮下方）、同弹窗链路 -->
    <div v-if="demoEntry" class="lf-demo-entry">
      <el-button link type="primary" class="lf-demo-btn" @click="emit('demo')">
        一键体验演示环境
        <svg
          class="lf-demo-arrow" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
      </el-button>
    </div>
  </el-form>
</template>

<script setup>
/**
 * 短信登录表单（纯展示 + 自身倒计时管理）
 *
 * 与 LoginFormFields 平级，挂在 login.vue 的 #form 插槽内、tab 切换显示。
 * 图形点选验证复用 login.vue 常驻的 ClickCaptcha 模态：
 *   - 点「获取验证码」→ emit('need-slider')；父级按验证开关决定弹模态或直接放行；
 *   - 验证通过后父级调本组件暴露的 requestSend(uuid)；
 *   - 只有服务端发码成功才启动倒计时，失败保持可重试。
 */
import { Iphone, Key } from '@element-plus/icons-vue'
import { sendSmsCode } from '@/api/login'

const props = defineProps({
  /** 登录请求中（按钮 loading） */
  loading: { type: Boolean, default: false },
  /** 是否展示「一键体验演示环境」入口（仅业务域真实登录页传入，env 可关） */
  demoEntry: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'need-slider', 'select', 'demo'])

const RESEND_SECONDS = 60
const formRef = ref(null)
const form = ref({ phonenumber: '', code: '' })
const countdown = ref(0)
const sending = ref(false)
let timer = null

// 多账号选择步骤
const step = ref('form')
const accounts = ref([])
const selectToken = ref('')
const selecting = ref(false)

const PHONE_RE = /^1[3-9]\d{9}$/
const rules = {
  phonenumber: [
    { required: true, trigger: 'blur', message: '请输入手机号' },
    { pattern: PHONE_RE, trigger: 'blur', message: '手机号格式不正确' }
  ],
  code: [
    { required: true, trigger: 'blur', message: '请输入短信验证码' },
    { pattern: /^\d{6}$/, trigger: 'blur', message: '验证码为 6 位数字' }
  ]
}

function onClickSend() {
  // Element Plus validateField：校验通过 resolve、失败 reject（勿用 callback(isValid) 形式，语义易写反）
  formRef.value.validateField('phonenumber')
    .then(() => {
      // 交给父级：滑块开启时先弹模态，通过后回调 requestSend；关闭时父级直接调 requestSend
      emit('need-slider')
    })
    .catch(() => { /* 校验错误已在表单项下展示，无需额外处理 */ })
}

/**
 * 实际发起发码（由 login.vue 在滑块放行/通过后调用）
 * @param {string|undefined} sliderUuid 滑块通过标记（开关关闭时为 undefined）
 */
async function requestSend(sliderUuid) {
  if (countdown.value > 0 || sending.value) return
  sending.value = true
  try {
    await sendSmsCode(form.value.phonenumber, 'login', sliderUuid)
    // 成功后才倒计时
    countdown.value = RESEND_SECONDS
    timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)
  } finally {
    sending.value = false
  }
  // 错误由全局拦截器统一提示，Promise reject 会透传给父级（父级不另做处理）
}

function onSubmit() {
  formRef.value.validate(valid => {
    if (!valid) return
    emit('submit', { phonenumber: form.value.phonenumber, code: form.value.code })
  })
}

/**
 * 验码通过但手机号绑定多个账号：由 login.vue 调用，切到账号选择视图
 */
function showAccounts(list, token) {
  accounts.value = Array.isArray(list) ? list : []
  selectToken.value = token
  step.value = 'select'
}

function onPick(acc) {
  if (selecting.value) return
  selecting.value = true
  emit('select', { selectToken: selectToken.value, userId: acc.userId })
}

function backToForm() {
  step.value = 'form'
  accounts.value = []
  selectToken.value = ''
  // 验证码已一次性消费，清空让用户重新获取
  form.value.code = ''
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

defineExpose({ requestSend, showAccounts, backToForm })
</script>

<style lang='scss' scoped>
.sms-form {
  margin-top: 30px;
}

/* ===== 账号选择步骤 ===== */
.sms-select {
  margin-top: 30px;
}
.sms-select-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--login-text-1);
  margin-bottom: 4px;
}
.sms-select-sub {
  font-size: 12px;
  color: var(--login-text-2);
  margin-bottom: 14px;
}
.sms-account-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  margin-bottom: 10px;
  padding: 12px 40px 12px 14px;
  border: 1px solid var(--login-border);
  border-radius: var(--login-radius);
  background: #f8faff;
  cursor: pointer;
  text-align: left;
  transition: border-color .15s ease, background .15s ease;
  &:hover:not(:disabled) {
    border-color: var(--login-input-focus);
    background: #fff;
  }
  &:disabled { cursor: wait; opacity: .7; }
}
.sms-account-name {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--login-text-1);
}
.sms-account-meta {
  font-size: 12px;
  color: var(--login-text-2);
  font-family: var(--app-font-mono);
}
.sms-account-dot { margin: 0 5px; }
.sms-account-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--login-link);
}
.sms-select-back {
  display: block;
  margin: 6px auto 0;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--login-text-2);
  cursor: pointer;
  &:hover { color: var(--login-link); }
}

/* 与账号表单同一套输入框视觉（登录页 CSS 变量） */
:deep(.el-input__wrapper) {
  border-radius: var(--login-radius);
  height: 44px;
  box-shadow: 0 0 0 1px var(--login-border) inset;
  background-color: #f8faff;
  &:hover, &.is-focus {
    box-shadow: 0 0 0 1px var(--login-input-focus) inset;
  }
}
:deep(.el-input__inner) {
  height: 44px;
  font-size: 14px;
  font-family: var(--app-font-mono);
  color: var(--login-text-1);
  letter-spacing: 0.5px;
  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus {
    -webkit-text-fill-color: var(--login-text-1);
    -webkit-box-shadow: 0 0 0 1000px #f8faff inset;
  }
}
:deep(.el-input__prefix-inner) {
  color: var(--login-text-2);
  font-size: 17px;
  margin-right: 6px;
}

/* 验证码输入框内嵌「获取验证码」 */
.sms-code-btn {
  flex: none;
  margin-right: 4px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--login-link);
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(:disabled) { text-decoration: underline; }
  &:disabled {
    color: var(--login-text-3, #94a3b8);
    cursor: not-allowed;
  }
}

/* 一键体验入口：与账号密码表单同款 */
.lf-demo-entry {
  display: flex;
  justify-content: center;
  margin-top: 6px;
}
.lf-demo-btn {
  font-size: 13px;
  font-weight: 500;
  padding: 4px 8px;
}
.lf-demo-arrow { width: 14px; height: 14px; flex: none; margin-left: 2px; }

/* 登录按钮与账号表单同款（含根节点渐变形态 .btn-gradient-on .lf-submit） */
.lf-submit-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.lf-submit-arrow { width: 15px; height: 15px; flex: none; }
.lf-submit {
  height: 46px;
  width: 100%;
  border-radius: var(--login-radius);
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 1px;
  background: var(--login-btn-bg);
  border-color: var(--login-btn-bg);
  transition: filter .15s, background .15s, box-shadow .15s, transform .1s;
  &:hover, &:focus {
    background: var(--login-btn-hover);
    border-color: var(--login-btn-hover);
  }
  &.is-loading {
    background: var(--login-btn-loading);
    border-color: var(--login-btn-loading);
    opacity: .85;
  }
}
.btn-gradient-on .lf-submit {
  background-image: var(--login-btn-gradient);
  background-origin: border-box;
  background-clip: border-box;
  border-color: transparent;
  box-shadow: 0 10px 24px -10px var(--login-btn-glow);
  &:hover, &:focus {
    background-image: var(--login-btn-gradient);
    border-color: transparent;
    filter: brightness(1.12);
  }
  &:active { transform: scale(.985); }
  &.is-loading {
    background-image: var(--login-btn-gradient);
    border-color: transparent;
    opacity: .85;
  }
}
</style>
