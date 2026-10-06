<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page rw-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">RTP 风险预警</h1>
          <p class="rk-subtitle">
            规则引擎每日扫描 · 健康风险与流程待办分栏 · 处置全留痕
          </p>
        </div>
      </div>

      <RtpWarningPanel />
    </div>
  </div>
</template>

<script setup name="ApmsRtpWarning">
import RtpWarningPanel from './RtpWarningPanel.vue'
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rw-page :deep(.rw-panel) {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
}
</style>
