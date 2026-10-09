<template>
  <DashCard title="PHV 发育阶段分布"
            :subtitle="`已评估 ${block.total || 0} 人 · 按最新成熟度偏移分档`"
            :big="big" :enter-delay="enterDelay" body-class="pb-body">
    <div class="pb-chart-wrap">
      <div ref="barRef" class="pb-chart"></div>
      <div v-if="!assessed" class="pb-empty">暂无 PHV 评估记录</div>
    </div>
    <p class="pb-foot">
      <b class="rk-mono">{{ block.windowCount || 0 }}</b> 名处于 PHV ±1 年窗口内，建议匹配窗口期训练安排
    </p>
  </DashCard>
</template>

<script setup name="DashPhvBands">
import { ref, computed, watch, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue'
import * as echarts from 'echarts'
import DashCard from './DashCard.vue'
import { chartTheme, GROW_ANIM_MS } from './dashTheme'

const { proxy } = getCurrentInstance()

const props = defineProps({
  block: { type: Object, default: () => ({ bands: [], windowCount: 0, total: 0 }) },
  big: { type: Boolean, default: false },
  enterDelay: { type: Number, default: 0 }
})

const BAND_COLORS = ['#8B5CF6', '#3B82F6', '#06B6D4', '#22C55E']
const BAND_COLORS_BIG = ['#a78bfa', '#60a5fa', '#22d3ee', '#4ade80']

const bands = computed(() => props.block.bands || [])
const assessed = computed(() => Number(props.block.total || 0) > 0)

const barRef = ref(null)
let chart = null
let ro = null

function render() {
  nextTick(() => {
    if (!barRef.value) return
    if (chart) chart.dispose()
    chart = echarts.init(barRef.value)
    const t = chartTheme(props.big)
    const colors = props.big ? BAND_COLORS_BIG : BAND_COLORS
    chart.setOption({
      tooltip: {
        ...t.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: props.big ? 'rgba(255,255,255,.04)' : 'rgba(37,99,235,.05)' } },
        formatter: (items) => {
          const it = items[0]
          return `<b>${it.axisValue}</b><br/>队员：<b>${it.value}</b> 人`
        }
      },
      grid: { left: 4, right: 4, top: 26, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: bands.value.map(b => b.label),
        axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { ...t.axisLabel, fontSize: 10, interval: 0 }
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: t.axisLabel, axisLine: { show: false }, axisTick: { show: false },
        splitLine: t.splitLine
      },
      series: [{
        type: 'bar',
        data: bands.value.map((b, i) => ({
          value: b.count,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colors[i] },
              { offset: 1, color: colors[i] + '55' }
            ]),
            borderRadius: [7, 7, 0, 0]
          }
        })),
        barWidth: 34,
        label: {
          show: true, position: 'top', distance: 4,
          fontSize: 12, fontWeight: 700,
          color: props.big ? 'rgba(255,255,255,.85)' : '#334155'
        },
        animationDuration: GROW_ANIM_MS,
        animationEasing: 'cubicOut',
        animationDelay: (i) => i * 120
      }]
    })
    chart.on('click', () => proxy.$router.push('/apms/growth').catch(() => {}))
    if (typeof ResizeObserver !== 'undefined') {
      if (!ro) ro = new ResizeObserver(() => chart?.resize())
      ro.observe(barRef.value)
    }
  })
}

watch(() => [props.block, props.big], render, { deep: true, immediate: true })

onBeforeUnmount(() => {
  if (ro) { ro.disconnect(); ro = null }
  if (chart) { chart.dispose(); chart = null }
})
</script>

<style lang="scss" scoped>
.pb-body { display: flex; flex-direction: column; }
.pb-chart-wrap { position: relative; flex: 1; min-height: 168px; }
.pb-chart { width: 100%; height: 100%; min-height: 168px; }
.pb-empty {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--dbx-sub);
}
.pb-foot {
  flex: none;
  margin: 8px -18px -14px;
  padding: 9px 18px;
  border-top: 1px solid var(--dbx-line);
  font-size: 11px; line-height: 1.5; color: var(--dbx-sub);
  b { color: var(--dbx-brand); font-weight: 700; margin-right: 2px; }
}
</style>
