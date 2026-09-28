<template>
  <!-- www.apms.top 品牌展示落地页：复用登录页渲染器的展示形态
       （无 form/roles slot → 无登录卡片/客户 logo，版权/ICP 完整保留） -->
  <LoginRenderer :config="loginThemeStore.config" showcase />
</template>

<script setup name="Showcase">
import LoginRenderer from '../login/LoginRenderer.vue'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { applyLoginHead, restoreLoginHead } from '../login/login.utils'

const loginThemeStore = useLoginThemeStore()

// favicon / 浏览器标题：与登录页完全一致，配置加载后动态替换，离开时恢复
function applyHead() {
  const c = loginThemeStore.config
  const title = (c.brand?.name || '').trim() || import.meta.env.VITE_APP_TITLE
  applyLoginHead({ favicon: c.brand?.favicon, title })
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
