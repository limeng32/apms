<template>
  <div class="login-wrap">
    <!-- 左侧品牌区 -->
    <aside class="login-brand">
      <div class="lb-head">
        <svg class="brand-logo" viewBox="0 0 40 46" fill="none">
          <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
            fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
          <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
          <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
          <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
        </svg>
        <div>
          <div class="lb-name">{{ title }}</div>
          <div class="lb-sub">ATHLETE PERFORMANCE MANAGEMENT SYSTEM</div>
        </div>
      </div>

      <div class="lb-hero">
        <h1>为运动员的<br>每一次成长<br><span class="accent">建立数据基石</span></h1>
        <p>覆盖数字档案、生长发育监控、科研测试、RTP 参训状态、医疗附件、组合评价与 PDF 报告的一体化管理平台。</p>

        <div class="lb-features">
          <div class="lb-feature">
            <el-icon><Check/></el-icon>
            <span><b>一人一档</b> · 跨赛季持续数据归集，体态/测试/RTP/医疗全维度</span>
          </div>
          <div class="lb-feature">
            <el-icon><TrendCharts/></el-icon>
            <span><b>Mirwald PHV</b> · 已确认公式可计算，Khamis-Roche 待参数确认</span>
          </div>
          <div class="lb-feature">
            <el-icon><Key/></el-icon>
            <span><b>数据权限</b> · 队伍级 DataScope，医疗附件私有存储，独立权限点</span>
          </div>
          <div class="lb-feature">
            <el-icon><Document/></el-icon>
            <span><b>报告可复现</b> · 算法版本+参考统计量快照，历史分数不漂移</span>
          </div>
        </div>
      </div>

      <div class="lb-foot">
        © {{ new Date().getFullYear() }} {{ title }} · 基于 RuoYi-Vue 3.9.2
      </div>
    </aside>

    <!-- 右侧登录表单区 -->
    <main class="login-form-side">
      <div class="login-form-box">
        <div class="lf-title">欢迎回来</div>
        <div class="lf-subtitle">请使用账号登录 {{ title }} 工作台</div>

        <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="lf-form" size="large">
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              type="text"
              auto-complete="off"
              placeholder="请输入用户名"
            >
              <template #prefix><el-icon><User/></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              :type="showPassword ? 'text' : 'password'"
              auto-complete="off"
              placeholder="请输入密码"
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

          <el-form-item prop="code" v-if="captchaEnabled">
            <div class="lf-captcha">
              <el-input
                v-model="loginForm.code"
                auto-complete="off"
                placeholder="验证码"
                style="flex: 1"
                @keyup.enter="handleLogin"
              >
                <template #prefix><el-icon><CircleCheck/></el-icon></template>
              </el-input>
              <div class="lf-captcha-img" @click="getCode">
                <img :src="codeUrl" class="lf-code-img" alt="验证码" v-if="codeUrl"/>
                <span v-else>点击获取</span>
              </div>
            </div>
          </el-form-item>

          <div class="lf-row">
            <el-checkbox v-model="loginForm.rememberMe">记住我</el-checkbox>
            <a href="javascript:;" class="lf-forgot" @click="handleForgot">忘记密码？</a>
          </div>

          <el-form-item style="width:100%;">
            <el-button
              :loading="loading"
              type="primary"
              class="lf-submit"
              @click.prevent="handleLogin"
            >
              <span v-if="!loading">登 录</span>
              <span v-else>登录中...</span>
            </el-button>
          </el-form-item>
        </el-form>

        <div class="lf-roles" v-if="isDev">
          <div class="lf-roles-title">— 演示角色快捷登录 —</div>
          <div class="lf-roles-list">
            <button v-for="r in roles" :key="r.key" class="lf-role-btn" @click="quickFill(r.key, r.name)">
              <el-icon class="role-icon"><component :is="r.icon"/></el-icon>
              {{ r.name }}
            </button>
          </div>
        </div>

        <div class="lf-copyright">
          © {{ new Date().getFullYear() }} {{ title }} · {{ footerContent }}
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { getCodeImg } from "@/api/login"
import Cookies from "js-cookie"
import { encrypt, decrypt } from "@/utils/jsencrypt"
import useUserStore from '@/store/modules/user'
import defaultSettings from '@/settings'
import {
  User, Lock, View, Hide, CircleCheck, Check, TrendCharts, Key, Document
} from '@element-plus/icons-vue'

const title = import.meta.env.VITE_APP_TITLE
const footerContent = defaultSettings.footerContent
const userStore = useUserStore()
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
  rememberMe: false,
  code: "",
  uuid: ""
})

const loginRules = {
  username: [{ required: true, trigger: "blur", message: "请输入您的账号" }],
  password: [{ required: true, trigger: "blur", message: "请输入您的密码" }],
  code: [{ required: true, trigger: "change", message: "请输入验证码" }]
}

const codeUrl = ref("")
const loading = ref(false)
const captchaEnabled = ref(true)
const register = ref(false)
const redirect = ref(undefined)

watch(route, (newRoute) => {
  redirect.value = newRoute.query && newRoute.query.redirect
}, { immediate: true })

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
        if (captchaEnabled.value) {
          getCode()
        }
      })
    }
  })
}

function getCode() {
  getCodeImg().then(res => {
    captchaEnabled.value = res.captchaEnabled === undefined ? true : res.captchaEnabled
    if (captchaEnabled.value) {
      codeUrl.value = "data:image/gif;base64," + res.img
      loginForm.value.uuid = res.uuid
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
  getCode()
  proxy.$modal.msgSuccess(`已填入演示账号：${name}`)
}

function handleForgot() {
  proxy.$modal.msgWarning('请联系管理员重置密码')
}

getCode()
getCookie()
</script>

<style lang='scss' scoped>
.login-wrap {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  grid-template-rows: 1fr;
  min-height: 100vh;
  width: 100%;
  background: #fff;
}

/* ============ 左侧品牌区 ============ */
.login-brand {
  position: relative;
  background-color: #1d3b33;
  background-image: linear-gradient(150deg, #16302a 0%, #1d3b33 55%, #27503f 100%);
  color: #fff;
  padding: 56px 64px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 85% 15%, rgba(74, 168, 134, .18) 0, transparent 38%),
      radial-gradient(circle at 12% 88%, rgba(63, 169, 110, .12) 0, transparent 42%);
    pointer-events: none;
  }
  & > * { position: relative; z-index: 1; }
}

.lb-head { display: flex; align-items: center; gap: 12px; }
.lb-head .brand-logo { width: 42px; height: 48px; flex: none; }
.lb-name { font-size: 22px; font-weight: 700; letter-spacing: 1.5px; line-height: 1.2; }
.lb-sub { font-size: 11.5px; color: rgba(255,255,255,.55); letter-spacing: 1px; margin-top: 2px; }

.lb-hero { margin-top: auto; padding-bottom: 24px; }
.lb-hero h1 {
  font-size: 38px; font-weight: 700; line-height: 1.2;
  letter-spacing: 1px; margin: 0;
  .accent { color: #4aa886; }
}
.lb-hero p {
  margin-top: 14px;
  font-size: 14.5px;
  color: rgba(255,255,255,.7);
  line-height: 1.7;
  max-width: 420px;
}

.lb-features {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lb-feature {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  color: rgba(255,255,255,.78);
  font-size: 13px;
  line-height: 1.55;
  .el-icon {
    flex: none;
    margin-top: 1px;
    color: #4aa886;
    font-size: 18px;
  }
  b { color: #fff; font-weight: 600; }
}

.lb-foot {
  margin-top: 28px;
  font-size: 11.5px;
  color: rgba(255,255,255,.35);
  border-top: 1px solid rgba(255,255,255,.08);
  padding-top: 16px;
}

/* ============ 右侧登录表单区 ============ */
.login-form-side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: #fff;
  height: 100%;
}

.login-form-box {
  width: 100%;
  max-width: 360px;
}

.lf-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2c28;
}
.lf-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: #8a9a93;
}
.lf-form {
  margin-top: 30px;
}

/* 验证码 */
.lf-captcha {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
}
.lf-captcha-img {
  width: 110px;
  height: 40px;
  flex: none;
  border: 1px solid #e3eae6;
  border-radius: 8px;
  background: linear-gradient(135deg, #f1f7f4, #e6f2ec);
  display: grid;
  place-items: center;
  cursor: pointer;
  overflow: hidden;
  &:hover { border-color: #4aa886; }
  .lf-code-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

/* 输入框 */
:deep(.el-input__wrapper) {
  border-radius: 10px;
  height: 44px;
  box-shadow: 0 0 0 1px #e3eae6 inset;
  &:hover, &.is-focus {
    box-shadow: 0 0 0 1px #4aa886 inset;
  }
}
:deep(.el-input__inner) {
  height: 44px;
  font-size: 14px;
}
:deep(.el-input__prefix-inner) {
  color: #8a9a93;
  font-size: 17px;
  margin-right: 6px;
}
.lf-eye {
  color: #8a9a93;
  cursor: pointer;
  &:hover { color: #2f6b57; }
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
  color: #2f6b57;
  font-weight: 500;
  &:hover { color: #3d8a6e; text-decoration: underline; }
}

/* 登录按钮 */
.lf-submit {
  height: 46px;
  width: 100%;
  border-radius: 10px;
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 1px;
  background: #2f6b57;
  border-color: #2f6b57;
  &:hover, &:focus {
    background: #3d8a6e;
    border-color: #3d8a6e;
  }
  &.is-loading {
    background: #4aa886;
    border-color: #4aa886;
    opacity: .85;
  }
}

/* 演示角色按钮 */
.lf-roles {
  margin-top: 22px;
  border-top: 1px dashed #e3eae6;
  padding-top: 18px;
}
.lf-roles-title {
  font-size: 11.5px;
  color: #8a9a93;
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
  border: 1px solid #e3eae6;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #53655e;
  cursor: pointer;
  transition: border-color .15s, color .15s;
  &:hover {
    border-color: #4aa886;
    color: #2f6b57;
  }
  .role-icon {
    font-size: 16px;
  }
}

/* 版权 */
.lf-copyright {
  margin-top: 30px;
  text-align: center;
  font-size: 11.5px;
  color: #8a9a93;
}

/* ============ 移动端响应式 ============ */
@media (max-width: 900px) {
  .login-wrap {
    grid-template-columns: 1fr;
  }
  .login-brand { display: none; }
  .login-form-side {
    min-height: 100vh;
    padding: 32px 20px;
  }
}
@media (max-width: 480px) {
  .login-form-box { max-width: 100%; }
  .lf-roles-list { grid-template-columns: repeat(2, 1fr); }
}

/* ============ 暗黑模式 ============ */
html.dark .login-brand {
  background: linear-gradient(150deg, #0d1a16 0%, #14241e 55%, #1a3027 100%);
}
html.dark .login-form-side {
  background: var(--el-bg-color);
}
html.dark .lf-title { color: var(--el-text-color-primary); }
html.dark .lf-subtitle { color: var(--el-text-color-secondary); }
html.dark .lf-captcha-img {
  background: linear-gradient(135deg, #1a261f, #0d1a16);
}
html.dark .lf-role-btn {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
  color: var(--el-text-color-regular);
}
</style>

<!-- 全局样式：非 scoped，确保 html/body/#app 撑满视口，登录页不露白边 -->
<style lang="scss">
html, body, #app {
  min-height: 100vh;
  margin: 0;
  padding: 0;
}
/* 登录路由下给 body 兜底背景色，防止内容超出视口时露出白色 */
/* 使用 :has 选择器，仅当页面包含 .login-wrap 时生效 */
body:has(.login-wrap) {
  background: #1d3b33;
}
</style>
