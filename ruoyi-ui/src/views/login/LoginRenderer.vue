<template>
  <div
    class="login-wrap"
    :class="{ 'brand-hidden-mobile': !cfg.layout.showBrandOnMobile }"
    :style="cssVars"
  >
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
          <div class="lb-name">{{ brandName }}</div>
          <div class="lb-sub">{{ cfg.brand.subTitle }}</div>
        </div>
      </div>

      <div class="lb-hero" v-if="cfg.hero.visible">
        <h1>
          <template v-for="(line, idx) in cfg.hero.lines" :key="idx">
            <span v-if="line.accent" class="accent">{{ line.text }}</span>
            <template v-else>{{ line.text }}</template>
            <br v-if="idx < cfg.hero.lines.length - 1" />
          </template>
        </h1>
        <p>{{ cfg.hero.description }}</p>

        <div class="lb-features" v-if="cfg.hero.features.visible">
          <div class="lb-feature" v-for="(f, i) in cfg.hero.features.items" :key="i">
            <el-icon><component :is="f.icon" /></el-icon>
            <span><b>{{ f.title }}</b><template v-if="f.text"> · {{ f.text }}</template></span>
          </div>
        </div>
      </div>

      <div class="lb-foot"><FooterRichText :content="cfg.footer.brandText" :ctx="tplCtx" /></div>
    </aside>

    <!-- 右侧登录表单区（表单与 dev 角色块由 login.vue 通过 slot 注入） -->
    <main class="login-form-side">
      <div class="login-form-box">
        <div class="lf-title">{{ cfg.form.title }}</div>
        <div class="lf-subtitle">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

        <slot name="form"></slot>
        <slot name="roles"></slot>

        <div class="lf-copyright" v-if="cfg.footer.showCopyright">
          <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import defaultSettings from '@/settings'
import { toCssVars, interpolate, mergeWithDefaults } from './login.utils'
import FooterRichText from './FooterRichText.vue'

const props = defineProps({
  config: { type: Object, default: () => ({}) }
})

// 始终与默认值合并，保证即使传入部分配置（如设计器回显）也能完整渲染
const cfg = computed(() => mergeWithDefaults(props.config))
const cssVars = computed(() => toCssVars(cfg.value))

const brandName = computed(() => (cfg.value.brand.name || '').trim() || import.meta.env.VITE_APP_TITLE)
const tplCtx = computed(() => ({
  title: brandName.value,
  year: new Date().getFullYear(),
  footerContent: defaultSettings.footerContent
}))
</script>

<style lang='scss' scoped>
.login-wrap {
  display: grid;
  grid-template-columns: var(--login-split);
  grid-template-rows: 1fr;
  min-height: 100vh;
  width: 100%;
  background: var(--login-page-bg);
  font-family: var(--login-font-family);
}

/* ============ 左侧品牌区 ============ */
.login-brand {
  position: relative;
  background: var(--login-brand-bg);
  color: var(--login-text-brand);
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
      radial-gradient(circle at 85% 15%, var(--login-glow-1) 0, transparent 38%),
      radial-gradient(circle at 12% 88%, var(--login-glow-2) 0, transparent 42%);
    pointer-events: none;
  }
  & > * { position: relative; z-index: 1; }
}

.lb-head { display: flex; align-items: center; gap: 12px; }
.lb-head .brand-logo { width: 42px; height: 48px; flex: none; }
.lb-name { font-size: var(--login-brand-size); font-weight: 700; letter-spacing: 1.5px; line-height: 1.2; }
.lb-sub { font-size: 11.5px; color: var(--login-brand-sub); letter-spacing: 1px; margin-top: 2px; }

.lb-hero { margin-top: auto; padding-bottom: 24px; }
.lb-hero h1 {
  font-size: var(--login-hero-size); font-weight: var(--login-hero-weight); line-height: 1.2;
  letter-spacing: 1px; margin: 0;
  .accent { color: var(--login-accent); }
}
.lb-hero p {
  margin-top: 14px;
  font-size: 14.5px;
  color: var(--login-text-muted);
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
  color: var(--login-brand-feature);
  font-size: 13px;
  line-height: 1.55;
  .el-icon {
    flex: none;
    margin-top: 1px;
    color: var(--login-accent);
    font-size: 18px;
  }
  b { color: var(--login-text-brand); font-weight: 600; }
}

.lb-foot {
  margin-top: 28px;
  font-size: 11.5px;
  color: var(--login-brand-foot);
  border-top: 1px solid var(--login-brand-border);
  padding-top: 16px;
  a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    &:hover { color: var(--login-text-brand); }
  }
}

/* ============ 右侧登录表单区 ============ */
.login-form-side {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: var(--login-page-bg);
  height: 100%;
}

.login-form-box {
  width: 100%;
  max-width: 360px;
}

.lf-title {
  font-size: var(--login-form-title-size);
  font-weight: 700;
  color: var(--login-text-1);
}
.lf-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--login-text-2);
}

/* 表单、登录按钮、dev 角色块均由 slot 注入，其样式归属 login.vue（slotted 内容带父级 scope） */

/* 版权 */
.lf-copyright {
  margin-top: 30px;
  text-align: center;
  font-size: 11.5px;
  color: var(--login-text-2);
  a {
    color: var(--login-link);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}

/* ============ 移动端响应式 ============ */
@media (max-width: 900px) {
  .login-wrap {
    grid-template-columns: 1fr;
  }
  .login-wrap.brand-hidden-mobile .login-brand { display: none; }
  .login-form-side {
    min-height: 100vh;
    padding: 32px 20px;
  }
}
@media (max-width: 480px) {
  .login-form-box { max-width: 100%; }
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
