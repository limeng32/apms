<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page pm-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">PHV 成熟度</h1>
          <p class="rk-subtitle">{{ summary.total }} 条记录 · {{ summary.athletes }} 名队员 · Mirwald 模型预测</p>
        </div>
        <div class="rk-header-actions">
          <el-button type="primary" class="rk-btn rk-btn-primary" @click="showCalcDialog()"
                     v-hasPermi="['apms:phv:edit']">
            <el-icon><MagicStick /></el-icon>新增 PHV 计算
          </el-button>
        </div>
      </div>

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
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetFilter">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== PHV 记录表 ===== -->
      <div v-loading="loading" class="rk-table-card">
        <div class="rk-table-scroll">
          <table class="rk-table pm-table">
            <thead>
              <tr>
                <th class="text-center col-index">#</th>
                <th>队员</th>
                <th class="text-center col-date">测量日期</th>
                <th class="text-right col-height">身高(cm)</th>
                <th class="text-right col-sit">坐高(cm)</th>
                <th class="text-right col-age">年龄</th>
                <th class="text-center col-offset">成熟度偏移</th>
                <th class="text-center col-phv">预测 PHV 年龄</th>
                <th class="text-center col-adult">预测成年身高</th>
                <th class="text-center col-method">计算方法</th>
                <th class="col-time">计算时间</th>
                <th class="text-right col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in filteredData" :key="row.id" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                <td class="text-center rk-mono rk-dash">{{ idx + 1 }}</td>
                <td>
                  <div class="rk-person">
                    <span class="rk-avatar pm-avatar" :style="{ background: avatarColor(row) }">
                      {{ (row.athleteName || '?').charAt(0) }}
                    </span>
                    <div class="rk-person-meta">
                      <span class="rk-person-main">{{ row.athleteName || '—' }}</span>
                      <span class="rk-person-sub">{{ row.athleteTeam || '无队伍' }} · #{{ row.athleteId }}</span>
                    </div>
                  </div>
                </td>
                <td class="text-center rk-mono">{{ row.measureDate || '—' }}</td>
                <td class="text-right rk-mono col-height">{{ row.height ?? '—' }}</td>
                <td class="text-right rk-mono col-sit">{{ row.sitHeight ?? '—' }}</td>
                <td class="text-right rk-mono">{{ row.decimalAge != null ? Number(row.decimalAge).toFixed(1) + ' 岁' : '—' }}</td>
                <td class="text-center col-offset">
                  <span v-if="row.maturityOffset != null" class="rk-status-badge" :class="offsetMeta(row.maturityOffset).tone">
                    <i class="rk-status-dot"></i>{{ offsetText(row.maturityOffset) }}
                  </span>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-phv">
                  <span v-if="row.predictedPhvAge != null" class="pm-phv-age">
                    {{ Number(row.predictedPhvAge).toFixed(1) }}<small> 岁</small>
                  </span>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-adult">
                  <span v-if="row.predictedAdultHeight != null" class="pm-adult-h rk-mono">
                    {{ row.predictedAdultHeight }}<small> cm</small>
                  </span>
                  <span v-else class="rk-dash">—</span>
                </td>
                <td class="text-center col-method">
                  <span class="rk-soft-chip">{{ row.mirwaldVersion || 'Mirwald' }}</span>
                </td>
                <td class="rk-mono col-time pm-cell-time">{{ row.createTime || '—' }}</td>
                <td class="text-right">
                  <div class="rk-actions">
                    <button type="button" class="rk-link pm-link-danger"
                            @click="handleDelete(row)" v-hasPermi="['apms:phv:remove']">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="!loading && filteredData.length === 0" class="rk-empty">
            <p class="rk-empty-title">{{ filters.keyword ? '没有匹配的 PHV 记录' : '暂无 PHV 记录' }}</p>
            <p class="rk-empty-desc">{{ filters.keyword ? '请调整筛选条件后重试' : '点击右上角「新增 PHV 计算」生成第一条记录' }}</p>
          </div>
        </div>
      </div>

      <!-- ========= PHV 计算弹窗 ========= -->
      <el-dialog title="PHV 成熟度计算" v-model="showCalc" width="600px">
        <el-alert type="info" show-icon :closable="false" class="calc-tip">
          PHV（Peak Height Velocity）用 Mirwald 公式，输入身高、坐高、体重、年龄、父母身高，预测：成熟度偏移、PHV 年龄、成年身高。
        </el-alert>

        <el-form :model="calcForm" label-width="120px">
          <el-form-item label="计算方式" required>
            <el-radio-group v-model="calcMode">
              <el-radio value="fromMeasure">从体态测量记录计算</el-radio>
              <el-radio value="direct">手动输入参数计算</el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 从体态测量 -->
          <template v-if="calcMode === 'fromMeasure'">
            <el-form-item label="运动员" required>
              <el-select v-model="calcForm.athleteId" filterable placeholder="选择队员"
                         style="width:100%" @change="onCalcAthleteChange">
                <el-option v-for="a in athleteOpts" :key="a.athleteId"
                           :label="`${a.name} (${a.primaryTeamName || '—'})`"
                           :value="a.athleteId"/>
              </el-select>
            </el-form-item>
            <el-form-item label="体态测量记录" required v-if="calcForm.athleteId">
              <el-select v-model="calcForm.sourceMeasureId" placeholder="选一条测量记录"
                         style="width:100%" @change="fillFromMeasure">
                <el-option v-for="m in currentAthleteMeasures" :key="m.id"
                           :label="`${m.measureDate} · 身高${m.height}cm · 体重${m.weight}kg`"
                           :value="m.id"/>
              </el-select>
            </el-form-item>
          </template>

          <!-- 手动输入 -->
          <template v-if="calcMode === 'direct'">
            <el-form-item label="运动员" required>
              <el-select v-model="calcForm.athleteId" filterable placeholder="选择队员"
                         style="width:100%" @change="onCalcAthleteChange">
                <el-option v-for="a in athleteOpts" :key="a.athleteId"
                           :label="`${a.name} (${a.primaryTeamName || '—'})`"
                           :value="a.athleteId"/>
              </el-select>
            </el-form-item>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="测量日期" required>
                  <el-date-picker v-model="calcForm.measureDate" type="date" value-format="YYYY-MM-DD"
                                  style="width:100%"/>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="精确年龄(岁)">
                  <el-input-number v-model="calcForm.decimalAge" :precision="2" :min="8" :max="25"/>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="身高(cm)" required>
                  <el-input-number v-model="calcForm.height" :precision="1" :min="100" :max="230"/>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="坐高(cm)" required>
                  <el-input-number v-model="calcForm.sitHeight" :precision="1" :min="40" :max="150"/>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="体重(kg)">
                  <el-input-number v-model="calcForm.weight" :precision="1" :min="30" :max="150"/>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="父亲身高(cm)">
                  <el-input-number v-model="calcForm.fatherHeight" :precision="1" :min="140" :max="220"/>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="母亲身高(cm)">
                  <el-input-number v-model="calcForm.motherHeight" :precision="1" :min="140" :max="220"/>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
        </el-form>

        <template #footer>
          <el-button @click="showCalc = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitCalc">执行计算</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup name="ApmsPhv">
import { list as listPhv, calculate, calculateDirect, delPhv } from '@/api/apms/phv'
import { listAthlete } from '@/api/apms/athlete'
import { listByAthlete as listMeasuresByAthlete } from '@/api/apms/bodyMeasure'
import { MagicStick, RefreshLeft } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()

const loading = ref(false)
const rawData = ref([])
const athleteOpts = ref([])
const currentAthleteMeasures = ref([])
const filters = reactive({ keyword: '' })

/* ===== 头像色板（同运动员同色，沿用原页按 athleteId 取色口径） ===== */
const AVATAR_COLORS = ['#f0a23a', '#7b9dc9', '#c14747', '#5fa080', '#a878d8', '#d88a3a']
const avatarColor = (row) => AVATAR_COLORS[(row.athleteId || 0) % AVATAR_COLORS.length]

/* ===== 成熟度偏移语义（沿用原页阈值：>0.5 早熟 / <-0.5 晚熟） ===== */
function offsetMeta(v) {
  if (v > 0.5) return { tone: 'tone-red', hint: '早熟倾向', chipTone: 'tone-risk' }
  if (v < -0.5) return { tone: 'tone-green', hint: '晚熟倾向', chipTone: 'tone-ok' }
  return { tone: 'tone-amber', hint: '峰值期前后', chipTone: 'tone-warn' }
}
const offsetText = (v) => (v > 0 ? '+' : '') + Number(v).toFixed(2)

/* ===== 汇总（全部记录口径，与原页一致） ===== */
const summary = reactive({ total: 0, athletes: 0, avgPhvAge: '—', avgOffset: null })

function buildSummary(arr) {
  summary.total = arr.length
  summary.athletes = new Set(arr.map(r => r.athleteId)).size
  const validAges = arr.filter(r => r.predictedPhvAge != null).map(r => Number(r.predictedPhvAge))
  const avgAge = validAges.length ? validAges.reduce((a, b) => a + b, 0) / validAges.length : null
  summary.avgPhvAge = avgAge != null ? avgAge.toFixed(2) : '—'
  const offsets = arr.filter(r => r.maturityOffset != null).map(r => Number(r.maturityOffset))
  summary.avgOffset = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : null
}

const kpiCards = computed(() => {
  const off = summary.avgOffset
  const meta = off != null ? offsetMeta(off) : { tone: '', hint: '—', chipTone: '' }
  return [
    { label: 'PHV 记录总数', value: summary.total, unit: '条', accent: '#8B5CF6',
      chip: summary.athletes + ' 名队员', chipTone: 'tone-info' },
    { label: '覆盖队员数', value: summary.athletes, unit: '人', accent: '#06B6D4',
      chip: '按 DataScope 隔离', chipTone: '' },
    { label: '平均预测 PHV 年龄', value: summary.avgPhvAge, unit: '岁', accent: '#2563EB',
      chip: 'Mirwald v2014.1', chipTone: '' },
    { label: '平均成熟度偏移', value: off != null ? offsetText(off) : '—', unit: off != null ? '岁' : '',
      accent: off > 0.5 ? '#DC2626' : off < -0.5 ? '#16A34A' : '#D97706',
      chip: meta.hint, chipTone: meta.chipTone }
  ]
})

/* ===== 列表加载 + 前端姓名筛选（原页口径：全量返回后本地过滤） ===== */
const filteredData = computed(() => {
  const kw = filters.keyword.trim()
  if (!kw) return rawData.value
  return rawData.value.filter(r => (r.athleteName || '').includes(kw))
})

function loadList() {
  loading.value = true
  listPhv({}).then(res => {
    rawData.value = res.data || []
    buildSummary(rawData.value)
  }).finally(() => { loading.value = false })
}
function resetFilter() { filters.keyword = '' }

listAthlete({ pageNum: 1, pageSize: 500 }).then(res => { athleteOpts.value = res.rows || [] })

// ========= 计算弹窗 =========
const showCalc = ref(false)
const saving = ref(false)
const calcMode = ref('fromMeasure')
const calcForm = reactive({ athleteId: null, sourceMeasureId: null, measureDate: null,
  height: null, sitHeight: null, weight: null, decimalAge: null,
  fatherHeight: null, motherHeight: null })

function showCalcDialog() {
  Object.assign(calcForm, { athleteId: null, sourceMeasureId: null, measureDate: null,
    height: null, sitHeight: null, weight: null, decimalAge: null,
    fatherHeight: null, motherHeight: null })
  currentAthleteMeasures.value = []
  showCalc.value = true
}

function onCalcAthleteChange(athleteId) {
  if (!athleteId) { currentAthleteMeasures.value = []; return }
  const athlete = athleteOpts.value.find(a => a.athleteId === athleteId)
  listMeasuresByAthlete(athleteId).then(res => {
    currentAthleteMeasures.value = res.data || []
    // 如果有父母身高，填入
    calcForm.fatherHeight = athlete?.fatherHeight ?? null
    calcForm.motherHeight = athlete?.motherHeight ?? null
    // 尝试算 decimalAge
    if (athlete?.birthDate) {
      const bd = new Date(athlete.birthDate)
      const now = new Date()
      const age = (now - bd) / (365.25 * 86400000)
      calcForm.decimalAge = Number(age.toFixed(4))
    }
  })
}

function fillFromMeasure(measureId) {
  const m = currentAthleteMeasures.value.find(x => x.id === measureId)
  if (m) {
    calcForm.height = m.height
    calcForm.sitHeight = m.sitHeight
    calcForm.weight = m.weight
    calcForm.measureDate = m.measureDate
  }
}

function submitCalc() {
  saving.value = true
  if (calcMode.value === 'fromMeasure') {
    if (!calcForm.athleteId || !calcForm.sourceMeasureId) {
      proxy.$modal.msgWarning('请选择运动员和体态测量记录'); saving.value = false; return
    }
    calculate({ athleteId: calcForm.athleteId, measureId: calcForm.sourceMeasureId })
      .then(res => handleCalcResult(res.data))
      .finally(() => saving.value = false)
  } else {
    if (!calcForm.athleteId || !calcForm.height || !calcForm.sitHeight) {
      proxy.$modal.msgWarning('运动员、身高、坐高必填'); saving.value = false; return
    }
    calculateDirect({ ...calcForm, athleteId: calcForm.athleteId, gender: athleteGender(calcForm.athleteId) })
      .then(res => handleCalcResult(res.data))
      .finally(() => saving.value = false)
  }
}

function athleteGender(id) {
  const a = athleteOpts.value.find(x => x.athleteId === id)
  return a?.gender === 'F' ? '1' : '0'
}

function handleCalcResult(record) {
  proxy.$modal.msgSuccess('PHV 计算已保存')
  showCalc.value = false
  loadList()
  // 如果后端返回了计算结果，弹一个预览
  if (record) {
    const details = []
    if (record.maturityOffset != null) details.push(`成熟度偏移: ${Number(record.maturityOffset).toFixed(2)}`)
    if (record.predictedPhvAge != null) details.push(`预测 PHV 年龄: ${Number(record.predictedPhvAge).toFixed(1)}岁`)
    if (record.predictedAdultHeight != null) details.push(`预测成年身高: ${record.predictedAdultHeight}cm`)
    if (details.length) proxy.$alert(details.join('<br/>'), '计算结果预览', { dangerouslyUseHTMLString: true })
  }
}

function handleDelete(row) {
  proxy.$modal.confirm(`确认删除这条 PHV 记录吗？`).then(() => {
    delPhv(row.id).then(() => { proxy.$modal.msgSuccess('已删除'); loadList() })
  }).catch(() => {})
}

loadList()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.pm-filter { margin-bottom: 14px; }

/* 数值单元格 */
.pm-avatar { width: 32px; height: 32px; font-size: 13px; }
.pm-phv-age {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  font-weight: 700;
  color: $rk-ok;
  small { font-size: 11px; font-weight: 500; color: $rk-text-3; }
}
.pm-adult-h {
  font-size: 13px;
  font-weight: 600;
  color: #7c3aed;
  small { font-size: 11px; font-weight: 500; color: $rk-text-3; }
}
.pm-cell-time { font-size: 12px; color: $rk-text-2; white-space: nowrap; }
.pm-link-danger { color: $rk-risk; &:hover { color: #b91c1c; } }

/* 列宽与密度 */
.pm-table .col-index { width: 44px; }
.pm-table .col-date { width: 96px; }
.pm-table .col-height,
.pm-table .col-sit,
.pm-table .col-age { width: 76px; }
.pm-table .col-offset { width: 104px; }
.pm-table .col-phv,
.pm-table .col-adult { width: 112px; }
.pm-table .col-method { width: 120px; }
.pm-table .col-time { width: 158px; }
.pm-table .col-actions { width: 72px; }
.pm-table :is(thead th, tbody td) { padding-left: 12px; padding-right: 12px; }

@media (max-width: 1320px) {
  .pm-table .col-time { display: none; }
}
@media (max-width: 1180px) {
  .pm-table .col-method,
  .pm-table .col-sit { display: none; }
}
@media (max-width: 1000px) {
  .pm-table .col-height { display: none; }
}

/* 弹窗内提示卡 */
.calc-tip { margin-bottom: 14px; }
</style>
