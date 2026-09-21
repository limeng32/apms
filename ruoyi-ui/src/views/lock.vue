<template>
  <LoginRenderer :config="lockConfig" hide-card-header>
    <template #form>
      <div class="unlock-box">
        <!-- 卡片内精简时钟 -->
        <div class="uc-clock">
          <div class="uc-time">{{ currentTime }}</div>
          <div class="uc-date">{{ currentDate }}</div>
        </div>

        <div class="avatar-wrap">
          <img :src="userStore.avatar" class="lock-avatar" @error="onAvatarError" />
          <div class="lock-badge"><el-icon><Lock /></el-icon></div>
        </div>
        <div class="lock-username">{{ userStore.nickName }}</div>
        <div class="lock-hint">系统已锁定，请输入密码解锁</div>

        <div class="input-wrap" :class="{ shake: isShaking }">
          <input
            ref="passwordInput"
            v-model="password"
            type="password"
            placeholder="请输入登录密码"
            class="lock-input"
            autocomplete="off"
            @keydown.enter="handleUnlock"
          />
          <button class="unlock-btn" :disabled="loading" @click="handleUnlock">
            <el-icon v-if="!loading"><ArrowRight /></el-icon>
            <el-icon v-else class="is-loading-spin"><Loading /></el-icon>
          </button>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <div class="lock-footer">
          <a href="javascript:;" @click="goLogin">退出重新登录</a>
        </div>
      </div>
    </template>
  </LoginRenderer>
</template>

<script setup>
import { Lock, ArrowRight, Loading } from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import useLockStore from '@/store/modules/lock'
import useLoginThemeStore from '@/store/modules/loginTheme'
import LoginRenderer from './login/LoginRenderer.vue'
import { unlockScreen } from '@/api/login'
import defAva from '@/assets/images/profile.jpg'

const router = useRouter()
const userStore = useUserStore()
const lockStore = useLockStore()
const loginThemeStore = useLoginThemeStore()

// 锁屏页布局固定为「全屏背景」，不受登录页所选模板影响；
// 其余配置（配色/背景图/遮罩/字体/logo）仍复用登录页同一份配置
const lockConfig = computed(() => ({
  ...loginThemeStore.config,
  layout: {
    ...loginThemeStore.config.layout,
    template: 'fullscreen'
  }
}))

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const isShaking = ref(false)
const currentTime = ref('')
const currentDate = ref('')
const passwordInput = ref(null)

let timer = null

const onAvatarError = (e) => {
  e.target.src = defAva
}

const startClock = () => {
  const update = () => {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    currentTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    currentDate.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}`
  }
  update()
  timer = setInterval(update, 1000)
}

const handleUnlock = async () => {
  if (!password.value) {
    showError('请输入密码')
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await unlockScreen(password.value)
    const lockPath = lockStore.lockPath
    lockStore.unlockScreen()
    router.replace(lockPath)
  } catch (err) {
    const msg = err.message || err.toString()
    showError(msg)
    password.value = ''
    nextTick(() => passwordInput.value?.focus())
  } finally {
    loading.value = false
  }
}

const showError = (msg) => {
  errorMsg.value = msg
  isShaking.value = true
  setTimeout(() => { isShaking.value = false }, 600)
}

const goLogin = () => {
  lockStore.unlockScreen()
  userStore.logOut().then(() => {
    router.push('/login')
  })
}

onMounted(() => {
  // 复用登录页同一份配置（背景/配色/字体/logo），失败静默由 LoginRenderer 默认值兜底
  loginThemeStore.loadConfig()
  startClock()
  nextTick(() => passwordInput.value?.focus())
})

onBeforeUnmount(() => {
  clearInterval(timer)
})
</script>

<style scoped lang="scss">
/* 锁屏卡片内容：颜色全部走登录页 CSS 变量，与登录表单同一视觉体系 */
.unlock-box {
  width: 100%;
}

/* 精简时钟 */
.uc-clock {
  text-align: center;
  margin-bottom: 20px;
}
.uc-time {
  font-size: 28px;
  font-weight: 600;
  color: var(--login-text-1);
  letter-spacing: 2px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.uc-date {
  margin-top: 2px;
  font-size: 12px;
  color: var(--login-text-2);
  letter-spacing: 1px;
}

/* 头像 + 锁标 */
.avatar-wrap {
  position: relative;
  width: 72px;
  margin: 0 auto 14px;
}
.lock-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid var(--login-border);
  object-fit: cover;
  display: block;
}
.lock-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--login-btn-bg);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border: 2px solid var(--login-page-bg);
}

.lock-username {
  text-align: center;
  color: var(--login-text-1);
  font-size: 16px;
  font-weight: 600;
}
.lock-hint {
  text-align: center;
  color: var(--login-text-2);
  font-size: 13px;
  margin: 6px 0 20px;
}

/* 密码输入 + 解锁按钮（一体化控件，规格对齐登录输入框 46px / 圆角） */
.input-wrap {
  display: flex;
  align-items: center;
  height: 46px;
  border: 1px solid var(--login-border);
  border-radius: var(--login-radius);
  overflow: hidden;
  transition: border-color 0.2s;
}
.input-wrap:focus-within {
  border-color: var(--login-input-focus);
}
.input-wrap.shake {
  animation: shake 0.5s ease;
}
.lock-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  padding: 0 12px 0 14px;
  font-size: 14px;
  color: var(--login-text-1);
  background: transparent;
}
.lock-input::placeholder {
  color: var(--login-text-2);
}
.unlock-btn {
  flex: none;
  align-self: stretch;
  width: 52px;
  border: none;
  background: var(--login-btn-bg);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  transition: background 0.2s;
}
.unlock-btn:hover:not(:disabled) {
  background: var(--login-btn-hover);
}
.unlock-btn:disabled {
  opacity: 0.85;
  cursor: default;
}
.is-loading-spin {
  animation: uc-spin 1s linear infinite;
}
@keyframes uc-spin {
  to { transform: rotate(360deg); }
}

/* 错误提示 */
.error-msg {
  margin-top: 14px;
  color: #f56c6c;
  font-size: 13px;
  text-align: center;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 底部退出登录 */
.lock-footer {
  margin-top: 22px;
  text-align: center;
}
.lock-footer a {
  color: var(--login-text-2);
  font-size: 13px;
  text-decoration: none;
}
.lock-footer a:hover {
  color: var(--login-link);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
</style>
