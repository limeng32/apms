<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page rtp-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">RTP 状态管理</h1>
          <p class="rk-subtitle">红黄绿参训状态看板 · 拖拽更新 · 评估时间线留痕</p>
        </div>
      </div>

      <RtpStatusPanel ref="statusPanelRef" />
    </div>
  </div>
</template>

<script setup name="ApmsRtp">
import RtpStatusPanel from './RtpStatusPanel.vue'

const statusPanelRef = ref(null)
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rtp-page :deep(.rtp-panel) {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
}
</style>
