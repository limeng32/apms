<template>
  <!-- www.apms.top 品牌展示落地页：复用登录页渲染器的展示形态
       （无 form/roles slot → 无登录卡片/客户 logo，版权/ICP 完整保留） -->
  <LoginRenderer :config="loginThemeStore.config" showcase />
</template>

<script setup name="Showcase">
import LoginRenderer from '../login/LoginRenderer.vue'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { applyLoginHead, restoreLoginHead, resolveBrowserTitle } from '../login/login.utils'

const loginThemeStore = useLoginThemeStore()

// favicon / 浏览器标题：均取展示站配置；标题留空回退域名内置短标题
function applyHead() {
  const c = loginThemeStore.config
  applyLoginHead({ favicon: c.brand?.favicon, title: resolveBrowserTitle(c) }, 'showcase')
}

// 首帧用默认配置渲染，挂载后异步拉取公开配置（失败静默回退，绝不阻断）
onMounted(() => {
  applyHead()
  loginThemeStore.loadConfig().then(applyHead)
})
onBeforeUnmount(() => {
  restoreLoginHead()
})
</script>
