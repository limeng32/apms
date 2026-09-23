<template>
  <LoginRenderer :config="loginThemeStore.config">
    <!-- 登录表单：纯展示组件 LoginFormFields，业务逻辑在本文件 -->
    <template #form>
      <LoginFormFields
        ref="loginFieldsRef"
        v-model="loginForm"
        :config="loginThemeStore.config"
        :loading="loading"
        @submit="handleLogin"
        @forgot="handleForgot"
      />
    </template>

    <!-- dev 环境演示角色快捷填充（原版行为：仅填充账号，不直接登录；UAT/生产不显示） -->
    <template #roles>
      <div class="lf-roles" v-if="isDev">
        <div class="lf-roles-title">— 演示角色快捷登录 —</div>
        <div class="lf-roles-list">
          <button v-for="r in roles" :key="r.key" class="lf-role-btn" @click="quickFill(r.key, r.name)">
            <el-icon class="role-icon"><component :is="r.icon"/></el-icon>
            {{ r.name }}
          </button>
        </div>
      </div>
    </template>
  </LoginRenderer>
</template>

<script setup name="Login">
import Cookies from "js-cookie"
import {
  User, CircleCheck, Check, TrendCharts, Key, Document
} from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import LoginRenderer from './login/LoginRenderer.vue'
import LoginFormFields from './login/LoginFormFields.vue'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { applyLoginHead, restoreLoginHead } from './login/login.utils'

const userStore = useUserStore()
const loginThemeStore = useLoginThemeStore()
const route = useRoute()
const router = useRouter()
const { proxy } = getCurrentInstance()

// 演示环境角色快捷登录（仅 dev 显示）
const isDev = import.meta.env.DEV
const roles = [
  { key: 'admin', name: '管理员', icon: 'Document' },
  { key: 'coach', name: '体能师', icon: 'User' },
  { key: 'rehab', name: '康复师', icon: 'CircleCheck' },
  { key: 'head', name: '主教练', icon: 'Key' },
  { key: 'doctor', name: '队医', icon: 'TrendCharts' },
  { key: 'research', name: '科研', icon: 'Check' },
]

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
})
onBeforeUnmount(() => {
  restoreLoginHead()
})

function handleLogin() {
  loginFieldsRef.value.validate(valid => {
    if (valid) {
      loading.value = true
      if (loginForm.value.rememberMe) {
        Cookies.set("username", loginForm.value.username, { expires: 30 })
        Cookies.set("rememberMe", loginForm.value.rememberMe, { expires: 30 })
      } else {
        Cookies.remove("username")
        Cookies.remove("rememberMe")
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
  const username = Cookies.get("username")
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

function quickFill(role, name) {
  loginForm.value.username = role
  loginForm.value.password = role + '123'
  proxy.$modal.msgSuccess(`已填入演示账号：${name}`)
}

function handleForgot() {
  const msg = loginThemeStore.config.form.forgot.alertMessage || '请联系管理员重置密码'
  proxy.$modal.msgWarning(msg)
}

getCookie()
</script>

<style lang='scss' scoped>
/* 演示角色按钮（仅 dev；UAT/生产不渲染） */
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
  gap: 8px;
}
.lf-role-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 9px 6px;
  border: 1px solid var(--login-border);
  border-radius: 8px;
  background: var(--login-page-bg);
  font-size: 12px;
  color: #53655e;
  cursor: pointer;
  transition: border-color .15s, color .15s;
  &:hover {
    border-color: var(--login-accent);
    color: var(--login-link);
  }
  .role-icon {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .lf-roles-list { grid-template-columns: repeat(2, 1fr); }
}

/* ============ 暗黑模式（与改造前一致） ============ */
html.dark .lf-role-btn {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
  color: var(--el-text-color-regular);
}
</style>
