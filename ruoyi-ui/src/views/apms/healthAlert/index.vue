<template>
  <div class="app-container">
    <!-- 整页只读遮罩：健康域（RTP 状态/风险处置）写权限归 medic，其他角色全页只读 -->
    <read-only-block :perms="['apms:rtp:edit', 'apms:rtpRisk:handle']">
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

      <!-- 上：RTP 状态管理（功能导语沿用原独立页说明） -->
      <div class="ha-block">
        <p class="ha-block-intro">红黄绿参训状态看板 · 拖拽更新 · 评估时间线留痕</p>
        <RtpStatusPanel ref="statusPanelRef" />
      </div>

      <!-- 下：RTP 风险预警（采纳建议后同步刷新上方状态；功能导语沿用原独立页说明） -->
      <div class="ha-block">
        <p class="ha-block-intro">规则引擎每日扫描 · 健康风险与流程待办分栏 · 处置全留痕</p>
        <RtpWarningPanel @accepted="reloadStatus" />
      </div>
    </div>
    </read-only-block>
  </div>
</template>

<script setup name="ApmsHealthAlert">
import RtpStatusPanel from '@/views/apms/rtp/RtpStatusPanel.vue'
import RtpWarningPanel from '@/views/apms/rtpWarning/RtpWarningPanel.vue'
import ReadOnlyBlock from '@/components/ReadOnlyBlock/index.vue'

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
/* 面板功能导语（原独立页副标题，合并后保留在白卡上方） */
.ha-block-intro {
  margin: 0 0 10px 2px;
  font-size: 13px;
  line-height: 1.5;
  color: $rk-text-3;
}
</style>
