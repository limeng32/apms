<template>
  <DashCard title="参训风险分布（RTP）" subtitle="红黄绿三态 + 未评估"
            :big="big" :enter-delay="enterDelay" body-class="rtp-body">

    <div v-if="hasData" class="rtp-main">
      <!-- 左：donut -->
      <div class="rtp-donut-wrap">
        <div ref="donutRef" class="rtp-donut-chart"></div>
        <div class="rtp-donut-center">
          <span class="rtp-donut-total rk-mono">{{ totalText }}</span>
          <span class="rtp-donut-label">在训</span>
        </div>
      </div>

      <!-- 右：按队伍堆叠 -->
      <div class="rtp-team-wrap">
        <div ref="teamRef" class="rtp-team-chart"></div>
      </div>
    </div>
    <div v-else class="dbx-empty">暂无 RTP 评估数据</div>

    <div class="rtp-legend">
      <span v-for="m in LEGEND_META" :key="m.key" class="rtp-lg-item">
        <span class="rtp-lg-dot" :style="{ background: m.color }"></span>
        {{ m.label }}
        <b class="rk-mono">{{ dist[m.key] || 0 }}</b>
      </span>
    </div>
  </DashCard>
</template>

<script setup name="DashRtpDonut">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import DashCard from './DashCard.vue'
import { chartTheme, statusColor, tipRightPosition } from './dashTheme'
import { useCountUp } from './useCountUp'

const props = defineProps({
  dist: { type: Object, default: () => ({}) },
  big: { type: Boolean, default: false },
  enterDelay: { type: Number, default: 0 }
})

const LEGEND_META = computed(() => [
  { key: 'green', label: '可参训', color: statusColor('green', props.big) },
  { key: 'yellow', label: '限制参训', color: statusColor('amber', props.big) },
  { key: 'red', label: '停训', color: statusColor('red', props.big) },
  ...(props.dist.none > 0 ? [{ key: 'none', label: '未评估', color: statusColor('none', props.big) }] : [])
])

const hasData = computed(() => Number(props.dist.total || 0) > 0)
// 中心数字独立 count-up，与环形扫描同时播放（不严格逐帧同步）
const totalText = useCountUp(computed(() => Number(props.dist.total || 0)), { duration: 1200 })

const donutRef = ref(null)
const teamRef = ref(null)
let donutChart = null
let teamChart = null
let ro = null
let sweepRaf = 0
let teamRaf = 0

const START_ANGLE = 90 // 12 点位（0 点方向）
const SWEEP_MS = 1200

const reducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 透明占位扇区：补齐"尚未扫到"的角度，保证每帧 value 总和恒等于 total，
 *  否则 ECharts 会把当前帧的值重新归一化到 360°，扫描会失真为各扇区轮流铺满整环 */
function makeGap(value) {
  return {
    key: '__gap', name: '', value,
    silent: true,
    label: { show: false },
    tooltip: { show: false },
    itemStyle: { color: 'transparent', borderColor: 'transparent', borderWidth: 0 }
  }
}

/**
 * 扫描式入场：从 12 点位起，边界顺时针扫一圈（0→360°），
 * 扫过的扇区依次画出，未扫到的角度由透明占位扇区补足；结束帧恢复真实数据。
 */
function playSweep(pieData) {
  cancelAnimationFrame(sweepRaf)
  if (!donutChart) return
  const total = pieData.reduce((s, d) => s + (Number(d.value) || 0), 0)
  if (!total) return
  if (reducedMotion) {
    donutChart.setOption({ series: [{ data: pieData }] })
    return
  }
  const angles = pieData.map(d => (Number(d.value) || 0) / total * 360)
  const t0 = performance.now()
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / SWEEP_MS)
    const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
    const sweep = eased * 360
    let acc = 0
    let visibleTotal = 0
    const animated = pieData.map((d, i) => {
      const a = angles[i]
      let visible
      if (sweep >= acc + a) visible = a
      else if (sweep > acc) visible = sweep - acc
      else visible = 0
      acc += a
      const val = total * visible / 360
      visibleTotal += val
      return { ...d, value: val }
    })
    const gapVal = Math.max(0, total - visibleTotal)
    const data = gapVal > 0.0001 ? animated.concat([makeGap(gapVal)]) : animated
    donutChart.setOption({ series: [{ data }] })
    if (p < 1) {
      sweepRaf = requestAnimationFrame(tick)
    } else {
      // 恢复真实整数数据（用于 tooltip/点击）
      donutChart.setOption({ series: [{ data: pieData }] })
    }
  }
  sweepRaf = requestAnimationFrame(tick)
}

function renderDonut() {
  if (!donutRef.value) return
  cancelAnimationFrame(sweepRaf)
  if (donutChart) donutChart.dispose()
  donutChart = echarts.init(donutRef.value)
  const t = chartTheme(props.big)
  const pieData = [
    { name: '可参训', key: 'green', value: props.dist.green || 0 },
    { name: '限制参训', key: 'yellow', value: props.dist.yellow || 0 },
    { name: '停训', key: 'red', value: props.dist.red || 0 }
  ]
  if (props.dist.none > 0) pieData.push({ name: '未评估', key: 'none', value: props.dist.none })
  // tooltip 始终显示真实值（扫描期间 data.value 是截断的中间值）
  const realByIndex = pieData
  donutChart.setOption({
    tooltip: {
      ...t.tooltip,
      trigger: 'item',
      // 卡片 overflow:hidden 会裁掉跟随鼠标的浮层：挂到 body，并强制显示在指针右侧
      appendToBody: true,
      position: (point, params, dom, rect, size) => tipRightPosition(donutRef.value, point, size),
      formatter: (p) => {
        const real = realByIndex[p.dataIndex] || p.data
        const v = real.value
        return `${real.name}：<b>${v}</b> 人（${props.dist.total ? Math.round(v / props.dist.total * 100) : 0}%）`
      }
    },
    series: [{
      type: 'pie',
      // 入场完全由 rAF 扫描逐帧驱动，关闭 ECharts 内置动画避免补间抖动
      animation: false,
      radius: ['58%', '82%'],
      center: ['50%', '50%'],
      startAngle: START_ANGLE, // 从 12 点位（0 点）起
      clockwise: true,         // 顺时针
      avoidLabelOverlap: true,
      itemStyle: { borderColor: props.big ? '#111B31' : '#fff', borderWidth: props.big ? 2 : 3, borderRadius: 4 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, label: { show: false } },
      data: reducedMotion
        ? pieData
        : pieData.map(d => ({ ...d, value: 0 }))
            .map(d => ({ ...d, itemStyle: { color: statusColor(d.key, props.big) } }))
            // 首帧整环为透明占位，扫描开始后逐帧替换
            .concat([makeGap(pieData.reduce((s, d) => s + (Number(d.value) || 0), 0))])
    }]
  })
  // 扫描式入场：12 点位起顺时针逐扇区画出
  playSweep(pieData.map(d => ({ ...d, itemStyle: { color: statusColor(d.key, props.big) } })))
}

const GAP_SERIES = '__gap'

/** 队伍堆叠条：左→右扫描入场（与 donut 同一节奏），透明尾段占位保证堆叠位置不跳动 */
function playTeamSweep(chart, rows, keys) {
  cancelAnimationFrame(teamRaf)
  if (reducedMotion || rows.length === 0) {
    chart.setOption({
      series: keys.map(key => ({
        name: key, type: 'bar', stack: 'rtp', barWidth: 13,
        data: rows.map(r => r[key] || 0),
        itemStyle: { color: statusColor(key, props.big) }
      })).concat([{
        name: GAP_SERIES, type: 'bar', stack: 'rtp', barWidth: 13,
        silent: true, tooltip: { show: false },
        data: rows.map(() => 0),
        itemStyle: { color: 'transparent' }
      }])
    })
    return
  }
  const t0 = performance.now()
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / SWEEP_MS)
    const eased = 1 - Math.pow(1 - p, 3)
    const seriesData = keys.map(key => rows.map(() => 0))
    const gapData = rows.map(() => 0)
    rows.forEach((r, ri) => {
      const total = r._total
      const boundary = eased * total // 当前扫到的累计值
      let acc = 0
      keys.forEach((key, ki) => {
        const v = r[key] || 0
        let visible
        if (boundary >= acc + v) visible = v
        else if (boundary > acc) visible = boundary - acc
        else visible = 0
        acc += v
        seriesData[ki][ri] = visible
      })
      gapData[ri] = Math.max(0, total - boundary)
    })
    chart.setOption({
      series: keys.map((key, ki) => ({
        name: key, type: 'bar', stack: 'rtp', barWidth: 13,
        data: seriesData[ki],
        itemStyle: { color: statusColor(key, props.big) }
      })).concat([{
        name: GAP_SERIES, type: 'bar', stack: 'rtp', barWidth: 13,
        silent: true, tooltip: { show: false },
        data: gapData,
        itemStyle: { color: 'transparent' }
      }])
    })
    if (p < 1) teamRaf = requestAnimationFrame(tick)
  }
  teamRaf = requestAnimationFrame(tick)
}

function renderTeam() {
  if (!teamRef.value) return
  cancelAnimationFrame(teamRaf)
  if (teamChart) teamChart.dispose()
  teamChart = echarts.init(teamRef.value)
  const t = chartTheme(props.big)
  const keys = ['green', 'yellow', 'red', ...(props.dist.none > 0 ? ['none'] : [])]
  const rows = [...(props.dist.byTeam || [])]
    .map(r => ({ ...r, _total: (r.green || 0) + (r.yellow || 0) + (r.red || 0) + (r.none || 0) }))
    .sort((a, b) => b._total - a._total)
    .slice(0, 6)
  const axisNames = rows.map(r => r.team && r.team.length > 5 ? r.team.slice(0, 5) + '…' : r.team || '未分组')
  // 末段（red 或 none）右端圆角
  const radiusOf = (key) => key === keys[keys.length - 1] ? [0, 6, 6, 0] : [0, 0, 0, 0]
  teamChart.setOption({
    animation: false, // 入场由 rAF 扫描驱动
    tooltip: {
      ...t.tooltip,
      trigger: 'axis',
      appendToBody: true,
      axisPointer: { type: 'shadow', shadowStyle: { color: props.big ? 'rgba(255,255,255,.04)' : 'rgba(37,99,235,.05)' } },
      formatter: (items) => {
        const name = items[0]?.axisValue || ''
        const labels = { green: '可参训', yellow: '限制参训', red: '停训', none: '未评估' }
        return `<b>${name}</b><br/>` + items
          .filter(i => i.seriesName !== GAP_SERIES && i.value > 0.5)
          .map(i => `${i.marker}${labels[i.seriesName] || i.seriesName}：${Math.round(i.value)} 人`).join('<br/>')
      }
    },
    grid: { left: 4, right: 12, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: 'value', show: false, max: Math.max(1, ...rows.map(r => r._total)) },
    yAxis: {
      type: 'category', inverse: true,
      data: axisNames,
      axisTick: { show: false }, axisLine: { show: false },
      axisLabel: { ...t.axisLabelDark, fontSize: 11 }
    },
    series: keys.map(key => ({
      name: key,
      type: 'bar',
      stack: 'rtp',
      barWidth: 13,
      data: rows.map(() => 0),
      itemStyle: { color: statusColor(key, props.big), borderRadius: radiusOf(key) }
    })).concat([{
      name: GAP_SERIES,
      type: 'bar',
      stack: 'rtp',
      barWidth: 13,
      silent: true,
      tooltip: { show: false },
      data: rows.map(r => r._total),
      itemStyle: { color: 'transparent' }
    }])
  })
  playTeamSweep(teamChart, rows, keys)
}

function renderAll() {
  nextTick(() => {
    if (!hasData.value) return
    renderDonut()
    renderTeam()
    if (typeof ResizeObserver !== 'undefined') {
      if (!ro) {
        ro = new ResizeObserver(() => {
          donutChart?.resize()
          teamChart?.resize()
        })
      }
      // observe 幂等：数据异步到达、v-if 渲染后需补挂
      if (donutRef.value) ro.observe(donutRef.value)
      if (teamRef.value) ro.observe(teamRef.value)
    }
  })
}

watch(() => [props.dist, props.big], renderAll, { deep: true, immediate: true })

onBeforeUnmount(() => {
  cancelAnimationFrame(sweepRaf)
  cancelAnimationFrame(teamRaf)
  if (ro) { ro.disconnect(); ro = null }
  if (donutChart) { donutChart.dispose(); donutChart = null }
  if (teamChart) { teamChart.dispose(); teamChart = null }
})
</script>

<style lang="scss" scoped>
.rtp-body { display: flex; flex-direction: column; }
.rtp-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}
.rtp-donut-wrap { position: relative; flex: none; width: 168px; height: 168px; }
.rtp-donut-chart { width: 100%; height: 100%; }
.rtp-donut-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none;
}
.rtp-donut-total {
  font-size: 30px; font-weight: 700; line-height: 1.1;
  color: var(--dbx-text);
}
.rtp-donut-label { margin-top: 2px; font-size: 11px; color: var(--dbx-sub); }
.rtp-team-wrap { flex: 1; min-width: 0; height: 168px; }
.rtp-team-chart { width: 100%; height: 100%; }

.rtp-legend {
  flex: none;
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px;
  margin-top: 8px; padding-top: 10px;
  border-top: 1px solid var(--dbx-line);
}
.rtp-lg-item {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 4px;
  font-size: 12px; color: var(--dbx-text);
  border-radius: 6px;
  b { font-size: 12px; font-weight: 700; }
}
.rtp-lg-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dbx-empty {
  height: 168px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--dbx-sub);
}
@media (max-width: 640px) {
  .rtp-main { flex-direction: column; }
  .rtp-team-wrap { width: 100%; }
}
</style>
