<template>
  <div
    class="login-wrap"
    :class="[
      isFullscreen ? 'login-fullscreen' : (isCentered ? 'login-centered' : 'login-split'),
      {
        'brand-hidden-mobile': !cfg.layout.showBrandOnMobile,
        'has-bg-image': isFullscreen && bgImage
      }
    ]"
    :style="cssVars"
  >
    <!-- ============ centered：居中卡片模板（无品牌栏） ============ -->
    <template v-if="isCentered">
      <div class="lc-stage">
        <div class="lc-box">
          <div class="lc-brand">
            <div
              class="brand-logo-slot lc-logo"
              :class="{ 'logo-draggable': logoDraggable }"
              :style="logoStyle"
              @pointerdown="onLogoPointerDown"
            >
              <svg v-if="logo.type === 'builtin' && builtinName === 'shield'" viewBox="0 0 40 46" fill="none">
                <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
                  fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
                <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
                <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
                <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
              </svg>
              <el-icon v-else-if="logo.type === 'builtin'" class="brand-logo-ep">
                <component :is="builtinName" />
              </el-icon>
              <img v-else-if="logo.type === 'image' && logoImageSrc" class="brand-logo-img" :src="logoImageSrc" alt="brand logo" />
            </div>
            <div class="lc-name">{{ brandName }}</div>
            <div class="lc-sub" v-if="cfg.brand.subTitle">{{ cfg.brand.subTitle }}</div>
          </div>

          <div class="lc-card">
            <div class="lf-title" v-if="!hideCardHeader">{{ cfg.form.title }}</div>
            <div class="lf-subtitle" v-if="!hideCardHeader">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

            <slot name="form"></slot>
            <slot name="roles"></slot>
          </div>

          <div class="lc-copyright" v-if="cfg.footer.showCopyright">
            <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
          </div>
        </div>
      </div>
    </template>

    <!-- ============ fullscreen：整屏背景图 + 遮罩 + 浮层卡片（M3c） ============ -->
    <template v-else-if="isFullscreen">
      <!-- 背景图层（cover/center）；遮罩为品牌渐变，透明度由 background.overlay 控制 -->
      <div v-if="bgImage" class="lf-bg-image" :style="{ backgroundImage: `url('${bgImage}')` }"></div>
      <div v-if="bgImage" class="lf-bg-overlay" :style="{ opacity: bgOverlay }"></div>

      <div class="lc-stage">
        <div class="lc-box">
          <div class="lc-brand">
            <div
              class="brand-logo-slot lc-logo"
              :class="{ 'logo-draggable': logoDraggable }"
              :style="logoStyle"
              @pointerdown="onLogoPointerDown"
            >
              <svg v-if="logo.type === 'builtin' && builtinName === 'shield'" viewBox="0 0 40 46" fill="none">
                <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
                  fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
                <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
                <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
                <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
              </svg>
              <el-icon v-else-if="logo.type === 'builtin'" class="brand-logo-ep">
                <component :is="builtinName" />
              </el-icon>
              <img v-else-if="logo.type === 'image' && logoImageSrc" class="brand-logo-img" :src="logoImageSrc" alt="brand logo" />
            </div>
            <div class="lc-name">{{ brandName }}</div>
            <div class="lc-sub" v-if="cfg.brand.subTitle">{{ cfg.brand.subTitle }}</div>
          </div>

          <div class="lc-card">
            <div class="lf-title" v-if="!hideCardHeader">{{ cfg.form.title }}</div>
            <div class="lf-subtitle" v-if="!hideCardHeader">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

            <slot name="form"></slot>
            <slot name="roles"></slot>
          </div>

          <div class="lc-copyright" v-if="cfg.footer.showCopyright">
            <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
          </div>
        </div>
      </div>
    </template>

    <!-- ============ split：左右双栏模板（默认） ============ -->
    <template v-else>
    <!-- 左侧品牌区 -->
    <aside class="login-brand">
      <div class="lb-head">
        <div
          class="brand-logo-slot"
          :class="{ 'logo-draggable': logoDraggable }"
          :style="logoStyle"
          @pointerdown="onLogoPointerDown"
        >
          <!-- 定制盾牌（默认） -->
          <svg v-if="logo.type === 'builtin' && builtinName === 'shield'" viewBox="0 0 40 46" fill="none">
            <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
              fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
            <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
            <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
            <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
          </svg>
          <!-- 其余内置 logo：全局注册的 Element Plus 图标；非白名单值兜底盾牌 -->
          <el-icon v-else-if="logo.type === 'builtin'" class="brand-logo-ep">
            <component :is="builtinName" />
          </el-icon>
          <!-- 自定义上传图片（仅 /profile/ 路径，显示时前缀 baseApi） -->
          <img v-else-if="logo.type === 'image' && logoImageSrc" class="brand-logo-img" :src="logoImageSrc" alt="brand logo" />
        </div>
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
        <div class="lf-title" v-if="!hideCardHeader">{{ cfg.form.title }}</div>
        <div class="lf-subtitle" v-if="!hideCardHeader">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

        <slot name="form"></slot>
        <slot name="roles"></slot>

        <div class="lf-copyright" v-if="cfg.footer.showCopyright">
          <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
        </div>
      </div>
    </main>
    </template>
  </div>
</template>

<script setup>
import defaultSettings from '@/settings'
import {
  toCssVars, interpolate, mergeWithDefaults,
  clampLogoSize, clampLogoOffset, mediaUrl,
  BUILTIN_LOGO_VALUES
} from './login.utils'
import FooterRichText from './FooterRichText.vue'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  /** 设计器预览：允许直接拖拽 logo 调整 offset */
  logoDraggable: { type: Boolean, default: false },
  /** 预览区当前缩放比例（拖拽位移换算为设计像素） */
  previewScale: { type: Number, default: 1 },
  /** 隐藏卡片标题/副标题（锁屏页使用：卡片顶部改由 slot 内的头像+锁屏提示替代） */
  hideCardHeader: { type: Boolean, default: false }
})
const emit = defineEmits(['logo-offset'])

// 始终与默认值合并，保证即使传入部分配置（如设计器回显）也能完整渲染
const cfg = computed(() => mergeWithDefaults(props.config))
const cssVars = computed(() => toCssVars(cfg.value))

// 布局模板：split（双栏，默认）/ centered（居中卡片，M3b）/ fullscreen（全屏背景，M3c）
const isCentered = computed(() => cfg.value.layout.template === 'centered')
const isFullscreen = computed(() => cfg.value.layout.template === 'fullscreen')

/* ============ fullscreen 背景（M3c） ============ */
// 背景图仅 /profile/ 站内资源；mediaUrl 对空值返回 ''
const bgImage = computed(() => mediaUrl(cfg.value.background?.image))
// 遮罩透明度夹取 0~1（脏数据兜底为默认 0.4）
const bgOverlay = computed(() => {
  const v = Number(cfg.value.background?.overlay)
  if (!Number.isFinite(v)) return 0.4
  return Math.min(1, Math.max(0, v))
})

const brandName = computed(() => (cfg.value.brand.name || '').trim() || import.meta.env.VITE_APP_TITLE)
const tplCtx = computed(() => ({
  title: brandName.value,
  year: new Date().getFullYear(),
  footerContent: defaultSettings.footerContent
}))

/* ============ logo 渲染与像素级调整 ============ */
const logo = computed(() => cfg.value.brand.logo || {})
const logoW = computed(() => clampLogoSize(logo.value.width, 42))
const logoH = computed(() => clampLogoSize(logo.value.height, 48))
const logoStyle = computed(() => ({
  width: `${logoW.value}px`,
  height: `${logoH.value}px`,
  // el-icon 内 svg 为 1em，用 font-size 撑满 slot
  fontSize: `${logoH.value}px`,
  transform: `translate(${clampLogoOffset(logo.value.offsetX)}px, ${clampLogoOffset(logo.value.offsetY)}px)`
}))
const logoImageSrc = computed(() => mediaUrl(logo.value.value))
// 防御：builtin 类型下 value 必须是白名单组件名（切换 type 瞬间/脏数据兜底为盾牌）
const builtinName = computed(() =>
  BUILTIN_LOGO_VALUES.includes(logo.value.value) ? logo.value.value : 'shield')

let dragState = null
function onLogoPointerDown(e) {
  if (!props.logoDraggable) return
  // 仅主键触发，避免设计器中右键等操作误拖
  if (e.button !== 0) return
  e.preventDefault()
  dragState = {
    startX: e.clientX,
    startY: e.clientY,
    originX: clampLogoOffset(logo.value.offsetX),
    originY: clampLogoOffset(logo.value.offsetY)
  }
  window.addEventListener('pointermove', onLogoPointerMove)
  window.addEventListener('pointerup', onLogoPointerUp, { once: true })
  window.addEventListener('pointercancel', onLogoPointerUp, { once: true })
}
function onLogoPointerMove(e) {
  if (!dragState) return
  const scale = props.previewScale > 0 ? props.previewScale : 1
  const x = clampLogoOffset(dragState.originX + (e.clientX - dragState.startX) / scale)
  const y = clampLogoOffset(dragState.originY + (e.clientY - dragState.startY) / scale)
  emit('logo-offset', { offsetX: x, offsetY: y })
}
function onLogoPointerUp() {
  dragState = null
  window.removeEventListener('pointermove', onLogoPointerMove)
}
</script>

<style lang='scss' scoped>
.login-wrap {
  min-height: 100vh;
  width: 100%;
  font-family: var(--login-font-family);
}

/* split：左右双栏（默认） */
.login-split {
  display: grid;
  grid-template-columns: var(--login-split);
  grid-template-rows: 1fr;
  background: var(--login-page-bg);
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
/* logo 槽位：宽高/位置像素由配置内联控制；transform 偏移不挤压品牌名 */
.brand-logo-slot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  user-select: none;
  > svg { width: 100%; height: 100%; display: block; }
}
.brand-logo-slot.logo-draggable { cursor: grab; }
.brand-logo-slot.logo-draggable:active { cursor: grabbing; }
.brand-logo-ep {
  width: 100%;
  height: 100%;
  color: var(--login-text-brand);
}
.brand-logo-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  user-drag: none;
  -webkit-user-drag: none;
}
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

/* ============ centered：居中卡片模板（M3b） ============ */
.login-centered {
  position: relative;
  display: flex;
  overflow: hidden;
  /* 整页背景沿用可配的品牌渐变（主题色页签的渐变构建器即时生效） */
  background: var(--login-brand-bg);
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 85% 12%, var(--login-glow-1) 0, transparent 38%),
      radial-gradient(circle at 10% 90%, var(--login-glow-2) 0, transparent 42%);
    pointer-events: none;
  }
}
.lc-stage {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  overflow-y: auto;
}
.lc-box {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
}
.lc-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 22px;
}
.lc-logo { margin-bottom: 14px; }
.lc-name {
  font-size: var(--login-brand-size);
  font-weight: 700;
  letter-spacing: 1.5px;
  line-height: 1.2;
  color: var(--login-text-brand);
}
.lc-sub {
  margin-top: 4px;
  font-size: 11.5px;
  letter-spacing: 1px;
  color: var(--login-brand-sub);
}
.lc-card {
  background: var(--login-page-bg);
  border-radius: calc(var(--login-radius) + 6px);
  padding: 30px 32px 26px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, .28);
  .lf-title { text-align: center; }
  .lf-subtitle {
    text-align: center;
    margin-bottom: 22px;
  }
}
/* 版权落在深色渐变背景上，使用品牌区浅色文字体系 */
.lc-copyright {
  margin-top: 22px;
  text-align: center;
  font-size: 11.5px;
  color: var(--login-brand-foot);
  a {
    color: var(--login-text-brand);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}

/* ============ fullscreen：整屏背景图 + 遮罩 + 浮层卡片（M3c） ============ */
.login-fullscreen {
  position: relative;
  display: flex;
  overflow: hidden;
  /* 无背景图时整页底色沿用品牌渐变（视觉等同 centered）；有图时作为图片未加载的兜底色 */
  background: var(--login-brand-bg);
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 85% 12%, var(--login-glow-1) 0, transparent 38%),
      radial-gradient(circle at 10% 90%, var(--login-glow-2) 0, transparent 42%);
    pointer-events: none;
  }
  /* 有真实背景图时关闭装饰光晕，避免叠在照片上泛色 */
  &.has-bg-image::before { display: none; }
}
.lf-bg-image {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: var(--login-brand-bg);
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}
.lf-bg-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* 遮罩颜色跟随「主题色」中的品牌渐变；opacity 0=纯图片，1=纯色不可见图 */
  background: var(--login-brand-bg);
  transition: opacity .15s ease;
}

/* ============ 移动端响应式 ============ */
@media (max-width: 900px) {
  .login-split {
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
  .lc-card { padding: 26px 22px 22px; }
}

/* ============ 暗黑模式 ============ */
html.dark .login-brand {
  background: linear-gradient(150deg, #0d1a16 0%, #14241e 55%, #1a3027 100%);
}
html.dark .login-centered,
html.dark .login-fullscreen {
  background: linear-gradient(150deg, #0d1a16 0%, #14241e 55%, #1a3027 100%);
}
html.dark .login-form-side {
  background: var(--el-bg-color);
}
html.dark .lc-card {
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
