<template>
  <div
    class="login-wrap"
    :class="[
      isFullscreen ? 'login-fullscreen' : (isCentered ? 'login-centered' : 'login-split'),
      {
        'brand-hidden-mobile': !cfg.layout.showBrandOnMobile,
        'force-mobile': device === 'mobile',
        'anim-on': entranceOn,
        'hero-gradient-on': heroGradientOn,
        'btn-gradient-on': buttonGradientOn,
        'showcase-on': showcase
      }
    ]"
    :style="cssVars"
  >
    <!-- ============ centered：居中卡片模板（无品牌栏） ============ -->
    <template v-if="isCentered">
      <LoginTechBackground
        v-if="hasTechLayer"
        :src="bgSrc"
        :texture="bgTexture"
        :overlay="bgOverlay"
        :show-radar="showRadar"
        :show-particles="showParticles"
        :ken-burns="kenBurns"
      />
      <div class="lc-stage">
        <!-- 客户方 Logo：登录框左缘正上方（版权方 logo 在品牌区居中，构成双 logo） -->
        <div
          v-if="!showcase && clientLogoEnabled"
          class="lc-logo-corner"
          data-anim
          :style="entranceOn ? { animationDelay: '0.1s' } : null"
        >
          <LoginLogoSlot
            :logo="clientLogo"
            :draggable="logoDraggable"
            @logo-pointerdown="onClientLogoPointerDown"
          />
        </div>
        <div class="lc-box">
          <div class="lc-brand" data-anim :style="entranceOn ? { animationDelay: '0.1s' } : null">
            <div
              :class="['brand-logo-slot', 'lc-logo', { 'logo-draggable': logoDraggable, 'logo-bitmap': logoBitmap }]"
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
              <el-icon v-else-if="logo.type === 'builtin' && !logoBuiltinImage" class="brand-logo-ep">
                <component :is="builtinName" />
              </el-icon>
              <img v-else-if="logo.type === 'builtin' && logoBuiltinImage" class="brand-logo-img" :src="logoBuiltinImage" alt="brand logo" />
              <img v-else-if="logo.type === 'image' && logoImageSrc" class="brand-logo-img" :src="logoImageSrc" alt="brand logo" />
            </div>
            <div class="lc-name">{{ brandName }}</div>
            <div class="lc-sub" v-if="cfg.brand.subTitle">{{ cfg.brand.subTitle }}</div>
          </div>

          <!-- 展示形态（www）：无登录卡片 -->
          <div v-if="!showcase" class="lc-card" data-anim :style="entranceOn ? { animationDelay: '0.3s' } : null">
            <div class="lf-title" v-if="!hideCardHeader">{{ cfg.form.title }}</div>
            <div class="lf-subtitle" v-if="!hideCardHeader">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

            <slot name="form"></slot>
            <slot name="roles"></slot>
          </div>

          <div class="lc-copyright" v-if="cfg.footer.showCopyright" data-anim :style="entranceOn ? { animationDelay: '0.5s' } : null">
            <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
          </div>
          <!-- 网安备案：居中卡片布局固定在卡片最下方（含 www 展示形态） -->
          <div v-if="policeBeian.show" class="lc-police" data-anim :style="entranceOn ? { animationDelay: '0.5s' } : null">
            <PoliceBeian :info="policeBeian" />
          </div>
        </div>
      </div>
    </template>

    <!-- ============ fullscreen：整屏背景图 + 遮罩 + 浮层卡片（M3c） ============ -->
    <template v-else-if="isFullscreen">
      <!-- 科技动态背景（内置/上传图 + 遮罩 + 粒子/雷达） -->
      <LoginTechBackground
        v-if="hasTechLayer"
        :src="bgSrc"
        :texture="bgTexture"
        :overlay="bgOverlay"
        :show-radar="showRadar"
        :show-particles="showParticles"
        :ken-burns="kenBurns"
      />

      <div class="lc-stage">
        <!-- 客户方 Logo：登录框左缘正上方（版权方 logo 在品牌区居中，构成双 logo） -->
        <div
          v-if="!showcase && clientLogoEnabled"
          class="lc-logo-corner"
          data-anim
          :style="entranceOn ? { animationDelay: '0.1s' } : null"
        >
          <LoginLogoSlot
            :logo="clientLogo"
            :draggable="logoDraggable"
            @logo-pointerdown="onClientLogoPointerDown"
          />
        </div>
        <div class="lc-box">
          <div class="lc-brand" data-anim :style="entranceOn ? { animationDelay: '0.1s' } : null">
            <div
              :class="['brand-logo-slot', 'lc-logo', { 'logo-draggable': logoDraggable, 'logo-bitmap': logoBitmap }]"
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
              <el-icon v-else-if="logo.type === 'builtin' && !logoBuiltinImage" class="brand-logo-ep">
                <component :is="builtinName" />
              </el-icon>
              <img v-else-if="logo.type === 'builtin' && logoBuiltinImage" class="brand-logo-img" :src="logoBuiltinImage" alt="brand logo" />
              <img v-else-if="logo.type === 'image' && logoImageSrc" class="brand-logo-img" :src="logoImageSrc" alt="brand logo" />
            </div>
            <div class="lc-name">{{ brandName }}</div>
            <div class="lc-sub" v-if="cfg.brand.subTitle">{{ cfg.brand.subTitle }}</div>
          </div>

          <!-- 展示形态（www）：无登录卡片 -->
          <div v-if="!showcase" class="lc-card" data-anim :style="entranceOn ? { animationDelay: '0.3s' } : null">
            <div class="lf-title" v-if="!hideCardHeader">{{ cfg.form.title }}</div>
            <div class="lf-subtitle" v-if="!hideCardHeader">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

            <slot name="form"></slot>
            <slot name="roles"></slot>
          </div>

          <div class="lc-copyright" v-if="cfg.footer.showCopyright" data-anim :style="entranceOn ? { animationDelay: '0.5s' } : null">
            <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
          </div>
          <!-- 网安备案：全屏布局同居中布局，置于最下方（含 www 展示形态） -->
          <div v-if="policeBeian.show" class="lc-police" data-anim :style="entranceOn ? { animationDelay: '0.5s' } : null">
            <PoliceBeian :info="policeBeian" />
          </div>
        </div>
      </div>
    </template>

    <!-- ============ split：左右双栏模板（默认） ============ -->
    <template v-else>
    <!-- 左侧品牌区：科技动态背景（主图/遮罩/线稿/雷达/粒子） -->
    <aside class="login-brand">
      <LoginTechBackground
        v-if="hasTechLayer"
        :src="bgSrc"
        :texture="bgTexture"
        :overlay="bgOverlay"
        :show-radar="showRadar"
        :show-particles="showParticles"
        :ken-burns="kenBurns"
      />
      <div class="lb-head" data-anim data-anim-delay="0.1s">
        <div
          class="brand-logo-slot"
          :class="{ 'logo-draggable': logoDraggable, 'logo-bitmap': logoBitmap }"
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
          <el-icon v-else-if="logo.type === 'builtin' && !logoBuiltinImage" class="brand-logo-ep">
            <component :is="builtinName" />
          </el-icon>
          <!-- 内置位图 logo（如奥体中心 nosc，随包静态资源） -->
          <img v-else-if="logo.type === 'builtin' && logoBuiltinImage" class="brand-logo-img" :src="logoBuiltinImage" alt="brand logo" />
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
          <span
            v-for="(line, idx) in heroCharModel"
            :key="idx"
            class="hero-line"
            :class="{ accent: line.accent }"
          ><span
            v-for="(ch, ci) in line.chars"
            :key="ci"
            class="hero-char"
            :data-anim="entranceOn ? 'char' : null"
            :style="entranceOn ? { animationDelay: ch.delay + 's' } : null"
          >{{ ch.ch === ' ' ? '\u00A0' : ch.ch }}</span></span>
        </h1>
        <p data-anim :style="entranceOn ? { animationDelay: descDelay + 's' } : null">{{ cfg.hero.description }}</p>

        <div class="lb-features" v-if="cfg.hero.features.visible">
          <div
            class="lb-feature"
            v-for="(f, i) in cfg.hero.features.items"
            :key="i"
            data-anim
            :style="entranceOn ? { animationDelay: (descDelay + 0.15 + i * 0.09) + 's' } : null"
          >
            <el-icon><component :is="f.icon" /></el-icon>
            <span><b>{{ f.title }}</b><template v-if="f.text"> · {{ f.text }}</template></span>
          </div>
        </div>
      </div>

      <div
        class="lb-foot"
        data-anim
        :style="entranceOn ? { animationDelay: (descDelay + 0.65) + 's' } : null"
      ><FooterRichText :content="cfg.footer.brandText" :ctx="tplCtx" />
        <!-- 展示形态（www）：原右下版权/ICP 上移到品牌区底部，与 brandText 堆叠；
             网安备案同样仅在展示形态下放此（常规 split 布局只在右下表单区显示） -->
        <div
          v-if="showcase && cfg.footer.showCopyright"
          class="lb-copyright-extra"
        ><FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" /></div>
        <PoliceBeian v-if="showcase && policeBeian.show" :info="policeBeian" />
      </div>
    </aside>

    <!-- 右侧登录表单区（表单与 dev 角色块由 login.vue 通过 slot 注入）；
         品牌展示形态（www）整体不渲染：客户 logo/登录卡片/右下版权均去除，
         右下版权在展示形态下移入左下品牌区（见 .lb-foot） -->
    <main v-if="!showcase" class="login-form-side">
      <!-- 客户方 Logo：右栏头部左侧，与登录框左缘对齐；与左栏版权方 logo 同处文档流顶部、共用同一顶部留白变量 -->
      <div
        class="rs-logo-head"
        data-anim
        :style="entranceOn ? { animationDelay: '0.1s' } : null"
      >
        <LoginLogoSlot
          v-if="clientLogoEnabled"
          :logo="clientLogo"
          :draggable="logoDraggable"
          @logo-pointerdown="onClientLogoPointerDown"
        />
      </div>
      <div class="login-form-box" data-anim :style="entranceOn ? { animationDelay: '0.35s' } : null">
        <div class="lf-title" v-if="!hideCardHeader">{{ cfg.form.title }}</div>
        <div class="lf-subtitle" v-if="!hideCardHeader">{{ interpolate(cfg.form.subtitle, tplCtx) }}</div>

        <slot name="form"></slot>
        <slot name="roles"></slot>

        <div class="lf-copyright" v-if="cfg.footer.showCopyright">
          <FooterRichText :content="cfg.footer.copyright" :ctx="tplCtx" />
        </div>
        <div v-if="policeBeian.show" class="lf-police">
          <PoliceBeian :info="policeBeian" />
        </div>
      </div>
    </main>
    </template>
  </div>
</template>

<script setup>
import defaultSettings from '@/settings'
import {
  toCssVars, interpolate, resolveDeviceConfig,
  clampLogoSize, clampLogoOffset, mediaUrl, builtinLogoImage, isBitmapLogo,
  builtinBgImage, builtinBgTexture,
  CLIENT_LOGO_OFFSET_X_LIMITS,
  BUILTIN_LOGO_VALUES
} from './login.utils'
import FooterRichText from './FooterRichText.vue'
import PoliceBeian from './PoliceBeian.vue'
import LoginTechBackground from './LoginTechBackground.vue'
import LoginLogoSlot from './LoginLogoSlot.vue'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  /**
   * 设备强制（设计器预览用）：
   * 'auto'（默认）= 按真机视口媒体查询判定；'desktop'/'mobile' = 强制按对应端渲染。
   */
  device: { type: String, default: 'auto' },
  /** 设计器预览：允许直接拖拽 logo 调整 offset */
  logoDraggable: { type: Boolean, default: false },
  /** 预览区当前缩放比例（拖拽位移换算为设计像素） */
  previewScale: { type: Number, default: 1 },
  /** 隐藏卡片标题/副标题（锁屏页使用：卡片顶部改由 slot 内的头像+锁屏提示替代） */
  hideCardHeader: { type: Boolean, default: false },
  /**
   * 品牌展示形态（www.apms.top 落地页）：
   * 去除客户方 logo 与登录卡片；split 右栏整体不渲染（品牌区满宽），
   * 表单区版权上移到品牌区底部。设计器预览与登录页均不传，默认 false。
   */
  showcase: { type: Boolean, default: false }
})
const emit = defineEmits(['logo-offset'])

/* ============ 设备判定（auto 时响应真机视口变化） ============ */
const MOBILE_QUERY = '(max-width: 900px)'
const mqMobile = ref(false)
let mq = null
function onMqChange(e) { mqMobile.value = e.matches }
onMounted(() => {
  mq = window.matchMedia(MOBILE_QUERY)
  mqMobile.value = mq.matches
  // Safari 14 以下用 addListener；现代浏览器 addEventListener
  if (mq.addEventListener) mq.addEventListener('change', onMqChange)
  else mq.addListener(onMqChange)
})
onBeforeUnmount(() => {
  if (!mq) return
  if (mq.removeEventListener) mq.removeEventListener('change', onMqChange)
  else mq.removeListener(onMqChange)
})
const isMobileDevice = computed(() =>
  props.device === 'mobile' ? true : props.device === 'desktop' ? false : mqMobile.value)

// 始终与默认值合并，并按设备解析移动端覆盖，保证部分配置也能完整渲染
const cfg = computed(() => resolveDeviceConfig(props.config, isMobileDevice.value))
const cssVars = computed(() => toCssVars(cfg.value))

// 公安备案：配置缺省时 mergeWithDefaults 已补 { show:false, number:'', url:'' }；
// 仅当开关打开且填了备案号才渲染
const policeBeian = computed(() => {
  const p = cfg.value.footer?.police || {}
  return {
    show: !!p.show && !!String(p.number || '').trim(),
    number: String(p.number || '').trim(),
    url: String(p.url || '').trim()
  }
})

// 布局模板：split（双栏，默认）/ centered（居中卡片，M3b）/ fullscreen（全屏背景，M3c）
const isCentered = computed(() => cfg.value.layout.template === 'centered')
const isFullscreen = computed(() => cfg.value.layout.template === 'fullscreen')

/* ============ 科技动态背景（split 品牌区 / centered / fullscreen 共用） ============ */
// 管理员上传图优先（仅 /profile/ 站内资源）；否则取内置背景（随包静态资源）
const bgUploaded = computed(() => mediaUrl(cfg.value.background?.image))
const bgBuiltin = computed(() => builtinBgImage(cfg.value.background?.builtin))
const bgSrc = computed(() => bgUploaded.value || bgBuiltin.value)
// 线稿纹理仅随内置背景出现，自定义上传图不叠加线稿
const bgTexture = computed(() => (bgUploaded.value ? '' : builtinBgTexture(cfg.value.background?.builtin)))
// 遮罩透明度夹取 0~1（脏数据兜底为默认 0.55）
const bgOverlay = computed(() => {
  const v = Number(cfg.value.background?.overlay)
  if (!Number.isFinite(v)) return 0.55
  return Math.min(1, Math.max(0, v))
})
const EFFECTS = ['none', 'particles', 'radar', 'all']
const bgEffect = computed(() =>
  EFFECTS.includes(cfg.value.background?.effect) ? cfg.value.background.effect : 'none')
const showParticles = computed(() => bgEffect.value === 'particles' || bgEffect.value === 'all')
const showRadar = computed(() => bgEffect.value === 'radar' || bgEffect.value === 'all')
const kenBurns = computed(() => cfg.value.background?.kenBurns !== false)
// 无主图但仍有粒子/雷达/线稿时，背景层也要渲染（纯渐变底上的科技氛围）
const hasTechLayer = computed(() =>
  !!(bgSrc.value || bgTexture.value || showParticles.value || showRadar.value))

/* ============ 入场动效开关与 Hero 逐字模型 ============ */
const entranceOn = computed(() => cfg.value.animation?.entrance !== false)
const heroGradientOn = computed(() => !!cfg.value.colors?.heroGradient?.enabled)
const buttonGradientOn = computed(() => !!cfg.value.colors?.buttonGradient?.enabled)

// 逐字 stagger：每条 Hero 行展开为字符数组，全局累计延迟（与 demo GSAP 时间线观感一致）
const HERO_CHAR_START = 0.28
const HERO_CHAR_STEP = 0.06
const heroCharModel = computed(() => {
  let order = 0
  const lines = Array.isArray(cfg.value.hero?.lines) ? cfg.value.hero.lines : []
  return lines.map((line) => ({
    accent: !!line.accent,
    chars: Array.from(String(line.text || '')).map((ch) => ({
      ch,
      delay: HERO_CHAR_START + order++ * HERO_CHAR_STEP
    }))
  }))
})
const totalHeroChars = computed(() => heroCharModel.value.reduce((n, l) => n + l.chars.length, 0))
// 描述段在全部逐字动画后排入场；特性/版权延迟以此为基准
const descDelay = computed(() => HERO_CHAR_START + totalHeroChars.value * HERO_CHAR_STEP + 0.12)

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
// 位图类 logo：宽度主导、高度按图片比例自适应；矢量（盾牌/EP 图标）走宽高双维
const logoBitmap = computed(() => isBitmapLogo(logo.value))
const logoStyle = computed(() => ({
  width: `${logoW.value}px`,
  height: logoBitmap.value ? 'auto' : `${logoH.value}px`,
  // el-icon 内 svg 为 1em，用 font-size 撑满 slot（位图无 el-icon）
  fontSize: logoBitmap.value ? undefined : `${logoH.value}px`,
  transform: `translate(${clampLogoOffset(logo.value.offsetX)}px, ${clampLogoOffset(logo.value.offsetY)}px)`
}))
const logoImageSrc = computed(() => mediaUrl(logo.value.value))
// 防御：builtin 类型下 value 必须是白名单组件名（切换 type 瞬间/脏数据兜底为盾牌）
const builtinName = computed(() =>
  BUILTIN_LOGO_VALUES.includes(logo.value.value) ? logo.value.value : 'shield')
// 内置位图 logo（如 nosc）；shield/EP 图标时为空串
const logoBuiltinImage = computed(() =>
  logo.value.type === 'builtin' ? builtinLogoImage(logo.value.value) : '')

/* ============ 客户方 Logo（双 logo 方案：登录区左上，与登录框左缘对齐，可独立开关/配置） ============ */
const clientLogo = computed(() => cfg.value.brand.logoClient || {})
// 启用且可渲染：builtin 始终兜底盾牌；image 必须已有 /profile/ 地址，避免空槽位
const clientLogoEnabled = computed(() => clientLogo.value.enabled !== false
  && (clientLogo.value.type !== 'image' || !!mediaUrl(clientLogo.value.value)))

// 客户方 logo 槽拖拽事件由 LoginLogoSlot 转发；target 区分写入哪个配置根
function onClientLogoPointerDown(e) {
  onLogoPointerDown(e, 'client')
}

let dragState = null
function onLogoPointerDown(e, target = 'main') {
  if (!props.logoDraggable) return
  // 仅主键触发，避免设计器中右键等操作误拖
  if (e.button !== 0) return
  e.preventDefault()
  const targetLogo = target === 'client' ? clientLogo.value : logo.value
  // 客户方 X 行程放宽（-200~400），其余维度均为 ±100
  const xBounds = target === 'client' ? CLIENT_LOGO_OFFSET_X_LIMITS : null
  dragState = {
    target,
    startX: e.clientX,
    startY: e.clientY,
    xBounds,
    originX: clampLogoOffset(targetLogo.offsetX, xBounds),
    originY: clampLogoOffset(targetLogo.offsetY)
  }
  window.addEventListener('pointermove', onLogoPointerMove)
  window.addEventListener('pointerup', onLogoPointerUp, { once: true })
  window.addEventListener('pointercancel', onLogoPointerUp, { once: true })
}
function onLogoPointerMove(e) {
  if (!dragState) return
  const scale = props.previewScale > 0 ? props.previewScale : 1
  const x = clampLogoOffset(dragState.originX + (e.clientX - dragState.startX) / scale, dragState.xBounds)
  const y = clampLogoOffset(dragState.originY + (e.clientY - dragState.startY) / scale)
  emit('logo-offset', { offsetX: x, offsetY: y }, dragState.target)
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
  padding: var(--login-logo-top-split) 64px 56px;
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
  /* 仅内容区抬到背景层之上；LoginTechBackground 自身 z-index:0 */
  > .lb-head, > .lb-hero, > .lb-foot { position: relative; z-index: 1; }
}

/* 双 logo 方案：左为版权方 logo+品牌名，右为客户方 logo（可在设计器关闭）。
   顶对齐（flex-start）：左右两栏头部第一个元素都是 logo，顶线严格共线，
   不再因品牌名文字块高于 logo 而把左 logo 下沉 */
.lb-head { display: flex; align-items: flex-start; gap: 12px; }
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
/* 位图 logo：槽高 auto，图片宽度 100%、高度随原始比例（宽度滑块即视觉宽度） */
.brand-logo-slot.logo-bitmap .brand-logo-img {
  height: auto;
  object-fit: unset;
}
.lb-name { font-size: var(--login-brand-size); font-weight: 700; letter-spacing: 1.5px; line-height: 1.2; }
.lb-sub { font-size: 11.5px; color: var(--login-brand-sub); letter-spacing: 1px; margin-top: 2px; }

.lb-hero { padding-bottom: 24px; }
.lb-hero h1 {
  font-size: var(--login-hero-size); font-weight: var(--login-hero-weight); line-height: 1.22;
  letter-spacing: 1px; margin: 0;
}
/* 每行独立裁切容器，逐字从行内上浮入场（demo GSAP 观感的纯 CSS 实现） */
.hero-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.08em;
}
.hero-char {
  display: inline-block;
  white-space: pre;
}
.hero-line.accent .hero-char { color: var(--login-accent); }
/* 渐变强调文字（设计器可开关/换色）；关闭时回退纯色 accent */
.hero-gradient-on .hero-line.accent .hero-char {
  background: var(--login-hero-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
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

/* 下方高度（split）：Hero 标语块与底部版权块相对默认位置整体垂直位移，
   负值上提、正值下移；0 时与默认布局完全一致 */
.lb-hero, .lb-foot {
  transform: translateY(var(--login-logo-bottom-split));
}

/* ============ 右侧登录表单区 ============ */
/* 与左栏 .login-brand 同机制：flex column 文档流 + 同一顶部留白变量，
   两个 logo 都锚定各自面板的文档流顶部，屏幕高度变化时相对位置不变且始终顶部对齐 */
.login-form-side {
  display: flex;
  flex-direction: column;
  padding: var(--login-logo-top-split) 24px 40px;
  background: var(--login-page-bg);
  height: 100%;
}
/* 客户方 Logo 头部行：与登录表单框共享同一条水平基准
   （同为 max-width 360px 居中列），logo 左对齐 → 其左缘与登录框左缘固定对齐；
   关闭时为空行（高度 0）不占位 */
.rs-logo-head {
  flex: none;
  align-self: center;
  width: 100%;
  max-width: 360px;
  display: flex;
  justify-content: flex-start;
}

.login-form-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-self: center;
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
/* 公安备案行：与版权同色、居中，版权隐藏时也保留上间距 */
.lf-police {
  margin-top: 12px;
  text-align: center;
  font-size: 11.5px;
  color: var(--login-text-2);
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
  padding: var(--login-logo-top-overlay) 20px 40px;
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
  margin-bottom: var(--login-logo-bottom-overlay);
}
/* 客户方 Logo：居中/全屏模板固定在登录框左缘正上方
   （.lc-box 宽 400px 居中，左缘即 50%-200px；窄屏不小于 20px 边距）；
   顶部偏移与 .lc-stage 的 padding-top 同变量，和品牌区主 logo 共用一条顶部基准线 */
.lc-logo-corner {
  position: absolute;
  top: var(--login-logo-top-overlay);
  left: max(20px, calc(50% - 200px));
  z-index: 2;
}
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
/* 网安备案：居中/全屏布局卡片最下方，与版权同色居中；版权隐藏时保留自身间距 */
.lc-police {
  margin-top: 12px;
  text-align: center;
  font-size: 11.5px;
  color: var(--login-brand-foot);
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
  /* 科技背景层存在时装饰光晕被其覆盖，无需再显隐（组件自带渐变兜底底色） */
}

/* ============ 入场动效（仅根节点 .anim-on 时生效；延迟由元素内联 animation-delay 控制） ============ */
@keyframes login-rise {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes login-char-rise {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}
.anim-on [data-anim] {
  animation: login-rise .6s cubic-bezier(.21, .8, .35, 1) both;
}
.anim-on [data-anim="char"] {
  animation-name: login-char-rise;
  animation-duration: .55s;
}
/* 关闭入场动效时元素默认可见，不残留 transform */
.login-wrap:not(.anim-on) [data-anim] { opacity: 1; transform: none; }

/* ============ 移动端响应式 ============ */
@media (max-width: 900px) {
  .login-split {
    grid-template-columns: 1fr;
  }
  .login-wrap.brand-hidden-mobile .login-brand { display: none; }
  .login-form-side {
    min-height: 100vh;
    padding: var(--login-logo-top-split) 20px 32px;
  }
  .lc-logo-corner { left: 20px; }
}
@media (max-width: 480px) {
  .login-form-box { max-width: 100%; }
  .lc-card { padding: 26px 22px 22px; }
}

/*
 * 设计器手机预览（device='mobile'）：画布只有 375px 但浏览器真实视口很宽，
 * 媒体查询不会命中，用 .force-mobile 复刻同样的 H5 形态。
 */
.login-wrap.force-mobile.login-split { grid-template-columns: 1fr; }
.login-wrap.force-mobile.brand-hidden-mobile .login-brand { display: none; }
.login-wrap.force-mobile .login-form-side {
  min-height: 100%;
  padding: var(--login-logo-top-split) 20px 32px;
}
.login-wrap.force-mobile .lc-logo-corner { left: 20px; }
.login-wrap.force-mobile .login-form-box { max-width: 100%; }
.login-wrap.force-mobile .lc-card { padding: 26px 22px 22px; }

/* ============ 品牌展示形态（www.apms.top 落地页） ============ */
/* split：右栏已 v-if 移除，品牌区独占整行 */
.showcase-on.login-split { grid-template-columns: 1fr; }
/* 超宽屏下内容列收窄，避免 Hero/特性/版权行被拉得过长 */
.showcase-on .lb-hero,
.showcase-on .lb-foot { max-width: 760px; }
/* 表单区版权上移后的堆叠间距（.lb-foot 自身已有分隔线，不再加第二道） */
.lb-copyright-extra { margin-top: 10px; }
/* overlay 族（centered/fullscreen）：卡片摘除后品牌块不再需要给卡片留的底部间距 */
.showcase-on .lc-brand { margin-bottom: 0; }
/* 移动端必须保留品牌区：覆盖登录页「≤900px 隐藏品牌区」与设计器手机预览的同名规则 */
.login-wrap.showcase-on.brand-hidden-mobile .login-brand { display: flex; }
.login-wrap.force-mobile.showcase-on.brand-hidden-mobile .login-brand { display: flex; }
/* 展示形态窄屏：品牌区满高、沿用品牌底色（无右栏白底后避免露白） */
@media (max-width: 900px) {
  .showcase-on .login-brand { min-height: 100vh; padding: var(--login-logo-top-split) 20px 32px; }
}

/* ============ 暗黑模式 ============ */
html.dark .login-brand {
  background: linear-gradient(150deg, #060b16 0%, #0b1222 55%, #0f172a 100%);
}
html.dark .login-centered,
html.dark .login-fullscreen {
  background: linear-gradient(150deg, #060b16 0%, #0b1222 55%, #0f172a 100%);
}
html.dark .login-form-side {
  background: var(--el-bg-color);
}
html.dark .lc-card {
  background: var(--el-bg-color);
}
html.dark .lf-title { color: var(--el-text-color-primary); }
html.dark .lf-subtitle { color: var(--el-text-color-secondary); }

/* 系统开启「减弱动态效果」：入场与装饰动画一律停用（元素保持最终可见态） */
@media (prefers-reduced-motion: reduce) {
  .anim-on [data-anim],
  .anim-on [data-anim="char"] {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
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
  background: #0a1120;
}
</style>
