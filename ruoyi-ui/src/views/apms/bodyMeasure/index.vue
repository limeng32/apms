<template>
  <div class="app-container" :class="{ 'is-embedded': embedded }">
    <div class="rk-dash-page rk-page pm-page">

      <!-- ===== 页头（合并页内也保留：统计信息 + 测量周期/新增测量入口） ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">体态测量</h1>
          <p class="rk-subtitle">{{ summary.total }} 条测量记录 · {{ summary.athletes }} 名队员 · 周期测量与趋势追踪</p>
        </div>
        <div class="rk-header-actions">
          <el-button class="rk-btn" @click="importDialogRef?.open()"
                     v-hasPermi="['apms:body:edit']">
            <el-icon><Upload /></el-icon>批量导入
          </el-button>
          <el-button type="primary" class="rk-btn rk-btn-primary" @click="showAddDialog"
                     v-hasPermi="['apms:body:edit']">
            <el-icon><Plus /></el-icon>新增测量
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="pm-tabs">
        <el-tab-pane label="测量台账" name="ledger">

      <!-- ===== KPI 卡带 ===== -->
      <div class="rk-kpi-grid is-4">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 筛选 ===== -->
      <div class="rk-filter pm-filter">
        <label class="rk-group">
          <span class="rk-label">队员</span>
          <input v-model="filters.keyword" class="rk-input" type="text" placeholder="队员姓名" />
        </label>
        <label class="rk-group">
          <span class="rk-label">队伍</span>
          <select v-model="filters.deptId" class="rk-select pm-select-team">
            <option :value="null">全部队伍</option>
            <option v-for="d in flatDepts" :key="d.deptId" :value="d.deptId">
              {{ '\u3000'.repeat(d.depth) }}{{ d.deptName }}
            </option>
          </select>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetFilter">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 测量记录表 ===== -->
      <div v-loading="loading" class="rk-table-card">
        <div class="rk-table-scroll">
          <table class="rk-table pm-table">
            <thead>
              <tr>
                <th>队员</th>
                <th class="text-center col-date">测量日期</th>
                <th class="text-right col-height">身高(cm)</th>
                <th class="text-right col-weight">体重(kg)</th>
                <th class="text-right col-sit">坐高(cm)</th>
                <th class="text-right col-leg">腿长(cm)</th>
                <th class="text-right col-fat">体脂(%)</th>
                <th class="text-right col-waist">腰围(cm)</th>
                <th class="text-right col-bmi">BMI</th>
                <th class="text-center col-source">来源</th>
                <th>周期</th>
                <th class="text-right col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in pagedData" :key="row.id" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                <td>
                  <button type="button" class="pm-person-btn" @click="openHistory(row)">
                    <div class="rk-person">
                      <span class="rk-avatar pm-avatar" :style="{ background: avatarColor(row) }">
                        {{ (row.athleteName || '?').charAt(0) }}
                      </span>
                      <div class="rk-person-meta">
                        <span class="rk-person-main">
                          {{ row.athleteName || '—' }}
                          <GenderBadge :gender="row.athleteGender" :size="15" class="pm-gender"/>
                        </span>
                        <span class="rk-person-sub">{{ row.athleteTeam || '无队伍' }} · #{{ row.athleteId }}</span>
                      </div>
                    </div>
                  </button>
                </td>
                <td class="text-center rk-mono">{{ row.measureDate || '—' }}</td>
                <td class="text-right rk-mono col-height">
                  <span v-if="row.height != null" :class="{ 'pm-val-abnormal': abnormal('height', row.height) }"
                        :title="abnormal('height', row.height) ? rangeTitle('height') : ''">{{ row.height }}</span>
                  <span v-else>—</span>
                </td>
                <td class="text-right rk-mono col-weight">
                  <span v-if="row.weight != null" :class="{ 'pm-val-abnormal': abnormal('weight', row.weight) }"
                        :title="abnormal('weight', row.weight) ? rangeTitle('weight') : ''">{{ row.weight }}</span>
                  <span v-else>—</span>
                </td>
                <td class="text-right rk-mono col-sit">
                  <span v-if="row.sitHeight != null" :class="{ 'pm-val-abnormal': abnormal('sitHeight', row.sitHeight) }"
                        :title="abnormal('sitHeight', row.sitHeight) ? rangeTitle('sitHeight') : ''">{{ row.sitHeight }}</span>
                  <span v-else>—</span>
                </td>
                <td class="text-right rk-mono col-leg">{{ calcLeg(row) }}</td>
                <td class="text-right rk-mono col-fat">
                  <span v-if="row.bodyFatRate != null" :class="{ 'pm-val-abnormal': abnormal('bodyFatRate', row.bodyFatRate) }"
                        :title="abnormal('bodyFatRate', row.bodyFatRate) ? rangeTitle('bodyFatRate') : ''">{{ row.bodyFatRate }}</span>
                  <span v-else>—</span>
                </td>
                <td class="text-right rk-mono col-waist">
                  <span v-if="row.waist != null" :class="{ 'pm-val-abnormal': abnormal('waist', row.waist) }"
                        :title="abnormal('waist', row.waist) ? rangeTitle('waist') : ''">{{ row.waist }}</span>
                  <span v-else>—</span>
                </td>
                <td class="text-right col-bmi">
                  <span v-if="row.height && row.weight" class="pm-bmi rk-mono">{{ calcBmi(row) }}</span>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-source">
                  <span v-if="row.dataSource" class="rk-status-badge" :class="sourceMeta(row.dataSource).tone">
                    <i class="rk-status-dot"></i>{{ sourceMeta(row.dataSource).label }}
                  </span>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td>
                  <span v-if="cycleNameMap[row.cycleId]" class="pm-cycle-chip">{{ cycleNameMap[row.cycleId] }}</span>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-right">
                  <div class="rk-actions">
                    <button type="button" class="rk-link" @click="openHistory(row)">趋势图</button>
                    <button type="button" class="rk-link" @click="showEditDialog(row)"
                            v-hasPermi="['apms:body:edit']">编辑</button>
                    <button type="button" class="rk-link pm-link-danger" @click="handleDelete(row)"
                            v-hasPermi="['apms:body:remove']">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="!loading && filteredData.length === 0" class="rk-empty">
            <p class="rk-empty-title">{{ hasFilter ? '没有匹配的测量记录' : '暂无体态测量记录' }}</p>
            <p class="rk-empty-desc">{{ hasFilter ? '请调整筛选条件后重试' : '点击右上角「新增测量」录入第一条记录' }}</p>
          </div>
        </div>
        <RkPager v-if="!loading && filteredData.length > PAGE_SIZE" v-model:page="page" :total="filteredData.length" :page-size="PAGE_SIZE" unit="条"/>
      </div>

        </el-tab-pane>

        <el-tab-pane label="测量周期" name="cycle" lazy>
          <MeasureCyclePanel ref="cyclePanelRef" @detail="openCycleDetail" @changed="loadCycleNames"/>
        </el-tab-pane>
      </el-tabs>

      <!-- 队员历史抽屉（只读：趋势图 + 历史记录） -->
      <AthleteMeasureDrawer ref="historyDrawerRef"/>
      <!-- 周期详情/批量录入 -->
      <CycleDetailDialog ref="cycleDetailRef" @saved="loadCycleNames"/>

      <!-- ========= 新增/编辑弹窗 ========= -->
      <el-dialog :title="editForm.id ? '编辑体态测量' : '新增体态测量'" v-model="showEdit" width="520px">
        <el-form :model="editForm" label-width="100px">
          <el-form-item label="队员" required>
            <el-select v-model="editForm.athleteId" placeholder="选择队员" filterable style="width:100%">
              <el-option v-for="a in athleteOpts" :key="a.athleteId"
                         :label="`${a.name} (${a.primaryTeamName || '—'})`"
                         :value="a.athleteId"/>
            </el-select>
          </el-form-item>
          <el-form-item label="测量日期" required>
            <el-date-picker v-model="editForm.measureDate" type="date" value-format="YYYY-MM-DD"
                            placeholder="选择日期" style="width:100%"/>
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="身高(cm)">
                <el-input-number v-model="editForm.height" :precision="1" :step="0.5"
                                :min="rangeOf('height').hardMin" :max="rangeOf('height').hardMax"
                                @change="checkField('height')"/>
                <p v-if="hints.height" class="pm-range-hint">{{ hints.height }}</p>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="体重(kg)">
                <el-input-number v-model="editForm.weight" :precision="1" :step="0.5"
                                :min="rangeOf('weight').hardMin" :max="rangeOf('weight').hardMax"
                                @change="checkField('weight')"/>
                <p v-if="hints.weight" class="pm-range-hint">{{ hints.weight }}</p>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="坐高(cm)">
                <el-input-number v-model="editForm.sitHeight" :precision="1" :step="0.5"
                                :min="rangeOf('sitHeight').hardMin" :max="rangeOf('sitHeight').hardMax"
                                @change="checkField('sitHeight')"/>
                <p v-if="hints.sitHeight" class="pm-range-hint">{{ hints.sitHeight }}</p>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="体脂率(%)">
                <el-input-number v-model="editForm.bodyFatRate" :precision="1" :step="0.5"
                                :min="rangeOf('bodyFatRate').hardMin" :max="rangeOf('bodyFatRate').hardMax"
                                @change="checkField('bodyFatRate')"/>
                <p v-if="hints.bodyFatRate" class="pm-range-hint">{{ hints.bodyFatRate }}</p>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="腰围(cm)">
            <el-input-number v-model="editForm.waist" :precision="1" :step="0.5"
                            :min="rangeOf('waist').hardMin" :max="rangeOf('waist').hardMax"
                            @change="checkField('waist')"/>
            <p v-if="hints.waist" class="pm-range-hint">{{ hints.waist }}</p>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showEdit = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
        </template>
      </el-dialog>

      <!-- Excel/CSV 批量导入（两阶段预览） -->
      <import-preview-dialog
        ref="importDialogRef"
        title="体态测量批量导入"
        preview-url="/apms/body-measure/import/preview"
        commit-url="/apms/body-measure/import/commit"
        template-url="apms/body-measure/import/template"
        allow-overwrite
        :tips="['列：运动员编号、姓名、测量日期、身高、体重、坐高、体脂率、腰围', '同队员同日期已有手工/任务/周期记录时不可导入；已有批量导入记录可勾选覆盖', '超合理区间（如身高 99cm）会黄色提示需确认，超物理范围（如 24cm）直接跳过']"
        @success="handleImportSuccess"
      />
    </div>
  </div>
</template>

<script setup name="ApmsBodyMeasure">

// 嵌入模式：由合并页（dispatch/growth/comboDispatch）堆叠使用
defineProps({ embedded: { type: Boolean, default: false } })
import { list as listMeasures, upsert, delMeasure } from '@/api/apms/bodyMeasure'
import { listAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'
import { listCycle } from '@/api/apms/measureCycle'
import { Plus, RefreshLeft, Upload } from '@element-plus/icons-vue'
import AthleteMeasureDrawer from './components/AthleteMeasureDrawer.vue'
import MeasureCyclePanel from './components/MeasureCyclePanel.vue'
import CycleDetailDialog from './components/CycleDetailDialog.vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import RkPager from '@/components/RkPager/index.vue'
import ImportPreviewDialog from '@/components/ImportPreviewDialog/index.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'
import {
  loadRanges, getBodyRange, classify, isHard, isWarn, isAbnormal,
  hardMessage, warnMessage, collectBodyIssues
} from '@/utils/measureRange'

const { proxy } = getCurrentInstance()

// 预加载录入区间字典（失败静默，工具内置默认兜底）
loadRanges().catch(() => {})
function rangeOf(key) { return getBodyRange(key) }

// 弹窗字段越界实时提示
const hints = reactive({ height: '', weight: '', sitHeight: '', bodyFatRate: '', waist: '' })
function checkField(key) {
  const range = getBodyRange(key)
  const level = classify(range, editForm[key])
  if (isHard(level) || level === 'invalid') hints[key] = hardMessage(range, editForm[key])
  else if (isWarn(level)) hints[key] = warnMessage(range, editForm[key])
  else hints[key] = ''
}
// 列表异常值标红判定
function abnormal(key, v) {
  return isAbnormal(classify(getBodyRange(key), v))
}
function rangeTitle(key) {
  const r = getBodyRange(key)
  return `合理区间 ${r.warnMin}~${r.warnMax}${r.unit ? ' ' + r.unit : ''}`
}

const activeTab = ref('ledger')
const historyDrawerRef = ref(null)
const cycleDetailRef = ref(null)
const importDialogRef = ref(null)
function handleImportSuccess() { loadList(); loadCycleNames(); historyDrawerRef.value?.reload() }
const cyclePanelRef = ref(null)
const cycleNameMap = ref({})

/* 周期 id→名称（台账周期列） */
async function loadCycleNames() {
  try {
    const res = await listCycle({ pageNum: 1, pageSize: 999 })
    const map = {}
    for (const c of (res.rows || [])) map[c.id] = c.name
    cycleNameMap.value = map
  } catch { /* 演示模式等无接口场景静默 */ }
}

function openHistory(row) {
  historyDrawerRef.value?.open({ athleteId: row.athleteId, athleteName: row.athleteName })
}
function openCycleDetail(cycle) {
  cycleDetailRef.value?.open(cycle.id)
}

const loading = ref(false)
const rawData = ref([])
const deptOpts = ref([])
const athleteOpts = ref([])
const filters = reactive({ keyword: '', deptId: null })
const showEdit = ref(false)
const saving = ref(false)
const editForm = reactive({
  id: null, athleteId: null, measureDate: null,
  height: null, weight: null, sitHeight: null,
  bodyFatRate: null, waist: null, dataSource: 'manual'
})

/* ===== 展示辅助（口径与原页一致） ===== */
const avatarColor = (row) => ageAvatarColor(row.athleteAge)
const calcLeg = (r) => r.height && r.sitHeight ? (r.height - r.sitHeight).toFixed(1) : '—'
const calcBmi = (r) => {
  if (!r.height || !r.weight) return null
  const m = r.height / 100
  return (r.weight / (m * m)).toFixed(1)
}
const SOURCE_META = {
  manual: { tone: 'tone-gray', label: '手动录入' },
  csv: { tone: 'tone-amber', label: 'CSV 导入' },
  task: { tone: 'tone-green', label: '测量任务' },
  cycle: { tone: 'tone-blue', label: '测量周期' },
  import: { tone: 'tone-amber', label: '导入' }
}
const sourceMeta = (s) => SOURCE_META[s] || { tone: 'tone-gray', label: s || '—' }

/* ===== 部门树拍平（原生 select 用，缩进体现层级） ===== */
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

/* ===== 汇总（全部记录口径） ===== */
const summary = reactive({ total: 0, athletes: 0, avgHeight: '—', avgBmi: '—' })
function buildSummary(arr) {
  summary.total = arr.length
  summary.athletes = new Set(arr.map(r => r.athleteId)).size
  const heights = arr.filter(r => r.height != null).map(r => Number(r.height))
  summary.avgHeight = heights.length ? (heights.reduce((a, b) => a + b, 0) / heights.length).toFixed(1) : '—'
  const bmis = arr.map(calcBmi).filter(v => v != null).map(Number)
  summary.avgBmi = bmis.length ? (bmis.reduce((a, b) => a + b, 0) / bmis.length).toFixed(1) : '—'
}

const kpiCards = computed(() => [
  { label: '测量记录总数', value: summary.total, unit: '条', accent: '#2563EB',
    chip: summary.athletes + ' 名队员', chipTone: 'tone-info' },
  { label: '覆盖队员数', value: summary.athletes, unit: '人', accent: '#06B6D4',
    chip: '按 DataScope 隔离', chipTone: '' },
  { label: '平均身高', value: summary.avgHeight, unit: 'cm', accent: '#16A34A',
    chip: '全队记录均值', chipTone: '' },
  { label: '平均 BMI', value: summary.avgBmi, accent: '#8B5CF6',
    chip: '体重 / 身高²', chipTone: '' }
])

/* ===== 列表加载 + 前端筛选（姓名 + 队伍；全量返回本地过滤），固定每页 10 条本地分页 ===== */
const PAGE_SIZE = 10
const page = ref(1)
const hasFilter = computed(() => !!(filters.keyword.trim() || filters.deptId != null))
const filteredData = computed(() => {
  let arr = rawData.value
  const kw = filters.keyword.trim()
  if (kw) arr = arr.filter(r => (r.athleteName || '').includes(kw))
  if (filters.deptId != null) {
    const dept = flatDepts.value.find(d => d.deptId === filters.deptId)
    if (dept) arr = arr.filter(r => r.athleteTeam === dept.deptName)
  }
  return arr
})
// 筛选变化回到第 1 页；删除等导致条数减少时防止页码越界
watch(() => [filters.keyword, filters.deptId], () => { page.value = 1 })
watch(filteredData, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  if (page.value > maxPage) page.value = maxPage
})
const pagedData = computed(() =>
  filteredData.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function loadList() {
  loading.value = true
  listMeasures({}).then(res => {
    rawData.value = res.data || []
    buildSummary(rawData.value)
  }).finally(() => { loading.value = false })
}
function resetFilter() { filters.keyword = ''; filters.deptId = null }

Promise.all([
  listAthlete({ pageNum: 1, pageSize: 500 }),
  listDept({ pageNum: 1, pageSize: 500 })
]).then(([a, d]) => {
  athleteOpts.value = a.rows || []
  deptOpts.value = Array.isArray(d.data) ? d.data : []
})

function clearHints() {
  Object.keys(hints).forEach(k => { hints[k] = '' })
}
function showAddDialog() {
  Object.assign(editForm, { id: null, athleteId: null, measureDate: new Date().toISOString().slice(0, 10),
    height: null, weight: null, sitHeight: null, bodyFatRate: null, waist: null, dataSource: 'manual' })
  clearHints()
  showEdit.value = true
}
function showEditDialog(row) {
  Object.assign(editForm, { ...row })
  clearHints()
  Object.keys(hints).forEach(k => checkField(k))
  showEdit.value = true
}
function doSubmitEdit() {
  saving.value = true
  upsert(editForm).then(() => {
    proxy.$modal.msgSuccess('保存成功')
    showEdit.value = false
    loadList()
    historyDrawerRef.value?.reload()
  }).finally(() => saving.value = false)
}
function submitEdit() {
  if (!editForm.athleteId || !editForm.measureDate) {
    proxy.$modal.msgWarning('队员和测量日期必填')
    return
  }
  const { hard, warn } = collectBodyIssues(editForm)
  // 硬限（物理不可能值）：直接拦截；后端还会兜底再拦一次
  if (hard.length) {
    proxy.$modal.msgError(hard[0])
    return
  }
  // 超出合理区间但在硬限内：汇总弹确认，确认后可保存
  if (warn.length) {
    proxy.$modal.confirm(
      '以下数值超出合理区间，确认数据无误仍要保存吗？\n· ' + warn.join('\n· '),
      '异常值确认'
    ).then(doSubmitEdit).catch(() => {})
    return
  }
  doSubmitEdit()
}
function handleDelete(row) {
  proxy.$modal.confirm(`确认删除 ${row.athleteName} 的测量记录 (${row.measureDate}) 吗？`, '删除测量记录').then(() => {
    delMeasure(row.id).then(() => { proxy.$modal.msgSuccess('已删除'); loadList() })
  }).catch(() => {})
}

loadList()
loadCycleNames()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.pm-tabs { margin-top: 4px; }
:deep(.pm-tabs .el-tabs__header) { margin-bottom: 14px; }

.pm-person-btn { background: none; border: 0; padding: 0; cursor: pointer; text-align: left; width: 100%; }

/* 录入弹窗：超出合理区间的字段下方浅红小字 */
.pm-range-hint {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: $rk-risk;
}
/* 列表：异常值（超合理区间/硬限）标红 */
.pm-val-abnormal {
  color: $rk-risk;
  font-weight: 600;
}
.pm-person-btn .rk-person-main { display: inline-flex; align-items: center; gap: 6px; }
.pm-person-btn:hover .rk-person-main { color: #2563eb; }
.pm-cycle-chip {
  display: inline-block; background: #eff6ff; color: #2563eb; border-radius: 10px;
  padding: 1px 9px; font-size: 11px; white-space: nowrap;
}

.pm-filter { margin-bottom: 14px; }
.pm-select-team { width: 170px; }

/* 数值单元格 */
.pm-avatar { width: 32px; height: 32px; font-size: 13px; }
.pm-bmi { font-size: 13px; font-weight: 600; color: $rk-text-1; }
.pm-link-danger { color: $rk-risk; &:hover { color: #b91c1c; } }

/* 列宽与密度 */
.pm-table .col-index { width: 44px; }
.pm-table .col-date { width: 96px; }
.pm-table .col-height,
.pm-table .col-weight,
.pm-table .col-sit,
.pm-table .col-leg,
.pm-table .col-fat,
.pm-table .col-waist,
.pm-table .col-bmi { width: 76px; }
.pm-table .col-source { width: 104px; }
.pm-table .col-actions { width: 110px; }
.pm-table :is(thead th, tbody td) { padding-left: 12px; padding-right: 12px; }

@media (max-width: 1320px) {
  .pm-table .col-waist { display: none; }
}
@media (max-width: 1180px) {
  .pm-table .col-sit,
  .pm-table .col-fat { display: none; }
}
@media (max-width: 1000px) {
  .pm-table .col-leg { display: none; }
}

/* ===== 嵌入模式：供合并页堆叠（隐藏页头、归零满铺外壳） ===== */
.app-container.is-embedded {
  padding: 0;
  :deep(.rk-dash-page) {
    margin: 0;
    padding: 0;
    min-height: 0;
    background: transparent;
  }
}

</style>
