<template>
  <el-form
    ref="loginRef"
    :model="modelValue"
    :rules="loginRules"
    class="lf-form"
    :class="{ 'lf-form-flash': flash }"
    size="large"
  >
    <el-form-item prop="username">
      <el-input
        :model-value="modelValue.username"
        type="text"
        auto-complete="off"
        :placeholder="form.usernamePlaceholder"
        :disabled="preview"
        @update:model-value="patch('username', $event)"
      >
        <template #prefix><el-icon><User/></el-icon></template>
      </el-input>
    </el-form-item>

    <el-form-item prop="password">
      <el-input
        :model-value="modelValue.password"
        :type="showPassword ? 'text' : 'password'"
        auto-complete="new-password"
        :placeholder="form.passwordPlaceholder"
        :disabled="preview"
        @update:model-value="patch('password', $event)"
        @keyup.enter="emit('submit')"
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
      <el-checkbox
        :model-value="modelValue.rememberMe"
        disabled
        @update:model-value="patch('rememberMe', $event)"
      >{{ form.rememberText }}</el-checkbox>
      <a
        v-if="form.forgot.mode === 'alert'"
        href="javascript:;"
        class="lf-forgot"
        @click="onForgotClick"
      >{{ form.forgot.text }}</a>
      <a
        v-else-if="form.forgot.mode === 'link' && safeForgotUrl"
        :href="safeForgotUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="lf-forgot"
      >{{ form.forgot.text }}</a>
      <!-- mode=hidden 不渲染；link 但 URL 非法时不渲染可执行链接 -->
    </div>

    <el-form-item style="width:100%;">
      <el-button
        :loading="loading"
        :disabled="preview"
        type="primary"
        class="lf-submit"
        @click.prevent="emit('submit')"
      >
        <span v-if="!loading" class="lf-submit-label">
          {{ form.buttonText }}
          <!-- demo 同款尾部箭头（lucide arrow-right：24 视图盒 + 2px 圆角线性描边） -->
          <svg
            class="lf-submit-arrow" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </span>
        <span v-else>{{ form.loadingText }}</span>
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
/**
 * 登录表单（纯展示）
 *
 * 唯一视觉来源：真实登录页（login.vue 注入业务）与设计器预览（preview=true，仅展示）
 * 共用本组件，设计器不得另写预览表单。
 */
import { User, Lock, View, Hide } from '@element-plus/icons-vue'
import { safeUrl } from './login.utils'

const props = defineProps({
  /** 合并默认值后的完整登录页配置 */
  config: { type: Object, required: true },
  /** { username, password, rememberMe } */
  modelValue: { type: Object, required: true },
  /** 预览模式：全部禁用、不触发任何业务动作 */
  preview: { type: Boolean, default: false },
  /** 登录请求中（按钮 loading 态） */
  loading: { type: Boolean, default: false },
  /** 切换演示角色时的 150ms 闪烁（demo 同款过渡；仅 login.vue dev 角色块触发） */
  flash: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit', 'forgot'])

const loginRef = ref(null)
const showPassword = ref(false)

const form = computed(() => props.config.form)
const safeForgotUrl = computed(() => safeUrl(form.value.forgot.url))

const loginRules = {
  username: [{ required: true, trigger: 'blur', message: '请输入您的账号' }],
  password: [{ required: true, trigger: 'blur', message: '请输入您的密码' }]
}

function patch(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

// 预览模式不触发业务动作（用本地 emit，与提交按钮一致）
function onForgotClick() {
  if (!props.preview) emit('forgot')
}

/** 供 login.vue 调用，保持与改造前 proxy.$refs.loginRef.validate 一致的回调式校验 */
function validate(callback) {
  loginRef.value.validate(callback)
}

defineExpose({ validate })
</script>

<style lang='scss' scoped>
.lf-form {
  margin-top: 30px;
  /* demo 同款：切换演示角色时账号区 150ms 淡入淡出 */
  transition: opacity .15s ease;
}
.lf-form.lf-form-flash { opacity: .4; }
.lf-submit-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.lf-submit-arrow { width: 15px; height: 15px; flex: none; }

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
/* 渐变形态：根节点 .btn-gradient-on 由 LoginRenderer 按配置添加（关闭时回退上方纯色三态） */
.btn-gradient-on .lf-submit {
  background: var(--login-btn-gradient);
  border-color: transparent;
  box-shadow: 0 10px 24px -10px var(--login-btn-glow);
  &:hover, &:focus {
    background: var(--login-btn-gradient);
    border-color: transparent;
    filter: brightness(1.12);
  }
  &:active { transform: scale(.985); }
  &.is-loading {
    background: var(--login-btn-gradient);
    border-color: transparent;
    opacity: .85;
  }
}
</style>
