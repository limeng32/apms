<template>
  <div class="app-container">

    <!-- 顶部汇总 -->
    <div class="summary-bar">
      <div class="sum-card">
        <div class="sum-num">{{ summary.total }}</div>
        <div class="sum-label">PHV 记录总数</div>
      </div>
      <div class="sum-card">
        <div class="sum-num">{{ summary.athletes }}</div>
        <div class="sum-label">覆盖队员数</div>
      </div>
      <div class="sum-card highlight">
        <div class="sum-num">{{ summary.avgPhvAge }}</div>
        <div class="sum-label">平均预测 PHV 年龄</div>
      </div>
    </div>

    <!-- 筛选 -->
    <el-form :inline="true" :model="filters" class="filter-bar">
      <el-form-item label="队员">
        <el-input v-model="filters.keyword" placeholder="姓名" clearable style="width:130px"/>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="loadList">查询</el-button>
        <el-button icon="Refresh" @click="resetFilter">重置</el-button>
        <el-button type="success" icon="Plus" @click="showCalcDialog()" v-hasPermi="['apms:phv:edit']">
          🧬 新增 PHV 计算
        </el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" border stripe v-loading="loading" max-height="600">
      <el-table-column label="#" type="index" width="50" align="center"/>
      <el-table-column label="队员" min-width="140">
        <template #default="scope">
          <div class="ath-cell">
            <div class="ath-avatar" :style="{ background: avatarColor(scope.row) }">
              {{ (scope.row.athleteName || '?').charAt(0) }}
            </div>
            <div>
              <div class="ath-name">{{ scope.row.athleteName }}</div>
              <div class="ath-sub">{{ scope.row.athleteTeam || '—' }} · #{{ scope.row.athleteId }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="测量日期" width="110" align="center" prop="measureDate"/>
      <el-table-column label="身高(cm)" width="90" align="right" prop="height"/>
      <el-table-column label="坐高(cm)" width="90" align="right" prop="sitHeight"/>
      <el-table-column label="年龄" width="90" align="right">
        <template #default="scope">
          <span class="age-val">{{ scope.row.decimalAge ? Number(scope.row.decimalAge).toFixed(1) + '岁' : '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="成熟度偏移" width="110" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.maturityOffset"
                  :type="offsetTag(scope.row.maturityOffset)" size="small" effect="dark">
            {{ scope.row.maturityOffset > 0 ? '+' : '' }}{{ Number(scope.row.maturityOffset).toFixed(2) }}
          </el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="预测 PHV 年龄" width="130" align="center">
        <template #default="scope">
          <span v-if="scope.row.predictedPhvAge" class="phv-age-val">
            {{ Number(scope.row.predictedPhvAge).toFixed(1) }} 岁
          </span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="预测成年身高" width="130" align="center">
        <template #default="scope">
          <span v-if="scope.row.predictedAdultHeight" class="adult-h-val">
            {{ scope.row.predictedAdultHeight }} cm
          </span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="计算方法" width="120" align="center">
        <template #default="scope">
          <el-tag size="small" type="info">{{ scope.row.mirwaldVersion || 'Mirwald' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="计算时间" width="160" prop="createTime"/>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="scope">
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)"
                     v-hasPermi="['apms:phv:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- ========= PHV 计算弹窗 ========= -->
    <el-dialog title="🧬 PHV 成熟度计算" v-model="showCalc" width="600px">
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
        <el-button type="primary" :loading="saving" @click="submitCalc">🧬 执行计算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsPhv">
import { list as listPhv, calculate, calculateDirect, delPhv } from '@/api/apms/phv'
import { listAthlete } from '@/api/apms/athlete'
import { listByAthlete as listMeasuresByAthlete } from '@/api/apms/bodyMeasure'

const { proxy } = getCurrentInstance()

const loading = ref(false)
const tableData = ref([])
const athleteOpts = ref([])
const currentAthleteMeasures = ref([])
const filters = reactive({ keyword: '' })

const summary = reactive({ total: 0, athletes: 0, avgPhvAge: '—' })

const avatarColors = ['#f0a23a', '#7b9dc9', '#c14747', '#5fa080', '#a878d8', '#d88a3a']
const avatarColor = (row) => avatarColors[(row.athleteId || 0) % avatarColors.length]
const offsetTag = (v) => v > 0.5 ? 'danger' : v < -0.5 ? 'success' : 'warning'

// ========= 加载 =========
function loadList() {
  loading.value = true
  listPhv({}).then(res => {
    let arr = res.data || []
    if (filters.keyword) arr = arr.filter(r => (r.athleteName || '').includes(filters.keyword))
    tableData.value = arr
    // 汇总
    summary.total = arr.length
    summary.athletes = new Set(arr.map(r => r.athleteId)).size
    const validAges = arr.filter(r => r.predictedPhvAge != null).map(r => Number(r.predictedPhvAge))
    summary.avgPhvAge = validAges.length ? validAges.reduce((a, b) => a + b, 0) / validAges.length : null
    summary.avgPhvAge = summary.avgPhvAge ? summary.avgPhvAge.toFixed(2) : '—'
  }).finally(() => loading.value = false)
}
function resetFilter() { filters.keyword = ''; loadList() }

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
    if (details.length) proxy.$alert(details.join('<br/>'), '🧬 计算结果预览', { dangerouslyUseHTMLString: true })
  }
}

function handleDelete(row) {
  proxy.$modal.confirm(`确认删除这条 PHV 记录吗？`).then(() => {
    delPhv(row.id).then(() => { proxy.$modal.msgSuccess('已删除'); loadList() })
  }).catch(() => {})
}

loadList()
</script>

<style scoped>
.summary-bar { display: flex; gap: 12px; margin-bottom: 14px; }
.sum-card {
  flex: 1; border-radius: 8px; padding: 14px; border: 1px solid #eef2f0; background: #fff; text-align: center;
}
.sum-card.highlight { background: #f0f8f3; border-color: #8bc7a5; }
.sum-num { font-size: 22px; font-weight: 700; color: #1b4332; }
.sum-label { font-size: 11.5px; color: #7a8a83; margin-top: 3px; }

.ath-cell { display: flex; align-items: center; gap: 10px; }
.ath-avatar { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 600; }
.ath-name { font-weight: 500; color: #303133; }
.ath-sub { font-size: 11.5px; color: #909399; margin-top: 2px; }

.phv-age-val { font-weight: 600; color: #2c8a57; }
.adult-h-val { font-weight: 600; color: #5f3dc4; }
.age-val { color: #53655e; }
.muted { color: #c0c4cc; }
.calc-tip { margin-bottom: 14px; }
.filter-bar { margin-bottom: 12px; }
</style>
