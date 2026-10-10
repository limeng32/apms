<template>
  <DashCard title="伤病台账摘要" subtitle="近 12 个月 · 活跃/闭环同医疗康复口径"
            :big="big" :enter-delay="enterDelay" body-class="ij-body">

    <div class="ij-stats">
      <div class="ij-stat">
        <p class="ij-num rk-mono is-warn">{{ activeText }}</p>
        <p class="ij-label">活跃</p>
      </div>
      <div class="ij-stat">
        <p class="ij-num rk-mono is-risk">{{ newText }}</p>
        <p class="ij-label">本月新发</p>
      </div>
      <div class="ij-stat">
        <p class="ij-num rk-mono is-ok">{{ recoveredText }}</p>
        <p class="ij-label">已康复</p>
      </div>
    </div>

    <div class="ij-chart-wrap">
      <div ref="siteRef" class="ij-chart"></div>
      <div v-if="!sites.length" class="ij-chart-empty">近 12 个月无活跃伤病记录</div>
    </div>

    <div class="ij-recent">
      <div v-for="r in recent" :key="r.athleteId + '-' + r.recordDate" class="ij-rec-row">
        <span class="ij-pulse"><i></i></span>
        <span class="ij-rec-text">
          <b>{{ r.athleteName || '#' + r.athleteId }}</b>
          <em>{{ r.title || typeLabel(r.recordType) }}</em>
        </span>
        <span v-if="r.bodySite" class="rk-soft-chip ij-site-chip">{{ siteLabel(r.bodySite) }}</span>
        <span class="ij-date rk-mono">{{ fmtDate(r.recordDate) }}</span>
      </div>
      <p v-if="!recent.length" class="ij-no-recent">暂无活跃伤病 🎉</p>
    </div>
  </DashCard>
</template>

<script setup name="DashInjurySummary">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import DashCard from './DashCard.vue'
import { chartTheme, GROW_ANIM_MS } from './dashTheme'
import { useCountUp } from './useCountUp'
import { siteLabel } from '@/views/apms/medical/bodySites'

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  big: { type: Boolean, default: false },
  enterDelay: { type: Number, default: 0 }
})

const sites = computed(() => props.data.sites || [])
const recent = computed(() => props.data.recent || [])
const activeText = useCountUp(computed(() => Number(props.data.active || 0)))
const newText = useCountUp(computed(() => Number(props.data.newThisMonth || 0)))
const recoveredText = useCountUp(computed(() => Number(props.data.recovered || 0)))

const siteRef = ref(null)
let chart = null
let ro = null

function fmtDate(d) { return d ? String(d).slice(5, 10) : '' }
function typeLabel(t) { return { injury: '损伤', surgery: '手术' }[t] || '医疗记录' }

/** 部位柱色：按活跃数排名由青 → 红渐变 */
function siteColor(idx) {
  const max = Math.max(sites.value.length - 1, 1)
  const t = Math.min(1, idx / max)
  const lerp = (a, b) => Math.round(a + (b - a) * t)
  return `rgb(${lerp(0x06, 0xdc)}, ${lerp(0xb6, 0x26)}, ${lerp(0xd4, 0x26)})`
}

function render() {
  nextTick(() => {
    if (!siteRef.value || !sites.value.length) return
    if (chart) chart.dispose()
    chart = echarts.init(siteRef.value)
    const t = chartTheme(props.big)
    const rows = sites.value.slice(0, 5)
    chart.setOption({
      tooltip: {
        ...t.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: props.big ? 'rgba(255,255,255,.04)' : 'rgba(37,99,235,.05)' } },
        formatter: (items) => {
          const it = items[0]
          return `部位 · <b>${siteLabel(it.axisValue)}</b><br/>活跃伤病：<b>${it.value}</b> 例`
        }
      },
      grid: { left: 4, right: 28, top: 4, bottom: 4, containLabel: true },
      xAxis: { type: 'value', show: false, minInterval: 1 },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map(r => siteLabel(r.site)),
        axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { ...t.axisLabelDark, fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: rows.map((r, i) => ({
          value: r.active,
          itemStyle: { color: siteColor(i), borderRadius: [0, 6, 6, 0] }
        })),
        barWidth: 13,
        label: {
          show: true, position: 'right', distance: 6,
          fontSize: 11, fontWeight: 700,
          color: props.big ? 'rgba(255,255,255,.8)' : '#475569',
          formatter: '{c}'
        },
        animationDuration: GROW_ANIM_MS,
        animationDelay: (i) => i * 90
      }]
    })
    if (typeof ResizeObserver !== 'undefined') {
      if (!ro) ro = new ResizeObserver(() => chart?.resize())
      ro.observe(siteRef.value)
    }
  })
}

watch(() => [props.data, props.big], render, { deep: true, immediate: true })

onBeforeUnmount(() => {
  if (ro) { ro.disconnect(); ro = null }
  if (chart) { chart.dispose(); chart = null }
})
</script>

<style lang="scss" scoped>
.ij-body { display: flex; flex-direction: column; }
.ij-stats {
  flex: none;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.ij-stat {
  text-align: center;
  padding: 8px 4px 9px;
  background: var(--dbx-bg-soft);
  border-radius: 10px;
}
.ij-num { font-size: 22px; font-weight: 700; line-height: 1.15; }
.ij-num.is-warn { color: #d97706; }
.ij-num.is-risk { color: #dc2626; }
.ij-num.is-ok { color: #16a34a; }
.ij-label { margin-top: 2px; font-size: 11px; color: var(--dbx-sub); }

.ij-chart-wrap { position: relative; margin-top: 10px; height: 132px; }
.ij-chart { width: 100%; height: 100%; }
.ij-chart-empty {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--dbx-sub);
}

.ij-recent {
  flex: none;
  margin: 8px -18px -14px;
  padding: 8px 18px 10px;
  border-top: 1px solid var(--dbx-line);
  display: flex; flex-direction: column; gap: 2px;
}
.ij-rec-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  text-align: left;
}
.ij-rec-text {
  flex: 1; min-width: 0;
  font-size: 12px;
  b { font-weight: 700; color: var(--dbx-text); margin-right: 6px; }
  em { font-style: normal; color: var(--dbx-sub); }
}
.ij-site-chip { flex: none; font-size: 10px; }
.ij-date { flex: none; font-size: 11px; color: var(--dbx-sub); }
.ij-no-recent { margin: 2px 0 4px; font-size: 12px; color: var(--dbx-sub); text-align: center; }

/* 活跃伤病脉冲点（等价 tailwind animate-ping） */
.ij-pulse {
  position: relative; flex: none;
  width: 8px; height: 8px;
}
.ij-pulse::before,
.ij-pulse::after {
  content: ''; position: absolute; inset: 0;
  border-radius: 50%; background: #d97706;
}
.ij-pulse::before {
  animation: ij-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes ij-ping {
  0% { transform: scale(1); opacity: 0.55; }
  75%, 100% { transform: scale(2.4); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ij-pulse::before { animation: none; }
}
</style>
