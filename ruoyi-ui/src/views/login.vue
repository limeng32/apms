<template>
  <LoginRenderer :config="loginThemeStore.config" @logo-click="onLogoSecretTap">
    <!-- 登录表单：纯展示组件 LoginFormFields，业务逻辑在本文件 -->
    <template #form>
      <!-- storage-error：浏览器存储不可用，演示与普通登录均暂停，阻断页 -->
      <div v-if="sessionState === 'storage-error'" class="storage-blocked">
        <el-icon class="storage-blocked-icon"><WarningFilled/></el-icon>
        <p class="storage-blocked-title">浏览器本地存储不可用</p>
        <p class="storage-blocked-text">演示与登录均已暂停，请恢复本地存储（sessionStorage）后刷新页面</p>
        <el-button type="primary" @click="reloadPage">重新检测</el-button>
      </div>
      <template v-else>
        <!-- 登录方式切换：短信开启且主 Logo 后门已解锁时才出现（未解锁只呈现短信登录单形态） -->
        <div v-if="smsEnabled && accountUnlocked" class="login-mode-tabs">
          <button type="button"
                  :class="{ 'is-active': activeTab === 'account' }"
                  @click="activeTab = 'account'">账号登录</button>
          <button type="button"
                  :class="{ 'is-active': activeTab === 'sms' }"
                  @click="activeTab = 'sms'">短信登录</button>
        </div>
        <LoginFormFields
          v-show="!smsEnabled || (accountUnlocked && activeTab === 'account')"
          ref="loginFieldsRef"
          v-model="loginForm"
          :config="loginThemeStore.config"
          :loading="loading"
          :demo-entry="demoEnabled"
          @submit="handleLogin"
          @forgot="handleForgot"
          @demo="demoDialogVisible = true"
        />
        <SmsLoginForm
          v-show="smsEnabled && activeTab === 'sms'"
          ref="smsFormRef"
          :loading="loading"
          :demo-entry="demoEnabled"
          @submit="onSmsSubmit"
          @need-slider="onSmsNeedSlider"
          @select="onSmsSelectAccount"
          @demo="demoDialogVisible = true"
        />
      </template>
    </template>
  </LoginRenderer>

  <!-- 图形点选验证码（模态框；点登录时弹出，通过后自动发起登录） -->
  <ClickCaptcha
    ref="sliderRef"
    @verified="onSliderVerified"
    @enabled-change="onSliderEnabledChange"
  />

  <!-- 一键体验口令弹窗（仅业务域登录页；展示页不挂 login.vue） -->
  <DemoPassDialog v-model="demoDialogVisible" @success="handleDemoSuccess" />
</template>

<script setup name="Login">
import Cookies from "js-cookie"
import { cookieName } from '@/utils/ruoyi'
import { WarningFilled } from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import LoginRenderer from './login/LoginRenderer.vue'
import LoginFormFields from './login/LoginFormFields.vue'
import SmsLoginForm from './login/SmsLoginForm.vue'
import ClickCaptcha from './login/ClickCaptcha.vue'
import DemoPassDialog from './login/DemoPassDialog.vue'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { applyLoginHead, restoreLoginHead, resolveBrowserTitle } from './login/login.utils'
import { readDemoSessionState, clearDemoSession } from '@/utils/auth'
import { isDemoEnabled } from '@/utils/demo'
import { isShowcaseHost } from '@/utils/entry'

const userStore = useUserStore()
const loginThemeStore = useLoginThemeStore()
const route = useRoute()
const router = useRouter()
const { proxy } = getCurrentInstance()

// 一键体验：入口开关（env 可关）+ 口令弹窗 + 会话四态（storage-error 阻断、broken 自愈）
const demoEnabled = isDemoEnabled()
const demoDialogVisible = ref(false)
const sessionState = ref(readDemoSessionState().state)

const loginFieldsRef = ref(null)
const smsFormRef = ref(null)

// 登录方式 tab（账号/短信）；短信 tab 是否可选由后端 smsEnabled 决定（loadConfig 后响应式更新）
const smsEnabled = computed(() => loginThemeStore.smsEnabled === true)
// 账号密码入口隐藏后门：默认只呈现短信登录，1.5s 内连续点击主 Logo 6 次才解锁。
// 状态仅存内存，不持久化——刷新/重新进入登录页即恢复隐藏（accountUnlocked 归 false）。
const BACKDOOR_TAP_REQUIRED = 6
const BACKDOOR_WINDOW_MS = 1500
const accountUnlocked = ref(false)
// 初始 tab 必须读 store 当前值：App.vue/lock.vue 可能在本组件挂载前就已 loadConfig
// （锁屏页「返回登录」走 router.push 而非整页刷新，store 中 smsEnabled 已为 true）。
// 若恒初始化为 account，watch 又只在变化时触发，会出现账号/短信两个表单同时 v-show=false 的空白页。
const activeTab = ref(smsEnabled.value ? 'sms' : 'account')
const logoTapTimes = []
function onLogoSecretTap() {
  if (accountUnlocked.value || !smsEnabled.value) return
  const now = Date.now()
  while (logoTapTimes.length && now - logoTapTimes[0] > BACKDOOR_WINDOW_MS) {
    logoTapTimes.shift()
  }
  logoTapTimes.push(now)
  if (logoTapTimes.length >= BACKDOOR_TAP_REQUIRED) {
    logoTapTimes.length = 0
    accountUnlocked.value = true
    activeTab.value = 'account'
  }
}
// 配置到达：短信开启且未解锁时默认落在短信 tab；短信关闭（如演示站）回到账号形态。
// immediate：组件在 store 已加载后再挂载时（SPA 内回到 /login）也能立即对齐，不依赖 false→true 的变化
watch(smsEnabled, (on) => {
  if (on && !accountUnlocked.value) {
    activeTab.value = 'sms'
  } else if (!on) {
    activeTab.value = 'account'
  }
}, { immediate: true })

// 真人滑块拼图：enabled=后端开关；sliderUuid=本次通过标识（登录前必须持有）
const sliderRef = ref(null)
const sliderEnabled = ref(false)
const sliderUuid = ref('')
// 滑块通过后继续的挂起动作：password=账号密码登录，smsCode=发送短信验证码
const pendingSliderAction = ref('password')
function onSliderEnabledChange(enabled) {
  sliderEnabled.value = enabled
  if (!enabled) sliderUuid.value = ''
}
function onSliderVerified(uuid) {
  sliderUuid.value = uuid
  // 模态框流程：滑块通过后按挂起动作继续（模态约 0.4s 后自行收起）
  if (pendingSliderAction.value === 'smsCode') {
    smsFormRef.value && smsFormRef.value.requestSend(uuid)
  } else {
    doLogin()
  }
}

const loginForm = ref({
  username: "",
  password: "",
  rememberMe: false
})

const loading = ref(false)
const register = ref(false)
const redirect = ref(undefined)

watch(route, (newRoute) => {
  redirect.value = newRoute.query && newRoute.query.redirect
}, { immediate: true })

// favicon / 浏览器标题：favicon 取业务站设计器配置；标题取 brand.browserTitle，
// 留空回退构建标题 VITE_APP_TITLE（见 login.utils.resolveBrowserTitle）
function applyHead() {
  const c = loginThemeStore.config
  applyLoginHead({ favicon: c.brand?.favicon, title: resolveBrowserTitle(c) }, 'portal')
}

// 进入 /login：首帧用默认配置渲染，挂载后异步拉取（失败静默回退，绝不阻断）
onMounted(() => {
  applyHead()
  loginThemeStore.loadConfig().then(applyHead)
  setupAutoFullscreen()
  // broken 自愈：演示单键损坏时清掉异常键并提示，本次回到普通登录（isDemoMode 翻 false）。
  // storage-error 不在此处理（模板渲染阻断页，任何登录入口都不出现）。
  if (sessionState.value === 'broken') {
    clearDemoSession()
    sessionState.value = 'none'
    proxy.$modal.msgInfo('演示状态数据异常，已退出演示模式')
  }
})
onBeforeUnmount(() => {
  restoreLoginHead()
  removeAutoFullscreenListener()
})

/**
 * 大屏沉浸兜底（仅生产 + 业务站）：
 * PWA 主屏幕图标启动时系统已按 manifest 全屏运行，无需再请求；
 * 用户从普通 Chrome 标签打开时，浏览器禁止页面加载即全屏（安全策略），
 * 故在首次点击/触摸页面（点输入框、按钮任意位置均可）时请求一次全屏。
 * iPhone Safari 不支持网页全屏（fullscreenEnabled 为假），自动跳过；
 * Esc/返回键退出后不再重复请求，失败（权限/iframe 等）一律静默。
 */
let autoFullscreenBound = false
function onFirstUserActivation() {
  const el = document.documentElement
  if (el && typeof el.requestFullscreen === 'function') {
    el.requestFullscreen().catch(() => {})
  }
}
function removeAutoFullscreenListener() {
  if (!autoFullscreenBound) return
  document.removeEventListener('pointerdown', onFirstUserActivation, true)
  autoFullscreenBound = false
}
function setupAutoFullscreen() {
  if (!import.meta.env.PROD || isShowcaseHost()) return
  if (!document.fullscreenEnabled) return
  // 已处于 PWA 全屏/独立形态（从主屏幕图标启动）时不再请求
  let launchedImmersive = false
  try {
    launchedImmersive = window.matchMedia(
      '(display-mode: fullscreen), (display-mode: standalone), (display-mode: minimal-ui)'
    ).matches
  } catch (e) { /* matchMedia 不可用时按普通标签处理 */ }
  if (launchedImmersive) return
  document.addEventListener('pointerdown', onFirstUserActivation, { once: true, capture: true })
  autoFullscreenBound = true
}

// 口令正确、enterDemo 完成：守卫检测 roles.length===0 走真实链路拉 mock getInfo/路由。
// 落地页与真实 super 一致：总览 → 数据驾驶舱（/overview/cockpit）
function handleDemoSuccess() {
  router.replace('/overview/cockpit')
}

function reloadPage() {
  window.location.reload()
}

function handleLogin() {
  loginFieldsRef.value.validate(valid => {
    if (!valid) return
    if (loginForm.value.rememberMe) {
      Cookies.set(cookieName("username"), loginForm.value.username, { expires: 30 })
      Cookies.set(cookieName("rememberMe"), loginForm.value.rememberMe, { expires: 30 })
    } else {
      Cookies.remove(cookieName("username"))
      Cookies.remove(cookieName("rememberMe"))
    }
    // 密码不再写入 cookie，并清除历史版本遗留的密码 cookie
    Cookies.remove("password")
    // 滑块开启：先弹出验证模态，通过后由 onSliderVerified 调 doLogin
    if (sliderEnabled.value) {
      pendingSliderAction.value = 'password'
      sliderRef.value && sliderRef.value.open()
      return
    }
    doLogin()
  })
}

/**
 * 短信表单点「获取验证码」：滑块开启先弹模态（通过后由 onSliderVerified 回调
 * 短信表单的 requestSend）；关闭则直接放行发码
 */
function onSmsNeedSlider() {
  if (sliderEnabled.value) {
    pendingSliderAction.value = 'smsCode'
    sliderRef.value && sliderRef.value.open()
  } else {
    smsFormRef.value && smsFormRef.value.requestSend(undefined)
  }
}

/** 短信表单提交：发码前已过过人机校验，这里直接登录，不再弹滑块 */
function onSmsSubmit(payload) {
  loading.value = true
  userStore.loginBySms(payload).then(res => {
    if (res.token) {
      // 单账号：已直接登录
      afterLoginSuccess()
      return
    }
    if (res.selectToken) {
      // 多账号：停止 loading，弹账号选择（选择令牌 5 分钟一次性）
      loading.value = false
      smsFormRef.value && smsFormRef.value.showAccounts(res.accounts, res.selectToken)
      return
    }
    loading.value = false
  }).catch(() => {
    loading.value = false
  })
}

/** 多账号：用户选定账号后凭选择令牌兑换登录 */
function onSmsSelectAccount(payload) {
  loading.value = true
  userStore.selectSmsAccount(payload).then(() => {
    afterLoginSuccess()
  }).catch(() => {
    loading.value = false
    // 令牌一次性/过期等失败：回到验证码步骤，提示已由全局拦截器给出
    smsFormRef.value && smsFormRef.value.backToForm()
  })
}

/** 登录成功后的统一跳转（账号/短信共用） */
function afterLoginSuccess() {
  const query = route.query
  const otherQueryParams = Object.keys(query).reduce((acc, cur) => {
    if (cur !== "redirect") {
      acc[cur] = query[cur]
    }
    return acc
  }, {})
  router.push({ path: redirect.value || "/", query: otherQueryParams })
}

/** 实际发起登录（普通登录直接调；滑块通过后由 onSliderVerified 调） */
function doLogin() {
  loading.value = true
  userStore.login({ ...loginForm.value, sliderUuid: sliderUuid.value || undefined }).then(() => {
    afterLoginSuccess()
  }).catch(() => {
    loading.value = false
    // 登录失败：滑块通过标记已被服务端消费，下次点登录会重新弹窗换新题
    sliderUuid.value = ''
  })
}

function getCookie() {
  // 本机多环境隔离后的用户名；兼容改造前未加后缀的旧 cookie
  const username = Cookies.get(cookieName("username")) || Cookies.get("username")
  // 清除历史版本遗留的密码 cookie；密码不再回填
  Cookies.remove("password")
  // “记住我”已禁用：清除遗留 cookie，强制不勾选
  Cookies.remove("rememberMe")
  loginForm.value = {
    username: username === undefined ? loginForm.value.username : username,
    password: loginForm.value.password,
    rememberMe: false
  }
}

function handleForgot() {
  const msg = loginThemeStore.config.form.forgot.alertMessage || '请联系管理员重置密码'
  proxy.$modal.msgWarning(msg)
}

getCookie()
</script>

<style lang='scss' scoped>
/* 账号登录 / 短信登录 切换条 */
.login-mode-tabs {
  display: flex;
  gap: 22px;
  margin: 22px 2px 0;
  border-bottom: 1px solid var(--login-border);
}
.login-mode-tabs button {
  position: relative;
  padding: 0 2px 10px;
  border: none;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--login-text-2);
  cursor: pointer;
  transition: color .15s ease;
  &.is-active {
    color: var(--login-link);
    font-weight: 600;
    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      border-radius: 2px;
      background: var(--login-link);
    }
  }
}

/* storage-error 阻断页（替换整个表单区） */
.storage-blocked {
  margin-top: 30px;
  padding: 28px 18px 24px;
  text-align: center;
  border: 1px solid var(--login-border);
  border-radius: var(--login-radius);
  background: var(--login-page-bg);
}
.storage-blocked-icon {
  font-size: 34px;
  color: #f59e0b;
}
.storage-blocked-title {
  margin: 12px 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--login-text-1);
}
.storage-blocked-text {
  margin: 0 0 16px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--login-text-2);
}
</style>
