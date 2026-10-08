<template>
  <!-- ========= 组合分报告弹窗（可打印；列表页与运动员详情共用） ========= -->
  <el-dialog :title="null" :model-value="modelValue"
             @update:model-value="v => emit('update:modelValue', v)"
             width="880px" class="report-dialog" :show-close="true">
    <div v-if="snapshotData" class="combo-report" id="comboReport">
      <!-- 报告头部 -->
      <div class="report-header">
        <div class="report-meta">
          <div class="report-title">
            🏋️ 组合体能评分报告
            <span class="report-sub">Combo Fitness Report</span>
          </div>
          <div class="report-info">
            <div class="info-row"><span class="info-label">队员</span><b>{{ row?.athleteName }}</b></div>
            <div class="info-row"><span class="info-label">组合模型</span>{{ row?.comboModelName || ('Model #' + row?.comboModelId) }}</div>
            <div class="info-row"><span class="info-label">算法版本</span><el-tag size="small" type="warning">{{ snapshotData.algoVersion }}</el-tag></div>
            <div class="info-row"><span class="info-label">归一化</span><el-tag size="small">{{ snapshotData.normalization }}</el-tag></div>
            <div class="info-row"><span class="info-label">计算时间</span>{{ row?.calculatedAt }}</div>
          </div>
        </div>
        <div class="report-score-box">
          <div class="score-big" :class="scoreClass(row?.comboScore)">
            {{ row?.comboScore != null ? Number(row.comboScore).toFixed(3) : '—' }}
          </div>
          <div class="score-grade" :class="'grade-' + comboGrade(row?.comboScore)">
            {{ comboGradeLabel(row?.comboScore) }}
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
        <el-table :data="sortedComponents" border size="small" :row-class-name="({ row: r }) => r.valid ? '' : 'component-skip'">
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
      <el-button @click="printReport" icon="Printer">🖨️ 打印报告</el-button>
      <el-button @click="emit('update:modelValue', false)">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup name="ComboScoreReport">
import { getById } from '@/api/apms/comboScore'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 评分行（含 refSnapshot；若只有 id 则自动拉详情）
  row: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue'])

// 解析 ref_snapshot，清洗旧版后端写入的字面量 "null"
function parseSnapshot(raw) {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (Array.isArray(data.components)) {
      data.components.forEach(c => {
        if (c.indicatorCode === 'null' || c.indicatorCode == null) c.indicatorCode = ''
        if (c.indicatorName === 'null' || c.indicatorName == null) c.indicatorName = ''
      })
    }
    return data
  } catch (e) {
    return null
  }
}

const fullRow = ref(null)
const snapshotData = computed(() => parseSnapshot(fullRow.value?.refSnapshot))

watch(() => props.modelValue, async (open) => {
  if (!open || !props.row) return
  // 行内已有快照直接用；否则按 id 拉详情
  if (props.row.refSnapshot) {
    fullRow.value = props.row
  } else if (props.row.id) {
    try {
      const res = await getById(props.row.id)
      fullRow.value = res.data || res
    } catch (e) {
      fullRow.value = props.row
    }
  } else {
    fullRow.value = props.row
  }
}, { immediate: true })

// 弹窗打开期间行数据被替换（列表连续点不同记录）时同步
watch(() => props.row, (r) => { if (props.modelValue && r) fullRow.value = r.refSnapshot ? r : fullRow.value })

const row = computed(() => fullRow.value || props.row)

const sortedComponents = computed(() => {
  if (!snapshotData.value?.components) return []
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
function scoreClass(v) {
  if (v == null) return ''
  if (v > 0.5) return 'score-high'
  if (v < -0.5) return 'score-low'
  return 'score-mid'
}
function printReport() { window.print() }
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

/* ========== 报告样式 ========== */
.combo-report { font-family: var(--app-font-family); }
.report-header {
  display: flex; gap: 24px; margin-bottom: 20px;
  padding: 20px; background: linear-gradient(135deg, #f0f8f3 0%, #e8f5ee 100%);
  border-radius: 10px; border: 1px solid #c8e0d0;
}
.report-meta { flex: 1; min-width: 0; }
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
.score-big { font-size: 42px; font-weight: 700; font-family: var(--app-font-mono); line-height: 1; }
.score-big.score-high { color: #2c8a57; }
.score-big.score-low { color: #c14747; }
.score-big.score-mid { color: #53655e; }
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
.bar-label .ind-code { font-family: var(--app-font-mono); font-size: 12px; color: #1b4332; font-weight: 600; }
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
.bar-val { text-align: right; font-size: 12px; font-family: var(--app-font-mono); }
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
.ind-code-sm { font-family: var(--app-font-mono); font-size: 12px; color: #1b4332; font-weight: 600; }
.ind-name-sm { font-size: 11px; color: #909399; }

/* Z-Score 颜色 */
.z-pos { color: #2c8a57; font-weight: 600; }
.z-neg { color: #c14747; font-weight: 600; }
.z-mid { color: #53655e; }

.t-cell { font-weight: 600; color: #1b4332; font-family: var(--app-font-mono); }
.weighted-cell { font-weight: 600; color: #2c8a57; font-family: var(--app-font-mono); }
.ref-range { font-size: 12px; color: #606266; }
.real-badge { margin-left: 4px; }
.ref-badge { margin-left: 4px; }
.muted { color: #c0c4cc; }

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
