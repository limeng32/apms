<template>
  <el-dialog :title="dialogTitle" v-model="visible" width="920px" append-to-body
             :close-on-click-modal="false" @closed="reset">

    <!-- ============ 散录模式：选任务（可选）+ 选队员 + 选指标 ============ -->
    <div v-if="mode === 'free' && !pickedReady && !submitted" class="rg-pick" v-loading="pickLoading">
      <div class="rg-pick-task">
        <span class="rg-pick-task-label">关联任务</span>
        <el-select v-model="pickTaskId" filterable clearable style="width:340px"
                   placeholder="不选 = 散录（不计入任务进度，下方自由选人/选指标）">
          <el-option v-for="t in taskOptions" :key="t.id"
                     :label="`#${t.id} ${t.taskName}`" :value="t.id"/>
        </el-select>
        <span class="rg-pick-task-hint">
          {{ pickTaskId
            ? `已按任务锁定 ${taskLock?.members?.length || 0} 名参测队员、${taskLock?.indicators?.length || 0} 项指标（不可改勾选，如需调整请清空任务后自由选择）`
            : '未选任务：请在下方自由勾选队员与指标' }}
        </span>
      </div>
      <el-alert v-if="!pickTaskId" type="info" :closable="false" show-icon style="margin-bottom:12px"
                title="散录不绑定任务、不计入任务进度；任务内批量录入也可在上方选择关联任务，或从任务详情「网格录成绩」进入。"/>
      <div class="rg-pick-grid">
        <div class="rg-pick-col">
          <div class="rg-pick-head">
            <b>{{ pickTaskId ? '任务参测队员（全部纳入）' : '① 选择队员' }}</b>
            <span class="rg-pick-count">
              {{ pickTaskId ? `共 ${displayAthletes.length} 人` : `已选 ${pickedAthletes.length} 人` }}
            </span>
          </div>
          <div v-if="!pickTaskId" class="rg-pick-filter">
            <select v-model="pickTeam" class="rg-sel">
              <option :value="null">全部队伍</option>
              <option v-for="t in teamOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-model="pickKeyword" class="rg-inp" placeholder="姓名筛选"/>
          </div>
          <el-table ref="athleteTableRef" :data="displayAthletes" row-key="athleteId"
                    height="340" size="small" @selection-change="onAthleteSelection">
            <el-table-column v-if="!pickTaskId" type="selection" width="42" reserve-selection/>
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
            <b>{{ pickTaskId ? '任务测试项（指标 + 模型，全部纳入）' : '② 选择指标' }}</b>
            <span class="rg-pick-count">
              {{ pickTaskId
                ? `共 ${displayIndicators.length} 项（指标 ${taskLock.indicators.length} · 模型 ${(taskLock.models || []).length}）`
                : `已选 ${pickedIndicators.length} 项` }}
            </span>
          </div>
          <el-table ref="indicatorTableRef" :data="displayIndicators" row-key="id"
                    height="340" size="small" @selection-change="onIndicatorSelection">
            <el-table-column v-if="!pickTaskId" type="selection" width="42"/>
            <el-table-column :label="pickTaskId ? '测试项' : '指标'" min-width="150">
              <template #default="{ row }">
                <div class="rg-ind-name">{{ row.name }}</div>
                <div class="rg-ind-sub">
                  <span class="rg-code">{{ row.code }}</span>
                  <span v-if="row.category" class="rg-cat" :class="{ 'is-model': row.kind === 'model' }">{{ row.category }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="单位/方向" width="100">
              <template #default="{ row }">
                <template v-if="row.kind === 'model'">
                  <span class="rg-dir">模型</span>
                </template>
                <template v-else>
                  <span class="rg-unit">{{ row.unit || '—' }}</span>
                  <span class="rg-dir">{{ dirShort(row.evaluationDirection) }}</span>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <!-- ============ 网格录入（任务模式直达；散录选完人/指标后进入） ============ -->
    <div v-if="mode === 'task' || pickedReady" class="rg-grid-wrap" v-show="!submitted">
      <!-- 维度切换：直接指标 / 模型测试（任务配置了模型项时显示；模型维度一次铺开所有模型） -->
      <div v-if="gridMode === 'MODEL' || taskModelItems.length" class="rg-dim-bar">
        <div class="rg-dim-switch">
          <button type="button" class="rg-dim-btn" :class="{ 'is-active': gridMode === 'INDICATOR' }"
                  @click="switchDimension('INDICATOR')">直接指标</button>
          <button type="button" class="rg-dim-btn" :class="{ 'is-active': gridMode === 'MODEL' }"
                  @click="switchDimension('MODEL')">模型测试（{{ taskModelItems.length }} 个）</button>
        </div>
        <span v-if="gridMode === 'MODEL'" class="rg-dim-hint">
          已铺开全部模型的数值采集项共 {{ columns.length }} 列，按现场实测填写、每人每模型至少 1 格、留空跳过；派生项保存后自动计算
        </span>
      </div>
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

      <el-alert v-if="gridMode === 'INDICATOR' && modelItemsCount > 0" type="info" :closable="false" show-icon style="margin-bottom:8px"
                :title="`任务另有 ${modelItemsCount} 个模型测试项，可在上方切换到「模型测试」录入；派生字段保存后自动计算`"/>

      <div v-if="!columns.length" class="rg-no-indicator" v-loading="modelLoading">
        {{ gridMode === 'MODEL'
          ? '任务模型没有可网格录入的数值型采集字段（可能全为文本/派生项），请用队员行的「录成绩」逐个填写。'
          : '该任务还没有直接指标测试项，请先在「测试项」Tab 添加指标。' }}
      </div>
      <div v-else ref="gridScrollRef" class="rg-table-scroll" v-loading="bestLoading || modelLoading">
        <table class="rg-table">
          <thead>
            <!-- 模型维度：按模型分组双行表头 -->
            <template v-if="gridMode === 'MODEL'">
              <tr>
                <th class="rg-col-name" rowspan="2">队员</th>
                <th v-for="g in modelColumnGroups" :key="g.modelId"
                    class="rg-th-group" :colspan="g.cols.length">{{ g.modelName }}</th>
              </tr>
              <tr>
                <template v-for="g in modelColumnGroups" :key="g.modelId">
                  <th v-for="c in g.cols" :key="c.key" class="rg-col-input">
                    <div class="rg-th-name">{{ c.name }}</div>
                    <div class="rg-th-sub">
                      <span class="rg-code">{{ c.code }}</span>
                      <span class="rg-unit">{{ c.unit || '—' }}</span>
                    </div>
                  </th>
                </template>
              </tr>
            </template>
            <!-- 指标维度：单行表头 -->
            <tr v-else>
              <th class="rg-col-name">队员</th>
              <th v-for="c in columns" :key="c.key" class="rg-col-input">
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
              <td v-for="c in columns" :key="c.key">
                <input
                  class="rg-cell"
                  :class="cellClass(row, c)"
                  v-model="row.values[c.key]"
                  inputmode="decimal"
                  :placeholder="gridMode === 'INDICATOR' ? bestText(row.athleteId, c.indicatorId) : ''"
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
          <el-button type="primary" :loading="pickLoading" :disabled="pickLoading || !canBuildGrid"
                     @click="nextFromPick">
            {{ pickTaskId ? '下一步：按任务录入' : '下一步：录入成绩' }}
          </el-button>
        </template>
        <template v-else>
          <el-button :disabled="saving" @click="mode === 'free' ? (pickedReady = false) : close()">
            {{ mode === 'free' ? '上一步' : '取消' }}
          </el-button>
          <el-button type="primary" :loading="saving"
                     :disabled="!columns.length || !personsWithData || hardCount > 0"
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
import { listTestTask, getTestTask } from '@/api/apms/testTask'
import { listField } from '@/api/apms/testModel'
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
const columns = ref([])                // 指标列 {kind:'indicator',indicatorId,...} 或模型列 {kind:'model',fieldId,fieldKey,...}
const gridRows = ref([])               // { athleteId, athleteName, athleteGender, athleteTeam, values:{列key:''} }
// 维度：INDICATOR 直接指标 | MODEL 全部模型字段同表
const gridMode = ref('INDICATOR')
const taskModelItems = ref([])         // 任务 MODEL 测试项 [{modelId,modelCode,modelName}]
const indicatorColumns = ref([])       // 任务指标列快照（切回指标时还原）
const modelColumns = ref([])           // 全部模型数值字段列（扁平，含 modelId）
const modelLoading = ref(false)
const measureDate = ref(today())
const sessionKey = ref('')
const bestMap = ref({})                // `${athleteId}:${indicatorId}` → 最佳值
const bestLoading = ref(false)

// 散录选人/选指标
const athleteTableRef = ref(null)
const indicatorTableRef = ref(null)
const gridScrollRef = ref(null)
// 表格列从无到有（新任务/维度异步加载完成）时，把横向滚动归位：
// el-dialog 默认不销毁内容，滚动容器会保留上次任务/维度的 scrollLeft，
// 新表格打开时左侧队员列看起来就是"被滚走"的一片空白
watch(columns, (val, old) => {
  if (val.length && !(old && old.length)) {
    nextTick(() => {
      // 列从无到有（新任务/维度异步加载完成）：横纵滚动都归位。
      // el-dialog 不销毁内容，滚动容器会残留上次的 scrollLeft/scrollTop，
      // 新表格一打开就是"被滚走一截"的错位状态
      if (gridScrollRef.value) {
        gridScrollRef.value.scrollLeft = 0
        gridScrollRef.value.scrollTop = 0
      }
    })
  }
})
const athleteLib = ref([])
const indicatorLib = ref([])
const pickedAthletes = ref([])
const pickedIndicators = ref([])
const pickedReady = ref(false)
const pickTeam = ref(null)
const pickKeyword = ref('')
// 散录页可选关联任务：选中后两张表立即切换为该任务成员/指标并锁定全选
const taskOptions = ref([])
const pickTaskId = ref(null)
const pickLoading = ref(false)
// 任务锁定快照（行结构对齐下方两张选择表）：{ task, members:[{athleteId,name,gender,primaryTeamName}], indicators:[指标库同构] }
const taskLock = ref(null)

// 选择表数据源：任务态 = 任务成员/指标（锁定）；自由态 = 全量 + 筛选
const displayAthletes = computed(() => {
  if (pickTaskId.value && taskLock.value) return taskLock.value.members
  return filteredAthletes.value
})
const displayIndicators = computed(() => {
  if (pickTaskId.value && taskLock.value) {
    // 任务态：指标 + 模型项合并展示，让用户看到任务全部测试内容
    const ind = taskLock.value.indicators.map(i => ({ ...i, kind: 'indicator', typeLabel: '指标' }))
    const mdl = (taskLock.value.models || []).map(m => ({
      id: `M:${m.modelId}`,
      kind: 'model',
      typeLabel: '模型',
      code: m.modelCode,
      name: m.modelName,
      category: '模型',
      unit: '',
      evaluationDirection: ''
    }))
    return [...ind, ...mdl]
  }
  return indicatorLib.value
})
// 仅自由态显示勾选列；任务态全员/全项固定纳入，无勾选交互
function onAthleteSelection(rows) { pickedAthletes.value = rows }
function onIndicatorSelection(rows) { pickedIndicators.value = rows }

// 切换任务：即时拉取任务详情，重绘两张表并全选；清空则恢复全量自由勾选
let pickSeq = 0
watch(pickTaskId, async (id, oldId) => {
  if (id === oldId) return
  const seq = ++pickSeq
  // 先清旧选择（reserve-selection 跨数据源会残留）
  athleteTableRef.value?.clearSelection()
  indicatorTableRef.value?.clearSelection()
  pickedAthletes.value = []
  pickedIndicators.value = []
  taskLock.value = null
  if (!id) return
  pickLoading.value = true
  try {
    const res = await getTestTask(id)
    if (seq !== pickSeq) return // 期间又切换了，丢弃过期结果
    const task = res.data
    if (!task) {
      pickTaskId.value = null
      return proxy.$modal.msgWarning('任务不存在或已被删除')
    }
    const lib = await loadIndicatorLib()
    if (seq !== pickSeq) return
    const libMap = new Map(lib.map(i => [i.id, i]))
    const indicatorIds = new Set()
    const indicators = []
    ;(task.items || [])
      .filter(it => it.itemType === 'INDICATOR' && it.indicatorId != null)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .forEach(it => {
        const meta = libMap.get(it.indicatorId) || {}
        if (indicatorIds.has(it.indicatorId)) return
        indicatorIds.add(it.indicatorId)
        indicators.push({
          id: it.indicatorId,
          code: it.indicatorCode || meta.code || '',
          name: it.indicatorName || meta.name || it.indicatorCode || ('指标#' + it.indicatorId),
          category: meta.category || '',
          unit: it.indicatorUnit || meta.unit || '',
          evaluationDirection: it.indicatorDirection || meta.evaluationDirection || ''
        })
      })
    // 任务模型项（去重）：确认页要展示，网格模型维度要按它们加载字段
    const modelIds = new Set()
    const models = []
    ;(task.items || [])
      .filter(it => it.itemType === 'MODEL' && it.modelId != null)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .forEach(it => {
        if (modelIds.has(it.modelId)) return
        modelIds.add(it.modelId)
        models.push({
          modelId: it.modelId,
          modelCode: it.modelCode || '',
          modelName: it.modelName || it.modelCode || ('模型#' + it.modelId)
        })
      })
    const members = (task.members || []).map(m => ({
      athleteId: m.athleteId,
      name: m.athleteName,
      gender: m.athleteGender,
      primaryTeamName: m.athleteTeam
    }))
    taskLock.value = { task, members, indicators, models }
  } catch (e) {
    if (seq === pickSeq) proxy.$modal.msgError(e?.msg || e?.message || '加载任务详情失败')
  } finally {
    if (seq === pickSeq) pickLoading.value = false
  }
})

// 提交
const saving = ref(false)
const submitted = ref(false)
const commitResult = ref({ committed: 0, failed: 0, failedDetails: [] })

const dialogTitle = computed(() => {
  const id = taskCtx.id || (pickedReady.value ? null : pickTaskId.value)
  if (id) {
    const name = taskCtx.name || taskOptions.value.find(t => t.id === id)?.taskName || ''
    return `网格录入成绩 · ${name || ('任务 #' + id)}`
  }
  return '网格录入成绩（散录）'
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

// ========= 按任务构建录入矩阵（任务抽屉入口 / 散录页选任务 共用） =========
// task 兼容两种形态：抽屉传入 { taskId, taskName, items, members }；
// getTestTask 返回 { id, taskName, items, members }
async function buildTaskGrid(task) {
  const id = task.taskId ?? task.id
  taskCtx.id = id
  taskCtx.name = task.taskName || ''
  measureDate.value = today()
  sessionKey.value = ''

  const lib = await loadIndicatorLib()
  const libMap = new Map(lib.map(i => [i.id, i]))

  // task.items 来自 getTestTask 详情；task.members 同
  const items = task.items || []
  const rawModelItems = items.filter(it => it.itemType === 'MODEL' && it.modelId != null)
  modelItemsCount.value = rawModelItems.length
  // 分组表头按模型去重（同一模型可能被任务重复添加，重复会导致字段列翻倍）；
  // 名称缺失（如模型行已被删除导致 JOIN 为空）时回退编码/占位，避免分组标题整格空白
  const taskModelMap = new Map()
  rawModelItems.forEach(it => {
    if (!taskModelMap.has(it.modelId)) {
      taskModelMap.set(it.modelId, {
        modelId: it.modelId,
        modelCode: it.modelCode || '',
        modelName: it.modelName || it.modelCode || ('模型#' + it.modelId)
      })
    }
  })
  taskModelItems.value = [...taskModelMap.values()]
  gridMode.value = 'INDICATOR'
  modelColumns.value = []

  indicatorColumns.value = items
    .filter(it => it.itemType === 'INDICATOR' && it.indicatorId != null)
    .map(it => {
      const meta = libMap.get(it.indicatorId) || {}
      return {
        kind: 'indicator',
        key: `I:${it.indicatorId}`,
        indicatorId: it.indicatorId,
        code: it.indicatorCode || meta.code || '',
        name: it.indicatorName || meta.name || it.indicatorCode || ('指标#' + it.indicatorId),
        unit: it.indicatorUnit || meta.unit || '',
        direction: it.indicatorDirection || meta.evaluationDirection || ''
      }
    })
  columns.value = indicatorColumns.value

  // 任务没有直接指标、只挂了模型时，直接落到「模型测试」维度，
  // 否则用户先看到一张空表，必须再手动切一次维度
  if (!indicatorColumns.value.length && taskModelItems.value.length) {
    gridMode.value = 'MODEL'
    columns.value = []
  }

  gridRows.value = (task.members || []).slice(0, MAX_ROWS).map(m => ({
    athleteId: m.athleteId,
    athleteName: m.athleteName,
    athleteGender: m.athleteGender,
    athleteTeam: m.athleteTeam,
    values: {}
  }))
  pickedReady.value = true
  loadBestValues()
  // 预加载模型字段，切到「模型测试」时即时呈现（不阻塞指标录入）
  if (rawModelItems.length) loadAllModelColumns()
  // 重新建表（如连续打开不同任务）时滚动容器是复用的，强制归零，
  // 否则沿用上一个任务残留的横纵滚动位置
  nextTick(() => {
    if (gridScrollRef.value) {
      gridScrollRef.value.scrollLeft = 0
      gridScrollRef.value.scrollTop = 0
    }
  })
}

// ========= 模型维度：一次铺开任务下全部模型的数值字段 =========
const NUMERIC_TYPES = ['decimal', 'number']
// 分组表头：[{ modelId, modelName, cols:[列...] }]
const modelColumnGroups = computed(() => {
  const groups = []
  const byId = new Map()
  modelColumns.value.forEach(c => {
    if (!byId.has(c.modelId)) {
      const g = { modelId: c.modelId, modelName: c.modelName || ('模型#' + c.modelId), cols: [] }
      byId.set(c.modelId, g)
      groups.push(g)
    }
    byId.get(c.modelId).cols.push(c)
  })
  return groups
})

function clearRowValues() {
  gridRows.value.forEach(r => { r.values = {} })
}

// 加载任务全部模型的数值型 INPUT 字段（并行），文本/派生字段不进网格
async function loadAllModelColumns() {
  if (!taskModelItems.value.length) { modelColumns.value = []; columns.value = []; return }
  modelLoading.value = true
  try {
    const results = await Promise.all(taskModelItems.value.map(m =>
      listField(m.modelId).then(res => ({ model: m, fields: res.data || [] })).catch(() => ({ model: m, fields: [] }))
    ))
    const cols = []
    results.forEach(({ model, fields }) => {
      fields
        .filter(f => f.collectMode !== 'DERIVED' && NUMERIC_TYPES.includes((f.dataType || '').toLowerCase()))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .forEach(f => cols.push({
          kind: 'model',
          key: `M:${model.modelId}:${f.id}`,
          modelId: model.modelId,
          modelName: model.modelName,
          fieldId: f.id,
          fieldKey: f.fieldKey,
          code: f.fieldKey,
          name: f.fieldName,
          unit: f.unit || ''
        }))
    })
    modelColumns.value = cols
    // 预加载只填充模型列快照；只有当前确实停留在「模型测试」维度时才替换表格列。
    // 否则用户还在「直接指标」维度时预加载返回，模型字段会窜进指标的单行表头，
    // 表现为分组行消失、队员列错位等整表错乱。
    if (gridMode.value === 'MODEL') columns.value = cols
  } finally {
    modelLoading.value = false
  }
}

function switchDimension(dim) {
  if (gridMode.value === dim) return
  clearRowValues()
  gridMode.value = dim
  if (dim === 'INDICATOR') {
    columns.value = indicatorColumns.value
    loadBestValues()
  } else {
    columns.value = modelColumns.value
    // 尚未加载过（如刚进任务弹窗）则拉取全部模型字段
    if (!modelColumns.value.length && taskModelItems.value.length) loadAllModelColumns()
  }
  // 切换维度后表头列数/行数变化，横纵位置归位，避免首列被残留偏移裁掉、
  // 或双行表头停留在 sticky 重叠的滚动位置
  nextTick(() => {
    if (gridScrollRef.value) {
      gridScrollRef.value.scrollLeft = 0
      gridScrollRef.value.scrollTop = 0
    }
  })
}

// ========= 任务模式入口（任务详情抽屉） =========
async function openForTask(task) {
  mode.value = 'task'
  submitted.value = false
  saving.value = false
  commitResult.value = { committed: 0, failed: 0, failedDetails: [] }
  visible.value = true
  await buildTaskGrid(task)
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
  pickTaskId.value = null
  taskLock.value = null
  measureDate.value = today()
  sessionKey.value = ''
  columns.value = []
  gridRows.value = []
  modelItemsCount.value = 0
  taskModelItems.value = []
  indicatorColumns.value = []
  modelColumns.value = []
  gridMode.value = 'INDICATOR'
  taskCtx.id = null
  taskCtx.name = ''
  commitResult.value = { committed: 0, failed: 0, failedDetails: [] }
  visible.value = true

  const loadTasks = listTestTask({ pageNum: 1, pageSize: 999 })
    .then(res => { taskOptions.value = res.rows || [] }).catch(() => {})
  await Promise.all([loadIndicatorLib(), loadAthleteLib(), loadTasks])
  nextTick(() => {
    athleteTableRef.value?.clearSelection()
    indicatorTableRef.value?.clearSelection()
  })
}

// 散录页「下一步」：选了任务 → 直接用已加载的任务快照建矩阵；未选 → 按勾选的人/指标自由组表
function nextFromPick() {
  if (pickTaskId.value) {
    if (!taskLock.value) return // 任务详情仍在加载
    buildTaskGrid(taskLock.value.task)
    return
  }
  if (!canBuildGrid.value) return
  buildFreeGrid()
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
const canBuildGrid = computed(() => {
  // 任务态：任务已加载、有成员有指标即可（勾选由系统锁定）
  if (pickTaskId.value) {
    return !!taskLock.value && taskLock.value.members.length > 0 && taskLock.value.indicators.length > 0
  }
  return pickedAthletes.value.length > 0 && pickedIndicators.value.length > 0
    && pickedAthletes.value.length <= MAX_ROWS
})

function buildFreeGrid() {
  taskCtx.id = null
  taskCtx.name = ''
  gridMode.value = 'INDICATOR'
  taskModelItems.value = []
  modelColumns.value = []
  indicatorColumns.value = pickedIndicators.value.map(i => ({
    kind: 'indicator',
    key: `I:${i.id}`,
    indicatorId: i.id,
    code: i.code,
    name: i.name,
    unit: i.unit || '',
    direction: i.evaluationDirection || ''
  }))
  columns.value = indicatorColumns.value
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

// ========= 实时校验 =========
function cellLevel(row, col) {
  const raw = row.values[col.key]
  if (raw === '' || raw == null || String(raw).trim() === '') return ''
  const num = Number(String(raw).trim())
  if (!Number.isFinite(num)) return 'invalid'
  // 模型字段无范围字典，只做数字校验
  if (col.kind === 'model') return ''
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
  if (col.kind === 'model') return ''
  const range = getIndicatorRange(col.code)
  if (isHard(level)) return hardMessage(range, row.values[col.key])
  if (isWarn(level)) return warnMessage(range, row.values[col.key])
  return ''
}
const filledCells = computed(() => gridRows.value.reduce((s, r) =>
  s + columns.value.filter(c => String(r.values[c.key] ?? '').trim() !== '').length, 0))
const personsWithData = computed(() => gridRows.value.filter(r =>
  columns.value.some(c => String(r.values[c.key] ?? '').trim() !== '')).length)
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
  const isModel = gridMode.value === 'MODEL'
  const rows = []
  gridRows.value.forEach(r => {
    const cells = []
    columns.value.forEach(c => {
      const raw = String(r.values[c.key] ?? '').trim()
      if (raw === '') return
      if (isModel) {
        // 每个 cell 带所属模型 id；后端按模型分组，每模型生成一条 result
        cells.push({ modelId: c.modelId, fieldId: c.fieldId, fieldKey: c.fieldKey, value: Number(raw) })
      } else {
        cells.push({ indicatorId: c.indicatorId, value: Number(raw) })
      }
    })
    if (cells.length) rows.push({ athleteId: r.athleteId, cells })
  })
  return {
    taskId: taskCtx.id || null,
    itemType: isModel ? 'MODEL' : 'INDICATOR',
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
  pickTaskId.value = null
  taskLock.value = null
  pickedAthletes.value = []
  pickedIndicators.value = []
  pickTeam.value = null
  pickKeyword.value = ''
  gridMode.value = 'INDICATOR'
  taskModelItems.value = []
  indicatorColumns.value = []
  modelColumns.value = []
}

defineExpose({ openForTask, openFree })
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rg-pick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
/* 任务态勾选框锁定（el-checkbox 禁用观感由 :selectable=false 提供，这里只弱化不可改列的光标） */
.rg-pick-grid :deep(.el-checkbox.is-disabled) { cursor: not-allowed; }
.rg-pick-task {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-bottom: 12px; padding: 10px 12px;
  border: 1px solid $rk-line; border-radius: 10px; background: #f8faff;
}
.rg-pick-task-label { font-size: 13px; font-weight: 600; color: $rk-text-1; white-space: nowrap; }
.rg-pick-task-hint { font-size: 12px; color: $rk-text-3; }
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

/* 维度切换条 */
.rg-dim-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 10px; padding: 8px 10px;
  border: 1px solid $rk-line; border-radius: 10px; background: #f8faff;
}
.rg-dim-switch { display: inline-flex; border: 1px solid $rk-brand-600; border-radius: 8px; overflow: hidden; }
.rg-dim-btn {
  border: 0; background: #fff; color: $rk-brand-600;
  padding: 6px 16px; font-size: 13px; cursor: pointer;
}
.rg-dim-btn.is-active { background: $rk-brand-600; color: #fff; }
.rg-dim-hint { font-size: 12px; color: $rk-text-3; }
.rg-dim-warn { font-size: 12px; color: $rk-warn; font-weight: 500; }
.rg-req-star { color: $rk-risk; margin-left: 2px; font-style: normal; }
/* 模型分组表头（第一行）：左对齐贴第一列，避免 colspan 很宽时居中标题被横向滚动裁出视野。
   高度必须固定：第二行表头 sticky 的 top 偏移要精确等于本行高度，
   否则纵向滚动时两行会错位 1px；改高度时两处一起改。 */
.rg-th-group {
  background: #eef2ff !important;
  color: $rk-brand-700;
  font-size: 12.5px;
  font-weight: 600;
  text-align: left !important;
  vertical-align: middle;
  border-left: 2px solid #c7d2fe;
  white-space: nowrap;
  box-sizing: border-box;
  height: 38px;
  padding: 8px 10px !important;
}
.rg-cat.is-model { background: #ede9fe; color: #6d28d9; }

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
/* 模型维度双行表头：两行都 sticky 且默认 top:0 时，纵向滚动后第二行会整个
   盖在第一行（模型分组蓝条消失、表头下方出现白段）。第二行必须下移第一行的高度。
   指标维度只有一个 tr，:nth-child(2) 不匹配，不受影响。 */
.rg-table thead tr:nth-child(2) th { top: 38px; }
.rg-table tbody td { padding: 6px 8px; background: #fff; }
.rg-table tbody tr:nth-child(even) td { background: #fafbfe; }
.rg-col-name {
  position: sticky; left: 0; z-index: 3; min-width: 130px;
  border-right: 1px solid $rk-line !important;
  vertical-align: middle; /* 双行分组表头 rowspan=2 时文字居中，避免顶部大片空白 */
}
/* vertical-align 必须写在 .rg-table thead th 同等级或更高特异性的选择器上：
   基础表头规则 (0,1,2) 的 vertical-align:top 会压掉普通单类选择器，
   导致 rowspan=2 时「队员」贴顶、下方留一大块空白。这里用 (0,2,2) 确保生效 */
.rg-table thead th.rg-col-name {
  z-index: 4;
  background: #f7f9fc !important;
  vertical-align: middle;
}
.rg-th-name { font-size: 12px; font-weight: 600; color: $rk-text-1; white-space: nowrap; }
.rg-th-sub { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.rg-col-input { min-width: 108px; }
/* 正文队员列同样 sticky：只有表头 sticky 时，横向滚动后姓名会被滚走、
   左下列一片空白（输入框从第二列开始直接顶到最左）。必须不透明背景，
   否则右侧单元格会从 sticky 列底下透出来 */
.rg-table tbody td.rg-name-cell {
  position: sticky; left: 0; z-index: 1;
  background: #fff;
  border-right: 1px solid $rk-line;
}
.rg-table tbody tr:nth-child(even) td.rg-name-cell { background: #fafbfe; }

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
