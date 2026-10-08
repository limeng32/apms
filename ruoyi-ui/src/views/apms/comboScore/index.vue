<template>
  <div class="app-container" :class="{ 'is-embedded': embedded }">
    <!-- 仅作为组合测试调度合并页的子区块使用；只读遮罩由 comboDispatch 外层统一控制 -->
    <div class="rk-dash-page rk-page cs-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">组合评分</h1>
          <p class="rk-subtitle">
            {{ summary.total }} 条评分 · {{ summary.athletes }} 名队员 · 均分 {{ summary.avgScore }} · 组合模型加权快照
          </p>
        </div>
        <div class="rk-header-actions">
          <el-button class="rk-btn rk-btn-primary" @click="showCalcDialog()" v-hasPermi="['apms:comboScore:calculate']">
            <el-icon><Cpu /></el-icon>批量计算
          </el-button>
        </div>
      </div>

      <!-- ===== KPI 卡带（全量本地统计，零后端改动） ===== -->
      <div class="rk-kpi-grid is-4">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone" v-if="k.chip">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 筛选（原生控件，全量本地即时过滤） ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">队员</span>
          <input v-model="filters.keyword" class="rk-input cs-search" placeholder="输入姓名即时筛选"/>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetFilter">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 成绩表（全量） ===== -->
      <div class="rk-table-card">
        <div class="rk-card-head">
          <h3 class="rk-card-title">组合评分记录</h3>
          <span class="rk-card-sub">{{ tableData.length }} 条 · 点击「快照」查看完整计算报告</span>
        </div>
        <div class="rk-card-body flush">
          <div v-loading="loading" class="rk-table-scroll">
            <table class="rk-table cs-table">
              <thead>
                <tr>
                  <th class="text-center col-idx">#</th>
                  <th>队员</th>
                  <th>组合模型</th>
                  <th class="text-center col-score">
                    <button type="button" class="cs-sort-btn" @click="toggleSort()">
                      组合分<span class="cs-sort-arrow">{{ sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕' }}</span>
                    </button>
                  </th>
                  <th class="text-center col-algo">算法版本</th>
                  <th class="col-time">计算时间</th>
                  <th class="text-center col-ops">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in tableData" :key="row.id" class="rk-row" :class="{ 'is-zebra': idx % 2 === 1 }">
                  <td class="text-center rk-mono cs-idx">{{ idx + 1 }}</td>
                  <td>
                    <div class="rk-person">
                      <span class="cs-avatar" :style="{ background: avatarColor(row) }">{{ (row.athleteName || '?').charAt(0) }}</span>
                      <div class="rk-person-main">
                        <div class="rk-person-link">
                          {{ row.athleteName }}
                          <GenderBadge :gender="row.athleteGender" :size="15"/>
                        </div>
                        <div class="rk-person-sub">{{ row.athleteTeam || '—' }} · #{{ row.athleteId }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="rk-soft-chip cs-model-chip" :title="row.comboModelName || ('Model #' + row.comboModelId)">
                      {{ modelLabel(row) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="cs-score rk-mono" :class="scoreClass(row.comboScore)">
                      {{ row.comboScore != null ? Number(row.comboScore).toFixed(3) : '—' }}
                    </span>
                  </td>
                  <td class="text-center"><span class="rk-soft-chip cs-algo">{{ row.algoVersion }}</span></td>
                  <td class="rk-mono cs-time">{{ formatTime(row.calculatedAt) }}</td>
                  <td class="text-center">
                    <div class="rk-actions">
                      <button type="button" class="rk-link" @click="showSnapshot(row)">快照</button>
                      <button type="button" class="rk-link cs-link-danger" @click="handleDelete(row)"
                              v-hasPermi="['apms:comboScore:remove']">删除</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!loading && tableData.length === 0">
                  <td colspan="7" class="rk-empty-cell">
                    <div class="rk-empty">
                      <p class="rk-empty-title">暂无评分记录</p>
                      <p class="rk-empty-desc">选择一次测试任务执行批量计算后生成</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========= 批量计算弹窗（原逻辑保留） ========= -->
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
              <el-option v-for="t in taskOpts" :key="t.id"
                         :label="`#${t.id} ${t.taskName} · ${t.testDate || ''}`"
                         :value="t.id"/>
            </el-select>
          </el-form-item>
        </el-form>

        <div v-if="previewItems.length" class="preview-box">
          <div class="preview-title">📋 参与队员预览（{{ previewItems.length }} 人）</div>
          <el-table :data="previewItems" border size="small" max-height="240">
            <el-table-column label="#" type="index" width="40"/>
            <el-table-column label="队员" min-width="130">
              <template #default="scope">
                {{ scope.row.athleteName }}
                <GenderBadge :gender="scope.row.gender || scope.row.athleteGender" :size="14"/>
              </template>
            </el-table-column>
            <el-table-column label="队伍" min-width="120">
              <template #default="scope">{{ scope.row.primaryTeamName || '—' }}</template>
            </el-table-column>
            <el-table-column label="性别" width="60" align="center">
              <template #default="scope">
                <GenderBadge :gender="scope.row.gender || scope.row.athleteGender" :size="15"/>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <template #footer>
          <el-button @click="showCalc = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitCalc" :disabled="!calcForm.comboModelId || !calcForm.taskId">
            <el-icon><Cpu /></el-icon>执行批量计算
          </el-button>
        </template>
      </el-dialog>

      <!-- ========= 组合分报告弹窗（共享组件，可打印） ========= -->
      <ComboScoreReport v-model="showSnapshotDialog" :row="currentSnapshotRow" />
    </div>
  </div>
</template>

<script setup name="ApmsComboScore">
import { list, calculate as calcBatch, delScore } from '@/api/apms/comboScore'
import { listComboModel } from '@/api/apms/comboModel'
import { listTestTask, listTaskMember } from '@/api/apms/testTask'
import { RefreshLeft, Cpu } from '@element-plus/icons-vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import ComboScoreReport from './ComboScoreReport.vue'
import { ageAvatarColor } from '@/utils/athleteAvatar'

defineProps({ embedded: { type: Boolean, default: false } })

const { proxy } = getCurrentInstance()

const loading = ref(false)
const rawList = ref([])
const modelOpts = ref([])
const taskOpts = ref([])
const currentModel = ref(null)
const previewItems = ref([])
const filters = reactive({ keyword: '' })
const sortDir = ref('')  // '' | 'asc' | 'desc'

const avatarColor = (row) => ageAvatarColor(row.athleteAge)
function modelLabel(row) {
  const m = modelOpts.value.find(x => x.id === row.comboModelId)
  if (m) return `模型#${m.modelId} · ${m.normalizationMethod || 'z_score'}`
  return 'Model #' + row.comboModelId
}
function scoreClass(v) {
  if (v == null) return ''
  if (v > 0.5) return 'score-high'
  if (v < -0.5) return 'score-low'
  return 'score-mid'
}

// ========= 全量加载 + 本地过滤/排序/统计 =========
const tableData = computed(() => {
  let arr = rawList.value
  if (filters.keyword) {
    const kw = filters.keyword.trim()
    arr = arr.filter(r => (r.athleteName || '').includes(kw))
  }
  if (sortDir.value) {
    arr = [...arr].sort((a, b) => {
      const va = Number(a.comboScore), vb = Number(b.comboScore)
      return sortDir.value === 'asc' ? va - vb : vb - va
    })
  }
  return arr
})
const summary = computed(() => {
  const arr = tableData.value
  const scores = arr.map(r => Number(r.comboScore)).filter(v => !isNaN(v))
  return {
    total: arr.length,
    athletes: new Set(arr.map(r => r.athleteId)).size,
    avgScore: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3) : '—',
    max: scores.length ? Math.max(...scores).toFixed(3) : '—',
    min: scores.length ? Math.min(...scores).toFixed(3) : '—'
  }
})
const kpiCards = computed(() => [
  { label: '评分记录', value: summary.value.total, unit: '条', accent: '#2563EB', chip: '含完整快照', chipTone: 'tone-info' },
  { label: '覆盖队员', value: summary.value.athletes, unit: '人', accent: '#06B6D4',
    chip: summary.value.athletes ? '人均 ' + (summary.value.total / summary.value.athletes).toFixed(1) + ' 条' : '—', chipTone: '' },
  { label: '平均组合分', value: summary.value.avgScore, unit: '', accent: '#8B5CF6', chip: 'Σ wᵢ × normalizedᵢ', chipTone: '' },
  { label: '最高 / 最低', value: summary.value.max + ' / ' + summary.value.min, unit: '', accent: '#16A34A', chip: '', chipTone: 'tone-ok' }
])
function toggleSort() { sortDir.value = sortDir.value === '' ? 'desc' : sortDir.value === 'desc' ? 'asc' : '' }

function loadList() {
  loading.value = true
  list({}).then(res => {
    rawList.value = res.data || []
  }).finally(() => { loading.value = false })
}
function resetFilter() { filters.keyword = ''; sortDir.value = '' }

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

// ========= snapshot 详情（报告内容在共享组件 ComboScoreReport 中） =========
const showSnapshotDialog = ref(false)
const currentSnapshotRow = ref(null)

function showSnapshot(row) {
  currentSnapshotRow.value = row
  showSnapshotDialog.value = true
}

function formatTime(t) { return t ? String(t).substring(0, 16) : '—' }

loadList()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.cs-search { width: 180px; }
.rk-empty-cell { padding: 36px 0; }
.rk-person-main { display: flex; flex-direction: column; gap: 3px; }
.rk-person-link { display: flex; align-items: center; gap: 6px; }

.col-idx { width: 56px; }
.col-score { width: 120px; }
.col-algo { width: 150px; }
.col-time { width: 140px; }
.col-ops { width: 130px; }

.cs-idx { font-size: 12px; color: $rk-text-3; }
.cs-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 13px; font-weight: 600; flex: none;
}
.cs-model-chip {
  max-width: 260px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--app-font-mono);
  font-size: 12px;
}
:deep(.cs-model-chip) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.cs-algo) { background: #fef3e0; color: $rk-warn; font-size: 11px; }

.cs-sort-btn {
  display: inline-flex; align-items: center; gap: 3px;
  background: none; border: none; padding: 0;
  font-size: 12px; font-weight: 500; color: $rk-text-3; cursor: pointer;
}
.cs-sort-arrow { font-size: 11px; color: $rk-brand-600; }
.cs-score { font-size: 15px; font-weight: 700; }
.cs-score.score-high { color: #2c8a57; }
.cs-score.score-low { color: #c14747; }
.cs-score.score-mid { color: #53655e; }
.cs-time { font-size: 12px; color: $rk-text-2; white-space: nowrap; }
.cs-link-danger { color: $rk-risk; }

.sub-hint { font-size: 12px; color: #909399; margin-top: 4px; }
.calc-tip { margin-bottom: 14px; }
.preview-box { margin-top: 16px; border: 1px solid #e6ebf0; border-radius: 8px; padding: 12px; background: #fafbfc; }
.preview-title { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px; }

/* 嵌入组合测试调度合并页时使用紧凑内边距 */
.app-container.is-embedded {
  padding: 0;
  :deep(.rk-dash-page) {
    margin: 0;
    padding: 0;
    min-height: 0;
  }
}
</style>
