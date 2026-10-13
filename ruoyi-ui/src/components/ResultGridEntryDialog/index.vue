<template>
  <el-dialog :title="dialogTitle" v-model="visible" width="920px" append-to-body
             :close-on-click-modal="false" @closed="reset">

    <!-- ============ 散录模式：选队员 + 选指标 ============ -->
    <div v-if="mode === 'free' && !submitted" class="rg-pick">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px"
                title="散录不绑定任务、不计入任务进度；任务内批量录入请从任务详情「网格录成绩」进入。"/>
      <div class="rg-pick-grid">
        <div class="rg-pick-col">
          <div class="rg-pick-head">
            <b>① 选择队员</b>
            <span class="rg-pick-count">已选 {{ pickedAthletes.length }} 人</span>
          </div>
          <div class="rg-pick-filter">
            <select v-model="pickTeam" class="rg-sel">
              <option :value="null">全部队伍</option>
              <option v-for="t in teamOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-model="pickKeyword" class="rg-inp" placeholder="姓名筛选"/>
          </div>
          <el-table ref="athleteTableRef" :data="filteredAthletes" row-key="athleteId"
                    height="340" size="small" @selection-change="rows => pickedAthletes = rows">
            <el-table-column type="selection" width="42" reserve-selection/>
            <el-table-column label="队员" min-width="120">
              <template #default="{ row }">
                <span class="rg-aname">{{ row.name }}</span>
                <GenderBadge :gender="row.gender" :size="13"/>
              </template>
            </el-table-column>
            <el-table-column prop="primaryTeamName" label="队伍" min-width="110"/>
          </el-table>
        </div>
        <div class="rg-pick-col">
          <div class="rg-pick-head">
            <b>② 选择指标</b>
            <span class="rg-pick-count">已选 {{ pickedIndicators.length }} 项</span>
          </div>
          <el-table ref="indicatorTableRef" :data="indicatorLib" row-key="id"
                    height="340" size="small" @selection-change="rows => pickedIndicators = rows">
            <el-table-column type="selection" width="42"/>
            <el-table-column label="指标" min-width="150">
              <template #default="{ row }">
                <div class="rg-ind-name">{{ row.name }}</div>
                <div class="rg-ind-sub">
                  <span class="rg-code">{{ row.code }}</span>
                  <span v-if="row.category" class="rg-cat">{{ row.category }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="单位/方向" width="100">
              <template #default="{ row }">
                <span class="rg-unit">{{ row.unit || '—' }}</span>
                <span class="rg-dir">{{ dirShort(row.evaluationDirection) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <!-- ============ 网格录入（任务模式直达；散录选完人/指标后进入） ============ -->
    <div v-if="mode === 'task' || pickedReady" class="rg-grid-wrap" v-show="!submitted">
      <div class="rg-grid-tool">
        <label class="rg-tool-item">
          <span class="rg-tool-label">测试日期</span>
          <el-date-picker v-model="measureDate" type="date" value-format="YYYY-MM-DD" style="width:150px"/>
        </label>
        <label class="rg-tool-item">
          <span class="rg-tool-label">场次</span>
          <el-input v-model="sessionKey" placeholder="如 S1（可选）" style="width:140px"/>
        </label>
        <span class="rg-tool-stat">
          已填 <b class="rg-mono">{{ filledCells }}</b> 格 · 涉及 <b class="rg-mono">{{ personsWithData }}</b> 人 ·
          留空自动跳过 · 同项再次提交记为新尝试（attempt，系统自动选最佳）
        </span>
      </div>

      <el-alert v-if="modelItemsCount > 0" type="warning" :closable="false" show-icon style="margin-bottom:8px"
                :title="`任务含 ${modelItemsCount} 个模型测试项（结构化字段/设备采集），不支持网格录入，请用队员行的「录成绩」逐个录入`"/>

      <div v-if="!columns.length" class="rg-no-indicator">
        该任务还没有直接指标测试项，请先在「测试项」Tab 添加指标。
      </div>
      <div v-else class="rg-table-scroll" v-loading="bestLoading">
        <table class="rg-table">
          <thead>
            <tr>
              <th class="rg-col-name">队员</th>
              <th v-for="c in columns" :key="c.indicatorId" class="rg-col-input">
                <div class="rg-th-name">{{ c.name }}</div>
                <div class="rg-th-sub">
                  <span class="rg-code">{{ c.code }}</span>
                  <span class="rg-unit">{{ c.unit || '—' }}</span>
                  <span class="rg-dir">{{ dirShort(c.direction) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in gridRows" :key="row.athleteId">
              <td class="rg-name-cell">
                <span class="rg-aname">{{ row.athleteName || '未命名' }}</span>
                <GenderBadge :gender="row.athleteGender" :size="13"/>
                <div v-if="row.athleteTeam" class="rg-team">{{ row.athleteTeam }}</div>
              </td>
              <td v-for="c in columns" :key="c.indicatorId">
                <input
                  class="rg-cell"
                  :class="cellClass(row, c)"
                  v-model="row.values[c.indicatorId]"
                  inputmode="decimal"
                  :placeholder="bestText(row.athleteId, c.indicatorId)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="hardCount" class="rg-hard-tip">有 {{ hardCount }} 个成绩不是数字或超出允许范围（红框），请修正后再提交</p>
    </div>

    <!-- ============ 提交结果 ============ -->
    <div v-if="submitted" class="rg-result">
      <el-result :icon="commitResult.failed ? 'warning' : 'success'"
                 :title="commitResult.failed ? '部分队员未录入' : '全部录入成功'"
                 :sub-title="`成功 ${commitResult.committed} 人 · 失败 ${commitResult.failed} 人`"/>
      <ul v-if="commitResult.failedDetails?.length" class="rg-fail-list">
        <li v-for="(d, i) in commitResult.failedDetails" :key="i">{{ d }}</li>
      </ul>
      <p class="rg-rep-hint">成绩已自动参与最佳试次判定；同项目再次提交会记为新的尝试（attempt），可在测试结果台账中删除错误尝试。</p>
    </div>

    <template #footer>
      <template v-if="!submitted">
        <template v-if="mode === 'free' && !pickedReady">
          <el-button @click="close">取消</el-button>
          <el-button type="primary" :disabled="!canBuildGrid" @click="buildFreeGrid">下一步：录入成绩</el-button>
        </template>
        <template v-else>
          <el-button :disabled="saving" @click="mode === 'free' ? (pickedReady = false) : close()">
            {{ mode === 'free' ? '上一步' : '取消' }}
          </el-button>
          <el-button type="primary" :loading="saving" :disabled="!columns.length || !personsWithData || hardCount > 0"
                     @click="submit">提交成绩</el-button>
        </template>
      </template>
      <template v-else>
        <el-button type="primary" @click="finish">完成</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup name="ResultGridEntryDialog">
import GenderBadge from '@/components/GenderBadge/index.vue'
import { listIndicator } from '@/api/apms/indicator'
import { listAthlete } from '@/api/apms/athlete'
import { listByTaskMember, batchGridAdd } from '@/api/apms/testResult'
import {
  loadRanges, getIndicatorRange, classify, isHard, isWarn, hardMessage, warnMessage
} from '@/utils/measureRange'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'success'])
const { proxy } = getCurrentInstance()

// 弹窗可见性内部自管（父组件只通过 ref.openForTask/openFree 打开，无需 v-model）；
// 同时向 v-model 单向同步，兼容外部显式绑定
const visible = ref(false)
watch(visible, v => { if (v !== props.modelValue) emit('update:modelValue', v) })

// 指标录入区间（字典 apms_indicator_range）
loadRanges().catch(() => {})

const MAX_ROWS = 100

const mode = ref('task')               // task | free
const taskCtx = reactive({ id: null, name: '' })
const modelItemsCount = ref(0)

// 网格数据
const columns = ref([])                // { indicatorId, code, name, unit, direction }
const gridRows = ref([])               // { athleteId, athleteName, athleteGender, athleteTeam, values:{id:''} }
const measureDate = ref(today())
const sessionKey = ref('')
const bestMap = ref({})                // `${athleteId}:${indicatorId}` → 最佳值
const bestLoading = ref(false)

// 散录选人/选指标
const athleteTableRef = ref(null)
const indicatorTableRef = ref(null)
const athleteLib = ref([])
const indicatorLib = ref([])
const pickedAthletes = ref([])
const pickedIndicators = ref([])
const pickedReady = ref(false)
const pickTeam = ref(null)
const pickKeyword = ref('')

// 提交
const saving = ref(false)
const submitted = ref(false)
const commitResult = ref({ committed: 0, failed: 0, failedDetails: [] })

const dialogTitle = computed(() => {
  if (mode.value === 'free') return '网格录入成绩（散录）'
  return `网格录入成绩 · ${taskCtx.name || ('任务 #' + taskCtx.id)}`
})

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dirShort(d) {
  return d === 'HIGHER_BETTER' ? '↑' : d === 'LOWER_BETTER' ? '↓' : d === 'RANGE_BEST' ? '≈' : d === 'REFERENCE_ONLY' ? '—' : ''
}

// ========= 指标库（散录选择 + 任务列单位/方向补全） =========
async function loadIndicatorLib() {
  if (indicatorLib.value.length) return indicatorLib.value
  const res = await listIndicator({ pageNum: 1, pageSize: 999, status: '0' })
  const rank = { '形态': 0, '机能': 1, '素质': 2, '筛查': 3 }
  indicatorLib.value = (res.rows || []).slice().sort(
    (a, b) => (rank[a.category] ?? 99) - (rank[b.category] ?? 99)
  )
  return indicatorLib.value
}

// ========= 任务模式入口 =========
async function openForTask(task) {
  mode.value = 'task'
  submitted.value = false
  pickedReady.value = true
  saving.value = false
  commitResult.value = { committed: 0, failed: 0, failedDetails: [] }
  visible.value = true
  taskCtx.id = task.taskId
  taskCtx.name = task.taskName || ''
  measureDate.value = today()
  sessionKey.value = ''

  const lib = await loadIndicatorLib()
  const libMap = new Map(lib.map(i => [i.id, i]))

  // task.items 来自 getTestTask 详情；task.members 同
  const items = task.items || []
  modelItemsCount.value = items.filter(it => it.itemType === 'MODEL').length
  columns.value = items
    .filter(it => it.itemType === 'INDICATOR' && it.indicatorId != null)
    .map(it => {
      const meta = libMap.get(it.indicatorId) || {}
      return {
        indicatorId: it.indicatorId,
        code: it.indicatorCode || meta.code || '',
        name: it.indicatorName || meta.name || it.indicatorCode || ('指标#' + it.indicatorId),
        unit: it.indicatorUnit || meta.unit || '',
        direction: it.indicatorDirection || meta.evaluationDirection || ''
      }
    })

  gridRows.value = (task.members || []).slice(0, MAX_ROWS).map(m => ({
    athleteId: m.athleteId,
    athleteName: m.athleteName,
    athleteGender: m.athleteGender,
    athleteTeam: m.athleteTeam,
    values: {}
  }))
  loadBestValues()
}

// ========= 散录模式入口 =========
async function openFree() {
  mode.value = 'free'
  submitted.value = false
  pickedReady.value = false
  saving.value = false
  pickedAthletes.value = []
  pickedIndicators.value = []
  pickTeam.value = null
  pickKeyword.value = ''
  measureDate.value = today()
  sessionKey.value = ''
  columns.value = []
  gridRows.value = []
  modelItemsCount.value = 0
  taskCtx.id = null
  taskCtx.name = ''
  commitResult.value = { committed: 0, failed: 0, failedDetails: [] }
  visible.value = true

  await Promise.all([loadIndicatorLib(), loadAthleteLib()])
  nextTick(() => {
    athleteTableRef.value?.clearSelection()
    indicatorTableRef.value?.clearSelection()
  })
}

async function loadAthleteLib() {
  if (athleteLib.value.length) return
  const res = await listAthlete({ pageNum: 1, pageSize: 999, status: '0' })
  athleteLib.value = res.rows || []
}

const teamOptions = computed(() => {
  const set = new Set()
  athleteLib.value.forEach(a => { if (a.primaryTeamName) set.add(a.primaryTeamName) })
  return Array.from(set).sort()
})
const filteredAthletes = computed(() => {
  const kw = (pickKeyword.value || '').trim().toLowerCase()
  return athleteLib.value.filter(a => {
    if (pickTeam.value && a.primaryTeamName !== pickTeam.value) return false
    if (kw && !(a.name || '').toLowerCase().includes(kw)) return false
    return true
  })
})
const canBuildGrid = computed(() => pickedAthletes.value.length > 0 && pickedIndicators.value.length > 0
  && pickedAthletes.value.length <= MAX_ROWS)

function buildFreeGrid() {
  columns.value = pickedIndicators.value.map(i => ({
    indicatorId: i.id,
    code: i.code,
    name: i.name,
    unit: i.unit || '',
    direction: i.evaluationDirection || ''
  }))
  gridRows.value = pickedAthletes.value.slice(0, MAX_ROWS).map(a => ({
    athleteId: a.athleteId,
    athleteName: a.name,
    athleteGender: a.gender,
    athleteTeam: a.primaryTeamName || '',
    values: {}
  }))
  pickedReady.value = true
  loadBestValues()
}

// ========= 现最佳参照（每人一次请求，并行；失败静默） =========
async function loadBestValues() {
  bestMap.value = {}
  if (!gridRows.value.length || !columns.value.length) return
  bestLoading.value = true
  const tasks = gridRows.value.map(async row => {
    try {
      const list = mode.value === 'task' && taskCtx.id
        ? (await listByTaskMember(taskCtx.id, row.athleteId)).data || []
        : []
      // 散录无统一接口按指标查，且网格关注任务现场，散录不展示最佳参照
      for (const r of list) {
        if (r.isSelected !== '1' || r.itemType !== 'INDICATOR' || r.indicatorId == null) continue
        const main = (r.values || []).find(v => v.fieldKey === 'result') || (r.values || [])[0]
        const v = main ? (main.numericValue ?? main.textValue) : null
        if (v != null) bestMap.value[`${row.athleteId}:${r.indicatorId}`] = v
      }
    } catch { /* 参照缺失不影响录入 */ }
  })
  await Promise.all(tasks)
  bestLoading.value = false
}
function bestText(athleteId, indicatorId) {
  const v = bestMap.value[`${athleteId}:${indicatorId}`]
  return v == null ? '' : `最佳 ${v}`
}

// ========= 实时校验（与单人弹窗口径一致） =========
function cellLevel(row, col) {
  const raw = row.values[col.indicatorId]
  if (raw === '' || raw == null || String(raw).trim() === '') return ''
  const num = Number(String(raw).trim())
  if (!Number.isFinite(num)) return 'invalid'
  const range = getIndicatorRange(col.code)
  if (!range) return ''
  return classify(range, num)
}
function cellClass(row, col) {
  const level = cellLevel(row, col)
  if (level === 'invalid' || isHard(level)) return 'is-hard'
  if (isWarn(level)) return 'is-warn'
  return ''
}
function cellHint(row, col) {
  const level = cellLevel(row, col)
  if (!level || level === 'invalid') return ''
  const range = getIndicatorRange(col.code)
  if (isHard(level)) return hardMessage(range, row.values[col.indicatorId])
  if (isWarn(level)) return warnMessage(range, row.values[col.indicatorId])
  return ''
}
const filledCells = computed(() => gridRows.value.reduce((s, r) =>
  s + columns.value.filter(c => String(r.values[c.indicatorId] ?? '').trim() !== '').length, 0))
const personsWithData = computed(() => gridRows.value.filter(r =>
  columns.value.some(c => String(r.values[c.indicatorId] ?? '').trim() !== '')).length)
const problemCells = computed(() => {
  const out = []
  gridRows.value.forEach(r => columns.value.forEach(c => {
    const level = cellLevel(r, c)
    if (level === 'invalid' || isHard(level)) out.push({ row: r, col: c, kind: 'hard' })
    else if (isWarn(level)) out.push({ row: r, col: c, kind: 'warn' })
  }))
  return out
})
const hardCount = computed(() => problemCells.value.filter(x => x.kind === 'hard').length)
const warnCells = computed(() => problemCells.value.filter(x => x.kind === 'warn'))

// ========= 提交 =========
function buildPayload() {
  const rows = []
  gridRows.value.forEach(r => {
    const cells = []
    columns.value.forEach(c => {
      const raw = String(r.values[c.indicatorId] ?? '').trim()
      if (raw === '') return
      cells.push({ indicatorId: c.indicatorId, value: Number(raw) })
    })
    if (cells.length) rows.push({ athleteId: r.athleteId, cells })
  })
  return {
    taskId: taskCtx.id || null,
    measureDate: measureDate.value,
    sessionKey: sessionKey.value || null,
    rows
  }
}

async function submit() {
  if (!measureDate.value) return proxy.$modal.msgWarning('请选择测试日期')
  if (!personsWithData.value) return proxy.$modal.msgWarning('请至少填写一个成绩')
  if (hardCount.value) return proxy.$modal.msgError('存在非数字或超出允许范围的成绩，请修正红框单元格')

  const payload = buildPayload()
  const warns = warnCells.value

  // 仅在存在「超出合理区间」的告警值时二次确认；正常数据点击即提交，避免多余弹窗打断现场录入
  if (warns.length) {
    const lines = warns.slice(0, 8).map(x => `· ${x.row.athleteName} ${x.col.name}：${cellHint(x.row, x.col)}`)
    const confirmText = `以下 ${warns.length} 个成绩超出合理区间：\n${lines.join('\n')}`
      + `${warns.length > 8 ? `\n…等 ${warns.length} 项` : ''}\n\n`
      + `将为 ${payload.rows.length} 名队员提交 ${filledCells.value} 项成绩（${payload.measureDate}）。\n`
      + '同项目再次提交记为新尝试（attempt），系统自动选最佳；留空项目不产生记录。是否继续？'
    try {
      await proxy.$modal.confirm(confirmText, '异常值确认')
    } catch { return } // 用户主动取消
  }

  saving.value = true
  try {
    const res = await batchGridAdd(payload)
    commitResult.value = res.data || { committed: 0, failed: 0, failedDetails: [] }
    submitted.value = true
    proxy.$modal.msgSuccess(`已提交：成功 ${commitResult.value.committed || 0} 人`
      + (commitResult.value.failed ? `，失败 ${commitResult.value.failed} 人（见明细）` : ''))
    emit('success', { taskId: taskCtx.id })
  } catch (e) {
    // 后端校验/系统错误必须可见，不能静默（否则表现为「点了没反应、没入库」）
    proxy.$modal.msgError(e?.msg || e?.message || '成绩提交失败，请重试')
  } finally {
    saving.value = false
  }
}

function finish() { visible.value = false }
function close() { visible.value = false }

function reset() {
  columns.value = []
  gridRows.value = []
  bestMap.value = {}
  sessionKey.value = ''
  submitted.value = false
  pickedReady.value = false
  saving.value = false
}

defineExpose({ openForTask, openFree })
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rg-pick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rg-pick-col { border: 1px solid $rk-line; border-radius: 12px; padding: 10px; }
.rg-pick-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: $rk-text-1; }
.rg-pick-count { font-size: 12px; color: $rk-brand-600; font-weight: 500; }
.rg-pick-filter { display: flex; gap: 8px; margin-bottom: 8px; }
.rg-sel { height: 32px; border: 1px solid $rk-line; border-radius: 8px; padding: 0 8px; font-size: 13px; min-width: 110px; }
.rg-inp { height: 32px; border: 1px solid $rk-line; border-radius: 8px; padding: 0 10px; font-size: 13px; flex: 1; min-width: 0; }

.rg-aname { font-size: 13px; font-weight: 600; color: $rk-text-1; margin-right: 4px; }
.rg-team { font-size: 11px; color: $rk-text-3; margin-top: 2px; }
.rg-ind-name { font-size: 13px; font-weight: 500; color: $rk-text-1; }
.rg-ind-sub { display: flex; gap: 6px; margin-top: 2px; }
.rg-code { font-family: var(--app-font-mono); font-size: 11px; color: $rk-text-3; }
.rg-cat { font-size: 11px; padding: 0 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; }
.rg-unit { font-size: 12px; color: $rk-text-2; }
.rg-dir { margin-left: 6px; font-size: 12px; font-weight: 700; color: $rk-brand-600; }

.rg-grid-tool { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.rg-tool-item { display: inline-flex; align-items: center; gap: 6px; }
.rg-tool-label { font-size: 13px; color: $rk-text-2; white-space: nowrap; }
.rg-tool-stat { margin-left: auto; font-size: 12px; color: $rk-text-3; }
.rg-tool-stat b { color: $rk-brand-600; }
.rg-mono { font-family: var(--app-font-mono); }

.rg-no-indicator {
  padding: 28px; text-align: center; font-size: 13px; color: $rk-warn;
  background: #fffaf0; border: 1px dashed #f0d9a8; border-radius: 12px;
}

.rg-table-scroll { border: 1px solid $rk-line; border-radius: 12px; overflow: auto; max-height: 460px; }
.rg-table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; }
.rg-table th, .rg-table td { border-right: 1px solid #eef1f6; border-bottom: 1px solid #eef1f6; }
.rg-table thead th {
  position: sticky; top: 0; z-index: 2;
  background: #f7f9fc; padding: 8px 10px; text-align: left; vertical-align: top;
}
.rg-table tbody td { padding: 6px 8px; background: #fff; }
.rg-table tbody tr:nth-child(even) td { background: #fafbfe; }
.rg-col-name { position: sticky; left: 0; z-index: 3; min-width: 130px; border-right: 1px solid $rk-line !important; }
thead .rg-col-name { z-index: 4; background: #f7f9fc !important; }
.rg-th-name { font-size: 12px; font-weight: 600; color: $rk-text-1; white-space: nowrap; }
.rg-th-sub { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.rg-col-input { min-width: 108px; }
.rg-name-cell { background: inherit; }

.rg-cell {
  width: 92px; height: 32px;
  border: 1px solid $rk-line; border-radius: 8px;
  padding: 0 8px; font-size: 13px;
  font-family: var(--app-font-mono);
  transition: border-color .15s, background .15s;
  &:focus { outline: none; border-color: $rk-brand-500; background: #fff; }
  &.is-hard { border-color: $rk-risk; background: #fef2f2; }
  &.is-warn { border-color: $rk-warn; background: #fffaf0; }
}
.rg-hard-tip { margin: 8px 2px 0; font-size: 12px; color: $rk-risk; }

.rg-result { min-height: 300px; }
.rg-fail-list {
  max-height: 200px; overflow: auto; margin: 0 auto 12px; padding: 10px 14px;
  list-style: none; border: 1px solid #f3c1c1; border-radius: 10px; background: #fef7f7;
  li { font-size: 12px; line-height: 1.9; color: $rk-risk; }
}
.rg-rep-hint { text-align: center; font-size: 12px; color: $rk-text-3; }

@media (max-width: 768px) {
  .rg-pick-grid { grid-template-columns: 1fr; }
  .rg-tool-stat { margin-left: 0; width: 100%; }
}
</style>
