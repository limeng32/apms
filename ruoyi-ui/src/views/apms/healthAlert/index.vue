<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page ha-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">健康预警中心</h1>
          <p class="rk-subtitle">
            上：RTP 参训状态看板 · 下：RTP 风险预警与处置 · 系统建议仅供参考，红黄绿由康复师人工确认
          </p>
        </div>
      </div>

      <!-- 上：RTP 状态管理 -->
      <RtpStatusPanel ref="statusPanelRef" class="ha-block" />

      <!-- 下：RTP 风险预警（采纳建议后同步刷新上方状态） -->
      <RtpWarningPanel class="ha-block" @accepted="reloadStatus" />
    </div>
  </div>
</template>

<script setup name="ApmsHealthAlert">
import RtpStatusPanel from '@/views/apms/rtp/RtpStatusPanel.vue'
import RtpWarningPanel from '@/views/apms/rtpWarning/RtpWarningPanel.vue'

const statusPanelRef = ref(null)
function reloadStatus() {
  statusPanelRef.value?.reload?.()
}
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.ha-block {
  display: block;
  margin-bottom: 22px;

  &:last-child { margin-bottom: 0; }
}
</style>
