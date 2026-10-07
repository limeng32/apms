<template>
  <div class="app-container">
    <!-- 整页只读遮罩：测试域（指标/任务/成绩）写权限归 tester，其他角色全页只读 -->
    <read-only-block :perms="['apms:indicator:edit', 'apms:testTask:edit', 'apms:testResult:edit']">
    <div class="rk-dash-page rk-page dispatch-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">指标库与任务下发</h1>
          <p class="rk-subtitle">
            指标定义与评价参考 · 测试任务下发与进度 · 成绩录入与选定
          </p>
        </div>
      </div>

      <section class="ha-block">
        <h2 class="ha-block-title">指标库</h2>
        <IndicatorPage embedded />
      </section>

      <section class="ha-block">
        <h2 class="ha-block-title">测试任务</h2>
        <TestTaskPage embedded />
      </section>

      <section class="ha-block">
        <h2 class="ha-block-title">测试结果</h2>
        <TestResultPage embedded />
      </section>
    </div>
    </read-only-block>
  </div>
</template>

<script setup name="ApmsDispatch">
import IndicatorPage from '@/views/apms/indicator/index.vue'
import TestTaskPage from '@/views/apms/testTask/index.vue'
import TestResultPage from '@/views/apms/testResult/index.vue'
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
