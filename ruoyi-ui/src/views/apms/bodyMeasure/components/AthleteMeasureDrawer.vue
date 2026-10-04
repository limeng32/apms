<template>
  <el-drawer :title="`体态测量历史 · ${athleteName || ''}`" v-model="visible" size="720px" append-to-body>
    <div v-loading="loading" class="amd-body">
      <!-- 最新值卡带 -->
      <div class="amd-latest" v-if="records.length">
        <div class="amd-latest-card" v-for="c in latestCards" :key="c.label">
          <span class="amd-latest-label">{{ c.label }}</span>
          <span class="amd-latest-value">{{ c.value }}<i v-if="c.unit">{{ c.unit }}</i></span>
          <span class="amd-latest-date">{{ c.date }}</span>
        </div>
      </div>

      <!-- 趋势图 -->
      <div class="rk-card amd-chart-card">
        <div class="amd-section-title">变化趋势</div>
        <BodyTrendChart :records="records"/>
      </div>

      <!-- 历史记录表 -->
      <div class="rk-card">
        <div class="amd-section-title">
          全部测量记录
          <span class="amd-count">{{ records.length }}</span>
        </div>
        <div class="rk-table-scroll">
          <table class="rk-table amd-table">
            <thead>
              <tr>
                <th>日期</th>
                <th class="text-right">身高</th>
                <th class="text-right">体重</th>
                <th class="text-right">坐高</th>
                <th class="text-right">体脂%</th>
                <th class="text-right">腰围</th>
                <th class="text-center">来源</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in records" :key="r.id">
                <td class="rk-mono">{{ (r.measureDate || '').substring(0, 10) }}</td>
                <td class="text-right rk-mono">{{ r.height ?? '—' }}</td>
                <td class="text-right rk-mono">{{ r.weight ?? '—' }}</td>
                <td class="text-right rk-mono">{{ r.sitHeight ?? '—' }}</td>
                <td class="text-right rk-mono">{{ r.bodyFatRate ?? '—' }}</td>
                <td class="text-right rk-mono">{{ r.waist ?? '—' }}</td>
                <td class="text-center">
                  <span class="rk-status-badge" :class="sourceMeta(r.dataSource).tone">{{ sourceMeta(r.dataSource).label }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref } from 'vue'
import BodyTrendChart from '@/components/BodyTrendChart/index.vue'
import { listByAthlete } from '@/api/apms/bodyMeasure'

const visible = ref(false)
const loading = ref(false)
const records = ref([])
const athleteId = ref(null)
const athleteName = ref('')

const SOURCE_META = {
  manual: { tone: 'tone-gray', label: '手动' },
  csv: { tone: 'tone-amber', label: 'CSV' },
  task: { tone: 'tone-green', label: '任务' },
  cycle: { tone: 'tone-blue', label: '周期' },
  import: { tone: 'tone-amber', label: '导入' }
}
const sourceMeta = (s) => SOURCE_META[s] || { tone: 'tone-gray', label: s || '—' }

const fmtDate = (d) => d ? String(d).substring(0, 10) : ''
const bmi = (r) => (r.height && r.weight)
  ? Number(r.weight / Math.pow(r.height / 100, 2)).toFixed(1) : null

const latestCards = computed(() => {
  const r = records.value[0] // 接口按日期倒序
  if (!r) return []
  return [
    { label: '身高', value: r.height ?? '—', unit: 'cm', date: fmtDate(r.measureDate) },
    { label: '体重', value: r.weight ?? '—', unit: 'kg', date: fmtDate(r.measureDate) },
    { label: 'BMI', value: bmi(r) ?? '—', unit: '', date: fmtDate(r.measureDate) },
    { label: '体脂率', value: r.bodyFatRate ?? '—', unit: '%', date: fmtDate(r.measureDate) },
    { label: '腰围', value: r.waist ?? '—', unit: 'cm', date: fmtDate(r.measureDate) }
  ]
})

async function open(athlete) {
  athleteId.value = athlete.athleteId
  athleteName.value = athlete.athleteName || athlete.name
  visible.value = true
  loading.value = true
  try {
    const res = await listByAthlete(athleteId.value)
    records.value = res.data || []
  } finally {
    loading.value = false
  }
}

async function reload() {
  if (!athleteId.value) return
  const res = await listByAthlete(athleteId.value)
  records.value = res.data || []
}

defineExpose({ open, reload })
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.amd-body { display: flex; flex-direction: column; gap: 14px; padding: 0 4px 20px; }
.amd-latest { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.amd-latest-card {
  background: #f8fafc; border: 1px solid #eef2f7; border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 2px;
}
.amd-latest-label { font-size: 11px; color: #94a3b8; }
.amd-latest-value { font-size: 20px; font-weight: 700; color: #1e293b; font-family: ui-monospace, Menlo, monospace; }
.amd-latest-value i { font-style: normal; font-size: 11px; font-weight: 400; color: #94a3b8; margin-left: 2px; }
.amd-latest-date { font-size: 10px; color: #cbd5e1; }
.amd-chart-card { padding: 12px; }
.amd-section-title { font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 8px; }
.amd-count { display: inline-block; margin-left: 6px; background: #eff6ff; color: #2563eb; border-radius: 10px; padding: 0 8px; font-size: 11px; }
.amd-table { font-size: 12px; }
</style>
