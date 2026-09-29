<template>
  <LoginRenderer :config="loginThemeStore.config">
    <!-- 登录表单：纯展示组件 LoginFormFields，业务逻辑在本文件 -->
    <template #form>
      <!-- storage-error：浏览器存储不可用，演示与普通登录均暂停，阻断页 -->
      <div v-if="sessionState === 'storage-error'" class="storage-blocked">
        <el-icon class="storage-blocked-icon"><WarningFilled/></el-icon>
        <p class="storage-blocked-title">浏览器本地存储不可用</p>
        <p class="storage-blocked-text">演示与登录均已暂停，请恢复本地存储（sessionStorage）后刷新页面</p>
        <el-button type="primary" @click="reloadPage">重新检测</el-button>
      </div>
      <LoginFormFields
        v-else
        ref="loginFieldsRef"
        v-model="loginForm"
        :config="loginThemeStore.config"
        :loading="loading"
        :flash="fieldFlash"
        :demo-entry="demoEnabled"
        @submit="handleLogin"
        @forgot="handleForgot"
        @demo="demoDialogVisible = true"
      />
    </template>

    <!-- dev 环境演示角色快捷填充（demo 同款角色卡：选中描边+对勾+角色色条，仅填充账号；UAT/生产不显示） -->
    <template #roles>
      <div class="lf-roles" v-if="isDev">
        <div class="lf-roles-title">— 选择演示角色，自动填充账号 —</div>
        <div class="lf-roles-list">
          <button
            v-for="r in roles"
            :key="r.key"
            type="button"
            class="lf-role-card"
            :class="{ active: selectedRole === r.key }"
            :style="{ '--role-color': r.color, '--role-soft': r.color + '1A' }"
            @click="quickFill(r)"
          >
            <span class="role-top">
              <span class="role-ico"><el-icon><component :is="r.icon"/></el-icon></span>
              <span v-if="selectedRole === r.key" class="role-check"><el-icon><Check/></el-icon></span>
              <span v-else class="role-dot"></span>
            </span>
            <span class="role-name">{{ r.name }}</span>
            <span v-if="selectedRole === r.key" class="role-bar"></span>
          </button>
        </div>
      </div>
    </template>
  </LoginRenderer>

  <!-- 一键体验口令弹窗（仅业务域登录页；展示页不挂 login.vue） -->
  <DemoPassDialog v-model="demoDialogVisible" @success="handleDemoSuccess" />
</template>

<script setup name="Login">
import Cookies from "js-cookie"
import { cookieName } from '@/utils/ruoyi'
import {
  User, CircleCheck, Check, Key, Document,
  FirstAidKit, DataAnalysis, WarningFilled
} from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import LoginRenderer from './login/LoginRenderer.vue'
import LoginFormFields from './login/LoginFormFields.vue'
import DemoPassDialog from './login/DemoPassDialog.vue'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { applyLoginHead, restoreLoginHead } from './login/login.utils'
import { readDemoSessionState, clearDemoSession } from '@/utils/auth'
import { isDemoEnabled } from '@/utils/demo'

const userStore = useUserStore()
const loginThemeStore = useLoginThemeStore()
const route = useRoute()
const router = useRouter()
const { proxy } = getCurrentInstance()

// 一键体验：入口开关（env 可关）+ 口令弹窗 + 会话四态（storage-error 阻断、broken 自愈）
const demoEnabled = isDemoEnabled()
const demoDialogVisible = ref(false)
const sessionState = ref(readDemoSessionState().state)

// 演示环境角色快捷登录（仅 dev 显示）；角色色板对齐 demo ROLE_LIST
const isDev = import.meta.env.DEV
const roles = [
  { key: 'admin', name: '管理员', icon: 'Document', color: '#2563eb' },
  { key: 'coach', name: '体能师', icon: 'User', color: '#06b6d4' },
  { key: 'rehab', name: '康复师', icon: 'CircleCheck', color: '#14b8a6' },
  { key: 'head', name: '主教练', icon: 'Key', color: '#7c3aed' },
  { key: 'doctor', name: '队医', icon: 'FirstAidKit', color: '#16a34a' },
  { key: 'research', name: '科研', icon: 'DataAnalysis', color: '#d97706' },
]
// 当前选中的角色卡（demo 同款选中态）；null=尚未选择
const selectedRole = ref(null)
// 切换角色时账号区 150ms 闪烁（demo pickRole 效果）
const fieldFlash = ref(false)
let flashTimer = null

const loginFieldsRef = ref(null)

const loginForm = ref({
  username: "admin",
  password: "",
  rememberMe: false
})

const loading = ref(false)
const register = ref(false)
const redirect = ref(undefined)

watch(route, (newRoute) => {
  redirect.value = newRoute.query && newRoute.query.redirect
}, { immediate: true })

// favicon / 浏览器标题：配置加载后动态替换，离开登录页恢复，不影响全站
function applyHead() {
  const c = loginThemeStore.config
  const title = (c.brand?.name || '').trim() || import.meta.env.VITE_APP_TITLE
  applyLoginHead({ favicon: c.brand?.favicon, title })
}

// 进入 /login：首帧用默认配置渲染，挂载后异步拉取（失败静默回退，绝不阻断）
onMounted(() => {
  applyHead()
  loginThemeStore.loadConfig().then(applyHead)
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
})

// 口令正确、enterDemo 完成：守卫检测 roles.length===0 走真实链路拉 mock getInfo/路由
function handleDemoSuccess() {
  router.replace('/apms/dashboard')
}

function reloadPage() {
  window.location.reload()
}

function handleLogin() {
  loginFieldsRef.value.validate(valid => {
    if (valid) {
      loading.value = true
      if (loginForm.value.rememberMe) {
        Cookies.set(cookieName("username"), loginForm.value.username, { expires: 30 })
        Cookies.set(cookieName("rememberMe"), loginForm.value.rememberMe, { expires: 30 })
      } else {
        Cookies.remove(cookieName("username"))
        Cookies.remove(cookieName("rememberMe"))
      }
      // 密码不再写入 cookie，并清除历史版本遗留的密码 cookie
      Cookies.remove("password")
      userStore.login(loginForm.value).then(() => {
        const query = route.query
        const otherQueryParams = Object.keys(query).reduce((acc, cur) => {
          if (cur !== "redirect") {
            acc[cur] = query[cur]
          }
          return acc
        }, {})
        router.push({ path: redirect.value || "/", query: otherQueryParams })
      }).catch(() => {
        loading.value = false
      })
    }
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

function quickFill(r) {
  // 仅在切换到不同角色时触发闪烁（重复点击当前角色不闪）
  if (selectedRole.value !== r.key) {
    fieldFlash.value = true
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { fieldFlash.value = false }, 150)
  }
  selectedRole.value = r.key
  loginForm.value.username = r.key
  loginForm.value.password = r.key + '123'
}

function handleForgot() {
  const msg = loginThemeStore.config.form.forgot.alertMessage || '请联系管理员重置密码'
  proxy.$modal.msgWarning(msg)
}

getCookie()
</script>

<style lang='scss' scoped>
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

/* 演示角色卡（仅 dev；UAT/生产不渲染）—— demo 同款：图标圆底/右上对勾/底部角色色条 */
.lf-roles {
  margin-top: 22px;
  border-top: 1px dashed var(--login-border);
  padding-top: 18px;
}
.lf-roles-title {
  font-size: 11.5px;
  color: var(--login-text-2);
  text-align: center;
  margin-bottom: 10px;
}
.lf-roles-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.lf-role-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 12px 13px;
  border: 1px solid var(--login-border);
  border-radius: 10px;
  background: var(--login-page-bg);
  cursor: pointer;
  text-align: left;
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
  &:hover {
    transform: translateY(-2px);
    border-color: var(--role-color);
    box-shadow: 0 10px 22px -12px var(--role-color);
  }
  /* 选中：角色色描边（inset 描边避免 1px→2px 布局抖动）+ 辉光 */
  &.active {
    border-color: var(--role-color);
    box-shadow:
      0 0 0 1px var(--role-color) inset,
      0 12px 26px -12px var(--role-color);
  }
}
.role-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.role-ico {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--role-soft);
  color: var(--role-color);
  font-size: 17px;
}
.role-dot {
  margin-top: 7px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--role-color);
}
.role-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--role-color);
  color: #fff;
  font-size: 12px;
}
.role-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--login-text-1);
  line-height: 1.2;
}
.role-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: var(--role-color);
}

@media (max-width: 480px) {
  .lf-roles-list { grid-template-columns: repeat(2, 1fr); }
}

/* ============ 暗黑模式（与改造前一致） ============ */
html.dark .lf-role-card {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
}
</style>
