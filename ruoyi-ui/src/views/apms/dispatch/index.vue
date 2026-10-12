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

      <!-- ===== 功能区 Tab：指标库 / 测试任务 / 测试结果
           懒挂载（首屏只加载一个模块）、挂载后切换保留各页筛选状态、与 URL ?tab= 同步 ===== -->
      <div class="dp-tabs rk-tabs">
        <button v-for="t in TABS" :key="t.key" type="button"
                class="rk-tab" :class="{ 'is-active': activeTab === t.key }"
                @click="switchTab(t.key)">
          {{ t.label }}
        </button>
      </div>

      <section class="ha-block" v-show="activeTab === 'indicator'">
        <IndicatorPage v-if="loaded.indicator" embedded />
      </section>

      <section class="ha-block" v-show="activeTab === 'task'">
        <TestTaskPage v-if="loaded.task" embedded />
      </section>

      <section class="ha-block" v-show="activeTab === 'result'">
        <TestResultPage v-if="loaded.result" embedded />
      </section>
    </div>
    </read-only-block>
  </div>
</template>

<script setup name="ApmsDispatch">
import { useRoute, useRouter } from 'vue-router'
import IndicatorPage from '@/views/apms/indicator/index.vue'
import TestTaskPage from '@/views/apms/testTask/index.vue'
import TestResultPage from '@/views/apms/testResult/index.vue'
import ReadOnlyBlock from '@/components/ReadOnlyBlock/index.vue'

const TABS = [
  { key: 'indicator', label: '指标库' },
  { key: 'task', label: '测试任务' },
  { key: 'result', label: '测试结果' }
]
const TAB_KEYS = TABS.map(t => t.key)

const route = useRoute()
const router = useRouter()

// 初始 Tab 取自 URL ?tab=（非法值回落到「指标库」）
const initialTab = TAB_KEYS.includes(route.query.tab) ? route.query.tab : 'indicator'
const activeTab = ref(initialTab)
// 懒挂载：首次切入才发请求加载，挂载后不再销毁，保留筛选/抽屉等页面状态
const loaded = reactive({ indicator: false, task: false, result: false })
loaded[initialTab] = true

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  loaded[key] = true
  // replace 同步 URL，不污染浏览历史
  if (route.query.tab !== key) {
    router.replace({ query: { ...route.query, tab: key } })
  }
}

// 支持浏览器前进/后退及外部链接切区
watch(() => route.query.tab, (v) => {
  const key = TAB_KEYS.includes(v) ? v : 'indicator'
  if (key !== activeTab.value) {
    activeTab.value = key
    loaded[key] = true
  }
})
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.dp-tabs {
  margin-top: 4px;
}

.ha-block {
  display: block;
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 16px;
  padding: 20px 22px 24px;
  margin-top: 16px;
}
</style>
