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
          <span class="lock-avatar lock-avatar-initial">{{ avatarInitial }}</span>
          <div class="lock-badge"><el-icon><Lock /></el-icon></div>
        </div>
        <div class="lock-username">{{ userStore.nickName }}</div>
        <div class="lock-hint">系统已锁定，点击解锁返回</div>

        <button class="unlock-btn" @click="handleUnlock">
          <el-icon><Unlock /></el-icon>
          <span>解 锁</span>
        </button>

        <div class="lock-footer">
          <a href="javascript:;" @click="goLogin">退出重新登录</a>
        </div>
      </div>
    </template>
  </LoginRenderer>
</template>

<script setup>
import { Lock, Unlock } from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import useLockStore from '@/store/modules/lock'
import useLoginThemeStore from '@/store/modules/loginTheme'
import LoginRenderer from './login/LoginRenderer.vue'

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

const currentTime = ref('')
const currentDate = ref('')

let timer = null

// 与顶部导航一致：昵称首字代替头像
const avatarInitial = computed(() => {
  const name = (userStore.nickName || '').trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})

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

// 免鉴权解锁：锁屏仅作占位，点击即回到锁定前页面，不做任何密码校验
const handleUnlock = () => {
  const lockPath = lockStore.lockPath
  lockStore.unlockScreen()
  router.replace(lockPath)
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
  display: block;
}
/* 名称首字徽章（替代头像图片），底色取登录主色，与右下锁标同一色系 */
.lock-avatar-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--login-btn-bg);
  color: #fff;
  font-size: 30px;
  font-weight: 700;
  user-select: none;
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

/* 一键解锁按钮（规格对齐登录按钮 46px / 圆角） */
.unlock-btn {
  width: 100%;
  height: 46px;
  margin-top: 4px;
  border: none;
  border-radius: var(--login-radius);
  background: var(--login-btn-bg);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 15px;
  letter-spacing: 4px;
  transition: background 0.2s;
}
.unlock-btn:hover {
  background: var(--login-btn-hover);
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
</style>
