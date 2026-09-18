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

    <!-- ========= 组合分报告弹窗（可打印） ========= -->
    <el-dialog :title="null" v-model="showSnapshotDialog" width="880px" class="report-dialog" :show-close="true">
      <div v-if="snapshotData" class="combo-report" id="comboReport">
        <!-- 报告头部 -->
        <div class="report-header">
          <div class="report-meta">
            <div class="report-title">
              🏋️ 组合体能评分报告
              <span class="report-sub">Combo Fitness Report</span>
            </div>
            <div class="report-info">
              <div class="info-row"><span class="info-label">队员</span><b>{{ currentSnapshotRow?.athleteName }}</b></div>
              <div class="info-row"><span class="info-label">组合模型</span>{{ currentSnapshotRow?.comboModelName || ('Model #' + currentSnapshotRow?.comboModelId) }}</div>
              <div class="info-row"><span class="info-label">算法版本</span><el-tag size="small" type="warning">{{ snapshotData.algoVersion }}</el-tag></div>
              <div class="info-row"><span class="info-label">归一化</span><el-tag size="small">{{ snapshotData.normalization }}</el-tag></div>
              <div class="info-row"><span class="info-label">计算时间</span>{{ currentSnapshotRow?.calculatedAt }}</div>
            </div>
          </div>
          <div class="report-score-box">
            <div class="score-big" :class="scoreClass(currentSnapshotRow?.comboScore)">
              {{ currentSnapshotRow?.comboScore != null ? Number(currentSnapshotRow.comboScore).toFixed(3) : '—' }}
            </div>
            <div class="score-grade" :class="'grade-' + comboGrade(currentSnapshotRow?.comboScore)">
              {{ comboGradeLabel(currentSnapshotRow?.comboScore) }}
            </div>
            <div class="score-hint">综合 Z-Score（Σ wᵢ × Tᵢ）</div>
          </div>
        </div>

        <!-- T-Score 可视化条形图 -->
        <div class="section-block">
          <div class="section-header">
            <span>📊 T-Score 可视化（各指标相对群体位置）</span>
            <span class="section-sub">T=50 为群体均值；每 ±1σ → ±10T 分</span>
          </div>
          <div class="tscore-bars">
            <div v-for="c in sortedComponents" :key="c.indicatorId" class="tscore-bar-row" :class="{ skipped: !c.valid }">
              <div class="bar-label">
                <span class="ind-code">{{ c.indicatorCode || ('#' + c.indicatorId) }}</span>
                <span class="ind-name">{{ c.indicatorName || '—' }}</span>
              </div>
              <div class="bar-track">
                <!-- 50 中心 -->
                <div class="bar-center-line"></div>
                <div v-if="c.valid" class="bar-fill"
                     :class="{ 'bar-higher': c.tScore >= 50, 'bar-lower': c.tScore < 50 }"
                     :style="barStyle(c.tScore)">
                </div>
              </div>
              <div class="bar-val" :class="{ 'val-ok': c.valid, 'val-skip': !c.valid }">
                <template v-if="c.valid">
                  <span class="t-num">{{ c.tScore?.toFixed(1) }}</span>
                  <span class="t-z">Z={{ c.zScore?.toFixed(2) }}</span>
                </template>
                <span v-else class="skip-reason">跳过: {{ c.skipReason }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Components 详细计算 -->
        <div class="section-block">
          <div class="section-header">
            <span>🧮 逐指标计算明细</span>
            <span class="section-sub">
              有效权重 Σw={{ snapshotData.effectiveWeightSum?.toFixed(2) || '—' }}
              · 有效 {{ validCount }}/{{ snapshotData.components?.length }}
            </span>
          </div>
          <el-table :data="sortedComponents" border size="small" :row-class-name="({ row }) => row.valid ? '' : 'component-skip'">
            <el-table-column label="指标" min-width="140">
              <template #default="scope">
                <div class="ind-name-cell">
                  <span class="ind-code-sm">{{ scope.row.indicatorCode }}</span>
                  <span class="ind-name-sm">{{ scope.row.indicatorName || '—' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="方向" width="80" align="center">
              <template #default="scope">
                <span class="dir-cell" :class="'dir-' + scope.row.direction">
                  {{ dirArrow(scope.row.direction) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="权重" width="70" align="center">
              <template #default="scope">{{ scope.row.weight?.toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="测量值" width="85" align="right">
              <template #default="scope">{{ scope.row.value ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="参考范围" width="130" align="center">
              <template #default="scope">
                <span v-if="scope.row.refMin != null || scope.row.refMax != null" class="ref-range">
                  {{ scope.row.refMin ?? '−∞' }} ~ {{ scope.row.refMax ?? '+∞' }}
                </span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="μ / σ / N" width="145" align="center">
              <template #default="scope">
                <template v-if="scope.row.valid">
                  <span>{{ scope.row.mu?.toFixed(2) }}</span>
                  <span class="sep">/</span>
                  <span>{{ scope.row.sigma?.toFixed(3) }}</span>
                  <span class="sep">/</span>
                  <el-tag size="small" :type="scope.row.useRealStats ? 'success' : 'info'" effect="plain">
                    N={{ scope.row.sampleSize ?? 0 }}
                    <span v-if="scope.row.useRealStats" class="real-badge">真实</span>
                    <span v-else class="ref-badge">ref</span>
                  </el-tag>
                </template>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="Z-Score" width="80" align="right">
              <template #default="scope">
                <span v-if="scope.row.valid" :class="zClass(scope.row.zScore)">{{ scope.row.zScore?.toFixed(2) }}</span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="T-Score" width="80" align="right">
              <template #default="scope">
                <span v-if="scope.row.valid" class="t-cell">{{ scope.row.tScore?.toFixed(1) }}</span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="加权分" width="85" align="right">
              <template #default="scope">
                <span v-if="scope.row.weightedScore != null" class="weighted-cell">{{ scope.row.weightedScore?.toFixed(3) }}</span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="贡献" width="80" align="right">
              <template #default="scope">
                <el-progress v-if="scope.row.valid && totalWeighted > 0"
                  :percentage="Math.abs(scope.row.weightedScore / totalWeighted * 100)"
                  :stroke-width="6" :show-text="false"
                  :color="contribColor(scope.row.weightedScore, totalWeighted)"/>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 备注 -->
        <div v-if="hasRealStats || hasRefFallback" class="section-block notes">
          <div class="section-header"><span>💡 数据来源说明</span></div>
          <ul class="notes-list">
            <li v-if="hasRealStats">✅ <b>真实统计</b>：部分指标使用了同队+同性别范围的实际测量值（N≥5）计算 μ/σ</li>
            <li v-if="hasRefFallback">ℹ️ <b>参考范围代理</b>：部分指标样本不足（N<5），使用 ref_min/ref_max 代理 μ/σ（μ=mid, σ=range/6）</li>
          </ul>
        </div>
      </div>
      <div v-else class="muted" style="text-align:center; padding:40px;">无快照数据</div>

      <template #footer>
        <el-button @click="window.print()" icon="Printer">🖨️ 打印报告</el-button>
        <el-button @click="showSnapshotDialog = false">关 闭</el-button>
      </template>
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

// ========== 报告辅助 computed ==========
const sortedComponents = computed(() => {
  if (!snapshotData.value?.components) return []
  // 有效在前，按权重降序；无效在后
  const arr = [...snapshotData.value.components]
  arr.sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? -1 : 1
    const wa = a.weight ?? 0, wb = b.weight ?? 0
    return wb - wa
  })
  return arr
})
const validCount = computed(() => sortedComponents.value.filter(c => c.valid).length)
const totalWeighted = computed(() =>
  sortedComponents.value.reduce((s, c) => s + (c.weightedScore ?? 0), 0))
const hasRealStats = computed(() => sortedComponents.value.some(c => c.valid && c.useRealStats))
const hasRefFallback = computed(() => sortedComponents.value.some(c => c.valid && !c.useRealStats))

// ========== 报告辅助函数 ==========
function comboGrade(v) {
  if (v == null) return 'na'
  if (v >= 1.0) return 'excellent'
  if (v >= 0.3) return 'good'
  if (v > -0.3) return 'normal'
  if (v > -1.0) return 'attention'
  return 'poor'
}
function comboGradeLabel(v) {
  return { excellent: '🏆 优秀', good: '👍 良好', normal: '✅ 正常', attention: '⚠️ 需关注', poor: '❌ 较差', na: '—' }[comboGrade(v)]
}
function dirArrow(d) {
  if (d === 'HIGHER_BETTER') return '↑ 越大越好'
  if (d === 'LOWER_BETTER') return '↓ 越小越好'
  if (d === 'RANGE_BEST') return '≈ 范围最佳'
  return '— 仅参考'
}
function zClass(z) {
  if (z == null) return ''
  if (z >= 0.5) return 'z-pos'
  if (z <= -0.5) return 'z-neg'
  return 'z-mid'
}
// T-Score 条形位置映射：30~70 映射到 0%~100% 宽度
function barStyle(t) {
  if (t == null) return {}
  const clamped = Math.max(20, Math.min(80, t))
  const pct = ((clamped - 20) / 60) * 100
  return { left: pct + '%' }
}
function contribColor(ws, total) {
  if (total <= 0) return '#909399'
  const pct = Math.abs(ws / total)
  if (pct >= 0.4) return '#2c8a57'
  if (pct >= 0.2) return '#53655e'
  return '#909399'
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

/* ========== 报告样式 ========== */
.combo-report { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.report-header {
  display: flex; gap: 24px; margin-bottom: 20px;
  padding: 20px; background: linear-gradient(135deg, #f0f8f3 0%, #e8f5ee 100%);
  border-radius: 10px; border: 1px solid #c8e0d0;
}
.report-meta { flex: 1; }
.report-title { font-size: 20px; font-weight: 700; color: #1b4332; margin-bottom: 12px; }
.report-sub { font-size: 12px; color: #7a8a83; font-weight: 400; margin-left: 8px; font-style: italic; }
.report-info { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; font-size: 13px; }
.info-row { display: contents; }
.info-label { color: #7a8a83; white-space: nowrap; }
.report-score-box {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 0 30px; min-width: 180px;
  background: #fff; border-radius: 10px; border: 2px solid #8bc7a5;
}
.score-big { font-size: 42px; font-weight: 800; font-family: Menlo, monospace; line-height: 1; }
.score-grade {
  font-size: 14px; font-weight: 600; margin-top: 8px; padding: 3px 12px; border-radius: 12px;
}
.score-grade.grade-excellent { background: #2c8a57; color: #fff; }
.score-grade.grade-good { background: #67c23a; color: #fff; }
.score-grade.grade-normal { background: #909399; color: #fff; }
.score-grade.grade-attention { background: #e6a23c; color: #fff; }
.score-grade.grade-poor { background: #c14747; color: #fff; }
.score-hint { font-size: 11px; color: #909399; margin-top: 6px; }

.section-block { margin-bottom: 18px; }
.section-header {
  display: flex; align-items: baseline; gap: 10px;
  font-size: 14px; font-weight: 600; color: #1b4332;
  padding-bottom: 6px; border-bottom: 1px solid #ebeef5; margin-bottom: 10px;
}
.section-sub { font-size: 11.5px; color: #909399; font-weight: 400; }

/* T-Score 条形图 */
.tscore-bars { display: flex; flex-direction: column; gap: 8px; padding: 8px 12px; background: #fafbfc; border-radius: 8px; }
.tscore-bar-row { display: grid; grid-template-columns: 160px 1fr 100px; align-items: center; gap: 10px; }
.tscore-bar-row.skipped { opacity: 0.5; }
.bar-label { display: flex; flex-direction: column; }
.bar-label .ind-code { font-family: monospace; font-size: 12px; color: #1b4332; font-weight: 600; }
.bar-label .ind-name { font-size: 11px; color: #7a8a83; }
.bar-track {
  position: relative; height: 22px; background: #e8eaed; border-radius: 4px; overflow: hidden;
}
.bar-center-line {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 2px;
  background: #1b4332; opacity: 0.6; z-index: 1;
}
.bar-fill {
  position: absolute; top: 0; bottom: 0; width: 12px; border-radius: 3px;
  transform: translateX(-50%); z-index: 2;
  transition: left 0.4s ease-out;
}
.bar-fill.bar-higher { background: linear-gradient(90deg, #67c23a, #2c8a57); box-shadow: 0 0 6px rgba(44,138,87,0.4); }
.bar-fill.bar-lower { background: linear-gradient(90deg, #e6a23c, #c14747); box-shadow: 0 0 6px rgba(193,71,71,0.4); }
.bar-val { text-align: right; font-size: 12px; font-family: Menlo, monospace; }
.bar-val.val-ok .t-num { font-weight: 700; color: #1b4332; font-size: 14px; }
.bar-val.val-ok .t-z { color: #909399; font-size: 11px; margin-left: 4px; }
.bar-val.val-skip { font-size: 11px; color: #c0c4cc; }
.skip-reason { color: #909399; }

/* 方向 cell */
.dir-cell { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.dir-HIGHER_BETTER { background: #f0f9eb; color: #2c8a57; }
.dir-LOWER_BETTER { background: #fef0f0; color: #c14747; }
.dir-RANGE_BEST { background: #fdf6ec; color: #e6a23c; }
.dir-REFERENCE_ONLY { background: #f4f4f5; color: #909399; }

/* 指标名称 cell */
.ind-name-cell { display: flex; flex-direction: column; }
.ind-code-sm { font-family: monospace; font-size: 12px; color: #1b4332; font-weight: 600; }
.ind-name-sm { font-size: 11px; color: #909399; }

/* Z-Score 颜色 */
.z-pos { color: #2c8a57; font-weight: 600; }
.z-neg { color: #c14747; font-weight: 600; }
.z-mid { color: #53655e; }

.t-cell { font-weight: 600; color: #1b4332; font-family: Menlo, monospace; }
.weighted-cell { font-weight: 600; color: #2c8a57; font-family: Menlo, monospace; }
.ref-range { font-size: 12px; color: #606266; }
.real-badge { margin-left: 4px; }
.ref-badge { margin-left: 4px; }

/* 跳过 component */
:deep(.component-skip td) { background-color: #fafafa !important; color: #c0c4cc; }

/* Notes */
.notes-list { margin: 8px 0 0 16px; padding: 0; font-size: 12px; color: #606266; line-height: 1.8; }

/* 打印样式 */
@media print {
  .el-dialog__header, .el-dialog__footer { display: none !important; }
  .el-dialog { margin: 0 !important; width: 100% !important; max-width: 100% !important; box-shadow: none !important; }
  .el-dialog__body { padding: 0 !important; }
  body { background: #fff !important; }
}
</style>
