<template>
  <div class="sidebar-logo-container" :class="{ 'collapse': collapse }">
    <transition name="sidebarLogoFade">
      <router-link :key="collapse ? 'collapse' : 'expand'" class="sidebar-logo-link" to="/">
        <!-- 自定义上传图片（品牌 Logo 为横版时按高度等比缩放） -->
        <img v-if="logoImgSrc" :src="logoImgSrc" class="sidebar-logo" alt="brand logo" />
        <!-- 定制盾牌（默认内置） -->
        <svg v-else-if="logoType === 'builtin' && builtinName === 'shield'" viewBox="0 0 40 46" fill="none" class="sidebar-logo">
          <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
            fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
          <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
          <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
          <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
        </svg>
        <!-- 其余内置 logo：全局注册的 Element Plus 图标 -->
        <el-icon v-else-if="logoType === 'builtin'" class="sidebar-logo sidebar-logo-ep">
          <component :is="builtinName" />
        </el-icon>
        <h1 v-if="!collapse" class="sidebar-title">{{ brandTitle }}</h1>
      </router-link>
    </transition>
  </div>
</template>

<script setup>
import useSettingsStore from '@/store/modules/settings'
import useLoginThemeStore from '@/store/modules/loginTheme'
import variables from '@/assets/styles/variables.module.scss'
import { mediaUrl, BUILTIN_LOGO_VALUES } from '@/views/login/login.utils'

defineProps({
  collapse: {
    type: Boolean,
    required: true
  }
})

const settingsStore = useSettingsStore()
const loginThemeStore = useLoginThemeStore()
const sideTheme = computed(() => settingsStore.sideTheme)

// 品牌 Logo 与名称均来自首页设计器配置（loginTheme store）
const logo = computed(() => loginThemeStore.config.brand.logo || {})
const logoType = computed(() => logo.value.type)
// 脏数据兜底：非白名单内置名一律回退盾牌
const builtinName = computed(() =>
  BUILTIN_LOGO_VALUES.includes(logo.value.value) ? logo.value.value : 'shield')
const logoImgSrc = computed(() =>
  logo.value.type === 'image' && logo.value.value ? mediaUrl(logo.value.value) : '')
const brandTitle = computed(() => loginThemeStore.config.brand.name || import.meta.env.VITE_APP_TITLE)

// 获取Logo背景色
const getLogoBackground = computed(() => {
  if (settingsStore.isDark) {
    return 'var(--sidebar-bg)'
  }
  if (settingsStore.navType == 3) {
    return variables.menuLightBg
  }
  // 深色侧栏透明：露出侧栏品牌渐变，使 Logo 区与菜单区连成一体
  return sideTheme.value === 'theme-dark' ? 'transparent' : variables.menuLightBg
})

// 获取Logo文字颜色
const getLogoTextColor = computed(() => {
  if (settingsStore.isDark) {
    return 'var(--sidebar-logo-text)'
  }
  if (settingsStore.navType == 3) {
    return variables.menuLightText
  }
  return sideTheme.value === 'theme-dark' ? '#fff' : variables.menuLightText
})
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active {
  transition: opacity 1.5s;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
  opacity: 0;
}

.sidebar-logo-container {
  position: relative;
  height: 50px;
  line-height: 50px;
  background: v-bind(getLogoBackground);
  text-align: center;
  overflow: hidden;

  /* #app 前缀用于压过全局 sidebar.scss 中 #app .sidebar-container a 的 inline-block */
  #app & .sidebar-logo-link {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    /* 左对齐：Logo 固定 11px 左缩进，右侧保留 10px 安全空隙，长品牌名由省略号兜底 */
    justify-content: flex-start;
    padding: 0 10px 0 11px;

    & .sidebar-logo {
      /* Logo 为 2:1 横版标志：18px 高（=36px 宽），为品牌名与右侧空隙让出空间 */
      height: 18px;
      width: auto;
      flex: none;
      margin-right: 8px;
    }

    & .sidebar-logo-ep {
      /* Element Plus 图标由字号控制尺寸 */
      height: auto;
      width: auto;
      font-size: 24px;
    }

    & .sidebar-title {
      margin: 0;
      color: v-bind(getLogoTextColor);
      font-weight: 600;
      line-height: 50px;
      /* 12px：200px 内放下 10 个汉字 + 横版 Logo，并保留右侧 10px 空隙 */
      font-size: 12px;
      font-family: Avenir, Helvetica Neue, Arial, Helvetica, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  #app &.collapse .sidebar-logo-link {
    /* 折叠态取消内边距并居中：44px Logo 在 54px 侧栏内左右各留 5px */
    padding: 0;
    justify-content: center;
  }

  #app &.collapse .sidebar-logo-link .sidebar-logo {
    /* 折叠侧栏宽 54px：按宽度等比缩放（44×22），完整不裁切 */
    width: 44px;
    height: auto;
    margin-right: 0px;
  }

  #app &.collapse .sidebar-logo-link .sidebar-logo-ep {
    width: auto;
    font-size: 28px;
  }
}
</style>
