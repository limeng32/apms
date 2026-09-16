<template>
  <div class="app-container">

    <!-- 顶部汇总 -->
    <div class="summary-bar">
      <div class="sum-card">
        <div class="sum-num">{{ summary.total }}</div>
        <div class="sum-label">评分记录总数</div>
      </div>
      <div class="sum-card">
        <div class="sum-num">{{ summary.athletes }}</div>
        <div class="sum-label">覆盖队员数</div>
      </div>
      <div class="sum-card highlight">
        <div class="sum-num">{{ summary.avgScore }}</div>
        <div class="sum-label">平均组合分</div>
      </div>
      <div class="sum-card">
        <div class="sum-num best">{{ summary.best }}</div>
        <div class="sum-label">最高 / 最低</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <el-form :inline="true" :model="filters" class="filter-bar">
      <el-form-item label="队员">
        <el-input v-model="filters.keyword" placeholder="姓名" clearable style="width:130px"/>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="loadList">查询</el-button>
        <el-button icon="Refresh" @click="resetFilter">重置</el-button>
        <el-button type="success" icon="Cpu" @click="showCalcDialog()" v-hasPermi="['apms:comboScore:calculate']">
          🧮 批量计算
        </el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" border stripe v-loading="loading" max-height="600" row-key="id">
      <el-table-column label="#" type="index" width="50" align="center"/>
      <el-table-column label="队员" min-width="150">
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
      <el-table-column label="组合模型" min-width="200" show-overflow-tooltip>
        <template #default="scope">
          <el-tag size="small" type="info">{{ scope.row.comboModelName || ('Model #' + scope.row.comboModelId) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="组合分" width="110" align="center" sortable>
        <template #default="scope">
          <span :class="scoreClass(scope.row.comboScore)" class="score-val">
            {{ scope.row.comboScore != null ? Number(scope.row.comboScore).toFixed(3) : '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="算法版本" width="160" align="center">
        <template #default="scope">
          <el-tag size="small" type="warning">{{ scope.row.algoVersion }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="计算时间" width="170" prop="calculatedAt"/>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="showSnapshot(scope.row)">快照</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)"
                     v-hasPermi="['apms:comboScore:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- ========= 批量计算弹窗 ========= -->
    <el-dialog title="🧮 批量组合模型评分" v-model="showCalc" width="620px">
      <el-alert type="info" show-icon :closable="false" class="calc-tip">
        选择一个组合模型和一次测试任务，系统会自动拉取该任务下所有「已选中」队员的测试数据，逐人计算加权组合分。
        缺失指标会被跳过，剩余指标权重自动归一化。
      </el-alert>

      <el-form label-width="100px">
        <el-form-item label="组合模型" required>
          <el-select v-model="calcForm.comboModelId" filterable placeholder="选一个组合模型"
                     style="width:100%" @change="onModelChange">
            <el-option v-for="m in modelOpts" :key="m.id"
                       :label="`#${m.id} ${m.modelId} · ${m.normalizationMethod}`"
                       :value="m.id"/>
          </el-select>
          <div class="sub-hint" v-if="currentModel">
            归一化方法: <b>{{ currentModel.normalizationMethod }}</b> · 公式: {{ currentModel.formula }}
          </div>
        </el-form-item>
        <el-form-item label="测试任务" required>
          <el-select v-model="calcForm.taskId" filterable placeholder="选一次测试任务"
                     style="width:100%" @change="onTaskChange">
            <el-option v-for="t in taskOpts" :key="t.taskId"
                       :label="`#${t.taskId} ${t.taskName} · ${t.testDate || ''}`"
                       :value="t.taskId"/>
          </el-select>
        </el-form-item>
      </el-form>

      <div v-if="previewItems.length" class="preview-box">
        <div class="preview-title">📋 参与队员预览（{{ previewItems.length }} 人）</div>
        <el-table :data="previewItems" border size="small" max-height="240">
          <el-table-column label="#" type="index" width="40"/>
          <el-table-column label="队员" min-width="120" prop="athleteName"/>
          <el-table-column label="队伍" min-width="120">
            <template #default="scope">{{ scope.row.primaryTeamName || '—' }}</template>
          </el-table-column>
          <el-table-column label="性别" width="60" align="center" prop="gender"/>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="showCalc = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCalc" :disabled="!calcForm.comboModelId || !calcForm.taskId">
          🧮 执行批量计算
        </el-button>
      </template>
    </el-dialog>

    <!-- ========= ref_snapshot 详情弹窗 ========= -->
    <el-dialog title="🔍 ref_snapshot 可复现快照" v-model="showSnapshotDialog" width="760px">
      <div v-if="snapshotData">
        <div class="snapshot-header">
          队员: <b>{{ currentSnapshotRow?.athleteName }}</b> ·
          模型: #{{ currentSnapshotRow?.comboModelId }} ·
          algo: {{ snapshotData.algoVersion }} ·
          总分: <span :class="scoreClass(currentSnapshotRow?.comboScore)" class="score-val big">
            {{ currentSnapshotRow?.comboScore != null ? Number(currentSnapshotRow.comboScore).toFixed(3) : '—' }}
          </span>
        </div>
        <el-table :data="snapshotData.components || []" border size="small">
          <el-table-column label="ind" type="index" width="40"/>
          <el-table-column label="指标ID" width="90" align="center" prop="indicatorId"/>
          <el-table-column label="权重" width="70" align="center">
            <template #default="scope">{{ Number(scope.row.weight).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="方向" width="110" align="center">
            <template #default="scope">
              <el-tag size="small" :type="dirTag(scope.row.direction)">{{ scope.row.direction }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="测量值" width="90" align="right">
            <template #default="scope">{{ scope.row.value ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="ref_min/max" width="130" align="center">
            <template #default="scope">{{ scope.row.refMin ?? '—' }} / {{ scope.row.refMax ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="μ / σ" width="130" align="center">
            <template #default="scope">{{ scope.row.mu != null ? Number(scope.row.mu).toFixed(2) : '—' }} / {{ scope.row.sigma != null ? Number(scope.row.sigma).toFixed(2) : '—' }}</template>
          </el-table-column>
          <el-table-column label="z_score" width="85" align="right">
            <template #default="scope">{{ scope.row.normalized != null ? Number(scope.row.normalized).toFixed(3) : '—' }}</template>
          </el-table-column>
          <el-table-column label="加权分" width="85" align="right">
            <template #default="scope">{{ scope.row.weightedScore != null ? Number(scope.row.weightedScore).toFixed(3) : '—' }}</template>
          </el-table-column>
          <el-table-column label="valid" width="55" align="center">
            <template #default="scope">
              <el-tag size="small" :type="scope.row.valid ? 'success' : 'info'">{{ scope.row.valid }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else class="muted">无快照数据</div>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsComboScore">
import { list, calculate as calcBatch, delScore, getById } from '@/api/apms/comboScore'
import { listComboModel } from '@/api/apms/comboModel'
import { listTestTask, listTaskMember } from '@/api/apms/testTask'

const { proxy } = getCurrentInstance()

const loading = ref(false)
const tableData = ref([])
const modelOpts = ref([])
const taskOpts = ref([])
const currentModel = ref(null)
const previewItems = ref([])
const filters = reactive({ keyword: '' })

const summary = reactive({ total: 0, athletes: 0, avgScore: '—', best: '—' })

const avatarColors = ['#f0a23a', '#7b9dc9', '#c14747', '#5fa080', '#a878d8', '#d88a3a']
const avatarColor = (row) => avatarColors[(row.athleteId || 0) % avatarColors.length]
const scoreClass = (v) => {
  if (v == null) return ''
  if (v > 0.5) return 'score-high'
  if (v < -0.5) return 'score-low'
  return 'score-mid'
}
const dirTag = (d) => d === 'LOWER_BETTER' ? 'danger' : d === 'HIGHER_BETTER' ? 'success' : 'info'

function loadList() {
  loading.value = true
  list({}).then(res => {
    let arr = res.data || []
    if (filters.keyword) arr = arr.filter(r => (r.athleteName || '').includes(filters.keyword))
    tableData.value = arr
    summary.total = arr.length
    summary.athletes = new Set(arr.map(r => r.athleteId)).size
    const scores = arr.map(r => Number(r.comboScore)).filter(v => !isNaN(v))
    if (scores.length) {
      summary.avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)
      summary.best = Math.max(...scores).toFixed(3) + ' / ' + Math.min(...scores).toFixed(3)
    } else {
      summary.avgScore = '—'; summary.best = '—'
    }
  }).finally(() => loading.value = false)
}
function resetFilter() { filters.keyword = ''; loadList() }

// 预拉下拉选项
listComboModel({ pageSize: 200 }).then(res => { modelOpts.value = res.data || res.rows || [] })
listTestTask({ pageSize: 200 }).then(res => { taskOpts.value = res.data || res.rows || [] })

// ========= 计算弹窗 =========
const showCalc = ref(false)
const saving = ref(false)
const calcForm = reactive({ comboModelId: null, taskId: null })

function showCalcDialog() {
  calcForm.comboModelId = null; calcForm.taskId = null
  currentModel.value = null; previewItems.value = []
  showCalc.value = true
}
function onModelChange(id) {
  currentModel.value = modelOpts.value.find(m => m.id === id) || null
}
function onTaskChange(taskId) {
  if (!taskId) { previewItems.value = []; return }
  listTaskMember(taskId).then(res => {
    previewItems.value = (res.data || res.rows || []).filter(m => m.isSelected === '1' || m.isSelected === 1 || m.isSelected === true)
  }).catch(() => { previewItems.value = [] })
}
function submitCalc() {
  if (!calcForm.comboModelId || !calcForm.taskId) {
    proxy.$modal.msgWarning('请先选择组合模型和测试任务'); return
  }
  saving.value = true
  calcBatch(calcForm.comboModelId, calcForm.taskId).then(res => {
    const r = res.data
    proxy.$alert(
      `✅ 执行完成！<br/>共处理 <b>${r.totalAthletes}</b> 名队员 · 成功 <b style="color:#2c8a57">${r.successCount}</b> · 跳过 <b style="color:#d97706">${r.skipCount}</b><br/><br/>` +
      (r.items || []).map(it =>
        `${it.status === 'OK' ? '✅' : '⏭️'} #${it.athleteId} ${it.athleteName} — ${it.status === 'OK' ? '<b>' + Number(it.comboScore).toFixed(3) + '</b>' : it.reason}`
      ).join('<br/>'),
      '🧮 批量计算结果', { dangerouslyUseHTMLString: true, confirmButtonText: '确定' }
    ).then(() => { showCalc.value = false; loadList() })
  }).finally(() => saving.value = false)
}

function handleDelete(row) {
  proxy.$modal.confirm(`确认删除 #${row.id} ${row.athleteName} 的组合评分记录吗？`).then(() => {
    delScore(row.id).then(() => { proxy.$modal.msgSuccess('已删除'); loadList() })
  }).catch(() => {})
}

// ========= snapshot 详情 =========
const showSnapshotDialog = ref(false)
const snapshotData = ref(null)
const currentSnapshotRow = ref(null)

function showSnapshot(row) {
  currentSnapshotRow.value = row
  if (row.refSnapshot) {
    try { snapshotData.value = JSON.parse(row.refSnapshot) } catch (e) { snapshotData.value = null }
    showSnapshotDialog.value = true
    return
  }
  // 从 API 拉详情
  getById(row.id).then(res => {
    const r = res.data || res
    currentSnapshotRow.value = r
    if (r.refSnapshot) {
      try { snapshotData.value = JSON.parse(r.refSnapshot) } catch (e) { snapshotData.value = null }
    } else {
      snapshotData.value = null
    }
    showSnapshotDialog.value = true
  })
}

loadList()
</script>

<style scoped>
.summary-bar { display: flex; gap: 12px; margin-bottom: 14px; }
.sum-card { flex: 1; border-radius: 8px; padding: 14px; border: 1px solid #eef2f0; background: #fff; text-align: center; }
.sum-card.highlight { background: #f0f8f3; border-color: #8bc7a5; }
.sum-num { font-size: 22px; font-weight: 700; color: #1b4332; }
.sum-num.best { color: #d97706; }
.sum-label { font-size: 11.5px; color: #7a8a83; margin-top: 3px; }

.ath-cell { display: flex; align-items: center; gap: 10px; }
.ath-avatar { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 600; }
.ath-name { font-weight: 500; color: #303133; }
.ath-sub { font-size: 11.5px; color: #909399; margin-top: 2px; }

.score-val { font-weight: 700; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.score-high { color: #2c8a57; }
.score-low { color: #c14747; }
.score-mid { color: #53655e; }
.score-val.big { font-size: 15px; }

.muted { color: #c0c4cc; }
.calc-tip { margin-bottom: 14px; }
.filter-bar { margin-bottom: 12px; }
.sub-hint { font-size: 12px; color: #909399; margin-top: 4px; }

.preview-box { margin-top: 16px; border: 1px solid #e6ebf0; border-radius: 8px; padding: 12px; background: #fafbfc; }
.preview-title { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px; }

.snapshot-header { font-size: 13px; color: #606266; margin-bottom: 12px; padding: 10px 14px; background: #f4f6f8; border-radius: 6px; }
</style>
