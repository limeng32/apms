<template>
  <div class="app-container rtp-page">

    <!-- 顶部指标条 -->
    <div class="rtp-summary">
      <div class="rtp-sum-cell rtp-green-bg">
        <div class="sum-num">{{ summary.green }}</div>
        <div class="sum-label">🟢 正常参训</div>
      </div>
      <div class="rtp-sum-cell rtp-amber-bg">
        <div class="sum-num">{{ summary.yellow }}</div>
        <div class="sum-label">🟡 限制参训</div>
      </div>
      <div class="rtp-sum-cell rtp-red-bg">
        <div class="sum-num">{{ summary.red }}</div>
        <div class="sum-label">🔴 不建议训练</div>
      </div>
      <div class="rtp-sum-cell rtp-gray-bg">
        <div class="sum-num">{{ summary.notAssessed }}</div>
        <div class="sum-label">⚪ 未评估</div>
      </div>
      <div class="rtp-sum-cell rtp-soft">
        <div class="sum-num">{{ summary.total }}</div>
        <div class="sum-label">全队总人数</div>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 左：RTP 列表 -->
      <el-col :xs="24" :md="14" :lg="14">
        <div class="panel-title">
          <span>RTP 状态管理</span>
          <span class="panel-sub">当前生效 · 点击行查看历史变更</span>
        </div>

        <!-- 筛选 -->
        <el-form :inline="true" :model="filters" class="filter-bar">
          <el-form-item label="状态">
            <el-select v-model="filters.status" placeholder="全部" clearable style="width:130px">
              <el-option v-for="s in statusOpts" :key="s.v" :label="s.label" :value="s.v"/>
            </el-select>
          </el-form-item>
          <el-form-item label="队伍">
            <el-tree-select v-model="filters.deptId" :data="deptOpts" filterable clearable
                            :props="{ label: 'deptName', value: 'deptId' }" style="width:160px"/>
          </el-form-item>
          <el-form-item>
            <el-input v-model="filters.keyword" placeholder="姓名搜索" clearable style="width:140px"/>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="applyFilter">筛选</el-button>
            <el-button icon="Refresh" @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="filteredList" border stripe highlight-current-row
                  v-loading="loading" max-height="560"
                  row-key="athleteId"
                  @row-click="(row) => handleRowClick(row)"
                  :row-class-name="rowClassFn">
          <el-table-column label="#" type="index" width="50" align="center"/>
          <el-table-column label="状态" width="100" align="center">
            <template #default="scope">
              <el-tag :type="statusTag(scope.row.status)" effect="dark" size="small" class="rtp-tag">
                {{ statusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="队员" min-width="140">
            <template #default="scope">
              <div class="athlete-cell">
                <div class="ath-avatar" :style="{ background: avatarColor(scope.row) }">
                  {{ (scope.row.athleteName || '?').charAt(0) }}
                </div>
                <div>
                  <div class="ath-name">{{ scope.row.athleteName || '未评估' }}</div>
                  <div class="ath-sub">{{ scope.row.athleteTeam || '—' }} · #{{ scope.row.athleteId }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="原因/限制" min-width="180">
            <template #default="scope">
              <div class="reason-text">{{ scope.row.reason || '—' }}</div>
              <div v-if="scope.row.trainingLimit" class="limit-text">限制：{{ scope.row.trainingLimit }}</div>
            </template>
          </el-table-column>
          <el-table-column label="下次复检" width="120" align="center">
            <template #default="scope">
              <span v-if="scope.row.nextReviewDate"
                    :class="{ 'overdue': isOverdue(scope.row.nextReviewDate), 'soon': isSoon(scope.row.nextReviewDate) }">
                {{ scope.row.nextReviewDate }}
              </span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="160">
            <template #default="scope">{{ formatDT(scope.row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click.stop="showEditDialog(scope.row)" v-hasPermi="['apms:athlete:edit']">编辑</el-button>
              <el-button link type="danger" icon="Delete" @click.stop="handleClear(scope.row)" v-if="scope.row.status" v-hasPermi="['apms:athlete:edit']">清除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>

      <!-- 右：详情 + 变更时间线 -->
      <el-col :xs="24" :md="10" :lg="10">
        <div class="panel-title">
          <span>RTP 详情</span>
          <span v-if="currentAthlete" class="panel-sub">{{ currentAthlete.athleteName }}</span>
          <span v-else class="panel-sub muted">← 点击左侧队员查看</span>
        </div>

        <div v-if="currentAthlete" class="detail-panel">
          <!-- 当前状态卡 -->
          <div class="current-card" :class="'cur-' + (currentAthlete.status || 'na')">
            <div class="cur-label">当前 RTP 状态</div>
            <div class="cur-status">{{ statusLabel(currentAthlete.status) }}</div>
            <div class="cur-meta">
              <span v-if="currentAthlete.reason">{{ currentAthlete.reason }}</span>
              <span v-if="currentAthlete.trainingLimit" class="cur-limit">限制：{{ currentAthlete.trainingLimit }}</span>
              <span v-if="currentAthlete.nextReviewDate" class="cur-review">下次复检：{{ currentAthlete.nextReviewDate }}</span>
            </div>
            <div class="cur-by">更新人：{{ currentAthlete.updatedBy || '—' }} @ {{ formatDT(currentAthlete.updatedTime) }}</div>
          </div>

          <!-- 快捷操作 -->
          <div class="quick-actions">
            <el-button v-if="currentAthlete.status !== 'g'" type="success" @click="quickSet('g')" v-hasPermi="['apms:athlete:edit']">标记 🟢 正常</el-button>
            <el-button v-if="currentAthlete.status !== 'y'" type="warning" @click="quickSet('y')" v-hasPermi="['apms:athlete:edit']">标记 🟡 限制</el-button>
            <el-button v-if="currentAthlete.status !== 'r'" type="danger" @click="quickSet('r')" v-hasPermi="['apms:athlete:edit']">标记 🔴 停训</el-button>
            <el-button @click="showEditDialog(currentAthlete)" v-hasPermi="['apms:athlete:edit']">详细编辑…</el-button>
          </div>

          <!-- 变更时间线 -->
          <div class="section-title">
            RTP 变更时间线
            <span class="privacy-note">共 {{ logList.length }} 条记录</span>
          </div>
          <el-timeline v-if="logList.length" class="rtp-timeline">
            <el-timeline-item v-for="(log, idx) in logList" :key="log.id"
                              :timestamp="formatDT(log.operateTime)"
                              placement="top"
                              :class="'tl-' + (log.toStatus || 'na')">
              <div class="tl-main">
                <div class="tl-flow">
                  <el-tag v-if="log.fromStatus" :type="statusTag(log.fromStatus)" size="small" effect="plain">
                    {{ statusLabel(log.fromStatus) }}
                  </el-tag>
                  <span class="tl-arrow">→</span>
                  <el-tag :type="statusTag(log.toStatus)" size="small" effect="dark">
                    {{ statusLabel(log.toStatus) }}
                  </el-tag>
                </div>
                <div v-if="log.reason" class="tl-reason">{{ log.reason }}</div>
                <div v-if="log.trainingLimit" class="tl-limit">限制：{{ log.trainingLimit }}</div>
                <div class="tl-operator">操作人：{{ log.operatorName || '—' }}</div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无变更记录"/>
        </div>

        <div v-else class="detail-empty">
          <el-empty description="选择左侧队员查看详情"/>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 编辑弹窗 ========== -->
    <el-dialog :title="editMode === 'new' ? '新增 RTP 评估' : '更新 RTP 状态'" v-model="showEdit" width="520px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="队员">
          <span class="edit-athlete">{{ currentAthlete?.athleteName || '—' }} (ID: {{ editForm.athleteId }})</span>
        </el-form-item>
        <el-form-item label="当前状态" required>
          <el-radio-group v-model="editForm.status">
            <el-radio value="g">🟢 正常参训</el-radio>
            <el-radio value="y">🟡 限制参训</el-radio>
            <el-radio value="r">🔴 不建议训练</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标记原因">
          <el-input v-model="editForm.reason" type="textarea" :rows="2"
                    :placeholder="editForm.status === 'g' ? '康复完成 / 综合评估正常…' : '如：腘绳肌轻度拉伤恢复期'"/>
        </el-form-item>
        <el-form-item v-if="editForm.status !== 'g'" label="训练限制">
          <el-input v-model="editForm.trainingLimit" placeholder="如：限制长距离 / 避免高强度间歇"/>
        </el-form-item>
        <el-form-item label="下次复检">
          <el-date-picker v-model="editForm.nextReviewDate" type="date" value-format="YYYY-MM-DD"
                          placeholder="选择日期" style="width:100%"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsRtp">
import { listStatus, getLog, updateStatus, clearStatus } from '@/api/apms/rtp'
import { listAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'

const { proxy } = getCurrentInstance()

// 字典
const statusOpts = [
  { v: 'g', label: '🟢 正常' },
  { v: 'y', label: '🟡 限制参训' },
  { v: 'r', label: '🔴 停训' }
]
const statusLabel = (s) => s === 'g' ? '正常参训' : s === 'y' ? '限制参训' : s === 'r' ? '不建议训练' : '未评估'
const statusTag   = (s) => s === 'g' ? 'success'  : s === 'y' ? 'warning'      : s === 'r' ? 'danger'     : 'info'

const avatarColors = ['#f0a23a', '#7b9dc9', '#c14747', '#5fa080', '#a878d8', '#d88a3a', '#5f9abf', '#8fbf5f']
function avatarColor(row) {
  const id = row.athleteId || 0
  return avatarColors[id % avatarColors.length]
}

function formatDT(d) { if (!d) return '—'; return String(d).substring(0, 19).replace('T', ' ') }
function isOverdue(d) { return d && new Date(d) < new Date() }
function isSoon(d)    { return d && !isOverdue(d) && (new Date(d) - new Date()) < 14 * 86400000 }

// ========= 数据 =========
const loading = ref(false)
const fullList = ref([])      // 含未评估
const rtpList = ref([])       // 有 RTP 记录的
const allAthletes = ref([])

const summary = reactive({ green: 0, yellow: 0, red: 0, notAssessed: 0, total: 0 })

const filters = reactive({ status: '', deptId: null, keyword: '' })
const deptOpts = ref([])

// 当前选中
const currentAthlete = ref(null)
const logList = ref([])

// ========= 加载 =========
function loadAll() {
  loading.value = true
  Promise.all([
    listStatus(),
    listAthlete({ pageNum: 1, pageSize: 500 }),
    listDept({ pageNum: 1, pageSize: 500 })
  ]).then(([rtpRes, athRes, deptRes]) => {
    const rtpArr = rtpRes.data || []
    const athArr = (athRes.rows || [])
    fullList.value = athArr.map(a => {
      const r = rtpArr.find(x => x.athleteId === a.athleteId)
      return {
        athleteId: a.athleteId,
        athleteName: a.name,
        athleteTeam: (r && r.athleteTeam) || a.primaryTeamName || '—',
        jerseyNo: a.jerseyNo,
        position: a.position,
        status: r ? r.status : null,
        reason: r ? r.reason : null,
        trainingLimit: r ? r.trainingLimit : null,
        nextReviewDate: r ? r.nextReviewDate : null,
        updatedBy: r ? r.updatedBy : null,
        updatedTime: r ? r.updatedTime : null
      }
    })
    allAthletes.value = athArr
    rtpList.value = rtpArr

    // 汇总
    summary.green = rtpArr.filter(r => r.status === 'g').length
    summary.yellow = rtpArr.filter(r => r.status === 'y').length
    summary.red = rtpArr.filter(r => r.status === 'r').length
    summary.notAssessed = athArr.length - rtpArr.length
    summary.total = athArr.length

    deptOpts.value = Array.isArray(deptRes.data) ? deptRes.data : []
    loading.value = false
  })
}

// ========= 筛选 =========
const filteredList = computed(() => {
  const kw = (filters.keyword || '').trim().toLowerCase()
  return fullList.value.filter(row => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.deptId && row._deptId !== filters.deptId) return false
    if (kw && !(row.athleteName || '').toLowerCase().includes(kw)) return false
    return true
  })
})

function applyFilter() {}
function resetFilter() { filters.status = ''; filters.deptId = null; filters.keyword = '' }

function rowClassFn({ row }) {
  if (!row.status) return 'row-na'
  return 'row-' + row.status
}

// ========= 行点击 → 加载历史 =========
function handleRowClick(row) {
  currentAthlete.value = row
  if (row.athleteId) {
    getLog(row.athleteId).then(res => { logList.value = res.data || [] })
  } else {
    logList.value = []
  }
}

// ========= 编辑 =========
const showEdit = ref(false)
const saving = ref(false)
const editMode = ref('update')
const editForm = reactive({ athleteId: null, status: 'g', reason: '', trainingLimit: '', nextReviewDate: null })

function showEditDialog(row) {
  currentAthlete.value = row
  editForm.athleteId = row.athleteId
  editForm.status = row.status || 'g'
  editForm.reason = row.reason || ''
  editForm.trainingLimit = row.trainingLimit || ''
  editForm.nextReviewDate = row.nextReviewDate || null
  showEdit.value = true
}

function quickSet(status) {
  if (!currentAthlete.value) return
  proxy.$prompt('请输入标记原因（可选）', '快速更新 RTP 状态', {
    inputType: 'textarea', inputPlaceholder: '如：康复完成、赛前评估正常…',
    confirmButtonText: '确认更新', cancelButtonText: '取消'
  }).then(({ value: reason }) => {
    saving.value = true
    updateStatus({
      athleteId: currentAthlete.value.athleteId,
      status, reason,
      trainingLimit: status === 'g' ? null : '待补充',
      nextReviewDate: null
    }).then(() => {
      proxy.$modal.msgSuccess('RTP 状态已更新')
      loadAll()
      if (currentAthlete.value) {
        getLog(currentAthlete.value.athleteId).then(res => { logList.value = res.data || [] })
      }
    }).finally(() => saving.value = false)
  }).catch(() => {})
}

function submitEdit() {
  saving.value = true
  updateStatus({
    athleteId: editForm.athleteId,
    status: editForm.status,
    reason: editForm.reason || null,
    trainingLimit: editForm.trainingLimit || null,
    nextReviewDate: editForm.nextReviewDate || null
  }).then(() => {
    proxy.$modal.msgSuccess('RTP 状态已更新')
    showEdit.value = false
    loadAll()
    if (currentAthlete.value) {
      getLog(currentAthlete.value.athleteId).then(res => { logList.value = res.data || [] })
    }
  }).finally(() => saving.value = false)
}

function handleClear(row) {
  proxy.$modal.confirm(`确认清除 ${row.athleteName} 的 RTP 状态？将回到"未评估"。`).then(() => {
    clearStatus(row.athleteId, {}).then(() => {
      proxy.$modal.msgSuccess('已清除')
      loadAll()
      currentAthlete.value = null
      logList.value = []
    })
  }).catch(() => {})
}

loadAll()
</script>

<style scoped>
.rtp-page { padding: 12px 16px; }

/* ========= 顶部汇总条 ========= */
.rtp-summary {
  display: flex; gap: 10px; margin-bottom: 16px;
}
.rtp-sum-cell {
  flex: 1; border-radius: 10px; padding: 14px 16px;
  text-align: center; border: 1px solid #eef2f0;
  background: #fff;
}
.sum-num { font-size: 26px; font-weight: 700; }
.sum-label { font-size: 12px; color: #606266; margin-top: 4px; }
.rtp-green-bg .sum-num { color: #2c8a57; }
.rtp-amber-bg .sum-num { color: #b97a16; }
.rtp-red-bg   .sum-num { color: #c14747; }
.rtp-gray-bg  .sum-num { color: #909399; }
.rtp-soft     .sum-num { color: #1b4332; }
.rtp-green-bg { background: #f0f8f3; border-color: #c8e0d0; }
.rtp-amber-bg { background: #fdf6e6; border-color: #f0d8a0; }
.rtp-red-bg   { background: #fceaea; border-color: #e5b5b5; }
.rtp-gray-bg  { background: #f7f8fa; border-color: #e4e7ed; }
.rtp-soft     { background: #f0f5f2; border-color: #c0d4c7; }

/* ========= 通用 ========= */
.panel-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600; color: #1b4332;
  padding: 0 0 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px;
}
.panel-sub { font-size: 12px; color: #909399; font-weight: 400; }
.panel-sub.muted { color: #c0c4cc; }

.filter-bar { margin-bottom: 10px; }

/* 行样式 */
.athlete-cell { display: flex; align-items: center; gap: 10px; }
.ath-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center; color: #fff;
  font-size: 14px; font-weight: 600; flex: none;
}
.ath-name { font-weight: 500; color: #303133; }
.ath-sub  { font-size: 11.5px; color: #909399; margin-top: 2px; }

.reason-text { font-size: 12.5px; color: #303133; }
.limit-text { font-size: 11.5px; color: #b97a16; margin-top: 3px; }

.muted { color: #c0c4cc; }
.overdue { color: #c14747; font-weight: 600; }
.soon    { color: #b97a16; font-weight: 600; }

:deep(.row-g)   { background: #fafefa; }
:deep(.row-y)   { background: #fffbf2; }
:deep(.row-r)   { background: #fef5f5; }
:deep(.row-na)  { background: #fafafa; }

.rtp-tag { font-weight: 600; letter-spacing: 0.5px; }

/* ========= 详情卡 ========= */
.detail-panel { min-height: 560px; }
.detail-empty { min-height: 560px; display: flex; align-items: center; justify-content: center; }

.current-card {
  border-radius: 10px; padding: 16px 18px; margin-bottom: 14px;
  border: 1px solid #eef2f0;
}
.cur-label { font-size: 12px; color: #7a8a83; }
.cur-status { font-size: 22px; font-weight: 700; margin: 6px 0 10px; }
.cur-meta { font-size: 12.5px; color: #303133; line-height: 1.7; }
.cur-limit { display: block; color: #b97a16; font-weight: 500; }
.cur-review { display: block; color: #53655e; font-size: 11.5px; margin-top: 2px; }
.cur-by { margin-top: 8px; font-size: 11.5px; color: #909399; }

.cur-g  { background: #f0f8f3; border-color: #8bc7a5; }
.cur-g  .cur-status { color: #2c8a57; }
.cur-y  { background: #fdf6e6; border-color: #e6c070; }
.cur-y  .cur-status { color: #b97a16; }
.cur-r  { background: #fceaea; border-color: #d88a8a; }
.cur-r  .cur-status { color: #c14747; }
.cur-na { background: #f5f6f7; border-color: #dcdfe6; }
.cur-na .cur-status { color: #909399; }

.quick-actions {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
}

.section-title {
  font-size: 13px; font-weight: 600; color: #1b4332;
  margin: 14px 0 10px; padding-left: 8px; border-left: 3px solid #1b4332;
  display: flex; align-items: center; gap: 8px;
}
.privacy-note { font-size: 11px; color: #909399; font-weight: 400; margin-left: auto; }

/* ========= 时间线 ========= */
.rtp-timeline { padding-left: 4px; }
.tl-flow { display: flex; align-items: center; gap: 6px; }
.tl-arrow { color: #909399; }
.tl-reason { font-size: 12.5px; color: #303133; margin-top: 4px; }
.tl-limit { font-size: 11.5px; color: #b97a16; margin-top: 2px; }
.tl-operator { font-size: 11px; color: #909399; margin-top: 2px; }

/* ========= 弹窗 ========= */
.edit-athlete { font-weight: 500; color: #1b4332; }
</style>
