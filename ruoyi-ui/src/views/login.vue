<template>
  <LoginRenderer :config="loginThemeStore.config">
    <!-- 登录表单 slot：结构与业务逻辑与改造前完全一致，仅文案取自配置（默认值相同） -->
    <template #form>
      <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="lf-form" size="large">
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            type="text"
            auto-complete="off"
            :placeholder="form.usernamePlaceholder"
          >
            <template #prefix><el-icon><User/></el-icon></template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            :type="showPassword ? 'text' : 'password'"
            auto-complete="off"
            :placeholder="form.passwordPlaceholder"
            @keyup.enter="handleLogin"
          >
            <template #prefix><el-icon><Lock/></el-icon></template>
            <template #suffix>
              <el-icon class="lf-eye" @click="showPassword = !showPassword">
                <View v-if="showPassword"/>
                <Hide v-else/>
              </el-icon>
            </template>
          </el-input>
        </el-form-item>

        <div class="lf-row">
          <el-checkbox v-model="loginForm.rememberMe">{{ form.rememberText }}</el-checkbox>
          <a
            v-if="forgot.mode === 'alert'"
            href="javascript:;"
            class="lf-forgot"
            @click="handleForgot"
          >{{ forgot.text }}</a>
          <a
            v-else-if="forgot.mode === 'link' && safeForgotUrl"
            :href="safeForgotUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="lf-forgot"
          >{{ forgot.text }}</a>
          <!-- mode=hidden 不渲染；link 但 URL 非法时不渲染可执行链接 -->
        </div>

        <el-form-item style="width:100%;">
          <el-button
            :loading="loading"
            type="primary"
            class="lf-submit"
            @click.prevent="handleLogin"
          >
            <span v-if="!loading">{{ form.buttonText }}</span>
            <span v-else>{{ form.loadingText }}</span>
          </el-button>
        </el-form-item>
      </el-form>
    </template>

    <!-- dev 环境演示角色快捷填充（原版行为：仅填充账号，不直接登录） -->
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
import { encrypt, decrypt } from "@/utils/jsencrypt"
import {
  User, Lock, View, Hide, CircleCheck, Check, TrendCharts, Key, Document
} from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import LoginRenderer from './login/LoginRenderer.vue'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { safeUrl } from './login/login.utils'

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

const showPassword = ref(false)

const loginForm = ref({
  username: "admin",
  password: "admin123",
  rememberMe: false
})

const loginRules = reactive({
  username: [{ required: true, trigger: "blur", message: "请输入您的账号" }],
  password: [{ required: true, trigger: "blur", message: "请输入您的密码" }]
})

const loading = ref(false)
const register = ref(false)
const redirect = ref(undefined)

// 登录页文案/链接（来自配置，空表时默认值与改造前硬编码一致）
const form = computed(() => loginThemeStore.config.form)
const forgot = computed(() => form.value.forgot)
const safeForgotUrl = computed(() => safeUrl(forgot.value.url))

watch(route, (newRoute) => {
  redirect.value = newRoute.query && newRoute.query.redirect
}, { immediate: true })

// 进入 /login：首帧用默认配置渲染，挂载后异步拉取（失败静默回退，绝不阻断）
onMounted(() => {
  loginThemeStore.loadConfig()
})

function handleLogin() {
  proxy.$refs.loginRef.validate(valid => {
    if (valid) {
      loading.value = true
      if (loginForm.value.rememberMe) {
        Cookies.set("username", loginForm.value.username, { expires: 30 })
        Cookies.set("password", encrypt(loginForm.value.password), { expires: 30 })
        Cookies.set("rememberMe", loginForm.value.rememberMe, { expires: 30 })
      } else {
        Cookies.remove("username")
        Cookies.remove("password")
        Cookies.remove("rememberMe")
      }
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
  const password = Cookies.get("password")
  const rememberMe = Cookies.get("rememberMe")
  loginForm.value = {
    username: username === undefined ? loginForm.value.username : username,
    password: password === undefined ? loginForm.value.password : decrypt(password),
    rememberMe: rememberMe === undefined ? false : Boolean(rememberMe)
  }
}

function quickFill(role, name) {
  loginForm.value.username = role
  loginForm.value.password = role + '123'
  proxy.$modal.msgSuccess(`已填入演示账号：${name}`)
}

function handleForgot() {
  proxy.$modal.msgWarning(forgot.value.alertMessage || '请联系管理员重置密码')
}

getCookie()
</script>

<style lang='scss' scoped>
.lf-form {
  margin-top: 30px;
}

/* 输入框（数值与改造前一致，颜色走登录页 CSS 变量） */
:deep(.el-input__wrapper) {
  border-radius: var(--login-radius);
  height: 44px;
  box-shadow: 0 0 0 1px var(--login-border) inset;
  &:hover, &.is-focus {
    box-shadow: 0 0 0 1px var(--login-input-focus) inset;
  }
}
:deep(.el-input__inner) {
  height: 44px;
  font-size: 14px;
}
:deep(.el-input__prefix-inner) {
  color: var(--login-text-2);
  font-size: 17px;
  margin-right: 6px;
}
.lf-eye {
  color: var(--login-text-2);
  cursor: pointer;
  &:hover { color: var(--login-link); }
}

/* 记住我 + 忘记密码 */
.lf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  font-size: 13px;
}
.lf-forgot {
  color: var(--login-link);
  font-weight: 500;
  &:hover { color: var(--login-btn-hover); text-decoration: underline; }
}

/* 登录按钮 */
.lf-submit {
  height: 46px;
  width: 100%;
  border-radius: var(--login-radius);
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 1px;
  background: var(--login-btn-bg);
  border-color: var(--login-btn-bg);
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

/* 演示角色按钮 */
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
