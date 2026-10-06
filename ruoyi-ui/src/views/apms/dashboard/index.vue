<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page">

      <!-- 页头 -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">数据驾驶舱</h1>
          <p class="rk-subtitle">组合评分 · PHV 发育 · 测试任务全队汇总</p>
        </div>
        <div class="rk-header-actions">
          <span class="db-scope-hint">DataScope 数据权限已隔离</span>
        </div>
      </div>

      <!-- KPI 卡带 -->
      <div class="rk-kpi-grid">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- 队伍分布 -->
      <div class="rk-chips-bar" v-if="teamDistKeys.length">
        <span class="rk-chips-bar-label">队伍分布</span>
        <span class="rk-soft-chip" v-for="k in teamDistKeys" :key="k">
          {{ k }} · {{ teamDistribution[k] }} 人
        </span>
      </div>

      <!-- 图表区 2×2 -->
      <div class="rk-chart-grid">

        <!-- 组合分排名 -->
        <div class="rk-chart-card">
          <div class="rk-chart-head">
            <span class="rk-chart-title">组合分 TOP 10 排名</span>
            <span class="rk-chart-sub">sigma 归一化 · 正值领先 / 负值短板</span>
          </div>
          <div class="rk-chart-body">
            <div ref="rankingRef" class="rk-chart-box"></div>
            <div class="rk-chart-empty" v-if="!hasRanking">暂无组合评分数据</div>
          </div>
        </div>

        <!-- PHV 散点 -->
        <div class="rk-chart-card">
          <div class="rk-chart-head">
            <span class="rk-chart-title">PHV 成熟度散点图</span>
            <span class="rk-chart-sub">当前年龄 vs 预测 PHV 年龄</span>
          </div>
          <div class="rk-chart-body">
            <div ref="phvRef" class="rk-chart-box"></div>
            <div class="rk-chart-empty" v-if="!hasPhv">暂无 PHV 记录</div>
          </div>
        </div>

        <!-- 指标雷达 -->
        <div class="rk-chart-card">
          <div class="rk-chart-head">
            <span class="rk-chart-title">指标雷达</span>
            <span class="rk-chart-sub">z_score 归一化</span>
            <div class="rk-chart-actions">
              <el-select v-model="radarAthleteId" class="db-select" size="small" placeholder="选运动员">
                <el-option v-for="a in radarOptions" :key="a.athleteId"
                           :label="a.athleteName + ' · ' + (a.athleteTeam || '')"
                           :value="a.athleteId"/>
              </el-select>
            </div>
          </div>
          <div class="rk-chart-body">
            <div ref="radarRef" class="rk-chart-box"></div>
            <div class="rk-chart-empty" v-if="!hasRadar">暂无雷达数据</div>
          </div>
        </div>

        <!-- 测试任务完成率 -->
        <div class="rk-chart-card">
          <div class="rk-chart-head">
            <span class="rk-chart-title">测试任务完成率</span>
            <span class="rk-chart-sub">选入 / 参与队员</span>
          </div>
          <div class="rk-chart-body">
            <div ref="taskRef" class="rk-chart-box"></div>
            <div class="rk-chart-empty" v-if="!hasTask">暂无测试任务</div>
          </div>
        </div>

      </div>

      <!-- 最近测试任务 -->
      <div class="rk-chart-card" v-if="hasTask">
        <div class="rk-chart-head">
          <span class="rk-chart-title">最近测试任务</span>
          <span class="rk-chart-sub">共 {{ taskCompletion.length }} 项</span>
        </div>
        <div class="rk-table-scroll">
          <table class="rk-table">
            <thead>
              <tr>
                <th class="text-center" style="width:48px">#</th>
                <th>任务名称</th>
                <th class="text-center" style="width:120px">日期</th>
                <th class="text-center" style="width:100px">状态</th>
                <th class="text-center" style="width:110px">选入队员</th>
                <th style="width:220px">完成率</th>
              </tr>
            </thead>
            <tbody>
              <tr class="rk-row" v-for="(row, idx) in taskCompletion" :key="row.taskId">
                <td class="text-center rk-mono rk-dash">{{ idx + 1 }}</td>
                <td class="db-task-name">{{ row.taskName }}</td>
                <td class="text-center rk-mono">{{ fmtDate(row.startDate) }}</td>
                <td class="text-center">
                  <span class="rk-status-badge" :class="taskStatusTone(row.status)">
                    <i class="rk-status-dot"></i>{{ taskStatusLabel(row.status) }}
                  </span>
                </td>
                <td class="text-center rk-mono">
                  <b>{{ row.selectedCount || 0 }}</b> / {{ row.athleteCount || 0 }}
                </td>
                <td>
                  <div class="db-progress-cell">
                    <div class="rk-progress">
                      <div class="rk-progress-bar"
                           :class="'tone-' + progressTone(taskProgress(row))"
                           :style="{ width: taskProgress(row) + '%' }"></div>
                    </div>
                    <span class="db-progress-num rk-mono" :class="'is-' + progressTone(taskProgress(row))">
                      {{ taskProgress(row) }}%
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="ApmsDashboard">
import { getOverview } from '@/api/apms/dashboard'
import * as echarts from 'echarts'
import { onBeforeUnmount } from 'vue'

const rankingRef = ref(null)
const phvRef = ref(null)
const radarRef = ref(null)
const taskRef = ref(null)

let rankingChart = null
let phvChart = null
let radarChart = null
let taskChart = null
let resizeObserver = null

const summary = reactive({})
const comboScoreRanking = ref([])
const indicatorRadar = ref([])
const phvScatter = ref([])
const taskCompletion = ref([])
const teamDistribution = reactive({})
const radarAthleteId = ref(null)

/* ===== demo 驾驶舱图表主题（对齐 chartConsts.ts / theme.ts） ===== */
const C = {
  brand: '#2563EB', brandLight: '#3B82F6',
  cyan: '#06B6D4', violet: '#8B5CF6', indigo: '#6366F1',
  ok: '#16A34A', okLight: '#4ADE80',
  warn: '#D97706', risk: '#DC2626', riskLight: '#F87171',
  slate: '#CBD5E1'
}
const AXIS_LABEL = { fontSize: 11, color: '#94A3B8' }
const SPLIT_LINE = { lineStyle: { color: '#EEF2F7' } }
const DARK_TOOLTIP = {
  backgroundColor: '#0F172A',
  borderWidth: 0,
  padding: [8, 12],
  textStyle: { color: '#fff', fontSize: 12 },
  extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.18);'
}
const LEGEND_TEXT = { fontSize: 11, color: '#64748B' }

const hasRanking = computed(function () { return comboScoreRanking.value.length > 0 })
const hasPhv = computed(function () { return phvScatter.value.length > 0 })
const hasRadar = computed(function () { return indicatorRadar.value.length > 0 && radarAthleteId.value != null })
const hasTask = computed(function () { return taskCompletion.value.length > 0 })

const teamDistKeys = computed(function () { return Object.keys(teamDistribution) })

const radarOptions = computed(function () {
  return indicatorRadar.value.map(function (r) {
    return { athleteId: r.athleteId, athleteName: r.athleteName || ('#' + r.athleteId), athleteTeam: r.athleteTeam || '' }
  })
})

// KPI 卡配置
const kpiCards = computed(function () {
  return [
    { label: '覆盖队员数', value: summary.totalAthletes || 0, unit: '人', accent: C.brand,
      chip: (summary.totalComboScores || 0) + ' 人有组合评分', chipTone: 'tone-info' },
    { label: '队伍数', value: teamDistKeys.value.length, unit: '支', accent: C.cyan,
      chip: '按 DataScope 隔离', chipTone: '' },
    { label: '平均组合分', value: Number(summary.avgComboScore || 0).toFixed(3), accent: C.indigo,
      chip: 'sigma 归一化', chipTone: '' },
    { label: '高表现（≥0.5）', value: summary.highPerformer || 0, unit: '人', accent: C.ok,
      chip: '领先组', chipTone: 'tone-ok' },
    { label: '需关注（≤-0.5）', value: summary.needAttention || 0, unit: '人', accent: C.risk,
      chip: '短板组', chipTone: 'tone-risk' },
    { label: 'PHV 记录', value: summary.phvRecords || 0, unit: '次', accent: C.violet,
      chip: 'Mirwald v2014.1', chipTone: '' }
  ]
})

// ========= 加载数据 =========
function loadData() {
  getOverview().then(function (res) {
    const d = res.data || {}
    Object.assign(summary, d.summary || {})
    comboScoreRanking.value = d.comboScoreRanking || []
    indicatorRadar.value = d.indicatorRadar || []
    phvScatter.value = d.phvScatter || []
    taskCompletion.value = d.taskCompletion || []
    Object.keys(teamDistribution).forEach(function (k) { delete teamDistribution[k] })
    Object.assign(teamDistribution, d.teamDistribution || {})

    // 默认雷达选第一个
    if (indicatorRadar.value.length && radarAthleteId.value == null) {
      radarAthleteId.value = indicatorRadar.value[0].athleteId
    }

    nextTick(function () { initCharts() })
  })
}

function initCharts() {
  // 1. 组合分排名 — 横向柱状图
  if (rankingRef.value) {
    if (rankingChart) rankingChart.dispose()
    rankingChart = echarts.init(rankingRef.value)
    const names = comboScoreRanking.value.map(function (r) { return r.athleteName + ' (#' + r.athleteId + ')' }).reverse()
    const scores = comboScoreRanking.value.map(function (r) { return Number(r.comboScore) }).reverse()
    rankingChart.setOption({
      tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'shadow' } }, DARK_TOOLTIP),
      grid: { left: 120, right: 52, top: 16, bottom: 28 },
      xAxis: { type: 'value', name: 'sigma', nameTextStyle: AXIS_LABEL, axisLabel: AXIS_LABEL, axisLine: { show: false }, axisTick: { show: false }, splitLine: SPLIT_LINE },
      yAxis: { type: 'category', data: names, axisLabel: Object.assign({}, AXIS_LABEL, { fontSize: 12, color: '#475569' }), axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar',
        data: scores,
        barWidth: '55%',
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: function (p) {
            return p.value >= 0
              ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: C.okLight }, { offset: 1, color: C.ok }
                ])
              : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: C.risk }, { offset: 1, color: C.riskLight }
                ])
          }
        },
        label: {
          show: true, position: 'right', distance: 6,
          formatter: function (p) { return Number(p.value).toFixed(3) },
          fontSize: 11, color: '#475569', fontFamily: 'IBM Plex Mono, Noto Sans SC, ui-monospace, Menlo, monospace'
        }
      }]
    })
  }

  // 2. PHV 散点图
  if (phvRef.value) {
    if (phvChart) phvChart.dispose()
    phvChart = echarts.init(phvRef.value)
    const points = phvScatter.value.map(function (r) {
      return {
        name: r.athleteName || ('#' + r.athleteId),
        value: [Number(r.decimalAge), Number(r.predictedPhvAge)],
        offset: r.maturityOffset != null ? Number(r.maturityOffset) : null
      }
    })
    phvChart.setOption({
      tooltip: Object.assign({
        trigger: 'item',
        formatter: function (p) {
          const o = p.data
          let tip = '<b>' + o.name + '</b><br/>当前年龄：' + Number(p.value[0]).toFixed(2)
            + ' 岁<br/>预测 PHV：' + Number(p.value[1]).toFixed(2) + ' 岁'
          if (o.offset != null) tip += '<br/>成熟度偏移：' + o.offset.toFixed(2)
          return tip
        }
      }, DARK_TOOLTIP),
      grid: { left: 56, right: 60, top: 36, bottom: 40 },
      xAxis: { type: 'value', name: '当前年龄（岁）', nameTextStyle: AXIS_LABEL, axisLabel: AXIS_LABEL, axisLine: { show: false }, axisTick: { show: false }, splitLine: SPLIT_LINE },
      yAxis: { type: 'value', name: '预测 PHV（岁）', nameTextStyle: AXIS_LABEL, axisLabel: AXIS_LABEL, axisLine: { show: false }, axisTick: { show: false }, splitLine: SPLIT_LINE },
      labelLayout: { hideOverlap: true },
      series: [{
        type: 'scatter',
        data: points,
        symbolSize: 12,
        itemStyle: { color: C.violet, opacity: .85, shadowBlur: 8, shadowColor: 'rgba(139,92,246,0.35)' },
        label: { show: true, formatter: function (p) { return p.data.name }, position: 'top', distance: 6, fontSize: 10, color: '#64748B' }
      }]
    })
  }

  // 3. 雷达图
  if (radarRef.value) {
    if (radarChart) radarChart.dispose()
    radarChart = echarts.init(radarRef.value)
    renderRadar()
  }

  // 4. 测试任务完成率 — 柱状图
  if (taskRef.value) {
    if (taskChart) taskChart.dispose()
    taskChart = echarts.init(taskRef.value)
    const taskNames = taskCompletion.value.map(function (t) {
      return t.taskName && t.taskName.length > 8 ? t.taskName.slice(0, 7) + '…' : t.taskName
    })
    const athleteCounts = taskCompletion.value.map(function (t) { return t.athleteCount || 0 })
    const selectedCounts = taskCompletion.value.map(function (t) { return t.selectedCount || 0 })
    taskChart.setOption({
      tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(37,99,235,0.05)' } } }, DARK_TOOLTIP),
      legend: { data: ['选入', '参与队员'], top: 0, right: 0, itemWidth: 10, itemHeight: 10, icon: 'roundRect', textStyle: LEGEND_TEXT },
      grid: { left: 36, right: 20, top: 36, bottom: 64 },
      xAxis: { type: 'category', data: taskNames, axisLabel: { rotate: 24, fontSize: 10, color: '#94A3B8', interval: 0 }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: AXIS_LABEL, axisLine: { show: false }, axisTick: { show: false }, splitLine: SPLIT_LINE },
      series: [
        { name: '选入', type: 'bar', data: selectedCounts, barWidth: '28%', itemStyle: { color: C.brand, borderRadius: [4, 4, 0, 0] } },
        { name: '参与队员', type: 'bar', data: athleteCounts, barWidth: '28%', itemStyle: { color: C.slate, borderRadius: [4, 4, 0, 0] } }
      ]
    })
  }

  // 容器尺寸变化（窗口 resize / 侧栏折叠）统一由 ResizeObserver 驱动
  if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize)
    ;[rankingRef, phvRef, radarRef, taskRef].forEach(function (ref) {
      if (ref.value) resizeObserver.observe(ref.value)
    })
  }
}

function renderRadar() {
  if (!radarChart) return
  const athlete = indicatorRadar.value.find(function (r) { return r.athleteId === radarAthleteId.value })
  if (!athlete || !athlete.dimensions || !athlete.dimensions.length) {
    radarChart.clear()
    return
  }
  const dims = athlete.dimensions.filter(function (d) { return d.valid })
  const indicatorLabels = dims.map(function (d) {
    const dirTag = d.direction === 'LOWER_BETTER' ? '↓' : d.direction === 'HIGHER_BETTER' ? '↑' : '−'
    return 'Ind#' + d.indicatorId + ' ' + dirTag
  })
  const normalizedValues = dims.map(function (d) { return d.normalized != null ? Number(d.normalized) : 0 })
  const seriesName = athlete.athleteName + ' · z_score'

  radarChart.setOption({
    tooltip: Object.assign({ trigger: 'item' }, DARK_TOOLTIP),
    legend: { data: [seriesName], top: 0, right: 0, itemWidth: 10, itemHeight: 10, icon: 'roundRect', textStyle: LEGEND_TEXT },
    radar: {
      indicator: indicatorLabels.map(function (name) { return { name: name, max: 3, min: -2 } }),
      shape: 'polygon',
      splitNumber: 5,
      center: ['50%', '54%'],
      radius: '66%',
      axisName: { fontSize: 11, color: '#64748B' },
      splitLine: { lineStyle: { color: '#EEF2F7' } },
      splitArea: { areaStyle: { color: ['#fff', 'rgba(248,250,255,0.7)'] } },
      axisLine: { lineStyle: { color: '#EEF2F7' } }
    },
    series: [{
      type: 'radar',
      data: [{
        name: seriesName,
        value: normalizedValues,
        areaStyle: { color: 'rgba(37,99,235,0.14)' },
        lineStyle: { color: C.brand, width: 2 },
        itemStyle: { color: C.brand },
        symbolSize: 4,
        label: { show: true, formatter: function (p) { return Number(p.value).toFixed(2) }, fontSize: 10, color: '#475569' }
      }]
    }]
  }, true)
}

watch(radarAthleteId, function () { renderRadar() })

/* ===== resize：ResizeObserver 驱动，卸载时断开并销毁实例 ===== */
function handleResize() {
  if (rankingChart) rankingChart.resize()
  if (phvChart) phvChart.resize()
  if (radarChart) radarChart.resize()
  if (taskChart) taskChart.resize()
}
onBeforeUnmount(function () {
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  if (rankingChart) { rankingChart.dispose(); rankingChart = null }
  if (phvChart) { phvChart.dispose(); phvChart = null }
  if (radarChart) { radarChart.dispose(); radarChart = null }
  if (taskChart) { taskChart.dispose(); taskChart = null }
})

/* ===== 任务表辅助 ===== */
const fmtDate = function (t) { return t ? String(t).slice(0, 10) : '−' }
const taskStatusMeta = {
  completed: { tone: 'tone-green', label: '已完成' },
  in_progress: { tone: 'tone-amber', label: '进行中' },
  pending: { tone: 'tone-gray', label: '待执行' }
}
const taskStatusTone = function (s) { return (taskStatusMeta[s] || { tone: 'tone-gray' }).tone }
const taskStatusLabel = function (s) { return (taskStatusMeta[s] || { label: s || '−' }).label }
const taskProgress = function (row) {
  if (!row || !row.athleteCount) return 0
  const p = Math.round((row.selectedCount || 0) / row.athleteCount * 100)
  return Math.max(0, Math.min(100, p))
}
// 进度色：≥80 绿 / ≥50 蓝 / ≥20 黄 / 其余红
const progressTone = function (p) {
  if (p >= 80) return 'ok'
  if (p >= 50) return 'brand'
  if (p >= 20) return 'warn'
  return 'risk'
}

loadData()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.db-scope-hint {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-size: 12px;
  color: $rk-text-3;
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 999px;
}

.db-select {
  width: 200px;
}
.db-select :deep(.el-select__wrapper),
.db-select :deep(.el-input__wrapper) {
  min-height: 30px;
  height: 30px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px $rk-line inset;
  font-size: 12px;
}
.db-select :deep(.el-select__wrapper:hover),
.db-select :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c7cedb inset;
}
.db-select :deep(.el-select__placeholder),
.db-select :deep(.el-select__selected-item) {
  font-size: 12px;
}

.db-task-name {
  font-weight: 600;
  color: $rk-text-1;
}

.db-progress-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.db-progress-cell .rk-progress { flex: 1; min-width: 120px; }
.db-progress-num {
  flex: none;
  width: 42px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: $rk-brand-600;
  &.is-ok { color: $rk-ok; }
  &.is-warn { color: $rk-warn; }
  &.is-risk { color: $rk-risk; }
}

@media (max-width: 720px) {
  .db-select { width: 150px; }
}
</style>
