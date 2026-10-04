<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page pm-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">体态测量</h1>
          <p class="rk-subtitle">{{ summary.total }} 条测量记录 · {{ summary.athletes }} 名队员 · 周期测量与趋势追踪</p>
        </div>
        <div class="rk-header-actions">
          <el-button class="rk-btn" @click="activeTab = 'cycle'">
            <el-icon><Calendar /></el-icon>测量周期
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
                <th class="text-center col-index">#</th>
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
              <tr v-for="(row, idx) in filteredData" :key="row.id" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                <td class="text-center rk-mono rk-dash">{{ idx + 1 }}</td>
                <td>
                  <button type="button" class="pm-person-btn" @click="openHistory(row)">
                    <div class="rk-person">
                      <span class="rk-avatar pm-avatar" :style="{ background: avatarColor(row) }">
                        {{ (row.athleteName || '?').charAt(0) }}
                      </span>
                      <div class="rk-person-meta">
                        <span class="rk-person-main">{{ row.athleteName || '—' }}</span>
                        <span class="rk-person-sub">{{ row.athleteTeam || '无队伍' }} · #{{ row.athleteId }}</span>
                      </div>
                    </div>
                  </button>
                </td>
                <td class="text-center rk-mono">{{ row.measureDate || '—' }}</td>
                <td class="text-right rk-mono col-height">{{ row.height ?? '—' }}</td>
                <td class="text-right rk-mono col-weight">{{ row.weight ?? '—' }}</td>
                <td class="text-right rk-mono col-sit">{{ row.sitHeight ?? '—' }}</td>
                <td class="text-right rk-mono col-leg">{{ calcLeg(row) }}</td>
                <td class="text-right rk-mono col-fat">{{ row.bodyFatRate ?? '—' }}</td>
                <td class="text-right rk-mono col-waist">{{ row.waist ?? '—' }}</td>
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
                <el-input-number v-model="editForm.height" :precision="1" :step="0.5" :min="100" :max="230"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="体重(kg)">
                <el-input-number v-model="editForm.weight" :precision="1" :step="0.5" :min="30" :max="150"/>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="坐高(cm)">
                <el-input-number v-model="editForm.sitHeight" :precision="1" :step="0.5" :min="40" :max="150"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="体脂率(%)">
                <el-input-number v-model="editForm.bodyFatRate" :precision="1" :step="0.5" :min="3" :max="40"/>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="腰围(cm)">
            <el-input-number v-model="editForm.waist" :precision="1" :step="0.5" :min="40" :max="150"/>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showEdit = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup name="ApmsBodyMeasure">
import { list as listMeasures, upsert, delMeasure } from '@/api/apms/bodyMeasure'
import { listAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'
import { listCycle } from '@/api/apms/measureCycle'
import { Plus, RefreshLeft, Calendar } from '@element-plus/icons-vue'
import AthleteMeasureDrawer from './components/AthleteMeasureDrawer.vue'
import MeasureCyclePanel from './components/MeasureCyclePanel.vue'
import CycleDetailDialog from './components/CycleDetailDialog.vue'

const { proxy } = getCurrentInstance()

const activeTab = ref('ledger')
const historyDrawerRef = ref(null)
const cycleDetailRef = ref(null)
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
const AVATAR_COLORS = ['#f0a23a', '#7b9dc9', '#c14747', '#5fa080', '#a878d8', '#d88a3a']
const avatarColor = (row) => AVATAR_COLORS[(row.athleteId || 0) % AVATAR_COLORS.length]
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

/* ===== 列表加载 + 前端筛选（姓名 + 队伍；原页为全量返回本地过滤） ===== */
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

function showAddDialog() {
  Object.assign(editForm, { id: null, athleteId: null, measureDate: new Date().toISOString().slice(0, 10),
    height: null, weight: null, sitHeight: null, bodyFatRate: null, waist: null, dataSource: 'manual' })
  showEdit.value = true
}
function showEditDialog(row) {
  Object.assign(editForm, { ...row })
  showEdit.value = true
}
function submitEdit() {
  if (!editForm.athleteId || !editForm.measureDate) {
    proxy.$modal.msgWarning('队员和测量日期必填')
    return
  }
  saving.value = true
  upsert(editForm).then(() => {
    proxy.$modal.msgSuccess('保存成功')
    showEdit.value = false
    loadList()
    historyDrawerRef.value?.reload()
  }).finally(() => saving.value = false)
}
function handleDelete(row) {
  proxy.$modal.confirm(`确认删除 ${row.athleteName} 的测量记录 (${row.measureDate}) 吗？`).then(() => {
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
</style>
