<template>
  <div class="app-container">
    <!-- 整页只读遮罩：测试域（测试模型/组合模型/组合评分）写权限归 tester，其他角色全页只读 -->
    <read-only-block :perms="['apms:testModel:edit', 'apms:comboModel:edit', 'apms:comboScore:calculate']">
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

      <!-- ===== 功能区 Tab：测试模型 / 组合模型 / 评分记录
           懒挂载（首屏只加载一个模块）、挂载后切换保留各页筛选状态、与 URL ?tab= 同步 ===== -->
      <div class="cd-tabs rk-tabs">
        <button v-for="t in TABS" :key="t.key" type="button"
                class="rk-tab" :class="{ 'is-active': activeTab === t.key }"
                @click="switchTab(t.key)">
          {{ t.label }}
        </button>
      </div>

      <section class="ha-block" v-show="activeTab === 'model'">
        <TestModelPage v-if="loaded.model" embedded />
      </section>

      <section class="ha-block" v-show="activeTab === 'combo'">
        <ComboModelPage v-if="loaded.combo" embedded />
      </section>

      <section class="ha-block" v-show="activeTab === 'score'">
        <ComboScorePage v-if="loaded.score" embedded />
      </section>
    </div>
    </read-only-block>
  </div>
</template>

<script setup name="ApmsComboDispatch">
import { useRoute, useRouter } from 'vue-router'
import TestModelPage from '@/views/apms/testModel/index.vue'
import ComboModelPage from '@/views/apms/comboModel/index.vue'
import ComboScorePage from '@/views/apms/comboScore/index.vue'
import ReadOnlyBlock from '@/components/ReadOnlyBlock/index.vue'

const TABS = [
  { key: 'model', label: '测试模型' },
  { key: 'combo', label: '组合模型' },
  { key: 'score', label: '评分记录' }
]
const TAB_KEYS = TABS.map(t => t.key)

const route = useRoute()
const router = useRouter()

// 初始 Tab 取自 URL ?tab=（非法值回落到「测试模型」）
const initialTab = TAB_KEYS.includes(route.query.tab) ? route.query.tab : 'model'
const activeTab = ref(initialTab)
// 懒挂载：首次切入才发请求加载，挂载后不再销毁，保留筛选/抽屉等页面状态
const loaded = reactive({ model: false, combo: false, score: false })
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
  const key = TAB_KEYS.includes(v) ? v : 'model'
  if (key !== activeTab.value) {
    activeTab.value = key
    loaded[key] = true
  }
})
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.cd-tabs {
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
