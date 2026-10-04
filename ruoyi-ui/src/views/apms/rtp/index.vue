<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page rtp-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">RTP 状态管理</h1>
          <p class="rk-subtitle">
            全队 {{ summary.total }} 人 · 已评估 {{ summary.green + summary.yellow + summary.red }} 人 ·
            点击卡片查看详情与变更时间线<template v-if="canEdit"> · 拖拽卡片更新状态</template>
          </p>
        </div>
      </div>

      <!-- ===== KPI 卡带（4 张） ===== -->
      <div class="rk-kpi-grid is-4">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit">人</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 筛选（看板列本身即状态维度，只留队伍 + 姓名） ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">队伍</span>
          <select v-model="filters.deptId" class="rk-select rt-select-team">
            <option :value="null">全部队伍</option>
            <option v-for="d in flatDepts" :key="d.deptId" :value="d.deptId">
              {{ '　'.repeat(d.depth) }}{{ d.deptName }}
            </option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">姓名</span>
          <input v-model="filters.keyword" class="rk-input" type="text" placeholder="队员姓名" />
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetFilter">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== RTP 看板（红/黄/绿/灰 四列） ===== -->
      <div v-loading="loading" class="rk-kanban-grid">
        <section
          v-for="col in COLUMNS"
          :key="col.key"
          class="rk-kanban-col"
          :class="[col.tone, { 'is-dragover': dragOverKey === col.key }]"
          @dragover="onDragOver(col.key, $event)"
          @dragenter="onDragOver(col.key, $event)"
          @dragleave="onDragLeave(col.key, $event)"
          @drop="onDrop(col.key, $event)"
        >
          <div class="rk-kanban-head">
            <span class="rk-kanban-dot"></span>
            <span class="rk-kanban-title">{{ col.title }}</span>
            <span class="rk-kanban-count rk-mono">{{ columnList(col.key).length }}</span>
            <span class="rk-kanban-hint" v-if="canEdit">{{ col.hint }}</span>
          </div>
          <div class="rk-kanban-body">
            <div
              v-for="row in columnList(col.key)"
              :key="row.athleteId"
              class="rk-kanban-card"
              :class="{ 'is-dragging': dragId === row.athleteId, 'is-readonly': !canEdit }"
              :draggable="canEdit"
              @dragstart="onDragStart(row, $event)"
              @dragend="onDragEnd"
              @click="openDrawer(row)"
            >
              <div class="rk-kanban-card-top">
                <span class="rk-avatar rt-avatar" :style="{ background: avatarColor(row) }">
                  {{ (row.athleteName || '?').charAt(0) }}
                </span>
                <span class="rk-kanban-card-name">
                  {{ row.athleteName || '未评估' }}
                  <GenderBadge :gender="row.athleteGender" :size="14"/>
                </span>
              </div>
              <div class="rk-kanban-card-sub">{{ row.athleteTeam || '—' }} · #{{ row.athleteId }}</div>
              <template v-if="row.status">
                <div v-if="row.reason" class="rk-kanban-card-reason">{{ row.reason }}</div>
                <div v-if="row.trainingLimit" class="rk-kanban-card-limit">限制：{{ row.trainingLimit }}</div>
                <div class="rk-kanban-card-foot">
                  <span v-if="row.nextReviewDate"
                        :class="{ 'is-overdue': isOverdue(row.nextReviewDate), 'is-soon': isSoon(row.nextReviewDate) }">
                    复检 {{ row.nextReviewDate }}
                  </span>
                  <span v-else>未设复检</span>
                  <span class="rt-card-time rk-mono">{{ (row.updatedTime || '').replace('T', ' ').substring(5, 10) }}</span>
                </div>
              </template>
              <div v-else class="rk-kanban-card-foot">
                <span>尚未评估</span>
              </div>
            </div>
            <div v-if="!loading && columnList(col.key).length === 0" class="rk-kanban-empty">暂无队员</div>
          </div>
        </section>
      </div>

      <!-- ========== 编辑弹窗（原逻辑保留） ========== -->
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

      <!-- ========== RTP 详情抽屉 ========== -->
      <el-drawer v-model="drawer" size="460px" :with-header="false" class="rt-drawer-wrap">
        <div class="rt-drawer" v-if="currentAthlete">
          <!-- 抽屉头：人 -->
          <div class="rt-drawer-head">
            <div class="rt-drawer-title">
              <span class="rk-avatar rt-avatar rt-avatar-lg" :style="{ background: avatarColor(currentAthlete) }">
                {{ (currentAthlete.athleteName || '?').charAt(0) }}
              </span>
              <div class="rt-drawer-id">
                <div class="rt-drawer-name">
                  {{ currentAthlete.athleteName || '未评估' }}
                  <GenderBadge :gender="currentAthlete.athleteGender" :size="16"/>
                  <span class="rk-status-badge" :class="statusTone(currentAthlete.status)">
                    <i class="rk-status-dot"></i>{{ statusLabel(currentAthlete.status) }}
                  </span>
                </div>
                <div class="rt-drawer-sub">
                  {{ currentAthlete.athleteTeam || '无队伍' }} · #{{ currentAthlete.athleteId }}
                </div>
              </div>
            </div>
            <button type="button" class="rt-drawer-close" @click="drawer = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>

          <!-- 当前状态卡 -->
          <div class="rk-rtp-panel" :class="statusTone(currentAthlete.status)">
            <div class="rk-rtp-icon" :class="statusTone(currentAthlete.status)">
              <el-icon><component :is="statusIcon(currentAthlete.status)" /></el-icon>
            </div>
            <div class="rt-panel-main">
              <div class="rk-rtp-label">当前 RTP 状态</div>
              <div class="rk-rtp-value">{{ statusLabel(currentAthlete.status) }}</div>
              <div class="rk-rtp-meta">
                <div v-if="currentAthlete.reason">原因：{{ currentAthlete.reason }}</div>
                <div v-if="currentAthlete.trainingLimit">训练限制：{{ currentAthlete.trainingLimit }}</div>
                <div v-if="currentAthlete.nextReviewDate">
                  下次复检：<span :class="{ 'is-overdue': isOverdue(currentAthlete.nextReviewDate) }">{{ currentAthlete.nextReviewDate }}</span>
                </div>
                <div v-if="!currentAthlete.status">暂无评估记录，可通过下方操作完成首次评估</div>
              </div>
              <div class="rk-rtp-foot">
                更新人：{{ currentAthlete.updatedBy || '—' }} · {{ formatDT(currentAthlete.updatedTime) }}
              </div>
            </div>
          </div>

          <!-- 快捷操作（原逻辑保留） -->
          <div class="rt-quick" v-hasPermi="['apms:athlete:edit']">
            <button v-if="currentAthlete.status !== 'g'" type="button"
                    class="rk-btn rk-btn-sm rt-qg" @click="quickSet('g')">标记 正常参训</button>
            <button v-if="currentAthlete.status !== 'y'" type="button"
                    class="rk-btn rk-btn-sm rt-qy" @click="quickSet('y')">标记 限制参训</button>
            <button v-if="currentAthlete.status !== 'r'" type="button"
                    class="rk-btn rk-btn-sm rt-qr" @click="quickSet('r')">标记 不建议训练</button>
            <button type="button" class="rk-btn rk-btn-sm" @click="showEditDialog(currentAthlete)">详细编辑…</button>
          </div>

          <!-- 变更时间线 -->
          <div class="rt-section-title">
            RTP 变更时间线
            <span class="rt-section-sub">共 {{ logList.length }} 条记录</span>
          </div>
          <el-timeline v-if="logList.length" class="rt-timeline">
            <el-timeline-item v-for="log in logList" :key="log.id"
                              :timestamp="formatDT(log.operateTime)"
                              placement="top"
                              :color="logDotColor(log.toStatus)">
              <div class="tl-main">
                <div class="tl-flow">
                  <span v-if="log.fromStatus" class="rk-status-badge" :class="statusTone(log.fromStatus)">
                    <i class="rk-status-dot"></i>{{ statusLabel(log.fromStatus) }}
                  </span>
                  <span class="tl-arrow">→</span>
                  <span class="rk-status-badge" :class="statusTone(log.toStatus)">
                    <i class="rk-status-dot"></i>{{ statusLabel(log.toStatus) }}
                  </span>
                </div>
                <div v-if="log.reason" class="tl-reason">{{ log.reason }}</div>
                <div v-if="log.trainingLimit" class="tl-limit">限制：{{ log.trainingLimit }}</div>
                <div class="tl-operator">操作人：{{ log.operatorName || '—' }}</div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <div v-else class="rt-tl-empty">暂无变更记录</div>

          <!-- 清除状态（原操作列入口搬入抽屉） -->
          <div class="rt-drawer-foot" v-if="currentAthlete.status" v-hasPermi="['apms:athlete:edit']">
            <button type="button" class="rk-btn rk-btn-sm rk-btn-danger" @click="handleClear(currentAthlete)">
              清除状态（回到未评估）
            </button>
          </div>
        </div>
      </el-drawer>
    </div>
  </div>
</template>

<script setup name="ApmsRtp">
import { listStatus, getLog, updateStatus, clearStatus } from '@/api/apms/rtp'
import { listAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'
import { checkPermi } from '@/utils/permission'
import { Close, RefreshLeft, CircleCheck, Warning, CircleClose, QuestionFilled } from '@element-plus/icons-vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'

const { proxy } = getCurrentInstance()

const canEdit = checkPermi(['apms:athlete:edit'])

// ========= 字典 =========
const COLUMNS = [
  { key: 'r', title: '不建议训练', tone: 'tone-red', hint: '拖入即停训' },
  { key: 'y', title: '限制参训', tone: 'tone-amber', hint: '拖入即限制' },
  { key: 'g', title: '正常参训', tone: 'tone-green', hint: '拖入即正常' },
  { key: 'na', title: '未评估', tone: 'tone-gray', hint: '拖入即清除' }
]
const statusLabel = (s) => s === 'g' ? '正常参训' : s === 'y' ? '限制参训' : s === 'r' ? '不建议训练' : '未评估'
const statusTone  = (s) => s === 'g' ? 'tone-green' : s === 'y' ? 'tone-amber' : s === 'r' ? 'tone-red' : 'tone-gray'
const statusIcon  = (s) => s === 'g' ? CircleCheck : s === 'y' ? Warning : s === 'r' ? CircleClose : QuestionFilled
const logDotColor = (s) => s === 'g' ? '#16A34A' : s === 'y' ? '#D97706' : s === 'r' ? '#DC2626' : '#94A3B8'

const avatarColor = (row) => ageAvatarColor(row.athleteAge)

function formatDT(d) { if (!d) return '—'; return String(d).substring(0, 19).replace('T', ' ') }
function isOverdue(d) { return d && new Date(d) < new Date() }
function isSoon(d)    { return d && !isOverdue(d) && (new Date(d) - new Date()) < 14 * 86400000 }

// ========= 数据 =========
const loading = ref(false)
const fullList = ref([])      // 含未评估（全员）
const allAthletes = ref([])

const summary = reactive({ green: 0, yellow: 0, red: 0, notAssessed: 0, total: 0 })

const filters = reactive({ deptId: null, keyword: '' })
const deptOpts = ref([])

/* 部门树拍平（原生 select 用，缩进体现层级） */
const flatDepts = computed(() => {
  const out = []
  const walk = (nodes, depth) => {
    (nodes || []).forEach(n => {
      out.push({ deptId: n.deptId, deptName: n.deptName, depth })
      if (n.children && n.children.length) walk(n.children, depth + 1)
    })
  }
  walk(deptOpts.value, 0)
  return out
})

const kpiCards = computed(() => [
  { label: '正常参训', value: summary.green, accent: '#16A34A', chip: '可正常参加训练', chipTone: 'tone-ok' },
  { label: '限制参训', value: summary.yellow, accent: '#D97706', chip: '需关注训练安排', chipTone: 'tone-warn' },
  { label: '不建议训练', value: summary.red, accent: '#DC2626', chip: '停训管理中', chipTone: 'tone-risk' },
  { label: '未评估', value: summary.notAssessed, accent: '#94A3B8', chip: '待完成首次评估', chipTone: '' }
])

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
        athleteGender: a.gender,
        athleteAge: a.age,
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

    summary.green = rtpArr.filter(r => r.status === 'g').length
    summary.yellow = rtpArr.filter(r => r.status === 'y').length
    summary.red = rtpArr.filter(r => r.status === 'r').length
    summary.notAssessed = athArr.length - rtpArr.length
    summary.total = athArr.length

    deptOpts.value = Array.isArray(deptRes.data) ? deptRes.data : []
  }).finally(() => { loading.value = false })
}

// ========= 筛选（修复原页 row._deptId 从未赋值导致队伍筛选失效的问题：按队名匹配） =========
const filteredList = computed(() => {
  const kw = (filters.keyword || '').trim().toLowerCase()
  let deptName = null
  if (filters.deptId != null) {
    deptName = flatDepts.value.find(d => d.deptId === filters.deptId)?.deptName ?? null
  }
  return fullList.value.filter(row => {
    if (deptName && row.athleteTeam !== deptName) return false
    if (kw && !(row.athleteName || '').toLowerCase().includes(kw)) return false
    return true
  })
})

function columnList(key) {
  return filteredList.value.filter(r => (r.status || 'na') === key)
}
function resetFilter() { filters.deptId = null; filters.keyword = '' }

// ========= 拖拽（弹确认后落库；清除走 clearStatus，其余走 updateStatus） =========
const dragId = ref(null)
const dragOverKey = ref(null)

function onDragStart(row, ev) {
  if (!canEdit) { ev.preventDefault(); return }
  dragId.value = row.athleteId
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', String(row.athleteId))
  }
}
function onDragEnd() {
  dragId.value = null
  dragOverKey.value = null
}
function onDragOver(key, ev) {
  if (!canEdit || dragId.value == null) return
  ev.preventDefault()
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
  dragOverKey.value = key
}
function onDragLeave(key, ev) {
  // 进入子元素时不清高亮，只有真正离开列才清
  const next = ev.relatedTarget
  if (next && ev.currentTarget && ev.currentTarget.contains(next)) return
  if (dragOverKey.value === key) dragOverKey.value = null
}
function onDrop(key) {
  const athleteId = dragId.value
  onDragEnd()
  if (!canEdit || athleteId == null) return
  const row = fullList.value.find(r => r.athleteId === athleteId)
  if (!row) return
  const fromKey = row.status || 'na'
  if (fromKey === key) return

  const targetLabel = key === 'na' ? '未评估（清除当前状态）' : statusLabel(key)
  proxy.$modal.confirm(`确认将「${row.athleteName}」的 RTP 状态标记为「${targetLabel}」？`)
    .then(() => {
      if (key === 'na') return clearStatus(athleteId, {})
      return updateStatus({
        athleteId,
        status: key,
        reason: null,
        trainingLimit: key === 'g' ? null : '待补充',
        nextReviewDate: null
      })
    })
    .then(() => {
      proxy.$modal.msgSuccess('RTP 状态已更新')
      loadAll()
      if (drawer.value && currentAthlete.value && currentAthlete.value.athleteId === athleteId) {
        getLog(athleteId).then(res => { logList.value = res.data || [] })
      }
    })
    .catch(() => {})
}

// ========= 详情抽屉 =========
const drawer = ref(false)
const currentId = ref(null)
const logList = ref([])

// 用 computed 保持详情在 loadAll 后不陈旧
const currentAthlete = computed(() =>
  currentId.value == null ? null : fullList.value.find(r => r.athleteId === currentId.value) || null
)

function openDrawer(row) {
  currentId.value = row.athleteId
  logList.value = []
  drawer.value = true
  if (row.athleteId) {
    getLog(row.athleteId).then(res => { logList.value = res.data || [] })
  }
}

// ========= 编辑（原逻辑保留） =========
const showEdit = ref(false)
const saving = ref(false)
const editMode = ref('update')
const editForm = reactive({ athleteId: null, status: 'g', reason: '', trainingLimit: '', nextReviewDate: null })

function showEditDialog(row) {
  currentId.value = row.athleteId
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
      getLog(currentAthlete.value.athleteId).then(res => { logList.value = res.data || [] })
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
    if (currentId.value != null) {
      getLog(currentId.value).then(res => { logList.value = res.data || [] })
    }
  }).finally(() => saving.value = false)
}

function handleClear(row) {
  proxy.$modal.confirm(`确认清除 ${row.athleteName} 的 RTP 状态？将回到"未评估"。`).then(() => {
    clearStatus(row.athleteId, {}).then(() => {
      proxy.$modal.msgSuccess('已清除')
      loadAll()
      drawer.value = false
      currentId.value = null
      logList.value = []
    })
  }).catch(() => {})
}

loadAll()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rt-select-team { width: 170px; }
.rt-avatar {
  width: 30px;
  height: 30px;
  font-size: 13px;
}
.rt-card-time { margin-left: auto; color: $rk-text-3; }

/* ===== 抽屉 ===== */
.rt-drawer-wrap :deep(.el-drawer__body) {
  padding: 0;
}
.rt-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 18px 20px 20px;
  overflow-y: auto;
}
.rt-drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid $rk-line;
}
.rt-drawer-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rt-avatar-lg {
  width: 44px;
  height: 44px;
  font-size: 18px;
}
.rt-drawer-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: $rk-text-1;
}
.rk-kanban-card-name { display: inline-flex; align-items: center; gap: 5px; }
.rt-drawer-sub { margin-top: 4px; font-size: 12px; color: $rk-text-3; }
.rt-drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex: none;
  color: $rk-text-3;
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 9px;
  cursor: pointer;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}
.rt-panel-main { min-width: 0; flex: 1; }
.rk-rtp-icon .el-icon { font-size: 24px; }
.is-overdue { color: $rk-risk; font-weight: 600; }

/* ===== 快捷操作 ===== */
.rt-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 4px;
}
.rt-qg { color: $rk-ok; border-color: #b7e4c7; &:hover { background: #e8f7ee; } }
.rt-qy { color: $rk-warn; border-color: #f5d9a8; &:hover { background: #fef3e0; } }
.rt-qr { color: $rk-risk; border-color: #f3c1c1; &:hover { background: #fcebeb; } }

/* ===== 区块标题 / 时间线 ===== */
.rt-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 12px;
  padding-left: 9px;
  border-left: 3px solid $rk-brand-600;
  font-size: 13px;
  font-weight: 600;
  color: $rk-text-1;
}
.rt-section-sub { margin-left: auto; font-size: 11px; font-weight: 400; color: $rk-text-3; }

.rt-timeline { padding-left: 2px; }
.rt-timeline :deep(.el-timeline-item__tail) { border-left-color: $rk-line; }
.rt-timeline :deep(.el-timeline-item__node--normal) { width: 10px; height: 10px; left: 2px; }
.rt-timeline :deep(.el-timeline-item__wrapper) { padding-left: 22px; top: 2px; }
.rt-timeline :deep(.el-timeline-item__timestamp) {
  position: static;
  margin-bottom: 6px;
  font-size: 11px;
  color: $rk-text-3;
}
.tl-flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tl-arrow { color: $rk-text-3; font-size: 12px; }
.tl-reason { margin-top: 5px; font-size: 12.5px; line-height: 18px; color: $rk-text-1; }
.tl-limit { margin-top: 2px; font-size: 12px; color: $rk-warn; }
.tl-operator { margin-top: 3px; font-size: 11px; color: $rk-text-3; }
.rt-tl-empty {
  padding: 24px 0;
  font-size: 12px;
  color: $rk-text-3;
  text-align: center;
}

.rt-drawer-foot {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid $rk-line;
}

/* ===== 弹窗内文字 ===== */
.edit-athlete { font-weight: 500; color: $rk-text-1; }
</style>
