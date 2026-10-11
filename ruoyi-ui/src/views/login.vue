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
        :demo-entry="demoEnabled"
        @submit="handleLogin"
        @forgot="handleForgot"
        @demo="demoDialogVisible = true"
      />
    </template>
  </LoginRenderer>

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
</style>
