<template>
  <button type="button" class="as-launcher" :class="{ 'is-open': store.open }"
          title="APMS 助手（Alt+A）" aria-label="打开 APMS 助手" @click="store.toggle()">
    <el-icon><ChatDotRound /></el-icon>
  </button>
  <AssistantPanel />
</template>

<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import useAssistantStore from './assistantStore'
import AssistantPanel from './AssistantPanel.vue'

const store = useAssistantStore()
const userStore = useUserStore()

function onKeydown(e) {
  if (e.altKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault()
    store.toggle()
    return
  }
  if (e.key === 'Escape' && store.open) {
    store.closePanel()
  }
}

function onSessionReset() {
  store.resetSession(false)
}

onMounted(() => {
  store.initialize()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('apms:assistant-reset', onSessionReset)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('apms:assistant-reset', onSessionReset)
  store.stopTyping()
})

watch([() => userStore.id, () => userStore.token], () => {
  store.resetSession(false)
  store.initialize()
})
</script>

<style>
.rk-assistant-highlight {
  outline: 3px solid var(--el-color-primary, #2563eb) !important;
  outline-offset: 3px !important;
  border-radius: 6px !important;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12) !important;
  transition: outline-color 0.2s ease, box-shadow 0.2s ease;
}
</style>

<style scoped>
.as-launcher {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2100;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, var(--el-color-primary), #06b6d4);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.28);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.as-launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(37, 99, 235, 0.36);
}
.as-launcher.is-open {
  opacity: 0.85;
}
@media (max-width: 768px) {
  .as-launcher {
    right: 14px;
    bottom: 14px;
    width: 44px;
    height: 44px;
  }
}
</style>
