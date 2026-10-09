<template>
  <section class="rw-panel">
    <div class="ha-section-head">
      <h2 class="ha-section-title">RTP 风险预警</h2>
      <p class="ha-section-sub">
        每日 07:00 自动扫描 · 健康风险（建议红/黄）与流程待办（复检逾期/临近）分开呈现 ·
        系统只给建议，红黄绿由康复师人工确认
      </p>
      <el-button type="primary" class="rk-btn rk-btn-primary ha-scan-btn" :loading="scanning"
                 @click="handleScan" v-hasPermi="['apms:rtpRisk:scan']">
        <el-icon><Aim /></el-icon>立即扫描
      </el-button>
    </div>

    <!-- ===== KPI 卡带（5 张） ===== -->
    <div class="rk-kpi-grid is-5">
      <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label"
           :class="{ 'is-active': filters.level === k.level && !filters.overdueOnly }"
           @click="pickLevel(k.level)">
        <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
        <div class="rk-kpi-label">{{ k.label }}</div>
        <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit">条</span></div>
        <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
      </div>
    </div>

    <!-- ===== 筛选 ===== -->
    <div class="rk-filter rw-filter">
      <label class="rk-group">
        <span class="rk-label">建议级别</span>
        <select v-model="filters.level" class="rk-input rw-select">
          <option value="">全部级别</option>
          <option value="WARNING">建议停训（红）</option>
          <option value="ATTENTION">建议限制（黄）</option>
          <option value="INFO_HEALTH">健康关注（INFO）</option>
          <option value="PROCESS">流程提醒（不计健康分）</option>
        </select>
      </label>
      <label class="rk-group">
        <span class="rk-label">状态</span>
        <select v-model="filters.statusTab" class="rk-input rw-select">
          <option value="ACTIVE">待处理</option>
          <option value="HANDLED">已处理</option>
        </select>
      </label>
      <label class="rk-group">
        <span class="rk-label">队伍</span>
        <select v-model="filters.deptId" class="rk-select rw-select-team">
          <option :value="null">全部队伍</option>
          <option v-for="d in flatDepts" :key="d.deptId" :value="d.deptId">
            {{ '　'.repeat(d.depth) }}{{ d.deptName }}
          </option>
        </select>
      </label>
      <label class="rk-group">
        <span class="rk-label">姓名</span>
        <input v-model="filters.keyword" class="rk-input" type="text" placeholder="队员姓名"
               @keyup.enter="reloadFirst"/>
      </label>
      <label class="rw-switch-group">
        <input type="checkbox" v-model="filters.overdueOnly" class="rw-switch"/>
        <span>仅看复检逾期</span>
      </label>
      <div class="rk-filter-right">
        <button type="button" class="rk-btn-reset" @click="resetFilter">
          <el-icon><RefreshLeft /></el-icon>重置
        </button>
      </div>
    </div>

    <!-- ===== 待办表 ===== -->
    <div v-loading="loading" class="rk-table-card">
      <div class="rk-table-scroll">
        <table class="rk-table rw-table">
          <thead>
            <tr>
              <th>队员</th>
              <th class="text-center col-level">级别</th>
              <th class="text-center col-score">健康分</th>
              <th>触发因子</th>
              <th class="text-center col-date">快照日期</th>
              <th class="text-center col-status">状态</th>
              <th class="text-right col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="row.id" class="rk-row"
                :class="{ 'is-zebra': idx % 2 === 1 }" @click="openDrawer(row)">
              <td>
                <div class="rk-person">
                  <span class="rk-avatar rw-avatar" :style="{ background: avatarColor(row) }">
                    {{ (row.athleteName || '?').charAt(0) }}
                  </span>
                  <div class="rk-person-meta">
                    <span class="rk-person-main">
                      {{ row.athleteName || '—' }}
                      <GenderBadge :gender="row.athleteGender" :size="14"/>
                    </span>
                    <span class="rk-person-sub">{{ row.athleteTeam || '无队伍' }} · #{{ row.athleteId }}</span>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <span class="rw-level-badge" :class="levelBadgeClass(row)">
                  <el-icon v-if="row.processOnly === '1'" class="rw-badge-ic"><Clock /></el-icon>
                  <i v-else class="rk-status-dot"></i>{{ levelLabel(row) }}
                </span>
                <div v-if="overdueDays(row) != null" class="rw-overdue-sub">逾期 {{ overdueDays(row) }} 天</div>
              </td>
              <td class="text-center rk-mono">
                <span :class="{ 'rw-score-zero': row.processOnly === '1' }">
                  {{ row.processOnly === '1' ? '—' : Number(row.riskScore).toFixed(1) }}
                </span>
              </td>
              <td>
                <div class="rw-chips">
                  <span v-for="f in (row.factorList || [])" :key="f.code"
                        class="rw-factor-chip" :class="f.kind === 'PROCESS' ? 'is-process' : 'is-health'">
                    {{ f.title }}
                  </span>
                </div>
              </td>
              <td class="text-center rk-mono">{{ row.snapshotDate }}</td>
              <td class="text-center">
                <span class="rk-soft-chip" :class="statusChipClass(row.status)">{{ statusLabel(row.status) }}</span>
              </td>
              <td class="text-right" @click.stop>
                <div class="rk-actions">
                  <button type="button" class="rk-link" @click="openDrawer(row)">查看/处置</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && rows.length === 0" class="rk-empty">
          <p class="rk-empty-title">暂无{{ filters.statusTab === 'ACTIVE' ? '待处理' : '已处理' }}预警</p>
          <p class="rk-empty-desc">系统每日自动扫描，也可点右上角「立即扫描」即时生成</p>
        </div>
      </div>

      <pagination v-show="total > 0" :total="total"
                  v-model:page="query.pageNum" v-model:limit="query.pageSize"
                  @pagination="loadList"/>
    </div>

    <!-- ========== 因子详情抽屉 ========== -->
    <el-drawer v-model="drawer" size="500px" :with-header="false" class="rw-drawer-wrap" :style="drawerPanelStyle">
      <div class="rw-drawer" v-if="current">
        <div class="rw-drawer-head">
          <div class="rw-drawer-title">
            <span class="rk-avatar rw-avatar-lg" :style="{ background: avatarColor(current) }">
              {{ (current.athleteName || '?').charAt(0) }}
            </span>
            <div>
              <div class="rw-drawer-name">
                {{ current.athleteName || '—' }}
                <GenderBadge :gender="current.athleteGender" :size="15"/>
              </div>
              <div class="rw-drawer-sub">{{ current.athleteTeam || '无队伍' }} · #{{ current.athleteId }} · {{ current.snapshotDate }}</div>
            </div>
          </div>
          <button type="button" class="rt-drawer-close" @click="drawer = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>

        <!-- 系统建议 -->
        <div class="rw-suggest-panel" :class="panelTone(current)">
          <div class="rw-suggest-label">系统建议（供参考，不自动改变 RTP 状态）</div>
          <div class="rw-suggest-main">
            <span class="rw-level-badge lg" :class="levelBadgeClass(current)">
              <el-icon v-if="current.processOnly === '1'" class="rw-badge-ic"><Clock /></el-icon>
              <i v-else class="rk-status-dot"></i>{{ levelLabel(current) }}
            </span>
            <span class="rw-suggest-score">健康分
              <b>{{ current.processOnly === '1' ? '0（纯流程待办）' : Number(current.riskScore).toFixed(1) }}</b>
            </span>
          </div>
          <div class="rw-suggest-rtp" v-if="canAccept(current)">
            采纳将写入 <b :class="current.suggestedLevel === 'WARNING' ? 'txt-red' : 'txt-amber'">
              {{ current.suggestedLevel === 'WARNING' ? '红 · 不建议训练' : '黄 · 限制参训' }}</b>
            <span v-if="currentStatus" class="rw-current-rtp">；当前：{{ rtpStatusLabel(currentStatus.status) }}</span>
          </div>
        </div>

        <!-- 因子明细 -->
        <div class="rw-section-title">
          触发因子（{{ (current.factorList || []).length }}）
          <span class="rw-section-sub">HEALTH 计健康分 · PROCESS 仅排序</span>
        </div>
        <div class="rw-factor-list">
          <div v-for="f in (current.factorList || [])" :key="f.code"
               class="rw-factor-card" :class="f.kind === 'PROCESS' ? 'is-process' : 'is-health'">
            <div class="rw-factor-head">
              <span class="rw-factor-kind" :class="f.kind === 'PROCESS' ? 'is-process' : 'is-health'">
                {{ f.kind === 'PROCESS' ? '流程' : '健康' }}
              </span>
              <span class="rw-factor-title">{{ f.title }}</span>
              <span class="rw-factor-meta">
                <template v-if="f.kind === 'HEALTH'">严重度 {{ f.severity }}</template>
                紧迫 {{ f.urgency }}
              </span>
            </div>
            <div class="rw-factor-detail">{{ f.detail }}</div>
          </div>
        </div>

        <!-- 已处理留痕 -->
        <div v-if="current.status !== 'ACTIVE'" class="rw-handled">
          <span class="rk-soft-chip" :class="statusChipClass(current.status)">{{ statusLabel(current.status) }}</span>
          {{ current.handledBy || '—' }} · {{ formatDT(current.handledTime) }}
          <span v-if="current.handleRemark"> · {{ current.handleRemark }}</span>
        </div>

        <!-- 底部操作 -->
        <div class="rw-drawer-foot" v-if="current.status === 'ACTIVE'">
          <template v-if="current.suggestedLevel === 'INFO'">
            <button type="button" class="rk-btn rk-btn-sm" :loading="acting"
                    @click="handleAck" v-hasPermi="['apms:rtpRisk:handle']">已知悉</button>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-danger" :loading="acting"
                    @click="handleDismiss" v-hasPermi="['apms:rtpRisk:handle']">忽略</button>
          </template>
          <template v-else>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" :loading="acting"
                    :disabled="stricterCurrent" :title="stricterCurrent ? '当前为更严格状态，无需下调' : ''"
                    v-if="canAccept(current) && checkRtpEdit"
                    @click="openAcceptDialog">采纳并更新 RTP</button>
            <span v-if="canAccept(current) && !checkRtpEdit" class="rw-perm-tip">需同时具备风险处置与 RTP 评估权限</span>
            <span v-if="stricterCurrent" class="rw-perm-tip">当前为更严格状态（{{ rtpStatusLabel(currentStatus.status) }}），无需下调</span>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-danger" :loading="acting"
                    @click="handleDismiss" v-hasPermi="['apms:rtpRisk:handle']">忽略</button>
          </template>
        </div>
      </div>
    </el-drawer>

    <!-- ========== 采纳并更新 RTP 弹窗（单次 HTTP，无 green） ========== -->
    <el-dialog :title="'采纳建议并更新 RTP · ' + (current?.athleteName || '')"
               v-model="acceptDialog" width="520px">
      <el-form :model="acceptForm" label-width="100px">
        <el-form-item label="写入状态">
          <span class="rw-accept-target" :class="acceptForm.status === 'r' ? 'txt-red' : 'txt-amber'">
            {{ acceptForm.status === 'r' ? '🔴 不建议训练' : '🟡 限制参训' }}
          </span>
          <span class="rw-accept-note">（由本次建议级别确定；green 需在 RTP 模块主动评估）</span>
        </el-form-item>
        <el-form-item label="标记原因">
          <el-input v-model="acceptForm.reason" type="textarea" :rows="2"
                    placeholder="如：术后未复查，建议停训就医评估"/>
        </el-form-item>
        <el-form-item label="训练限制">
          <el-input v-model="acceptForm.trainingLimit" placeholder="如：停训 / 避免高强度对抗"/>
        </el-form-item>
        <el-form-item label="下次复检">
          <el-date-picker v-model="acceptForm.nextReviewDate" type="date" value-format="YYYY-MM-DD"
                          placeholder="选择日期" style="width:100%"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="acceptDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitAccept">确认采纳（单次提交）</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup name="RtpWarningPanel">
import { listRisk, statRisk, getRisk, ackRisk, dismissRisk, acceptRisk, scanAll } from '@/api/apms/rtpRisk'
import { getStatus as getRtpStatus } from '@/api/apms/rtp'
import { listDept } from '@/api/system/dept'
import { checkPermi } from '@/utils/permission'
import { Close, RefreshLeft, Aim, Clock } from '@element-plus/icons-vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'
import { useDrawerOffset } from '@/utils/drawerOffset'

const emit = defineEmits(['accepted'])

const { proxy } = getCurrentInstance()

const { drawerPanelStyle } = useDrawerOffset()

const checkRtpEdit = checkPermi(['apms:rtpRisk:handle']) && checkPermi(['apms:rtp:edit'])

// ========= 展示字典 =========
function levelLabel(row) {
  if (!row) return '—'
  if (row.processOnly === '1') return '流程提醒'
  if (row.suggestedLevel === 'WARNING') return '建议停训'
  if (row.suggestedLevel === 'ATTENTION') return '建议限制'
  return '健康关注'
}
function levelBadgeClass(row) {
  if (row.processOnly === '1') return 'rw-badge-process'
  if (row.suggestedLevel === 'WARNING') return 'tone-red'
  if (row.suggestedLevel === 'ATTENTION') return 'tone-amber'
  return 'rw-badge-info'
}
function panelTone(row) {
  if (row.processOnly === '1') return 'is-process'
  if (row.suggestedLevel === 'WARNING') return 'is-red'
  if (row.suggestedLevel === 'ATTENTION') return 'is-amber'
  return 'is-info'
}
function statusLabel(s) {
  return { ACTIVE: '待处理', ACKED: '已知悉', ACCEPTED: '已采纳', DISMISSED: '已忽略', EXPIRED: '已过期' }[s] || s
}
function statusChipClass(s) {
  if (s === 'ACCEPTED') return 'rw-chip-green'
  if (s === 'ACTIVE') return 'rw-chip-blue'
  return ''
}
function rtpStatusLabel(s) {
  return s === 'g' ? '正常参训' : s === 'y' ? '限制参训' : s === 'r' ? '不建议训练' : '未评估'
}
function avatarColor(row) { return ageAvatarColor(row.athleteAge) }
function formatDT(d) { return d ? String(d).substring(0, 19).replace('T', ' ') : '—' }
function overdueDays(row) {
  const f = (row.factorList || []).find(x => x.code === 'REVIEW_OVERDUE')
  return f ? f.refData?.daysOverdue : null
}

// ========= 数据 =========
const loading = ref(false)
const scanning = ref(false)
const acting = ref(false)
const rows = ref([])
const total = ref(0)
const stats = reactive({ total: 0, warning: 0, attention: 0, infoHealth: 0, processOnly: 0 })

const query = reactive({ pageNum: 1, pageSize: 10 })
const filters = reactive({ level: '', statusTab: 'ACTIVE', deptId: null, keyword: '', overdueOnly: false })
const deptOpts = ref([])

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
  { label: '待处理总数', value: stats.total, accent: '#2563EB', chip: '当日 ACTIVE', chipTone: '', level: '' },
  { label: '建议停训（红）', value: stats.warning, accent: '#DC2626', chip: 'WARNING', chipTone: 'tone-risk', level: 'WARNING' },
  { label: '建议限制（黄）', value: stats.attention, accent: '#D97706', chip: 'ATTENTION', chipTone: 'tone-warn', level: 'ATTENTION' },
  { label: '健康关注', value: stats.infoHealth, accent: '#2563EB', chip: 'INFO', chipTone: 'tone-ok', level: 'INFO_HEALTH' },
  { label: '流程提醒', value: stats.processOnly, accent: '#64748B', chip: '复检逾期/临近', chipTone: '', level: 'PROCESS' }
])

function buildParams() {
  const p = { pageNum: query.pageNum, pageSize: query.pageSize }
  if (filters.deptId != null) p.deptId = filters.deptId
  if (filters.keyword.trim()) p.keyword = filters.keyword.trim()
  if (filters.statusTab === 'ACTIVE') p.status = 'ACTIVE'
  else p.status = 'ACKED,ACCEPTED,DISMISSED'
  if (filters.level === 'WARNING' || filters.level === 'ATTENTION') p.suggestedLevel = filters.level
  else if (filters.level === 'INFO_HEALTH') { p.suggestedLevel = 'INFO'; p.processOnly = '0' }
  else if (filters.level === 'PROCESS') p.processOnly = '1'
  if (filters.overdueOnly) p.processFlag = 'REVIEW_OVERDUE'
  return p
}

function loadList() {
  loading.value = true
  listRisk(buildParams()).then(res => {
    rows.value = res.rows || []
    total.value = res.total || 0
  }).finally(() => { loading.value = false })
}

function loadStat() {
  const p = {}
  if (filters.deptId != null) p.deptId = filters.deptId
  if (filters.keyword.trim()) p.keyword = filters.keyword.trim()
  statRisk(p).then(res => {
    Object.assign(stats, res.data || {})
  })
}

function reloadFirst() { query.pageNum = 1; loadList(); loadStat() }

function resetFilter() {
  filters.level = ''
  filters.statusTab = 'ACTIVE'
  filters.deptId = null
  filters.keyword = ''
  filters.overdueOnly = false
  reloadFirst()
}

function pickLevel(level) {
  filters.level = (filters.level === level && !filters.overdueOnly) ? '' : level
  filters.statusTab = 'ACTIVE'
  reloadFirst()
}

watch(() => [filters.level, filters.statusTab, filters.deptId, filters.overdueOnly], reloadFirst)

function handleScan() {
  proxy.$modal.confirm('立即对全部在训运动员执行一次风险扫描？将生成/刷新当日快照。').then(() => {
    scanning.value = true
    scanAll().then(res => {
      const s = res.data || {}
      proxy.$modal.msgSuccess(`扫描完成：共 ${s.total ?? 0} 人，${s.withRisk ?? 0} 人存在风险/待办`)
      query.pageNum = 1
      loadList()
      loadStat()
    }).finally(() => { scanning.value = false })
  }).catch(() => {})
}

// ========= 抽屉与处置 =========
const drawer = ref(false)
const current = ref(null)
const currentStatus = ref(null)

function canAccept(row) {
  return row && (row.suggestedLevel === 'ATTENTION' || row.suggestedLevel === 'WARNING')
}
const stricterCurrent = computed(() => {
  if (!canAccept(current.value) || !currentStatus.value) return false
  const rank = { r: 3, y: 2, g: 1 }
  const target = current.value.suggestedLevel === 'WARNING' ? 'r' : 'y'
  return (rank[currentStatus.value.status] || 0) > rank[target]
})

function openDrawer(row) {
  current.value = row
  currentStatus.value = null
  drawer.value = true
  // 拉取最新明细（因子留痕）+ 当前 RTP（不降级判断）
  getRisk(row.id).then(res => { current.value = res.data || row })
  if (canAccept(row) && checkRtpEdit) {
    getRtpStatus(row.athleteId).then(res => { currentStatus.value = res.data || null }).catch(() => {})
  }
}

function refreshAfterAction() {
  loadList()
  loadStat()
}

function handleAck() {
  proxy.$prompt('可补充备注（可选）', '标记已知悉', {
    inputType: 'textarea', inputPlaceholder: '如：已线下提醒队员按时复检',
    confirmButtonText: '确认', cancelButtonText: '取消'
  }).then(({ value }) => {
    acting.value = true
    ackRisk(current.value.id, value || null).then(() => {
      proxy.$modal.msgSuccess('已标记知悉')
      drawer.value = false
      refreshAfterAction()
    }).finally(() => { acting.value = false })
  }).catch(() => {})
}

function handleDismiss() {
  proxy.$prompt('请填写忽略理由（必填）', '忽略该预警', {
    inputType: 'textarea', inputPlaceholder: '如：伤病已在其他机构闭环，系统未采集到复查记录',
    confirmButtonText: '确认忽略', cancelButtonText: '取消'
  }).then(({ value }) => {
    if (!value || !value.trim()) {
      proxy.$modal.msgError('忽略必须填写理由')
      return
    }
    acting.value = true
    dismissRisk(current.value.id, value.trim()).then(() => {
      proxy.$modal.msgSuccess('已忽略')
      drawer.value = false
      refreshAfterAction()
    }).finally(() => { acting.value = false })
  }).catch(() => {})
}

// ========= 采纳（单接口单事务） =========
const acceptDialog = ref(false)
const saving = ref(false)
const acceptForm = reactive({ status: 'y', reason: '', trainingLimit: '', nextReviewDate: null })

function openAcceptDialog() {
  const row = current.value
  acceptForm.status = row.suggestedLevel === 'WARNING' ? 'r' : 'y'
  acceptForm.reason = '风险预警采纳：' + (row.factorList || []).map(f => f.title).join('；')
  acceptForm.trainingLimit = acceptForm.status === 'r' ? '建议停训，就医评估' : '限制参训，避免高强度'
  acceptForm.nextReviewDate = null
  acceptDialog.value = true
}

function submitAccept() {
  saving.value = true
  acceptRisk(current.value.id, {
    status: acceptForm.status,
    reason: acceptForm.reason || null,
    trainingLimit: acceptForm.trainingLimit || null,
    nextReviewDate: acceptForm.nextReviewDate || null
  }).then(() => {
    proxy.$modal.msgSuccess('已采纳：RTP 状态、变更日志与预警处置在同一事务完成')
    acceptDialog.value = false
    drawer.value = false
    refreshAfterAction()
    // 通知合并页刷新上方 RTP 状态面板
    emit('accepted')
  }).finally(() => { saving.value = false })
}

// ========= 初始化 =========
listDept({ pageNum: 1, pageSize: 500 }).then(res => {
  deptOpts.value = Array.isArray(res.data) ? res.data : []
})
loadList()
loadStat()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rw-panel {
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 16px;
  padding: 20px 22px 24px;
}

/* 面板区块头（合并页中充当分区标题） */
.ha-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-bottom: 16px;
}
.ha-section-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: $rk-text-1;
  position: relative;
  padding-left: 10px;
  &::before {
    content: '';
    position: absolute;
    left: 0; top: 50%;
    transform: translateY(-50%);
    width: 4px; height: 16px;
    border-radius: 2px;
    background: $rk-brand-600;
  }
}
.ha-section-sub {
  margin: 0;
  flex: 1 1 100%;
  order: 2;
  font-size: 12px;
  color: $rk-text-3;
}
.ha-scan-btn { margin-left: auto; flex: none; }

.rw-select { width: 160px; }
.rw-select-team { width: 150px; }
.rw-avatar { width: 30px; height: 30px; font-size: 13px; }
.rw-avatar-lg { width: 44px; height: 44px; font-size: 18px; }

.rw-switch-group {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: $rk-text-2; cursor: pointer; white-space: nowrap;
}
.rw-switch { accent-color: $rk-brand-600; }

/* ===== 级别徽标：健康暖色 / 流程中性灰蓝 ===== */
.rw-level-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600; line-height: 18px;
  border: 1px solid transparent; white-space: nowrap;
  &.lg { font-size: 14px; padding: 6px 14px; }
  .rw-badge-ic { font-size: 14px; }
}
.rw-badge-process { background: #eef2f7; border-color: #dbe3ee; color: #5b6b7f; }
.rw-badge-info { background: #e8f1fe; border-color: #bfd9fb; color: #1d5bb8; }
.rw-overdue-sub { margin-top: 4px; font-size: 11px; font-weight: 600; color: #b45309; }
.rw-score-zero { color: $rk-text-3; }

.rw-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rw-factor-chip {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: 8px; font-size: 12px;
  border: 1px solid transparent;
}
.rw-factor-chip.is-health { background: #fef3e0; border-color: #f5d9a8; color: #b45309; }
.rw-factor-chip.is-process { background: #eef2f7; border-color: #dbe3ee; color: #5b6b7f; }

.rw-table .col-level { width: 130px; }
.rw-table .col-score { width: 90px; }
.rw-table .col-date { width: 110px; }
.rw-table .col-status { width: 90px; }
.rw-table .col-actions { width: 100px; }

.rw-chip-blue { background: #e8f1fe; color: #1d5bb8; border-color: #bfd9fb; }
.rw-chip-green { background: #e8f7ee; color: #16A34A; border-color: #b7e4c7; }

/* ===== 抽屉 ===== */
.rw-drawer { display: flex; flex-direction: column; height: 100%; padding: 18px 20px 20px; overflow-y: auto; }
.rw-drawer-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid $rk-line;
}
.rw-drawer-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rw-drawer-name { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: $rk-text-1; }
.rw-drawer-sub { margin-top: 4px; font-size: 12px; color: $rk-text-3; }
:deep(.rt-drawer-close) {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex: none;
  color: $rk-text-3; background: #fff; border: 1px solid $rk-line; border-radius: 9px; cursor: pointer;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}

.rw-suggest-panel {
  border: 1px solid $rk-line; border-radius: 14px; padding: 14px 16px;
  background: #f8fafc;
  &.is-red { border-left: 4px solid $rk-risk; }
  &.is-amber { border-left: 4px solid $rk-warn; }
  &.is-info { border-left: 4px solid #2563eb; }
  &.is-process { border-left: 4px solid #94a3b8; }
}
.rw-suggest-label { font-size: 12px; color: $rk-text-3; margin-bottom: 8px; }
.rw-suggest-main { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.rw-suggest-score { font-size: 13px; color: $rk-text-2; b { color: $rk-text-1; margin-left: 4px; } }
.rw-suggest-rtp { margin-top: 10px; font-size: 12.5px; color: $rk-text-2; }
.txt-red { color: $rk-risk; }
.txt-amber { color: $rk-warn; }
.rw-current-rtp { color: $rk-text-3; }

.rw-section-title {
  display: flex; align-items: center; gap: 8px;
  margin: 18px 0 12px; padding-left: 9px;
  border-left: 3px solid $rk-brand-600;
  font-size: 13px; font-weight: 600; color: $rk-text-1;
}
.rw-section-sub { margin-left: auto; font-size: 11px; font-weight: 400; color: $rk-text-3; }

.rw-factor-list { display: flex; flex-direction: column; gap: 10px; }
.rw-factor-card {
  border: 1px solid $rk-line; border-radius: 12px; padding: 11px 13px; background: #fff;
  &.is-health { border-left: 3px solid $rk-warn; }
  &.is-process { border-left: 3px solid #94a3b8; }
}
.rw-factor-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.rw-factor-kind {
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 6px;
  &.is-health { background: #fef3e0; color: #b45309; }
  &.is-process { background: #eef2f7; color: #5b6b7f; }
}
.rw-factor-title { font-size: 13px; font-weight: 600; color: $rk-text-1; }
.rw-factor-meta { margin-left: auto; font-size: 11px; color: $rk-text-3; white-space: nowrap; }
.rw-factor-detail { font-size: 12.5px; line-height: 19px; color: $rk-text-2; }

.rw-handled {
  margin-top: 16px; padding: 10px 12px; border-radius: 10px;
  background: $rk-canvas; font-size: 12.5px; color: $rk-text-2;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}

.rw-drawer-foot {
  margin-top: auto; padding-top: 16px;
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  border-top: 1px solid $rk-line;
}
.rw-perm-tip { font-size: 12px; color: $rk-text-3; }

.rw-accept-target { font-weight: 700; font-size: 14px; }
.rw-accept-note { margin-left: 8px; font-size: 12px; color: $rk-text-3; }

/* KPI 卡可点击 */
.rk-kpi-card { cursor: pointer; }
</style>
