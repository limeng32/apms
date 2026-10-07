<template>
  <div class="app-container">
    <!-- 整页只读遮罩：运动员域（体态/PHV）写权限归 coach，其他角色全页只读 -->
    <read-only-block :perms="['apms:body:edit', 'apms:phv:edit']">
    <div class="rk-dash-page rk-page growth-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">青训发育监控</h1>
          <p class="rk-subtitle">
            体态测量（身高/体重/体脂）· PHV 生长高峰与发育窗监控
          </p>
        </div>
      </div>

      <section class="ha-block">
        <h2 class="ha-block-title">体态测量</h2>
        <BodyMeasurePage embedded />
      </section>

      <section class="ha-block">
        <h2 class="ha-block-title">PHV 成熟度</h2>
        <PhvPage embedded />
      </section>
    </div>
    </read-only-block>
  </div>
</template>

<script setup name="ApmsGrowth">
import BodyMeasurePage from '@/views/apms/bodyMeasure/index.vue'
import PhvPage from '@/views/apms/phv/index.vue'
import ReadOnlyBlock from '@/components/ReadOnlyBlock/index.vue'
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.ha-block {
  display: block;
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 16px;
  padding: 20px 22px 24px;
  margin-bottom: 22px;

  &:last-child { margin-bottom: 0; }
}
.ha-block-title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 700;
  color: $rk-text-1;
  position: relative;
  padding-left: 10px;
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 50%;
    transform: translateY(-50%);
    width: 4px; height: 16px;
    border-radius: 2px;
    background: $rk-brand-600;
  }
}
</style>
