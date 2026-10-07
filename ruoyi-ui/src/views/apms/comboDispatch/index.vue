<template>
  <div class="app-container">
    <!-- 整页只读遮罩：测试域（测试模型/组合模型）写权限归 tester，其他角色全页只读 -->
    <read-only-block :perms="['apms:testModel:edit', 'apms:comboModel:edit']">
    <div class="rk-dash-page rk-page combo-dispatch-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">组合测试调度</h1>
          <p class="rk-subtitle">
            测试模型与字段定义 · 组合模型配置与计算调度
          </p>
        </div>
      </div>

      <section class="ha-block">
        <TestModelPage embedded />
      </section>

      <section class="ha-block">
        <ComboModelPage embedded />
      </section>
    </div>
    </read-only-block>
  </div>
</template>

<script setup name="ApmsComboDispatch">
import TestModelPage from '@/views/apms/testModel/index.vue'
import ComboModelPage from '@/views/apms/comboModel/index.vue'
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
