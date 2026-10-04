<template>
  <div class="btc-wrap">
    <div class="btc-toolbar">
      <el-checkbox-group v-model="checkedMetrics" size="small">
        <el-checkbox v-for="m in METRICS" :key="m.key" :value="m.key">
          <i class="btc-dot" :style="{ background: m.color }"></i>{{ m.label }}<span class="btc-unit">{{ m.unit }}</span>
        </el-checkbox>
      </el-checkbox-group>
    </div>
    <!-- 容器常驻（v-show），避免 v-if 销毁后 ECharts 实例与 DOM 永久脱钩 -->
    <div ref="chartRef" class="btc-chart" v-show="hasData"></div>
    <div v-if="!hasData" class="btc-empty">{{ emptyText }}</div>
  </div>
</template>

<script setup>
import * as echarts from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 体态趋势图（纯展示）
 * props.records: ApmsBodyMeasure[]（任意顺序，内部按日期升序）
 * 指标可勾选；BMI 由身高体重实时计算。
 */
const props = defineProps({
  records: { type: Array, default: () => [] }
})

const METRICS = [
  { key: 'height', label: '身高', unit: 'cm', color: '#2563EB' },
  { key: 'weight', label: '体重', unit: 'kg', color: '#06B6D4' },
  { key: 'bmi', label: 'BMI', unit: '', color: '#8B5CF6' },
  { key: 'bodyFatRate', label: '体脂率', unit: '%', color: '#F59E0B' },
  { key: 'waist', label: '腰围', unit: 'cm', color: '#EF4444' },
  { key: 'sitHeight', label: '坐高', unit: 'cm', color: '#10B981' }
]
const checkedMetrics = ref(['height', 'weight'])
const chartRef = ref(null)
let chart = null
let resizeObserver = null

const sortedRows = () => (props.records || []).slice().sort((a, b) =>
  String(a.measureDate).localeCompare(String(b.measureDate)))

function bmiOf(r) {
  const h = Number(r.height), w = Number(r.weight)
  if (!h || !w) return null
  return Number((w / Math.pow(h / 100, 2)).toFixed(1))
}

function valueOf(r, key) {
  if (key === 'bmi') return bmiOf(r)
  return r[key] != null ? Number(r[key]) : null
}

const hasData = computed(() => {
  const rows = sortedRows()
  if (rows.length < 2) return false
  return rows.some(r => checkedMetrics.value.some(k => valueOf(r, k) != null))
})

const emptyText = computed(() => {
  if (sortedRows().length < 2) return '至少需要 2 次测量数据才能绘制趋势'
  if (!checkedMetrics.value.length) return '请至少勾选一个指标'
  return '当前勾选的指标暂无有效数据'
})

function ensureChart() {
  const el = chartRef.value
  if (!el) return null
  // 容器被替换过（防御性）：旧实例必须重建
  if (chart && chart.isDisposed()) chart = null
  if (chart && chart.getDom() !== el) { chart.dispose(); chart = null }
  if (!chart) chart = echarts.init(el)
  return chart
}

function draw() {
  if (!hasData.value) return
  const rows = sortedRows()
  const series = checkedMetrics.value.map(key => {
    const meta = METRICS.find(m => m.key === key)
    return {
      name: meta.label,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      connectNulls: true,
      lineStyle: { width: 2.5, color: meta.color },
      itemStyle: { color: meta.color },
      yAxisIndex: key === 'bmi' || key === 'bodyFatRate' ? 1 : 0,
      data: rows.map(r => valueOf(r, key)),
      tooltip: { valueFormatter: (v) => v == null ? '—' : `${v}${meta.unit}` }
    }
  })

  const inst = ensureChart()
  if (!inst) return
  inst.setOption({
    tooltip: { trigger: 'axis' },
    legend: { show: false },
    grid: { left: 48, right: 52, top: 20, bottom: 32 },
    xAxis: {
      type: 'category',
      data: rows.map(r => String(r.measureDate).substring(0, 10)),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 11 }
    },
    yAxis: [
      { type: 'value', scale: true, axisLabel: { color: '#94a3b8', fontSize: 11 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      { type: 'value', scale: true, axisLabel: { color: '#cbd5e1', fontSize: 10 }, splitLine: { show: false } }
    ],
    series
  }, true)
  // 抽屉动画/隐藏恢复后容器尺寸可能与 init 时不同，主动校正一次
  inst.resize()
}

// 统一在 DOM 状态（v-show、容器尺寸）落地后再绘制
function render() {
  nextTick(draw)
}

watch(() => props.records, render, { deep: false })
watch(checkedMetrics, render, { deep: true })

function onResize() { if (chart && !chart.isDisposed()) chart.resize() }

onMounted(() => {
  render()
  window.addEventListener('resize', onResize)
  // 容器尺寸变化（抽屉开合动画、布局伸缩、display:none→block）自动适配
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (chart && !chart.isDisposed() && chartRef.value.clientWidth > 0) chart.resize()
    })
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  if (chart) { chart.dispose(); chart = null }
})

defineExpose({ render })
</script>

<style lang="scss" scoped>
.btc-wrap { width: 100%; }
.btc-toolbar { margin-bottom: 6px; }
.btc-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: 1px; }
.btc-unit { color: #94a3b8; font-size: 11px; margin-left: 2px; }
.btc-chart { width: 100%; height: 280px; }
.btc-empty { padding: 40px 0; text-align: center; color: #94a3b8; font-size: 13px; }
:deep(.el-checkbox) { margin-right: 14px; height: 26px; }
</style>
