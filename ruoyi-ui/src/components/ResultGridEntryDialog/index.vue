<template>
  <el-dialog :title="dialogTitle" v-model="visible" width="920px" append-to-body
             class="rg-dialog" :close-on-click-modal="false" @closed="reset">

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
            <span class="rg-pick-head-right">
              <button v-if="isNarrow && !pickTaskId" type="button" class="rg-pl-all"
                      @click="toggleAllAthletes">{{ isAthleteAllPicked ? '清空' : '全选' }}</button>
              <span class="rg-pick-count">
                {{ pickTaskId ? `共 ${displayAthletes.length} 人` : `已选 ${pickedAthletes.length} 人` }}
              </span>
            </span>
          </div>
          <div v-if="!pickTaskId" class="rg-pick-filter">
            <select v-model="pickTeam" class="rg-sel">
              <option :value="null">全部队伍</option>
              <option v-for="t in teamOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-model="pickKeyword" class="rg-inp" placeholder="姓名筛选"/>
          </div>
          <!-- 桌面：el-table 保留原交互 -->
          <el-table v-if="!isNarrow" ref="athleteTableRef" :data="displayAthletes" row-key="athleteId"
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
          <!-- 窄屏：全宽清单行，消除 el-table 表内横滚与表头裁切 -->
          <div v-else class="rg-pick-list">
            <div v-for="row in displayAthletes" :key="row.athleteId"
                 class="rg-pl-row" :class="{ 'is-on': !pickTaskId && isAthletePicked(row) }"
                 @click="toggleAthlete(row)">
              <span v-if="!pickTaskId" class="rg-pl-check" :class="{ 'is-on': isAthletePicked(row) }"></span>
              <span v-else class="rg-pl-lock">已纳入</span>
              <span class="rg-pl-main">
                <span class="rg-pl-name">
                  <span class="rg-aname">{{ row.name }}</span>
                  <GenderBadge :gender="row.gender" :size="13"/>
                </span>
                <span v-if="row.primaryTeamName" class="rg-pl-sub">{{ row.primaryTeamName }}</span>
              </span>
            </div>
            <div v-if="!displayAthletes.length" class="rg-pl-empty">暂无符合条件的队员</div>
          </div>
        </div>
        <div class="rg-pick-col">
          <div class="rg-pick-head">
            <b>{{ pickTaskId ? '任务测试项（指标 + 模型，全部纳入）' : '② 选择指标' }}</b>
            <span class="rg-pick-head-right">
              <button v-if="isNarrow && !pickTaskId" type="button" class="rg-pl-all"
                      @click="toggleAllIndicators">{{ isIndicatorAllPicked ? '清空' : '全选' }}</button>
              <span class="rg-pick-count">
                {{ pickTaskId
                  ? `共 ${displayIndicators.length} 项（指标 ${taskLock.indicators.length} · 模型 ${(taskLock.models || []).length}）`
                  : `已选 ${pickedIndicators.length} 项` }}
              </span>
            </span>
          </div>
          <!-- 桌面：el-table 保留原交互 -->
          <el-table v-if="!isNarrow" ref="indicatorTableRef" :data="displayIndicators" row-key="id"
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
          <!-- 窄屏：全宽清单行，单位/方向移到行尾，不再被横滚裁切 -->
          <div v-else class="rg-pick-list">
            <div v-for="row in displayIndicators" :key="row.id"
                 class="rg-pl-row" :class="{ 'is-on': !pickTaskId && isIndicatorPicked(row) }"
                 @click="toggleIndicator(row)">
              <span v-if="!pickTaskId" class="rg-pl-check" :class="{ 'is-on': isIndicatorPicked(row) }"></span>
              <span v-else class="rg-pl-lock">已纳入</span>
              <span class="rg-pl-main">
                <div class="rg-ind-name">{{ row.name }}</div>
                <div class="rg-ind-sub">
                  <span class="rg-code">{{ row.code }}</span>
                  <span v-if="row.category" class="rg-cat" :class="{ 'is-model': row.kind === 'model' }">{{ row.category }}</span>
                </div>
              </span>
              <span class="rg-pl-right">
                <template v-if="row.kind === 'model'">
                  <span class="rg-dir">模型</span>
                </template>
                <template v-else>
                  <span class="rg-unit">{{ row.unit || '—' }}</span>
                  <span class="rg-dir">{{ dirShort(row.evaluationDirection) }}</span>
                </template>
              </span>
            </div>
            <div v-if="!displayIndicators.length" class="rg-pl-empty">暂无符合条件的指标</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 演示态：明确告知写入不持久，避免刷新后数据归零被误认为系统故障 -->
    <el-alert v-if="isDemoMode()" type="warning" :closable="false" show-icon class="rg-demo-alert"
              title="演示模式：录入的成绩只保存在当前标签页，刷新页面或退出演示后会还原为样本数据，不会写入真实系统。"/>

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
          本次已填 <b class="rg-mono">{{ touchedCells }}</b> 格 · 涉及 <b class="rg-mono">{{ touchedPersons }}</b> 人
          <template v-if="modelItemsCount > 0">
            （指标 {{ indTouchedCells }} · 模型 {{ modelTouchedCells }}，切换页签不清空，可一次提交）
          </template>
          <template v-if="echoCells">
            · 已带出 <b class="rg-mono">{{ echoCells }}</b> 格已有成绩（原样保留，修改后才作为新尝试提交）
          </template>
          · 留空自动跳过
        </span>
      </div>

      <el-alert v-if="gridMode === 'INDICATOR' && modelItemsCount > 0" type="info" :closable="false" show-icon style="margin-bottom:8px"
                :title="`任务另有 ${modelItemsCount} 个模型测试项：切到上方「模型测试」页签继续填写，本页已填成绩会保留，最后一次提交同时保存两类成绩；派生字段保存后自动计算`"/>

      <div v-if="!columns.length" class="rg-no-indicator" v-loading="modelLoading">
        {{ gridMode === 'MODEL'
          ? '任务模型没有可网格录入的数值型采集字段（可能全为文本/派生项），请用队员行的「录成绩」逐个填写。'
          : '该任务还没有直接指标测试项，请先在「测试项」Tab 添加指标。' }}
      </div>
      <template v-else>
      <!-- 桌面：完整二维矩阵，首列 sticky + 容器横滚 -->
      <div v-if="!isNarrow" ref="gridScrollRef" class="rg-table-scroll" v-loading="echoLoading || modelLoading">
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
                  :class="[cellClass(row, c), { 'is-echo': isEchoCell(row, c) }]"
                  v-model="row.values[c.key]"
                  inputmode="decimal"
                  :title="isEchoCell(row, c) ? '已有成绩，修改后将作为新尝试提交' : ''"
                  @input="markTouched(row, c)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 窄屏：按测项分页——每屏 1 个测项 + 全队纵向录入，chip/箭头/横滑三种换列方式。
           数据仍写 row.values[activeCol.key]，草稿槽、校验、提交 payload 与桌面完全共用 -->
      <div v-else class="rg-mobile-grid" v-loading="echoLoading || modelLoading">
        <div class="rg-colnav">
          <button type="button" class="rg-colstep" :disabled="activeColIndex === 0"
                  aria-label="上一个测项" @click="prevCol">‹</button>
          <span class="rg-colpos">第 {{ activeColIndex + 1 }} / {{ columns.length }} 项</span>
          <button type="button" class="rg-colstep" :disabled="activeColIndex >= columns.length - 1"
                  aria-label="下一个测项" @click="nextCol">›</button>
        </div>
        <div ref="colbarRef" class="rg-colbar">
          <template v-for="(g, gi) in mobileColGroups" :key="gi">
            <span v-if="g.groupName" class="rg-colgroup">{{ g.groupName }}</span>
            <button v-for="c in g.cols" :key="c.key" type="button"
                    class="rg-colchip"
                    :class="{
                      'is-active': activeCol && c.key === activeCol.key,
                      'is-hard': colLevelState(c) === 'hard',
                      'is-warn': colLevelState(c) === 'warn'
                    }"
                    @click="gotoCol(columns.indexOf(c))">
              <span class="rg-colchip-name">{{ c.name }}</span>
              <span class="rg-colchip-meta">
                <i v-if="colLevelState(c)" class="rg-coldot"
                   :class="{ 'is-hard': colLevelState(c) === 'hard' }"></i>
                {{ colFilledCount(c) }}/{{ gridRows.length }}
              </span>
            </button>
          </template>
        </div>
        <div v-if="activeCol" class="rg-mhead">
          <div class="rg-mhead-name">{{ activeCol.name }}</div>
          <div class="rg-th-sub">
            <span class="rg-code">{{ activeCol.code }}</span>
            <span class="rg-unit">{{ activeCol.unit || '—' }}</span>
            <span v-if="gridMode === 'INDICATOR'" class="rg-dir">{{ dirShort(activeCol.direction) }}</span>
            <span v-else class="rg-cat is-model">{{ activeCol.modelName }}</span>
          </div>
        </div>
        <div ref="mobileGridRef" class="rg-mlist"
             @touchstart.passive="onGridTouchStart" @touchend="onGridTouchEnd">
          <div v-for="row in gridRows" :key="row.athleteId" class="rg-mrow">
            <div class="rg-mname">
              <span class="rg-aname">{{ row.athleteName || '未命名' }}</span>
              <GenderBadge :gender="row.athleteGender" :size="13"/>
              <div v-if="row.athleteTeam" class="rg-team">{{ row.athleteTeam }}</div>
            </div>
            <input
              class="rg-cell rg-mcell"
              :class="[cellClass(row, activeCol), { 'is-echo': isEchoCell(row, activeCol) }]"
              v-model="row.values[activeCol.key]"
              inputmode="decimal"
              :title="isEchoCell(row, activeCol) ? '已有成绩，修改后将作为新尝试提交' : ''"
              @input="markTouched(row, activeCol)"
            />
          </div>
        </div>
      </div>
      </template>
      <p v-if="hardCount" class="rg-hard-tip">有 {{ hardCount }} 个成绩不是数字或超出允许范围（红框），请修正后再提交</p>
    </div>

    <!-- ============ 提交结果 ============ -->
    <div v-if="submitted" class="rg-result">
      <el-result :icon="resultIcon" :title="resultTitle"
                 :sub-title="`成功 ${commitResult.committed} 人 · 失败 ${commitResult.failed} 人`
                   + (commitResult.skipped ? ` · 跳过 ${commitResult.skipped} 人` : '')"/>
      <ul v-if="commitResult.failedDetails?.length" class="rg-fail-list">
        <li v-for="(d, i) in commitResult.failedDetails" :key="i">{{ d }}</li>
      </ul>
      <p class="rg-rep-hint">新录入的成绩默认成为当前结果（同项目取最新一次，可在测试结果台账手动改选）；同项目再次提交会记为新的尝试（attempt），错误尝试可在台账删除。</p>
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
                     :disabled="(!indicatorColumns.length && !modelColumns.length) || !touchedCells || hardCount > 0"
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
import { isDemoMode } from '@/utils/auth'

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

/**
 * 网格行工厂：两个维度的草稿分别存放在 indValues / modelValues，
 * values 始终指向「当前展示维度」的那个槽——切换页签只换引用、不清空，
 * 混合任务（指标+模型）可以在同一次弹窗里填完两类成绩后一起提交。
 */
function makeGridRow(m) {
  const indValues = {}
  return {
    athleteId: m.athleteId,
    athleteName: m.athleteName,
    athleteGender: m.athleteGender,
    athleteTeam: m.athleteTeam ?? m.primaryTeamName ?? '',
    values: indValues,
    indValues,
    modelValues: {},
    // 本次弹窗用户实际编辑过的列 key 集合。带出的已有成绩不在其中——
    // 只有 touched 格子才进提交体，避免历史成绩被重复记为新 attempt
    touched: {},
    // 模型维度已有成绩缓存（模型列异步加载，先按 modelId:fieldId / modelId::fieldKey 存原始值）
    modelEcho: {}
  }
}

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
const echoLoading = ref(false)         // 已有成绩带出请求进行中（网格 v-loading）

// 散录选人/选指标
const athleteTableRef = ref(null)
const indicatorTableRef = ref(null)
const gridScrollRef = ref(null)

// ============ 窄屏（≤768px）形态分支：清单行选择 + 按测项分页录入 ============
// 断点与 h5-pager-drawer-ux 规范统一；桌面端模板完全不走这套分支，原有表格零影响
const viewportWidth = ref(window.innerWidth)
function onViewportResize() { viewportWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onViewportResize))
onBeforeUnmount(() => window.removeEventListener('resize', onViewportResize))
const isNarrow = computed(() => viewportWidth.value <= 768)

// 窄屏录入：当前停留的测项列（分页矩阵一次只呈现一列）
const activeColIndex = ref(0)
const colbarRef = ref(null)
const mobileGridRef = ref(null)
const activeCol = computed(() => {
  const cols = columns.value
  if (!cols.length) return null
  return cols[Math.min(activeColIndex.value, cols.length - 1)]
})
// chip 条结构：模型维度按模型分组，指标维度合成单个无名组，模板只认一种结构
const mobileColGroups = computed(() => {
  if (gridMode.value === 'MODEL') {
    return modelColumnGroups.value.map(g => ({ groupName: g.modelName, cols: g.cols }))
  }
  return [{ groupName: '', cols: columns.value }]
})
// 某测项列已填人数（chip 上的 3/6 进度）
function colFilledCount(col) {
  return gridRows.value.reduce((n, r) =>
    n + (String(r.values[col.key] ?? '').trim() !== '' ? 1 : 0), 0)
}
// 列级状态点：分页态看不到全表，用红/橙点提示该列存在硬错/告警，帮助定位问题测项
function colLevelState(col) {
  let warn = false
  for (const r of gridRows.value) {
    // 状态点只反映本次新输入的问题，不带出历史成绩的区间分级
    if (!r.touched[col.key]) continue
    const lv = cellLevel(r, col)
    if (lv === 'invalid' || isHard(lv)) return 'hard'
    if (isWarn(lv)) warn = true
  }
  return warn ? 'warn' : ''
}
function gotoCol(i) {
  const n = columns.value.length
  if (!n) return
  activeColIndex.value = Math.max(0, Math.min(i, n - 1))
}
function prevCol() { gotoCol(activeColIndex.value - 1) }
function nextCol() { gotoCol(activeColIndex.value + 1) }
// 翻页后：活动 chip 滚到可视区中央、队员列表回顶（测站轮转通常从第一名队员重填）
watch(activeColIndex, () => {
  nextTick(() => {
    colbarRef.value?.querySelector('.rg-colchip.is-active')
      ?.scrollIntoView({ inline: 'center', behavior: 'smooth' })
    if (mobileGridRef.value) mobileGridRef.value.scrollTop = 0
  })
})
// 列集合整体更换（切维度/换任务/异步模型列到达）：分页归零，避免停在不存在的列上
watch(columns, () => { activeColIndex.value = 0 })
// 触摸横滑翻页：仅水平位移占主导时触发，纵向滚动交给原生，互不抢占
let touchStartX = 0
let touchStartY = 0
function onGridTouchStart(e) {
  const t = e.touches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}
function onGridTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    dx < 0 ? nextCol() : prevCol()
  }
}
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

// 窄屏清单行的勾选维护（桌面 el-table 仍走 selection-change；两套写入同一个 picked 数组，
// 下一步 canBuildGrid/buildFreeGrid 无需感知来源）
const isAthleteAllPicked = computed(() => {
  const rows = displayAthletes.value
  return rows.length > 0 && pickedAthletes.value.length === rows.length
})
function isAthletePicked(row) {
  return pickedAthletes.value.some(a => a.athleteId === row.athleteId)
}
function toggleAthlete(row) {
  if (pickTaskId.value) return // 任务态锁定，行点击不响应
  const idx = pickedAthletes.value.findIndex(a => a.athleteId === row.athleteId)
  if (idx >= 0) pickedAthletes.value.splice(idx, 1)
  else pickedAthletes.value.push(row)
}
function toggleAllAthletes() {
  pickedAthletes.value = isAthleteAllPicked.value ? [] : displayAthletes.value.slice()
}
const isIndicatorAllPicked = computed(() => {
  const rows = displayIndicators.value
  return rows.length > 0 && pickedIndicators.value.length === rows.length
})
function isIndicatorPicked(row) {
  return pickedIndicators.value.some(i => i.id === row.id)
}
function toggleIndicator(row) {
  if (pickTaskId.value) return
  const idx = pickedIndicators.value.findIndex(i => i.id === row.id)
  if (idx >= 0) pickedIndicators.value.splice(idx, 1)
  else pickedIndicators.value.push(row)
}
function toggleAllIndicators() {
  pickedIndicators.value = isIndicatorAllPicked.value ? [] : displayIndicators.value.slice()
}

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

  gridRows.value = (task.members || []).slice(0, MAX_ROWS).map(m => makeGridRow(m))
  // 任务无直接指标时直接落在模型维度，values 指针也要切到模型草稿槽
  if (gridMode.value === 'MODEL') gridRows.value.forEach(r => { r.values = r.modelValues })
  pickedReady.value = true
  // 已有成绩带出与模型字段预加载并发：两者都完成后再补一次模型 hydrate，
  // 消除「模型列先到、echo 后到」或反之的竞态（两个函数内部也各自防御性 hydrate）
  const echoTask = loadExistingValues()
  const modelTask = rawModelItems.length ? loadAllModelColumns() : null
  Promise.all([echoTask, modelTask].filter(Boolean)).then(hydrateModelEcho).catch(() => {})
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
// 网格只承载数值采集：text 型字段（如 YOYO 的「规程版本」protocol_version）有意排除——
// 网格提交契约 Cell.value 为 BigDecimal、只写 numericValue，文本无承载通道；
// 这类描述性元数据由 ResultEntryDialog 手动录入/编辑（走 textValue）承接。
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
    // 列到达即尝试灌入已有模型成绩（echo 未就绪时 no-op，由 loadExistingValues 收尾补灌）
    hydrateModelEcho()
  } finally {
    modelLoading.value = false
  }
}

function switchDimension(dim) {
  if (gridMode.value === dim) return
  // 切换不清空：当前 values 本身就是对应草稿槽的引用，
  // 只需把 values 指针换到目标维度的槽，已填成绩原样保留（v-model 直接写在槽对象上）
  gridMode.value = dim
  gridRows.value.forEach(r => {
    r.values = dim === 'INDICATOR' ? r.indValues : r.modelValues
  })
  if (dim === 'INDICATOR') {
    columns.value = indicatorColumns.value
    // 已有成绩在建表时一次性带出并驻留 indValues，切页签只换指针，无需重新请求
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
  gridRows.value = pickedAthletes.value.slice(0, MAX_ROWS).map(a => makeGridRow({
    athleteId: a.athleteId,
    athleteName: a.name,
    athleteGender: a.gender,
    primaryTeamName: a.primaryTeamName || ''
  }))
  pickedReady.value = true
  // 散录不绑定任务，无「该队员在该任务下的已有成绩」可带出，网格从空白开始
}

// ========= 已有成绩带出（只要存在任务上下文即可：任务抽屉入口 / 散录里选关联任务 都生效） =========
// 取每条结果当前选中的代表记录（isSelected=1，新口径=最新一次）直接灌进对应格子，用户打开即见历史成绩。
// 关键语义：带出值不写 touched——未修改就不进提交体，不会把历史成绩重复记为新 attempt；
// 用户一旦输入（markTouched），该格才按新尝试提交。
// 注意：判据是 taskCtx.id 而非 mode==='task'——散录弹窗选了关联任务后同样走 buildTaskGrid，
// taskCtx.id 有值但 mode 仍是 'free'，按 mode 闸门会把这条路径的带出误杀。
// 纯散录（不选任务）taskCtx.id=null，by-task-member 无任务可查，网格从空白开始。
async function loadExistingValues() {
  if (!gridRows.value.length) return
  if (!taskCtx.id) return
  echoLoading.value = true
  try {
    const tasks = gridRows.value.map(async row => {
      let list = []
      try {
        list = (await listByTaskMember(taskCtx.id, row.athleteId)).data || []
      } catch { /* 带出失败不阻塞录入，格子留空即可 */ return }
      for (const r of list) {
        if (r.isSelected !== '1') continue
        if (r.itemType === 'INDICATOR' && r.indicatorId != null) {
          const main = (r.values || []).find(v => v.fieldKey === 'result') || (r.values || [])[0]
          const v = main ? (main.numericValue ?? main.textValue) : null
          if (v == null) continue
          const key = `I:${r.indicatorId}`
          // 异步返回可能晚于用户输入：已触碰或已填的格子绝不覆盖
          if (!row.touched[key] && String(row.indValues[key] ?? '').trim() === '') {
            row.indValues[key] = String(v)
          }
        } else if (r.itemType === 'MODEL' && r.modelId != null) {
          for (const v of (r.values || [])) {
            if (v.isDerived === '1' || v.numericValue == null) continue
            // 双键缓存：fieldId 与网格列 key 精确对应，fieldKey 作为旧数据缺 fieldId 时的兜底
            if (v.fieldId != null) row.modelEcho[`${r.modelId}:${v.fieldId}`] = v.numericValue
            if (v.fieldKey) row.modelEcho[`${r.modelId}::${v.fieldKey}`] = v.numericValue
          }
        }
      }
    })
    await Promise.all(tasks)
    hydrateModelEcho()
  } finally {
    echoLoading.value = false
  }
}
// 模型列异步到达后，把缓存的模型成绩灌进 modelValues。
// 与 loadExistingValues 并发、先后顺序不确定，两条路径各自收尾时都调一次，
// 任一方未就绪则本次 no-op，另一方完成后再灌，保证不丢不覆盖。
function hydrateModelEcho() {
  if (!modelColumns.value.length) return
  gridRows.value.forEach(row => {
    modelColumns.value.forEach(c => {
      if (row.touched[c.key] || String(row.modelValues[c.key] ?? '').trim() !== '') return
      const v = row.modelEcho[`${c.modelId}:${c.fieldId}`]
        ?? (c.fieldKey ? row.modelEcho[`${c.modelId}::${c.fieldKey}`] : null)
      if (v != null) row.modelValues[c.key] = String(v)
    })
  })
}
function markTouched(row, col) { row.touched[col.key] = true }
// 带出值视觉态：有值且用户未触碰。输入即 reactive 消失
function isEchoCell(row, col) {
  return String(row.values[col.key] ?? '').trim() !== '' && !row.touched[col.key]
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
function cellHint(row, col, vals = row.values) {
  if (col.kind === 'model') return ''
  const level = levelOf(vals, col)
  if (!level || level === 'invalid') return ''
  const range = getIndicatorRange(col.code)
  if (isHard(level)) return hardMessage(range, vals[col.key])
  if (isWarn(level)) return warnMessage(range, vals[col.key])
  return ''
}
/** 某队员在指定列集合里本次实际编辑过的格数（带出的已有成绩不计） */
function touchedCountIn(cols, row) {
  return cols.filter(c => row.touched[c.key]).length
}
/** 某队员在指定列集合+草稿槽里「带出且未改」的格数 */
function echoCountIn(cols, vals, row) {
  return cols.filter(c => !row.touched[c.key] && String(vals[c.key] ?? '').trim() !== '').length
}
// 本次录入统计覆盖两个维度：停留在任意页签都能看到全部新填，混合任务一次提交两槽合计
const indTouchedCells = computed(() => gridRows.value.reduce((s, r) =>
  s + touchedCountIn(indicatorColumns.value, r), 0))
const modelTouchedCells = computed(() => gridRows.value.reduce((s, r) =>
  s + touchedCountIn(modelColumns.value, r), 0))
const touchedCells = computed(() => indTouchedCells.value + modelTouchedCells.value)
const touchedPersons = computed(() => gridRows.value.filter(r =>
  touchedCountIn(indicatorColumns.value, r) + touchedCountIn(modelColumns.value, r) > 0).length)
// 带出的已有成绩总量（统计行提示用，让用户知道多少格是历史数据）
const echoCells = computed(() => gridRows.value.reduce((s, r) =>
  s + echoCountIn(indicatorColumns.value, r.indValues, r)
  + echoCountIn(modelColumns.value, r.modelValues, r), 0))

/** 指定草稿值下的单元格等级（problemCells 跨维度扫描用，模板仍用 cellLevel 读当前槽） */
function levelOf(vals, col) {
  const raw = vals[col.key]
  if (raw === '' || raw == null || String(raw).trim() === '') return ''
  const num = Number(String(raw).trim())
  if (!Number.isFinite(num)) return 'invalid'
  if (col.kind === 'model') return '' // 模型字段无范围字典，只做数字校验
  const range = getIndicatorRange(col.code)
  if (!range) return ''
  return classify(range, num)
}
const problemCells = computed(() => {
  const out = []
  // 只校验本次编辑过的格子：带出的历史成绩即使不在当前区间字典内，也不能拦截新数据提交
  // 指标槽：范围字典分级
  gridRows.value.forEach(r => indicatorColumns.value.forEach(c => {
    if (!r.touched[c.key]) return
    const level = levelOf(r.indValues, c)
    if (level === 'invalid' || isHard(level)) out.push({ row: r, col: c, kind: 'hard', vals: r.indValues })
    else if (isWarn(level)) out.push({ row: r, col: c, kind: 'warn', vals: r.indValues })
  }))
  // 模型槽：只查非数字（红框硬错），无合理区间概念
  gridRows.value.forEach(r => modelColumns.value.forEach(c => {
    if (!r.touched[c.key]) return
    if (levelOf(r.modelValues, c) === 'invalid') {
      out.push({ row: r, col: c, kind: 'hard', vals: r.modelValues })
    }
  }))
  return out
})
const hardCount = computed(() => problemCells.value.filter(x => x.kind === 'hard').length)
const warnCells = computed(() => problemCells.value.filter(x => x.kind === 'warn'))

// 提交结果三态：成功 0/失败 0（全部跳过）时不能硬编码「全部录入成功」
const resultIcon = computed(() => {
  const c = commitResult.value
  if (c.failed) return 'warning'
  if (!c.committed) return 'info'
  return 'success'
})
const resultTitle = computed(() => {
  const c = commitResult.value
  if (c.committed && !c.failed) return '全部录入成功'
  if (c.committed && c.failed) return '部分队员未录入'
  if (!c.committed && c.failed) return '录入失败'
  return '没有可录入的成绩' // 0 成功 0 失败（全部跳过）
})

// ========= 提交 =========
/**
 * 按维度构造网格提交体（两槽独立）：
 * 指标批 itemType=INDICATOR、每指标一 cell；模型批 itemType=MODEL、
 * 每 cell 带 modelId/fieldId/fieldKey，后端按模型分组合并为一条 result。
 * 只返回有数据的批次——混合任务一次弹窗可同时产生两批。
 *
 * 两维度 touched 语义不同：
 * - 指标：一个指标一条独立 result，未触碰的格子绝不提交（防止历史成绩重复记 attempt）；
 * - 模型：一个模型一条 result、内含多字段。若只提交改过的字段，新 attempt 会是残片，
 *   丢掉该记录原有字段。因此按「本次触碰过的模型」分组，组内所有非空字段整体提交——
 *   改过的用新值、未改的用带出原值，新记录是完整快照；用户主动清空的字段（touched 但空）
 *   仍按空跳过，等同显式删除该字段值。未触碰的模型整体不产生新 attempt。
 */
function buildPayloads() {
  const common = {
    taskId: taskCtx.id || null,
    measureDate: measureDate.value,
    sessionKey: sessionKey.value || null
  }
  // 指标：逐格 touched 闸门
  const buildIndicator = () => {
    const rows = []
    gridRows.value.forEach(r => {
      const cells = []
      indicatorColumns.value.forEach(c => {
        if (!r.touched[c.key]) return
        const raw = String(r.indValues[c.key] ?? '').trim()
        if (raw === '') return
        cells.push({ indicatorId: c.indicatorId, value: Number(raw) })
      })
      if (cells.length) rows.push({ athleteId: r.athleteId, cells })
    })
    return rows.length ? { ...common, itemType: 'INDICATOR', rows } : null
  }
  // 模型：先圈定 touched 模型，再整体快照该模型的非空字段
  const buildModel = () => {
    const rows = []
    gridRows.value.forEach(r => {
      const touchedModelIds = new Set(
        modelColumns.value.filter(c => r.touched[c.key]).map(c => c.modelId)
      )
      if (!touchedModelIds.size) return
      const cells = []
      modelColumns.value.forEach(c => {
        if (!touchedModelIds.has(c.modelId)) return
        const raw = String(r.modelValues[c.key] ?? '').trim()
        if (raw === '') return
        cells.push({ modelId: c.modelId, fieldId: c.fieldId, fieldKey: c.fieldKey, value: Number(raw) })
      })
      if (cells.length) rows.push({ athleteId: r.athleteId, cells })
    })
    return rows.length ? { ...common, itemType: 'MODEL', rows } : null
  }
  return [buildIndicator(), buildModel()].filter(Boolean)
}

async function submit() {
  if (!measureDate.value) return proxy.$modal.msgWarning('请选择测试日期')
  if (!touchedPersons.value) return proxy.$modal.msgWarning('请至少填写一个成绩（带出的已有成绩未修改不会重复提交）')
  if (hardCount.value) return proxy.$modal.msgError('存在非数字或超出允许范围的成绩，请修正红框单元格')

  const payloads = buildPayloads()
  if (!payloads.length) return proxy.$modal.msgWarning('请至少填写一个成绩')
  const personCount = new Set(payloads.flatMap(p => p.rows.map(r => r.athleteId))).size
  // 实际入库字段数：模型部分字段修改时会同快照补带同模型其他字段，可能大于 touchedCells
  const payloadCellCount = payloads.reduce(
    (s, p) => s + p.rows.reduce((n, r) => n + r.cells.length, 0), 0)
  const warns = warnCells.value

  // 仅在存在「超出合理区间」的告警值时二次确认；正常数据点击即提交，避免多余弹窗打断现场录入
  if (warns.length) {
    const lines = warns.slice(0, 8).map(x => `· ${x.row.athleteName} ${x.col.name}：${cellHint(x.row, x.col, x.vals)}`)
    const confirmText = `以下 ${warns.length} 个成绩超出合理区间：\n${lines.join('\n')}`
      + `${warns.length > 8 ? `\n…等 ${warns.length} 项` : ''}\n\n`
      + `将为 ${personCount} 名队员提交 ${payloadCellCount} 项成绩（${measureDate.value}）。\n`
      + '同项目再次提交记为新尝试（attempt），默认取最新一次为当前结果；留空项目不产生记录。是否继续？'
    try {
      await proxy.$modal.confirm(confirmText, '异常值确认')
    } catch { return } // 用户主动取消
  }

  saving.value = true
  // 两维度顺序提交、合并 ImportCommitResult（任意一批网络失败则整体提示，不落半成品状态）
  const merged = { committed: 0, skipped: 0, failed: 0, failedDetails: [], skippedDetails: [] }
  try {
    for (const payload of payloads) {
      const res = await batchGridAdd(payload)
      const d = res.data || {}
      merged.committed += d.committed || 0
      merged.skipped += d.skipped || 0
      merged.failed += d.failed || 0
      merged.failedDetails.push(...(d.failedDetails || []))
      merged.skippedDetails.push(...(d.skippedDetails || []))
    }
    commitResult.value = merged
    submitted.value = true
    proxy.$modal.msgSuccess(`已提交：成功 ${merged.committed} 人`
      + (merged.skipped ? `，跳过 ${merged.skipped} 人` : '')
      + (merged.failed ? `，失败 ${merged.failed} 人（见明细）` : ''))
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
  echoLoading.value = false
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

.rg-demo-alert { margin-bottom: 12px; }

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
.rg-pick-head-right { display: flex; align-items: center; gap: 6px; }
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
  /* 带出的已有成绩：淡蓝底与新录入区分；用户一输入（touched）该类即移除 */
  &.is-echo { border-color: #b9cdf5; background: #eef4ff; color: $rk-text-2; }
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

  /* 关联任务条纵排：el-select 内联固定 340px，在 375px 内容区（约 297px）溢出，
     把弹窗 body 撑出横向滚动（图1 步骤整体可横晃的根因）。inline width 需 !important 覆盖 */
  .rg-pick-task { flex-direction: column; align-items: stretch; gap: 8px; }
  .rg-pick-task :deep(.el-select) { width: 100% !important; }
  /* 工具条固定宽控件兜底：max-width 可直接压过 inline width，极端窄视口不再撑破 */
  .rg-grid-tool .el-date-editor,
  .rg-grid-tool .el-input { max-width: 100%; }

  /* ===== 窄屏选择清单行（替代 el-table，全宽无表内横滚） ===== */
  .rg-pick-list {
    max-height: 320px; overflow-y: auto; overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    border: 1px solid $rk-line; border-radius: 10px; background: #fff;
  }
  .rg-pl-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; min-height: 46px;
    border-bottom: 1px solid #eef1f6; cursor: pointer;
    &:last-child { border-bottom: 0; }
    &.is-on { background: #f5f8ff; }
  }
  /* 自定义圆形勾选：原生 checkbox 在可点击行内会触发双次切换，纯视觉态由行点击驱动 */
  .rg-pl-check {
    flex: none; width: 20px; height: 20px; border-radius: 50%;
    border: 1.5px solid #c3cad6; background: #fff; position: relative;
    &.is-on { background: $rk-brand-600; border-color: $rk-brand-600; }
    &.is-on::after {
      content: ''; position: absolute; left: 6px; top: 2px;
      width: 5px; height: 9px;
      border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
    }
  }
  .rg-pl-lock {
    flex: none; font-size: 11px; color: $rk-brand-600;
    background: #eef2ff; border-radius: 999px; padding: 2px 8px; white-space: nowrap;
  }
  .rg-pl-main { flex: 1; min-width: 0; }
  .rg-pl-name { display: flex; align-items: center; gap: 4px; }
  .rg-pl-sub { display: block; margin-top: 2px; font-size: 11px; color: $rk-text-3; }
  .rg-pl-right { flex: none; display: flex; align-items: baseline; gap: 4px; white-space: nowrap; }
  .rg-pl-all {
    border: 0; background: none; padding: 4px 6px; min-height: auto;
    font-size: 12px; line-height: 1.4; color: $rk-brand-600;
  }
  .rg-pl-empty { padding: 24px 12px; text-align: center; font-size: 13px; color: $rk-text-3; }

  /* ===== 窄屏按测项分页录入 ===== */
  .rg-mobile-grid {
    position: relative;
    border: 1px solid $rk-line; border-radius: 12px; background: #fff; overflow: hidden;
  }
  .rg-colnav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px; background: #f7f9fc; border-bottom: 1px solid #eef1f6;
  }
  .rg-colpos { font-size: 12px; color: $rk-text-2; font-family: var(--app-font-mono); }
  .rg-colstep {
    width: 36px; height: 36px; padding: 0; min-height: auto;
    border-radius: 50%; border: 1px solid $rk-line; background: #fff;
    font-size: 18px; line-height: 1; color: $rk-brand-600;
    &:disabled { color: #b6bdc9; background: #f4f6fa; }
  }
  /* chip 条是窄屏唯一横向滚动承载，外层与队员列表均不设 overflow-x */
  .rg-colbar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; overflow-x: auto; overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid #eef1f6;
  }
  .rg-colgroup {
    flex: none; font-size: 11px; color: #6d28d9; background: #ede9fe;
    border-radius: 6px; padding: 3px 7px; white-space: nowrap;
  }
  .rg-colchip {
    flex: none; max-width: 150px; min-height: auto;
    border: 1px solid $rk-line; background: #fff; border-radius: 10px;
    padding: 6px 10px; text-align: left;
    &.is-active { border-color: $rk-brand-600; background: #eef2ff; }
    &.is-hard { border-color: rgba($rk-risk, .55); }
    &.is-warn { border-color: rgba($rk-warn, .65); }
  }
  .rg-colchip-name {
    display: block; max-width: 120px; font-size: 12px; font-weight: 600; color: $rk-text-1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rg-colchip-meta {
    display: flex; align-items: center; gap: 4px; margin-top: 2px;
    font-size: 10.5px; color: $rk-text-3; font-family: var(--app-font-mono);
  }
  .rg-coldot {
    width: 7px; height: 7px; border-radius: 50%; background: $rk-warn;
    &.is-hard { background: $rk-risk; }
  }
  .rg-mhead { padding: 10px 12px 4px; }
  .rg-mhead-name { font-size: 14px; font-weight: 700; color: $rk-text-1; }
  .rg-mlist {
    max-height: 48vh; overflow-y: auto; overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .rg-mrow {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; min-height: 58px; border-bottom: 1px solid #eef1f6;
    &:last-child { border-bottom: 0; }
  }
  .rg-mname { flex: 0 0 104px; width: 104px; min-width: 0; }
  .rg-mname .rg-aname {
    display: inline-block; max-width: 80px; vertical-align: middle;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rg-mname .rg-team { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 输入框近满宽、触摸目标 40px；16px 字号避免 iOS 聚焦时自动放大页面 */
  .rg-mcell { flex: 1; width: auto; min-width: 0; height: 40px; font-size: 16px; }
}
</style>

<!-- 非 scoped：el-dialog 经 teleport 挂到 body，需全局命中；类名 rg-dialog 限定作用域 -->
<style lang="scss">
/* 弹窗限高：header/footer 常驻可视区，仅 body 内部滚动。
   修复小高度/1062px 视口下「提交成绩」按钮被挤到屏外、首次点击落空的问题 */
.rg-dialog.el-dialog {
  margin: 4vh auto !important;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.rg-dialog .el-dialog__header { flex: none; }
.rg-dialog .el-dialog__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  /* 横向收口：滚动只允许发生在内部清单/ chip 条等自带容器，
     body 不允许被固定宽控件（如内联 340px 的 select）撑出整窗横晃 */
  overflow-x: hidden;
}
.rg-dialog .el-dialog__footer { flex: none; }
</style>
