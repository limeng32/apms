<template>
  <el-dialog title="批量 RTP 评估" :model-value="modelValue" width="880px"
             :close-on-click-modal="false" :close-on-press-escape="!submitting"
             @update:model-value="v => !submitting && emit('update:modelValue', v)"
             @open="onOpen" @closed="onClosed">

    <!-- 步骤条 -->
    <el-steps :active="stepIndex" align-center class="rb-steps" finish-status="success">
      <el-step title="① 选择队员"/>
      <el-step title="② 录入评估结论"/>
      <el-step title="③ 执行结果"/>
    </el-steps>

    <!-- ============ 步骤 1：选人 ============ -->
    <div v-show="step === 'select'" class="rb-pane">
      <div class="rb-filter">
        <label class="rk-group">
          <span class="rk-label">队伍</span>
          <select v-model="filter.team" class="rk-select">
            <option :value="null">全部队伍</option>
            <option v-for="t in teamOptions" :key="t">{{ t }}</option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">当前状态</span>
          <select v-model="filter.fromStatus" class="rk-select">
            <option :value="null">全部</option>
            <option value="na">未评估</option>
            <option value="g">🟢 正常参训</option>
            <option value="y">🟡 限制参训</option>
            <option value="r">🔴 不建议训练</option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">姓名</span>
          <input v-model="filter.keyword" class="rk-input" placeholder="队员姓名"/>
        </label>
        <div class="rb-filter-right">
          <button type="button" class="rk-btn rk-btn-sm" @click="toggleAllFiltered">全选/反选当前筛选</button>
        </div>
      </div>

      <el-table ref="selectTableRef" :data="filteredCandidates" row-key="athleteId" height="360"
                size="small" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="44" reserve-selection/>
        <el-table-column label="队员" min-width="150">
          <template #default="{ row }">
            <span class="rb-name">{{ row.athleteName || '未命名' }}</span>
            <GenderBadge :gender="row.athleteGender" :size="14"/>
          </template>
        </el-table-column>
        <el-table-column prop="athleteTeam" label="队伍" min-width="120"/>
        <el-table-column label="当前状态" width="110">
          <template #default="{ row }">
            <span class="rk-status-badge" :class="statusTone(row.status)">
              <i class="rk-status-dot"></i>{{ statusLabel(row.status) }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <div class="rb-footbar">
        <span class="rb-count" :class="{ 'is-over': selected.length > MAX_ITEMS }">
          已选 {{ selected.length }} 人<template v-if="selected.length > MAX_ITEMS"> · 超出上限 {{ MAX_ITEMS }} 人，请减少</template>
        </span>
      </div>
    </div>

    <!-- ============ 步骤 2：评估（统一 / 逐人 双模式） ============ -->
    <div v-show="step === 'assess'" class="rb-pane">
      <el-radio-group v-model="mode" class="rb-mode">
        <el-radio-button value="uniform">统一标记（结论相同）</el-radio-button>
        <el-radio-button value="perPerson">逐人评估（可分别结论）</el-radio-button>
      </el-radio-group>

      <!-- 统一标记 -->
      <div v-if="mode === 'uniform'" class="rb-uniform">
        <div class="rb-uniform-tip">将为已选的 <b>{{ assessRows.length }}</b> 人写入相同结论；转「🟢 正常参训」会自动清空旧训练限制。</div>
        <el-form label-width="92px" class="rb-uniform-form">
          <el-form-item label="评估结论" required>
            <el-radio-group v-model="uniform.status">
              <el-radio value="g">🟢 正常参训</el-radio>
              <el-radio value="y">🟡 限制参训</el-radio>
              <el-radio value="r">🔴 不建议训练</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="标记原因">
            <el-input v-model="uniform.reason" type="textarea" :rows="2"
                      :placeholder="uniform.status === 'g' ? '如：阶段体检正常 / 康复完成' : '如：腘绳肌轻度拉伤恢复期'"/>
          </el-form-item>
          <el-form-item v-if="uniform.status !== 'g'" label="训练限制">
            <el-input v-model="uniform.trainingLimit" placeholder="如：限制长距离 / 避免高强度间歇"/>
          </el-form-item>
          <el-form-item label="下次复检">
            <el-date-picker v-model="uniform.nextReviewDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期"/>
            <button type="button" class="rk-link rb-quick-day" @click="quickDay(7)">+7 天</button>
            <button type="button" class="rk-link rb-quick-day" @click="quickDay(30)">+30 天</button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 逐人评估 -->
      <div v-else class="rb-perperson">
        <div class="rb-fill-bar">
          <span class="rb-fill-label">批量填充勾选行：</span>
          <el-select v-model="fill.status" placeholder="状态" style="width:150px" size="small">
            <el-option label="🟢 正常参训" value="g"/>
            <el-option label="🟡 限制参训" value="y"/>
            <el-option label="🔴 不建议训练" value="r"/>
          </el-select>
          <el-date-picker v-model="fill.nextReviewDate" type="date" size="small"
                          value-format="YYYY-MM-DD" placeholder="复检日期" style="width:150px"/>
          <button type="button" class="rk-btn rk-btn-sm"
                  :disabled="!fillTargets.length" @click="applyFill">应用到勾选 {{ fillTargets.length }} 人</button>
          <span class="rb-fill-tip">行内仍可逐个微调；未选状态的行无法提交</span>
        </div>

        <el-table ref="assessTableRef" :data="assessRows" row-key="athleteId" height="360"
                  size="small" :row-class-name="assessRowClass"
                  @selection-change="rows => fillTargets = rows">
          <el-table-column type="selection" width="44"/>
          <el-table-column label="队员" min-width="130">
            <template #default="{ row }">
              <div class="rb-name-line">
                <span class="rb-name">{{ row.athleteName || '未命名' }}</span>
                <GenderBadge :gender="row.athleteGender" :size="13"/>
              </div>
              <div class="rb-sub">{{ row.athleteTeam || '—' }} · 原状态 {{ statusLabel(row.fromStatus) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="结论" width="190">
            <template #default="{ row }">
              <el-radio-group v-model="row.status" size="small">
                <el-radio value="g">🟢</el-radio>
                <el-radio value="y">🟡</el-radio>
                <el-radio value="r">🔴</el-radio>
              </el-radio-group>
            </template>
          </el-table-column>
          <el-table-column label="原因" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.reason" size="small" placeholder="选填"/>
            </template>
          </el-table-column>
          <el-table-column v-if="hasNonGreen" label="训练限制" min-width="140">
            <template #default="{ row }">
              <el-input v-model="row.trainingLimit" size="small" :disabled="row.status === 'g'" placeholder="非🟢时填写"/>
            </template>
          </el-table-column>
          <el-table-column label="复检日期" width="145">
            <template #default="{ row }">
              <el-date-picker v-model="row.nextReviewDate" type="date" size="small"
                              value-format="YYYY-MM-DD" style="width:125px"/>
            </template>
          </el-table-column>
        </el-table>

        <div class="rb-footbar">
          <span class="rb-count">已选 {{ assessRows.length }} 人 · 已给结论 {{ answeredCount }} 人 · 待结论 {{ assessRows.length - answeredCount }} 人</span>
        </div>
      </div>
    </div>

    <!-- ============ 步骤 3：结果 ============ -->
    <div v-show="step === 'result'" class="rb-pane">
      <el-result :icon="resultAllSuccess ? 'success' : 'warning'"
                 :title="resultAllSuccess ? '全部评估完成' : '部分完成'"
                 :sub-title="`共 ${resultRows.length} 人 · 成功 ${resultSuccess} 人 · 失败 ${resultFailed} 人`"/>
      <el-table :data="resultRows" height="300" size="small" :row-class-name="resultRowClass">
        <el-table-column label="队员" min-width="140">
          <template #default="{ row }">
            <span class="rb-name">{{ row.athleteName || ('#' + row.athleteId) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <span :class="row.status === 'success' ? 'rb-ok' : 'rb-fail'">
              {{ row.status === 'success' ? '✓ 成功' : '✗ 失败' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="失败原因 / 说明" min-width="200">
          <template #default="{ row }">{{ row.status === 'success' ? '—' : (row.reason || '未知错误') }}</template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 底栏 -->
    <template #footer>
      <template v-if="step === 'select'">
        <el-button @click="close">取消</el-button>
        <el-button type="primary" :disabled="!canGoAssess" @click="goAssess">
          下一步：评估（{{ selected.length }} 人）
        </el-button>
      </template>
      <template v-else-if="step === 'assess'">
        <el-button :disabled="submitting" @click="step = 'select'">上一步</el-button>
        <el-button type="primary" :loading="submitting" @click="submitBatch">提交评估</el-button>
      </template>
      <template v-else>
        <el-button v-if="resultFailed > 0" :loading="submitting" @click="retryFailed">仅重试失败 {{ resultFailed }} 项</el-button>
        <el-button type="primary" @click="finish">完成</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup name="RtpBatchAssessDialog">
import { ElMessageBox } from 'element-plus'
import GenderBadge from '@/components/GenderBadge/index.vue'
import { batchUpdateStatus } from '@/api/apms/rtp'

const MAX_ITEMS = 200

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 看板 fullList：{ athleteId, athleteName, athleteGender, athleteTeam, athleteAge, status }
  athletes: { type: Array, default: () => [] },
  // 打开时预选（如未评估列「批量首评」）
  presetAthleteIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'success'])

const { proxy } = getCurrentInstance()

// ========= 步骤状态 =========
const step = ref('select') // select | assess | result
const stepIndex = computed(() => ({ select: 0, assess: 1, result: 2 }[step.value]))
const submitting = ref(false)

// ========= 步骤 1：选人 =========
const selectTableRef = ref(null)
const filter = reactive({ team: null, fromStatus: null, keyword: '' })
const selected = ref([])

const teamOptions = computed(() => {
  const set = new Set()
  props.athletes.forEach(a => { if (a.athleteTeam && a.athleteTeam !== '—') set.add(a.athleteTeam) })
  return Array.from(set).sort()
})

const filteredCandidates = computed(() => {
  const kw = (filter.keyword || '').trim().toLowerCase()
  return props.athletes.filter(a => {
    if (filter.team && a.athleteTeam !== filter.team) return false
    if (filter.fromStatus) {
      const s = a.status || 'na'
      if (s !== filter.fromStatus) return false
    }
    if (kw && !(a.athleteName || '').toLowerCase().includes(kw)) return false
    return true
  })
})

function onSelectionChange(rows) { selected.value = rows }
function toggleAllFiltered() { selectTableRef.value?.toggleAllSelection() }

const canGoAssess = computed(() => selected.value.length > 0 && selected.value.length <= MAX_ITEMS)

// ========= 步骤 2：评估 =========
const mode = ref('uniform')
const uniform = reactive({ status: 'g', reason: '', trainingLimit: '', nextReviewDate: null })
const assessRows = ref([])
const fillTargets = ref([])
const fill = reactive({ status: null, nextReviewDate: null })

function goAssess() {
  assessRows.value = selected.value.map(a => ({
    athleteId: a.athleteId,
    athleteName: a.athleteName,
    athleteGender: a.athleteGender,
    athleteTeam: a.athleteTeam,
    fromStatus: a.status,
    status: '', reason: '', trainingLimit: '', nextReviewDate: null
  }))
  step.value = 'assess'
}

const answeredCount = computed(() => assessRows.value.filter(r => !!r.status).length)
const hasNonGreen = computed(() => assessRows.value.some(r => r.status && r.status !== 'g'))

function quickDay(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  uniform.nextReviewDate = d.toISOString().slice(0, 10)
}
function applyFill() {
  if (!fill.status && !fill.nextReviewDate) {
    proxy.$modal.msgWarning('请先选择要填充的状态或复检日期')
    return
  }
  fillTargets.value.forEach(r => {
    if (fill.status) r.status = fill.status
    if (fill.nextReviewDate) r.nextReviewDate = fill.nextReviewDate
  })
  proxy.$modal.msgSuccess(`已应用到 ${fillTargets.value.length} 人`)
}
function assessRowClass({ row }) {
  return row.status ? '' : 'rb-row-pending'
}

// ========= 提交 =========
function buildItem(row) {
  return {
    athleteId: row.athleteId,
    status: row.status,
    reason: (row.reason || '').trim() || null,
    // 转绿清空旧训练限制；黄/红留空也按 null
    trainingLimit: row.status === 'g' ? null : ((row.trainingLimit || '').trim() || null),
    nextReviewDate: row.nextReviewDate || null
  }
}

function validateAndBuild() {
  if (mode.value === 'uniform') {
    if (!uniform.status) { proxy.$modal.msgWarning('请选择统一评估结论'); return null }
    assessRows.value.forEach(r => {
      r.status = uniform.status
      r.reason = uniform.reason
      r.trainingLimit = uniform.status === 'g' ? '' : uniform.trainingLimit
      r.nextReviewDate = uniform.nextReviewDate
    })
  } else {
    const missing = assessRows.value.filter(r => !r.status)
    if (missing.length) {
      proxy.$modal.msgWarning(`还有 ${missing.length} 人未选择结论：${missing.slice(0, 5).map(m => m.athleteName).join('、')}${missing.length > 5 ? ' 等' : ''}`)
      return null
    }
  }
  return assessRows.value.map(buildItem)
}

async function submitBatch() {
  const items = validateAndBuild()
  if (!items) return
  const cnt = { g: 0, y: 0, r: 0 }
  items.forEach(i => { cnt[i.status]++ })
  try {
    await ElMessageBox.confirm(
      `将标记：🟢 正常 ${cnt.g} 人 · 🟡 限制 ${cnt.y} 人 · 🔴 停训 ${cnt.r} 人。每人都会写入变更时间线，确认提交？`,
      '批量评估确认', { confirmButtonText: '确认提交', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  await runItems(items)
}

// ========= 步骤 3：结果 / 重试 =========
const resultRows = ref([])
const resultSuccess = computed(() => resultRows.value.filter(r => r.status === 'success').length)
const resultFailed = computed(() => resultRows.value.filter(r => r.status === 'failed').length)
const resultAllSuccess = computed(() => resultRows.value.length > 0 && resultFailed.value === 0)
function resultRowClass({ row }) { return row.status === 'failed' ? 'rb-row-failed' : '' }

async function runItems(items) {
  submitting.value = true
  try {
    const res = await batchUpdateStatus(items)
    mergeResults(res.data?.items || [], items)
    step.value = 'result'
  } finally {
    submitting.value = false
  }
}

// 合并接口结果（重试时只更新对应人），姓名缺失用本地行补齐
function mergeResults(remoteItems, submittedItems) {
  const nameMap = new Map(assessRows.value.map(r => [r.athleteId, r.athleteName]))
  const byId = new Map(resultRows.value.map(r => [r.athleteId, r]))
  remoteItems.forEach(remote => {
    const row = byId.get(remote.athleteId) || { athleteId: remote.athleteId }
    row.status = remote.status
    row.reason = remote.reason
    if (remote.athleteName) row.athleteName = remote.athleteName
    if (!row.athleteName) row.athleteName = nameMap.get(remote.athleteId)
    byId.set(remote.athleteId, row)
  })
  // 首次提交：接口若漏回某人，标记失败，保证结果人数与提交一致
  if (resultRows.value.length === 0) {
    submittedItems.forEach(it => {
      if (!byId.has(it.athleteId)) {
        byId.set(it.athleteId, { athleteId: it.athleteId, athleteName: nameMap.get(it.athleteId), status: 'failed', reason: '服务端未返回结果' })
      }
    })
  }
  resultRows.value = Array.from(byId.values())
}

async function retryFailed() {
  const failedIds = new Set(resultRows.value.filter(r => r.status === 'failed').map(r => r.athleteId))
  const items = assessRows.value.filter(r => failedIds.has(r.athleteId)).map(buildItem)
  if (!items.length) return
  await runItems(items)
}

function finish() {
  emit('success')
  close()
}
function close() { emit('update:modelValue', false) }

// ========= 打开 / 关闭重置 =========
function onOpen() {
  step.value = 'select'
  mode.value = 'uniform'
  Object.assign(uniform, { status: 'g', reason: '', trainingLimit: '', nextReviewDate: null })
  Object.assign(filter, { team: null, fromStatus: null, keyword: '' })
  assessRows.value = []
  resultRows.value = []
  selected.value = []
  nextTick(() => {
    selectTableRef.value?.clearSelection()
    // 预选（未评估列批量首评）：默认筛选数据即全员，行均在表内，可直接勾选
    if (props.presetAthleteIds?.length) {
      const idSet = new Set(props.presetAthleteIds)
      props.athletes.forEach(a => {
        if (idSet.has(a.athleteId)) selectTableRef.value?.toggleRowSelection(a, true)
      })
    }
  })
}
function onClosed() {
  selectTableRef.value?.clearSelection()
  assessTableRef.value?.clearSelection()
}
const assessTableRef = ref(null)

const statusLabel = (s) => s === 'g' ? '正常参训' : s === 'y' ? '限制参训' : s === 'r' ? '不建议训练' : '未评估'
const statusTone = (s) => s === 'g' ? 'tone-green' : s === 'y' ? 'tone-amber' : s === 'r' ? 'tone-red' : 'tone-gray'
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rb-steps { margin-bottom: 16px; }
.rb-pane { min-height: 420px; }

.rb-filter {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  margin-bottom: 10px;
}
.rb-filter .rk-select { width: 130px; height: 32px; }
.rb-filter .rk-input { width: 150px; height: 32px; }
.rb-filter-right { margin-left: auto; }

.rb-name { font-size: 13px; font-weight: 600; color: $rk-text-1; margin-right: 4px; }
.rb-name-line { display: flex; align-items: center; gap: 4px; }
.rb-sub { font-size: 11px; color: $rk-text-3; margin-top: 2px; }
.rb-footbar { margin-top: 10px; }
.rb-count { font-size: 12px; color: $rk-text-2; }
.rb-count.is-over { color: $rk-risk; font-weight: 600; }

/* 模式切换 + 统一标记 */
.rb-mode { margin-bottom: 12px; }
.rb-uniform {
  border: 1px solid $rk-line; border-radius: 12px;
  padding: 16px 18px 4px; background: #f8faff;
}
.rb-uniform-tip { font-size: 12px; color: $rk-text-2; margin-bottom: 12px; }
.rb-quick-day { margin-left: 10px; font-size: 12px; }

/* 逐人评估 */
.rb-fill-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 8px 12px;
  border: 1px dashed $rk-line; border-radius: 10px; background: #f8fafc;
}
.rb-fill-label { font-size: 12px; font-weight: 600; color: $rk-text-2; }
.rb-fill-tip { margin-left: auto; font-size: 11px; color: $rk-text-3; }

:deep(.rb-row-pending) { background: #fff8ed; }
:deep(.rb-row-failed) { background: #fef2f2; }
.rb-ok { color: $rk-ok; font-weight: 600; font-size: 12px; }
.rb-fail { color: $rk-risk; font-weight: 600; font-size: 12px; }
</style>
