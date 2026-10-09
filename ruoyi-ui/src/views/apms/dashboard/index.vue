<template>
  <div class="app-container" :class="{ 'is-bigscreen': bigScreen }">
    <div class="rk-dash-page rk-page db-page">

      <!-- 大屏模式球场线纹理 -->
      <div v-if="bigScreen" class="db-pitch" aria-hidden="true"></div>

      <!-- 页头 -->
      <div class="rk-header db-header">
        <div>
          <h1 class="rk-title">{{ bigScreen ? '数据指挥屏' : '数据驾驶舱' }}</h1>
          <p class="rk-subtitle">
            {{ bigScreen ? '青训中心 · 运动表现数据大屏' : '任务进度 · 参训风险 · 伤病与发育监控 · 组合评分分析' }}
          </p>
        </div>
        <div class="rk-header-actions db-header-actions">
          <span v-if="bigScreen" class="db-clock rk-mono">{{ clock }}</span>
          <button type="button" class="db-big-btn" :class="{ 'is-on': bigScreen }" @click="toggleBig">
            <el-icon><Monitor v-if="!bigScreen" /><Sunny v-else /></el-icon>
            {{ bigScreen ? '退出大屏' : '大屏模式' }}
          </button>
        </div>
      </div>

      <!-- ===== 门面 KPI ×5（count-up） ===== -->
      <div class="db-kpi-row">
        <div class="rk-kpi-card db-kpi" v-for="(k, i) in kpiCards" :key="k.label"
             :style="{ animationDelay: i * 70 + 'ms' }">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.display }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 门面行2：风险分布 + 本周任务 ===== -->
      <div class="db-row">
        <div class="db-col-5">
          <DashRtpDonut :dist="rtpDistribution" :big="bigScreen" :enter-delay="40"/>
        </div>
        <div class="db-col-7">
          <DashTaskProgress :block="activeTasks" :big="bigScreen" :enter-delay="110"/>
        </div>
      </div>

      <!-- ===== 门面行3：伤病 + PHV + 健康预警 ===== -->
      <div class="db-row">
        <div class="db-col-4">
          <DashInjurySummary :data="injurySummary" :big="bigScreen" :enter-delay="180"/>
        </div>
        <div class="db-col-4">
          <DashPhvBands :block="phvBands" :big="bigScreen" :enter-delay="250"/>
        </div>
        <div class="db-col-4">
          <DashHealthAlert :data="healthAlerts" :big="bigScreen" :enter-delay="320"/>
        </div>
      </div>

      <!-- ===== 详细分析（可折叠；大屏态默认收起） ===== -->
      <div class="db-detail-bar">
        <button type="button" class="db-detail-toggle" @click="showDetail = !showDetail">
          <el-icon class="db-toggle-ic" :class="{ 'is-open': showDetail }"><ArrowDown /></el-icon>
          详细分析（组合评分 / PHV 散点 / 指标雷达 / 任务完成率）
        </button>
      </div>

      <div v-show="showDetail" class="db-detail">
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
  </div>
</template>

<script setup name="ApmsDashboard">
import { getOverview } from '@/api/apms/dashboard'
import * as echarts from 'echarts'
import { onBeforeUnmount } from 'vue'
import { Monitor, Sunny, ArrowDown } from '@element-plus/icons-vue'
import DashRtpDonut from './components/DashRtpDonut.vue'
import DashTaskProgress from './components/DashTaskProgress.vue'
import DashInjurySummary from './components/DashInjurySummary.vue'
import DashPhvBands from './components/DashPhvBands.vue'
import DashHealthAlert from './components/DashHealthAlert.vue'
import { useCountUp } from './components/useCountUp'

/* ===== 大屏模式（localStorage 记忆）+ 实时时钟 ===== */
const bigScreen = ref(localStorage.getItem('apms-dash-bigscreen') === '1')
const showDetail = ref(!bigScreen.value)
const clock = ref('')
let clockTimer = null
function fmtClock(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function startClock() {
  clock.value = fmtClock(new Date())
  clockTimer = setInterval(() => { clock.value = fmtClock(new Date()) }, 1000)
}
function stopClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
}
function toggleBig() {
  bigScreen.value = !bigScreen.value
  localStorage.setItem('apms-dash-bigscreen', bigScreen.value ? '1' : '0')
  if (bigScreen.value) {
    showDetail.value = false
    startClock()
  } else {
    showDetail.value = true
    stopClock()
    // 详情区由隐藏变可见后，下一帧让所有图表按新尺寸重绘
    nextTick(() => setTimeout(handleResize, 60))
  }
}
if (bigScreen.value) startClock()
onBeforeUnmount(stopClock)

/* ===== 门面区数据 ===== */
const rtpDistribution = ref({ green: 0, yellow: 0, red: 0, none: 0, total: 0, byTeam: [] })
const activeTasks = ref({ list: [], avgProgress: 0 })
const injurySummary = ref({ active: 0, newThisMonth: 0, recovered: 0, sites: [], recent: [] })
const phvBands = ref({ bands: [], windowCount: 0, total: 0 })
const healthAlerts = ref({ total: 0, warning: 0, attention: 0, infoHealth: 0, list: [] })

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

// KPI 卡（门面前 5 指标；数字 count-up）
const kpiAthletesText = useCountUp(computed(() => Number(rtpDistribution.value.total || 0)))
const kpiTaskPctText = useCountUp(computed(() => Number(activeTasks.value.avgProgress || 0)))
const kpiInjuryText = useCountUp(computed(() => Number(injurySummary.value.active || 0)))
const kpiRedText = useCountUp(computed(() => Number(healthAlerts.value.warning || 0)))
const kpiAmberText = useCountUp(computed(() => Number(healthAlerts.value.attention || 0)))

const kpiCards = computed(function () {
  return [
    { label: '在训运动员', value: rtpDistribution.value.total || 0, display: kpiAthletesText.value, unit: '人',
      accent: C.brand, chip: '含未评估 ' + (rtpDistribution.value.none || 0) + ' 人', chipTone: 'tone-info' },
    { label: '本周任务完成率', value: activeTasks.value.avgProgress || 0, display: kpiTaskPctText.value, unit: '%',
      accent: C.cyan, chip: '活跃任务 ' + (activeTasks.value.list?.length || 0) + ' 项', chipTone: '' },
    { label: '活跃伤病', value: injurySummary.value.active || 0, display: kpiInjuryText.value, unit: '例',
      accent: C.warn, chip: '本月新发 ' + (injurySummary.value.newThisMonth || 0) + ' 例', chipTone: 'tone-warn' },
    { label: '建议停训（红）', value: healthAlerts.value.warning || 0, display: kpiRedText.value, unit: '人',
      accent: C.risk, chip: healthAlerts.value.warning ? '需立即处置' : '暂无红警', chipTone: 'tone-risk' },
    { label: '建议限制（黄）', value: healthAlerts.value.attention || 0, display: kpiAmberText.value, unit: '人',
      accent: '#D97706', chip: '当日 ACTIVE 预警', chipTone: 'tone-warn' }
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

    // 门面区 5 个数据块
    rtpDistribution.value = d.rtpDistribution || rtpDistribution.value
    activeTasks.value = d.activeTasks || activeTasks.value
    injurySummary.value = d.injurySummary || injurySummary.value
    phvBands.value = d.phvBands || phvBands.value
    healthAlerts.value = d.healthAlerts || healthAlerts.value

    // 默认雷达选第一个
    if (indicatorRadar.value.length && radarAthleteId.value == null) {
      radarAthleteId.value = indicatorRadar.value[0].athleteId
    }

    // 大屏态详情区隐藏：图表仍初始化（ResizeObserver 在展开时自动 resize）
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

/* ===== 门面区栅格 ===== */
.db-page { position: relative; transition: background-color .3s ease; }
.db-page > * { position: relative; z-index: 1; }
.db-pitch {
  position: absolute; inset: 0; z-index: 0;
  pointer-events: none;
  opacity: .05;
  background-image: url('/pitch-lines.svg');
  background-size: 480px;
}

.db-header-actions { gap: 12px; }
.db-clock {
  font-size: 20px; font-weight: 600;
  color: #22d3ee;
  text-shadow: 0 0 16px rgba(34, 211, 238, .45);
  letter-spacing: 1px;
}
.db-big-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 14px;
  font-size: 12px; font-weight: 600;
  color: $rk-text-2;
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 9px;
  cursor: pointer;
  transition: all .15s ease;
  &:hover { background: #f8fafc; }
  &.is-on {
    color: #22d3ee;
    border-color: rgba(34, 211, 238, .45);
    background: rgba(34, 211, 238, .08);
    box-shadow: 0 0 18px rgba(34, 211, 238, .18);
  }
}

.db-kpi-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.db-kpi {
  opacity: 0;
  animation: db-fade-up .5s ease-out forwards;
}
@keyframes db-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.db-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
@media (min-width: 1280px) {
  .db-kpi-row { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .db-row { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .db-col-5 { grid-column: span 5; }
  .db-col-7 { grid-column: span 7; }
  .db-col-4 { grid-column: span 4; }
}
@media (min-width: 768px) and (max-width: 1279px) {
  .db-kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

/* 详细分析折叠条 */
.db-detail-bar {
  position: relative; z-index: 1;
  display: flex;
  margin: 2px 0 14px;
}
.db-detail-toggle {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px;
  font-size: 13px; font-weight: 600;
  color: $rk-brand-600;
  background: $rk-brand-50;
  border: 1px solid rgba(37, 99, 235, .15);
  border-radius: 999px;
  cursor: pointer;
  &:hover { background: rgba(37, 99, 235, .1); }
}
.db-toggle-ic { transition: transform .25s ease; }
.db-toggle-ic.is-open { transform: rotate(180deg); }
.db-detail { animation: db-fade-up .35s ease-out; }

/* ===== 大屏深色模式 ===== */
.app-container.is-bigscreen { background: #0a1120; }
.db-page.is-bigscreen {
  background: #0a1120;
  .rk-title { color: #fff; }
  .rk-subtitle { color: rgba(255, 255, 255, .5); }
}
.is-bigscreen .rk-kpi-card {
  background: #111b31;
  border-color: rgba(148, 163, 191, .18);
  box-shadow: 0 0 22px rgba(37, 99, 235, .07);
}
.is-bigscreen .rk-kpi-label { color: rgba(255, 255, 255, .55); }
.is-bigscreen .rk-kpi-value { color: #fff; }
.is-bigscreen .db-big-btn {
  background: rgba(255, 255, 255, .05);
  border-color: rgba(148, 163, 191, .3);
  color: rgba(255, 255, 255, .75);
  &:hover { background: rgba(255, 255, 255, .09); }
}
.is-bigscreen .db-detail-toggle {
  color: #22d3ee;
  background: rgba(34, 211, 238, .08);
  border-color: rgba(34, 211, 238, .25);
}

@media (prefers-reduced-motion: reduce) {
  .db-kpi, .db-detail { animation: none; opacity: 1; }
  .db-page { transition: none; }
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
