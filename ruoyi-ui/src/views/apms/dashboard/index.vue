<template>
  <div class="app-container dashboard">

    <!-- 顶部汇总卡 -->
    <div class="summary-row">
      <div class="sum-card" v-for="(item, idx) in summaryCards" :key="idx" :class="item.cls">
        <div class="sum-icon" :style="{ background: item.iconBg }">
          <el-icon :size="24"><component :is="item.icon"/></el-icon>
        </div>
        <div class="sum-body">
          <div class="sum-num">{{ item.value }}</div>
          <div class="sum-label">{{ item.label }}</div>
        </div>
        <div class="sum-sub" v-if="item.sub">{{ item.sub }}</div>
      </div>
    </div>

    <!-- 队伍分布 -->
    <div class="team-bar" v-if="teamDistKeys.length">
      <span class="team-label">队伍分布：</span>
      <el-tag v-for="k in teamDistKeys" :key="k" class="team-tag" effect="plain">
        {{ k }} · {{ teamDistribution[k] }} 人
      </el-tag>
    </div>

    <!-- 图表区 2×2 -->
    <el-row :gutter="16">

      <!-- 左上：组合分排名 -->
      <el-col :span="14">
        <div class="chart-card">
          <div class="chart-title">组合分 TOP 10 排名</div>
          <div ref="rankingRef" class="chart-box"></div>
          <div v-if="!hasRanking" class="empty-hint">暂无组合评分数据</div>
        </div>
      </el-col>

      <!-- 右上：PHV 成熟度散点 -->
      <el-col :span="10">
        <div class="chart-card">
          <div class="chart-title">PHV 成熟度散点图</div>
          <div ref="phvRef" class="chart-box"></div>
          <div v-if="!hasPhv" class="empty-hint">暂无 PHV 记录</div>
        </div>
      </el-col>

      <!-- 左下：指标雷达（可切换运动员） -->
      <el-col :span="14">
        <div class="chart-card">
          <div class="chart-title-row">
            <span class="chart-title">指标雷达（z_score 归一化）</span>
            <el-select v-model="radarAthleteId" size="small" style="width: 160px" placeholder="选运动员">
              <el-option v-for="a in radarOptions" :key="a.athleteId"
                         :label="a.athleteName + ' · ' + (a.athleteTeam || '')"
                         :value="a.athleteId"/>
            </el-select>
          </div>
          <div ref="radarRef" class="chart-box"></div>
          <div v-if="!hasRadar" class="empty-hint">暂无雷达数据</div>
        </div>
      </el-col>

      <!-- 右下：测试任务完成率 -->
      <el-col :span="10">
        <div class="chart-card">
          <div class="chart-title">测试任务完成率</div>
          <div ref="taskRef" class="chart-box"></div>
          <div v-if="!hasTask" class="empty-hint">暂无测试任务</div>
        </div>
      </el-col>

    </el-row>

    <!-- 状态区 -->
    <div class="status-row" v-if="hasTask">
      <div class="status-title">最近测试任务</div>
      <el-table :data="taskCompletion" border size="small" max-height="220">
        <el-table-column label="#" type="index" width="40"/>
        <el-table-column label="任务名称" prop="taskName" min-width="160"/>
        <el-table-column label="日期" width="110" align="center">
          <template #default="scope">{{ scope.row.startDate || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="scope">
            <el-tag size="small" :type="taskStatusType(scope.row.status)">{{ taskStatusLabel(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="选入队员" width="100" align="center">
          <template #default="scope">
            <b>{{ scope.row.selectedCount || 0 }}</b> / {{ scope.row.athleteCount || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="完成率" width="140" align="center">
          <template #default="scope">
            <el-progress :percentage="taskProgress(scope.row)" :stroke-width="10" :color="progressColor(taskProgress(scope.row))"/>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup name="ApmsDashboard">
import { getOverview } from '@/api/apms/dashboard'
import * as echarts from 'echarts'
import { Trophy, DataAnalysis, Warning, User, DataLine, PieChart } from '@element-plus/icons-vue'

const rankingRef = ref(null)
const phvRef = ref(null)
const radarRef = ref(null)
const taskRef = ref(null)

let rankingChart = null
let phvChart = null
let radarChart = null
let taskChart = null

const summary = reactive({})
const comboScoreRanking = ref([])
const indicatorRadar = ref([])
const phvScatter = ref([])
const taskCompletion = ref([])
const teamDistribution = reactive({})
const radarAthleteId = ref(null)

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

// 汇总卡配置
const summaryCards = computed(function () {
  return [
    { label: '覆盖队员数', value: summary.totalAthletes || 0, sub: '有组合评分', cls: '', icon: User, iconBg: 'linear-gradient(135deg,#667eea,#764ba2)' },
    { label: '队伍数', value: teamDistKeys.value.length, sub: '已 DataScope 隔离', cls: '', icon: PieChart, iconBg: 'linear-gradient(135deg,#f093fb,#f5576c)' },
    { label: '平均组合分', value: summary.avgComboScore || 0, sub: 'sigma 归一化', cls: 'highlight', icon: DataLine, iconBg: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
    { label: '高表现(>=0.5)', value: summary.highPerformer || 0, sub: '领先组', cls: 'success', icon: Trophy, iconBg: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
    { label: '需关注(<=-0.5)', value: summary.needAttention || 0, sub: '短板组', cls: 'warn', icon: Warning, iconBg: 'linear-gradient(135deg,#fa709a,#fee140)' },
    { label: 'PHV 记录', value: summary.phvRecords || 0, sub: '次 PHV 记录', cls: '', icon: DataAnalysis, iconBg: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
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
    if (indicatorRadar.value.length && !radarAthleteId.value) {
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 140, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: '组合分 (sigma)', splitLine: { lineStyle: { color: '#f0f0f0' } } },
      yAxis: { type: 'category', data: names, axisLabel: { fontSize: 12 } },
      series: [{
        type: 'bar',
        data: scores,
        barWidth: '60%',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: function (p) {
            return p.value >= 0
              ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#43e97b' }, { offset: 1, color: '#38f9d7' }
                ])
              : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#fa709a' }, { offset: 1, color: '#fee140' }
                ])
          }
        },
        label: { show: true, position: 'right', formatter: function (p) { return Number(p.value).toFixed(3) } }
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
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          const o = p.data
          let tip = o.name + '<br/>当前年龄: ' + p.value[0] + '<br/>预测 PHV: ' + p.value[1] + ' 岁'
          if (o.offset != null) tip += '<br/>成熟度偏移: ' + o.offset.toFixed(2)
          return tip
        }
      },
      grid: { left: 60, right: 30, top: 40, bottom: 40 },
      xAxis: { type: 'value', name: '当前年龄 (岁)', splitLine: { lineStyle: { color: '#f0f0f0' } } },
      yAxis: { type: 'value', name: '预测 PHV (岁)', splitLine: { lineStyle: { color: '#f0f0f0' } } },
      series: [{
        type: 'scatter',
        data: points,
        symbolSize: 14,
        itemStyle: { color: '#f5576c', shadowBlur: 6, shadowColor: 'rgba(245,87,108,0.4)' },
        label: { show: true, formatter: function (p) { return p.data.name }, position: 'top', fontSize: 10, color: '#606266' }
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
      return t.taskName && t.taskName.length > 12 ? t.taskName.slice(0, 11) + '...' : t.taskName
    })
    const athleteCounts = taskCompletion.value.map(function (t) { return t.athleteCount || 0 })
    const selectedCounts = taskCompletion.value.map(function (t) { return t.selectedCount || 0 })
    taskChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['选入', '参与队员'], top: 4, textStyle: { fontSize: 11 } },
      grid: { left: 30, right: 20, top: 40, bottom: 60 },
      xAxis: { type: 'category', data: taskNames, axisLabel: { rotate: 20, fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
      series: [
        { name: '选入', type: 'bar', data: selectedCounts, barWidth: '35%', itemStyle: { color: '#43e97b', borderRadius: [3, 3, 0, 0] } },
        { name: '参与队员', type: 'bar', data: athleteCounts, barWidth: '35%', itemStyle: { color: '#4facfe', borderRadius: [3, 3, 0, 0] } }
      ]
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
    const dirTag = d.direction === 'LOWER_BETTER' ? 'down' : d.direction === 'HIGHER_BETTER' ? 'up' : '-'
    return 'Ind#' + d.indicatorId + dirTag
  })
  const normalizedValues = dims.map(function (d) { return d.normalized != null ? Number(d.normalized) : 0 })

  radarChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { data: [athlete.athleteName + ' · z_score'], top: 4, textStyle: { fontSize: 11 } },
    radar: {
      indicator: indicatorLabels.map(function (name) { return { name: name, max: 3, min: -2 } }),
      shape: 'polygon',
      splitNumber: 4,
      axisName: { fontSize: 11, color: '#606266' },
      splitLine: { lineStyle: { color: '#e8ecf0' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.3)', 'rgba(240,243,247,0.4)'] } }
    },
    series: [{
      type: 'radar',
      data: [{
        name: athlete.athleteName + ' · z_score',
        value: normalizedValues,
        areaStyle: { color: 'rgba(79,172,254,0.4)' },
        lineStyle: { color: '#4facfe', width: 2 },
        itemStyle: { color: '#4facfe' },
        label: { show: true, formatter: function (p) { return Number(p.value).toFixed(2) }, fontSize: 10, color: '#303133' }
      }]
    }]
  }, true)
}

watch(radarAthleteId, function () { renderRadar() })

function handleResize() {
  if (rankingChart) rankingChart.resize()
  if (phvChart) phvChart.resize()
  if (radarChart) radarChart.resize()
  if (taskChart) taskChart.resize()
}
window.addEventListener('resize', handleResize)

const taskStatusType = function (s) { return s === 'completed' ? 'success' : s === 'in_progress' ? 'warning' : 'info' }
const taskStatusLabel = function (s) {
  if (s === 'completed') return '已完成'
  if (s === 'in_progress') return '进行中'
  if (s === 'pending') return '待执行'
  return s || '-'
}
const taskProgress = function (row) { return row.athleteCount ? Math.round((row.selectedCount || 0) / row.athleteCount * 100) : 0 }
const progressColor = function (p) {
  if (p >= 80) return '#43e97b'
  if (p >= 50) return '#4facfe'
  if (p >= 20) return '#f093fb'
  return '#fa709a'
}

loadData()
</script>

<style scoped>
.dashboard { padding-bottom: 20px; }

.summary-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.sum-card {
  position: relative;
  background: #fff;
  border: 1px solid #eef2f5;
  border-radius: 10px;
  padding: 14px 16px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.15s, box-shadow 0.15s;
  overflow: hidden;
}
.sum-card:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
.sum-card.highlight { border-color: #4facfe; background: linear-gradient(135deg, #f0f9ff, #fff); }
.sum-card.success { border-color: #43e97b; }
.sum-card.warn { border-color: #fee140; }
.sum-icon {
  width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center;
  color: #fff; flex-shrink: 0;
}
.sum-body { flex: 1; min-width: 0; }
.sum-num { font-size: 22px; font-weight: 700; color: #1f2d3d; font-family: 'SF Mono', Menlo, monospace; }
.sum-label { font-size: 12px; color: #7a8a99; margin-top: 2px; }
.sum-sub {
  position: absolute; top: 8px; right: 12px;
  font-size: 11px; color: #909399;
}

.team-bar {
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 14px; background: #fafbfc; border-radius: 8px; border: 1px solid #eef2f5;
}
.team-label { font-size: 12px; color: #606266; font-weight: 500; }
.team-tag { font-size: 12px; }

.chart-card {
  position: relative;
  background: #fff;
  border: 1px solid #eef2f5;
  border-radius: 10px;
  padding: 14px 16px 10px;
  margin-bottom: 14px;
}
.chart-title { font-size: 14px; font-weight: 600; color: #1f2d3d; margin-bottom: 4px; }
.chart-title-row {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;
}
.chart-box { width: 100%; height: 320px; }
.empty-hint {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  color: #c0c4cc; font-size: 13px;
}

.status-row {
  background: #fff; border: 1px solid #eef2f5; border-radius: 10px; padding: 12px 14px 8px;
}
.status-title { font-size: 14px; font-weight: 600; color: #1f2d3d; margin-bottom: 10px; }
</style>
