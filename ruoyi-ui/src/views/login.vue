<template>
  <LoginRenderer :config="loginThemeStore.config">
    <!-- 登录表单：纯展示组件 LoginFormFields，业务逻辑在本文件 -->
    <template #form>
      <LoginFormFields
        ref="loginFieldsRef"
        v-model="loginForm"
        :config="loginThemeStore.config"
        :loading="loading"
        :flash="fieldFlash"
        @submit="handleLogin"
        @forgot="handleForgot"
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
</template>

<script setup name="Login">
import Cookies from "js-cookie"
import {
  User, CircleCheck, Check, Key, Document,
  FirstAidKit, DataAnalysis
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
