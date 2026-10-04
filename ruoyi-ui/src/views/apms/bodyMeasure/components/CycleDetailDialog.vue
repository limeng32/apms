<template>
  <el-dialog :title="`测量周期 · ${data.cycle?.name || ''}`" v-model="visible" width="880px" append-to-body
             @closed="reset">
    <div v-loading="loading">
      <!-- 概览：窗口 + 进度条 -->
      <div class="cd-head">
        <div class="cd-meta">
          <span class="rk-soft-chip">{{ data.cycle?.targetDeptName || '全部在训队员' }}</span>
          <span class="cd-window">
            {{ fmtDate(data.cycle?.planStartDate) }} ~ {{ fmtDate(data.cycle?.planEndDate) || '—' }}
          </span>
          <span class="rk-status-badge" :class="data.cycle?.status === '1' ? 'tone-gray' : 'tone-green'">
            {{ data.cycle?.status === '1' ? '已关闭' : '进行中' }}
          </span>
        </div>
        <div class="cd-progress">
          <div class="cd-progress-bar">
            <div class="cd-progress-inner" :style="{ width: (data.percent || 0) + '%' }"></div>
          </div>
          <span class="cd-progress-text">
            {{ data.measuredCount || 0 }} / {{ data.memberTotal || 0 }} 人已测（{{ data.percent || 0 }}%）
          </span>
        </div>
      </div>

      <div class="cd-toolbar">
        <el-radio-group v-model="view" size="small">
          <el-radio-button value="pending">未测（{{ (data.pending || []).length }}）</el-radio-button>
          <el-radio-button value="measured">已测（{{ (data.measured || []).length }}）</el-radio-button>
        </el-radio-group>
        <el-button type="primary" size="small" @click="enterBatch"
                   v-if="data.cycle?.status !== '1'">批量录入</el-button>
      </div>

      <!-- 名单 -->
      <div v-if="!batchMode" class="rk-table-scroll cd-scroll">
        <table class="rk-table cd-table">
          <thead>
            <tr>
              <th>队员</th>
              <th>队伍</th>
              <template v-if="view === 'measured'">
                <th class="text-center">测量日期</th>
                <th class="text-right">身高</th>
                <th class="text-right">体重</th>
                <th class="text-right">体脂%</th>
              </template>
              <th v-else class="text-center">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in list" :key="p.athleteId">
              <td>{{ p.athleteName }} <GenderBadge :gender="p.athleteGender" :size="14" class="cd-gender"/></td>
              <td class="re-muted">{{ p.teamName || '—' }}</td>
              <template v-if="view === 'measured'">
                <td class="text-center rk-mono">{{ fmtDate(p.measureDate) }}</td>
                <td class="text-right rk-mono">{{ p.height ?? '—' }}</td>
                <td class="text-right rk-mono">{{ p.weight ?? '—' }}</td>
                <td class="text-right rk-mono">{{ p.bodyFatRate ?? '—' }}</td>
              </template>
              <td v-else class="text-center"><span class="rk-status-badge tone-amber">待测量</span></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!list.length" class="cd-empty">{{ view === 'pending' ? '全部队员都已完成测量 🎉' : '暂无已测记录' }}</div>
      </div>

      <!-- 批量录入 -->
      <div v-else>
        <div class="cd-batch-bar">
          <span>统一测量日期</span>
          <el-date-picker v-model="batchDate" type="date" value-format="YYYY-MM-DD" size="small" style="width:150px"/>
          <span class="cd-batch-hint">已测队员默认带出上次数据，修改即更新；空白行自动跳过</span>
        </div>
        <div class="rk-table-scroll cd-scroll">
          <table class="rk-table cd-table">
            <thead>
              <tr>
                <th>队员</th>
                <th class="text-center">身高 cm</th>
                <th class="text-center">体重 kg</th>
                <th class="text-center">坐高 cm</th>
                <th class="text-center">体脂 %</th>
                <th class="text-center">腰围 cm</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in batchRows" :key="row.athleteId">
                <td>{{ row.athleteName }} <GenderBadge :gender="row.athleteGender" :size="14" class="cd-gender"/> <span class="re-muted">{{ row.teamName }}</span></td>
                <td class="text-center"><el-input-number v-model="row.height" :precision="1" :step="0.5" :controls="false" :min="100" :max="230" size="small" style="width:96px"/></td>
                <td class="text-center"><el-input-number v-model="row.weight" :precision="1" :step="0.5" :controls="false" :min="30" :max="150" size="small" style="width:96px"/></td>
                <td class="text-center"><el-input-number v-model="row.sitHeight" :precision="1" :step="0.5" :controls="false" :min="40" :max="150" size="small" style="width:96px"/></td>
                <td class="text-center"><el-input-number v-model="row.bodyFatRate" :precision="1" :step="0.5" :controls="false" :min="3" :max="40" size="small" style="width:96px"/></td>
                <td class="text-center"><el-input-number v-model="row.waist" :precision="1" :step="0.5" :controls="false" :min="40" :max="150" size="small" style="width:96px"/></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="batchMode">
        <el-button @click="batchMode = false">返 回</el-button>
        <el-button type="primary" :loading="saving" @click="submitBatch">保存测量结果</el-button>
      </template>
      <el-button v-else @click="visible = false">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { cycleProgress, batchSaveCycle } from '@/api/apms/measureCycle'
import GenderBadge from '@/components/GenderBadge/index.vue'

const { proxy } = getCurrentInstance()
const emit = defineEmits(['saved'])

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const view = ref('pending')
const batchMode = ref(false)
const batchDate = ref(null)
const data = reactive({ cycle: null, memberTotal: 0, measuredCount: 0, pendingCount: 0, percent: 0, measured: [], pending: [] })
const batchRows = ref([])

const list = computed(() => view.value === 'pending' ? data.pending : data.measured)
const fmtDate = (d) => d ? String(d).substring(0, 10) : ''

async function open(id) {
  visible.value = true
  batchMode.value = false
  view.value = 'pending'
  loading.value = true
  try {
    const res = await cycleProgress(id)
    Object.assign(data, res.data)
  } finally {
    loading.value = false
  }
}

async function reload() {
  if (!data.cycle) return
  const res = await cycleProgress(data.cycle.id)
  Object.assign(data, res.data)
}

function enterBatch() {
  batchDate.value = fmtDate(data.cycle.planStartDate) || new Date().toISOString().slice(0, 10)
  // 目标队员=已测+未测；已测带出旧值（measureId 存在表示更新）
  const measuredMap = new Map(data.measured.map(m => [m.athleteId, m]))
  batchRows.value = [...data.pending, ...data.measured.map(m => ({ ...m }))]
    .sort((a, b) => (a.teamName || '').localeCompare(b.teamName || ''))
    .map(p => {
      const old = measuredMap.get(p.athleteId)
      return {
        measureId: old?.measureId ?? null,
        athleteId: p.athleteId,
        athleteName: p.athleteName,
        athleteGender: p.athleteGender ?? old?.athleteGender ?? null,
        teamName: p.teamName ? `（${p.teamName}）` : '',
        height: old?.height ?? null,
        weight: old?.weight ?? null,
        sitHeight: old?.sitHeight ?? null,
        bodyFatRate: old?.bodyFatRate ?? null,
        waist: old?.waist ?? null
      }
    })
  batchMode.value = true
}

async function submitBatch() {
  const filled = batchRows.value.filter(r =>
    r.height != null || r.weight != null || r.sitHeight != null || r.bodyFatRate != null || r.waist != null)
  if (!filled.length) return proxy.$modal.msgWarning('请至少填写一项测量数据')
  saving.value = true
  try {
    await batchSaveCycle(data.cycle.id, filled.map(r => ({
      id: r.measureId || undefined,
      athleteId: r.athleteId,
      measureDate: batchDate.value,
      height: r.height, weight: r.weight, sitHeight: r.sitHeight,
      bodyFatRate: r.bodyFatRate, waist: r.waist
    })))
    proxy.$modal.msgSuccess(`已保存 ${filled.length} 条测量记录`)
    await reload()
    emit('saved')
    batchMode.value = false
    view.value = 'measured'
  } finally {
    saving.value = false
  }
}

function reset() {
  Object.assign(data, { cycle: null, measured: [], pending: [] })
  batchRows.value = []
}

defineExpose({ open, reload })
</script>

<style lang="scss" scoped>
.cd-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 20px; flex-wrap: wrap; }
.cd-meta { display: flex; gap: 8px; align-items: center; }
.cd-window { font-size: 12px; color: #64748b; font-family: ui-monospace, Menlo, monospace; }
.cd-progress { display: flex; align-items: center; gap: 10px; }
.cd-progress-bar { width: 220px; height: 8px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
.cd-progress-inner { height: 100%; background: linear-gradient(90deg, #60a5fa, #2563eb); border-radius: 999px; transition: width .4s; }
.cd-progress-text { font-size: 12px; color: #475569; white-space: nowrap; }
.cd-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.cd-scroll { max-height: 460px; border: 1px solid #eef2f7; border-radius: 8px; }
.cd-table { font-size: 12px; }
.cd-empty { padding: 36px; text-align: center; color: #94a3b8; font-size: 13px; }
.cd-batch-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 13px; color: #475569; }
.cd-batch-hint { font-size: 12px; color: #94a3b8; }
.re-muted { color: #94a3b8; font-size: 11px; margin-left: 6px; }
.cd-gender { vertical-align: middle; margin: 0 3px; }
:deep(.el-input-number .el-input__inner) { text-align: center; }
</style>
