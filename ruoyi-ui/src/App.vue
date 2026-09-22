<template>
  <router-view />
</template>

<script setup>
import useSettingsStore from './store/modules/settings'
import useLoginThemeStore from './store/modules/loginTheme'
import { applyGlobalBrand } from '@/utils/theme'

const settingsStore = useSettingsStore()
const loginThemeStore = useLoginThemeStore()

// 全局品牌随首页设计器配置实时更新（设计器保存即同步 store，立即生效）
watch(() => loginThemeStore.config, (cfg) => {
  applyGlobalBrand(cfg)
  // 同步侧栏菜单激活文字色（el-menu active-text-color 绑定 settingsStore.theme）
  if (cfg && cfg.colors && cfg.colors.accent) {
    settingsStore.theme = cfg.colors.accent
  }
}, { deep: true })

onMounted(() => {
  // 先以默认值应用一次，避免样式空窗；拉取到配置后 watch 自动重新应用
  applyGlobalBrand(loginThemeStore.config)
  loginThemeStore.loadConfig()
})
</script>
