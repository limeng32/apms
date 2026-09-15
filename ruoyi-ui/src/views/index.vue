<template>
  <div class="apms-dashboard">
    <!-- Hero 区 -->
    <div class="dash-hero">
      <div class="hero-left">
        <h2>{{ greeting }}，{{ userName }}</h2>
        <p>
          {{ todayText }} · 当前赛季
          <span class="hl">{{ stats.athleteCount }} 名队员</span>
          归队，今日有
          <span class="hl">{{ stats.taskInProgress }} 个测试任务</span>
          进行中，
          <span class="hl-amber">{{ stats.rtpAttention }} 名队员</span>
          参训状态需关注。
        </p>
      </div>
      <div class="hero-right">
        <el-button type="primary" class="btn-goals" @click="$router.push('/apms/task')">查看测试看板</el-button>
      </div>
    </div>

    <!-- 统计卡 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="12" :md="6" :lg="6">
        <div class="stat-card stat-green">
          <div class="sc-head">
            <span class="sc-label">在队队员</span>
            <el-icon class="sc-ic"><User/></el-icon>
          </div>
          <div class="sc-num">{{ stats.athleteCount }} <span class="sc-unit">人</span></div>
          <div class="sc-sub">{{ stats.teamBreakdown }}</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6" :lg="6">
        <div class="stat-card stat-blue">
          <div class="sc-head">
            <span class="sc-label">进行中任务</span>
            <el-icon class="sc-ic"><Document/></el-icon>
          </div>
          <div class="sc-num">{{ stats.taskInProgress }} <span class="sc-unit">个</span></div>
          <div class="sc-sub">另有 {{ stats.taskPending }} 待开始 · {{ stats.taskDone }} 已完成</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6" :lg="6">
        <div class="stat-card stat-amber">
          <div class="sc-head">
            <span class="sc-label">限制 / 停训</span>
            <el-icon class="sc-ic"><Warning/></el-icon>
          </div>
          <div class="sc-num">{{ stats.rtpAttention }} <span class="sc-unit">人</span></div>
          <div class="sc-sub">
            <span class="dot-amber">●</span> {{ stats.rtpYellow }} 限制 &nbsp;
            <span class="dot-red">●</span> {{ stats.rtpRed }} 停训
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6" :lg="6">
        <div class="stat-card stat-green2">
          <div class="sc-head">
            <span class="sc-label">本周新测量</span>
            <el-icon class="sc-ic"><TrendCharts/></el-icon>
          </div>
          <div class="sc-num">{{ stats.measureWeek }} <span class="sc-unit">人次</span></div>
          <div class="sc-sub">体态 {{ stats.bodyMeasureWeek }} · PHV {{ stats.phvWeek }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 主区域：任务进度 + RTP -->
    <el-row :gutter="16" class="main-row">
      <el-col :xs="24" :md="14" :lg="15">
        <div class="card">
          <div class="card-h">
            <div class="card-title">测试任务进度 <small>进行中</small></div>
            <el-button text class="btn-link" @click="$router.push('/apms/task')">全部任务 →</el-button>
          </div>
          <div class="card-b">
            <div v-for="t in taskList" :key="t.id" class="task-row">
              <div class="task-head">
                <div class="task-name">{{ t.name }}</div>
                <el-tag :type="taskStatusType(t.status)" size="small" effect="light">{{ t.status }}</el-tag>
              </div>
              <div class="task-bar-wrap">
                <el-progress
                  :percentage="Math.round(t.done / t.total * 100)"
                  :color="taskBarColor(t.bar)"
                  :stroke-width="8"
                  :show-text="false"
                  style="flex:1"
                />
                <span class="task-bar-text">{{ t.done }}/{{ t.total }} 人 · {{ Math.round(t.done / t.total * 100) }}%</span>
              </div>
              <div class="task-sub">{{ t.group }} · {{ t.window }}</div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :md="10" :lg="9">
        <div class="card">
          <div class="card-h">
            <div class="card-title">参训状态总览 <small>RTP</small></div>
            <el-button text class="btn-link" @click="$router.push('/apms/health')">健康与医疗 →</el-button>
          </div>
          <div class="card-b">
            <el-row :gutter="10" class="rtp-row">
              <el-col :span="8">
                <div class="rtp-cell rtp-green-bg">
                  <div class="rtp-num">{{ stats.rtpGreen }}</div>
                  <div class="rtp-label">正常全量</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="rtp-cell rtp-amber-bg">
                  <div class="rtp-num">{{ stats.rtpYellow }}</div>
                  <div class="rtp-label">限制参训</div>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="rtp-cell rtp-red-bg">
                  <div class="rtp-num">{{ stats.rtpRed }}</div>
                  <div class="rtp-label">不建议训练</div>
                </div>
              </el-col>
            </el-row>
            <div class="rtp-attention">
              <div v-for="p in attentionPlayers" :key="p.id" class="player-row">
                <div class="p-avatar" :style="{background: p.color}">{{ p.name.charAt(0) }}</div>
                <div class="p-meta">
                  <div class="p-name">{{ p.name }}</div>
                  <div class="p-sub">#{{ p.no }} · {{ p.pos }}</div>
                </div>
                <span class="rtp-dot" :class="p.rtp"></span>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 快捷入口 -->
    <div class="card quick-card">
      <div class="card-h">
        <div class="card-title">快捷入口</div>
      </div>
      <div class="card-b">
        <el-row :gutter="12">
          <el-col v-for="q in quickLinks" :key="q.path" :xs="12" :sm="12" :md="6" :lg="6">
            <div class="quick-link" @click="$router.push(q.path)">
              <span class="ql-ic" :style="{background: q.bg}"><el-icon><component :is="q.icon"/></el-icon></span>
              <div>
                <div class="ql-t">{{ q.title }}</div>
                <div class="ql-d">{{ q.desc }}</div>
              </div>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
  </div>
</template>

<script setup name="Index">
import { User, Document, Warning, TrendCharts, Aim, DataAnalysis, Files, Setting } from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'

const userStore = useUserStore()
const route = useRoute()

const userName = computed(() => userStore.nickName || userStore.name || '管理员')
const now = new Date()
const hour = now.getHours()
const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
const todayText = `${now.getMonth()+1}月${now.getDate()}日`

// 统计数据（一期静态 mock，后续替换为 /apms/dashboard/stats）
const stats = reactive({
  athleteCount: 12,
  teamBreakdown: 'U18梯队 · U16梯队 · 专项组',
  taskInProgress: 3,
  taskPending: 1,
  taskDone: 5,
  rtpAttention: 4,
  rtpGreen: 8,
  rtpYellow: 3,
  rtpRed: 1,
  measureWeek: 7,
  bodyMeasureWeek: 4,
  phvWeek: 3
})

// 任务列表（mock）
const taskList = reactive([
  { id: 1, name: '冬季体能测试 · U18', status: '进行中', done: 8, total: 12, bar: 'green', group: 'U18梯队', window: '12.10 - 12.20' },
  { id: 2, name: '康复评估专项 · 伤后归队', status: '进行中', done: 3, total: 4, bar: 'amber', group: '康复组', window: '12.15 - 12.22' },
  { id: 3, name: 'CMJ 力量测试 · 全队', status: '进行中', done: 10, total: 12, bar: 'green', group: 'U18+U16', window: '12.18 - 12.20' }
])

// RTP 关注名单（黄/红）
const attentionPlayers = reactive([
  { id: 1, name: '张志远', no: '10', pos: '中场', rtp: 'y', color: '#f0a23a' },
  { id: 2, name: '李铭昊', no: '7',  pos: '前锋', rtp: 'y', color: '#7b9dc9' },
  { id: 3, name: '王浩然', no: '4',  pos: '后卫', rtp: 'r', color: '#c14747' },
  { id: 4, name: '陈嘉宇', no: '23', pos: '门将', rtp: 'y', color: '#5fa080' }
])

// 快捷入口
const quickLinks = [
  { path: '/apms/athlete',  title: '队员数字档案', desc: '一人一档 · 持续数据归集', icon: 'User',          bg: '#e8f3ec' },
  { path: '/apms/phv',      title: '生长发育监控', desc: 'PHV · 预测成年身高',     icon: 'TrendCharts',  bg: '#e8f0fb' },
  { path: '/apms/indicator',title: '指标与任务下发', desc: '勾选指标 · 指定小组窗口', icon: 'Aim',           bg: '#fef4e6' },
  { path: '/apms/report',   title: '综合测试报告', desc: '个人 / 团队 · 导出 PDF', icon: 'Files',         bg: '#f0e8fb' }
]

function taskStatusType(s) {
  return s === '进行中' ? 'success' : s === '已完成' ? 'info' : 'warning'
}
function taskBarColor(bar) {
  return bar === 'amber' ? '#f0a23a' : bar === 'red' ? '#c14747' : '#4a9a78'
}
</script>

<style lang="scss" scoped>
.apms-dashboard {
  padding: 16px 20px 24px;
  background: #f6f8f7;
  min-height: calc(100vh - 84px);
}

/* ============ Hero ============ */
.dash-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  background: linear-gradient(135deg, #1d3b33 0%, #27503f 100%);
  border-radius: 12px;
  color: #fff;
  margin-bottom: 16px;
}
.hero-left h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
}
.hero-left p {
  margin: 0;
  font-size: 13px;
  color: rgba(255,255,255,.78);
  line-height: 1.6;
}
.hl { color: #9edbbf; font-weight: 600; }
.hl-amber { color: #f5c87a; font-weight: 600; }
.btn-goals {
  background: rgba(255,255,255,.12) !important;
  border-color: rgba(255,255,255,.25) !important;
  color: #fff !important;
  backdrop-filter: blur(4px);
  &:hover, &:focus {
    background: rgba(255,255,255,.2) !important;
    border-color: rgba(255,255,255,.35) !important;
  }
}

/* ============ 统计卡 ============ */
.stat-row { margin-bottom: 16px; }
.stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px 18px;
  border: 1px solid #eef2f0;
  transition: box-shadow .2s;
  &:hover {
    box-shadow: 0 4px 14px rgba(0,0,0,.05);
  }
}
.sc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sc-label {
  font-size: 12.5px;
  color: #7a8a83;
}
.sc-ic {
  font-size: 18px;
}
.sc-num {
  font-size: 28px;
  font-weight: 700;
  margin-top: 6px;
  color: #1f2c28;
}
.sc-unit {
  font-size: 13px;
  font-weight: 400;
  color: #7a8a83;
}
.sc-sub {
  font-size: 11.5px;
  color: #8a9a93;
  margin-top: 4px;
}
.stat-green  .sc-ic { color: #4a9a78; }
.stat-blue   .sc-ic { color: #4a78c9; }
.stat-amber  .sc-ic { color: #f0a23a; }
.stat-green2 .sc-ic { color: #4a9a78; }

/* ============ 卡片 ============ */
.main-row { margin-bottom: 16px; }
.card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #eef2f0;
  overflow: hidden;
}
.card-h {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 18px;
  border-bottom: 1px solid #eef2f0;
}
.card-title {
  font-size: 14.5px;
  font-weight: 600;
  color: #1f2c28;
  small {
    font-size: 12px;
    font-weight: 400;
    color: #8a9a93;
    margin-left: 4px;
  }
}
.btn-link {
  color: #2f6b57;
  font-size: 12.5px;
  padding: 0;
  &:hover { color: #3d8a6e; }
}
.card-b {
  padding: 14px 18px;
}

/* ============ 任务进度 ============ */
.task-row {
  padding: 11px 0;
  border-bottom: 1px solid #eef2f0;
  &:last-child { border-bottom: none; }
}
.task-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.task-name {
  font-size: 13.5px;
  font-weight: 600;
  color: #1f2c28;
}
.task-bar-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 9px;
}
.task-bar-text {
  font-size: 12px;
  color: #53655e;
  width: 96px;
  text-align: right;
}
.task-sub {
  font-size: 11.5px;
  color: #8a9a93;
  margin-top: 5px;
}

/* ============ RTP ============ */
.rtp-row { margin-bottom: 14px; }
.rtp-cell {
  border-radius: 10px;
  padding: 13px 0;
  text-align: center;
}
.rtp-num {
  font-size: 24px;
  font-weight: 700;
}
.rtp-label {
  font-size: 11.5px;
  margin-top: 2px;
}
.rtp-green-bg { background: #e8f5ed; .rtp-num { color: #2c8a57; } .rtp-label { color: #3c7a59; } }
.rtp-amber-bg { background: #fdf3e0; .rtp-num { color: #b97a16; } .rtp-label { color: #9a7020; } }
.rtp-red-bg   { background: #fce8e8; .rtp-num { color: #c14747; } .rtp-label { color: #a15050; } }

.dot-amber { color: #f0a23a; }
.dot-red   { color: #c14747; }

.rtp-attention {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.p-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex: none;
}
.p-meta {
  flex: 1;
  min-width: 0;
}
.p-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2c28;
}
.p-sub {
  font-size: 11.5px;
  color: #8a9a93;
}
.rtp-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  &.y { background: #f0a23a; }
  &.r { background: #c14747; }
  &.g { background: #4a9a78; }
}

/* ============ 快捷入口 ============ */
.quick-card { margin-bottom: 0; }
.quick-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #eef2f0;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
  &:hover {
    border-color: #4aa886;
    box-shadow: 0 3px 10px rgba(74, 168, 134, .08);
  }
}
.ql-ic {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex: none;
  font-size: 20px;
  color: #2f6b57;
}
.ql-t {
  font-size: 13.5px;
  font-weight: 600;
  color: #1f2c28;
}
.ql-d {
  font-size: 11.5px;
  color: #8a9a93;
  margin-top: 2px;
}

/* ============ 响应式 ============ */
@media (max-width: 768px) {
  .apms-dashboard { padding: 12px; }
  .dash-hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
    .btn-goals { width: 100%; }
  }
  .stat-card { margin-bottom: 8px; }
}
</style>
