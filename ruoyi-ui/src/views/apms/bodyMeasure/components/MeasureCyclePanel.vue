<template>
  <div>
    <div class="mc-toolbar">
      <div class="mc-filter">
        <input v-model="keyword" class="rk-input" type="text" placeholder="周期名称" />
        <select v-model="statusFilter" class="rk-select">
          <option value="">全部状态</option>
          <option value="0">进行中</option>
          <option value="1">已关闭</option>
        </select>
      </div>
      <el-button type="primary" class="rk-btn rk-btn-primary" @click="openCreate">
        <el-icon><Plus /></el-icon>新建测量周期
      </el-button>
    </div>

    <div v-loading="loading" class="mc-grid">
      <div v-for="c in filtered" :key="c.id" class="mc-card" :class="{ 'is-closed': c.status === '1' }">
        <div class="mc-card-head">
          <span class="mc-name">{{ c.name }}</span>
          <span class="rk-status-badge" :class="c.status === '1' ? 'tone-gray' : 'tone-green'">
            {{ c.status === '1' ? '已关闭' : '进行中' }}
          </span>
        </div>
        <div class="mc-meta">
          <span class="rk-soft-chip">{{ c.targetDeptName || '全部在训队员' }}</span>
          <span class="mc-window rk-mono">{{ fmtDate(c.planStartDate) }} ~ {{ fmtDate(c.planEndDate) || '—' }}</span>
        </div>
        <div class="mc-progress-wrap">
          <div class="mc-progress-bar">
            <div class="mc-progress-inner" :style="{ width: percent(c) + '%' }"></div>
          </div>
          <span class="mc-progress-text">{{ c.measuredCount || 0 }}/{{ c.memberTotal || 0 }} · {{ percent(c) }}%</span>
        </div>
        <div class="mc-actions">
          <button type="button" class="rk-link" @click="$emit('detail', c)">查看/录入</button>
          <button type="button" class="rk-link" @click="openEdit(c)">编辑</button>
          <button type="button" class="rk-link" @click="toggleStatus(c)">
            {{ c.status === '1' ? '重新开启' : '关闭周期' }}
          </button>
          <button type="button" class="rk-link is-danger" @click="handleDelete(c)">删除</button>
        </div>
      </div>
      <div v-if="!loading && !filtered.length" class="mc-empty">
        暂无测量周期，点击右上角「新建测量周期」安排一次队伍体态测量
      </div>
    </div>

    <!-- 新建/编辑 -->
    <el-dialog :title="form.id ? '编辑测量周期' : '新建测量周期'" v-model="formVisible" width="520px" append-to-body>
      <el-form :model="form" label-width="100px">
        <el-form-item label="周期名称" required>
          <el-input v-model="form.name" placeholder="如 2026 秋季入队体态测量"/>
        </el-form-item>
        <el-form-item label="目标队伍">
          <el-select v-model="form.targetDeptId" clearable placeholder="不选=全部在训队员" style="width:100%">
            <el-option v-for="d in flatDepts" :key="d.deptId"
                       :label="`${'　'.repeat(d.depth)}${d.deptName}`" :value="d.deptId"/>
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="开始日期">
              <el-date-picker v-model="form.planStartDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期">
              <el-date-picker v-model="form.planEndDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">进行中</el-radio>
            <el-radio value="1">已关闭</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="测量口径、注意事项等"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { listCycle, addCycle, updateCycle, delCycle } from '@/api/apms/measureCycle'
import { listDept } from '@/api/system/dept'

const { proxy } = getCurrentInstance()
const emit = defineEmits(['changed', 'detail'])

const loading = ref(false)
const saving = ref(false)
const cycles = ref([])
const keyword = ref('')
const statusFilter = ref('0')
const depts = ref([])
const formVisible = ref(false)
const form = reactive({ id: null, name: '', targetDeptId: null, planStartDate: null, planEndDate: null, status: '0', remark: '' })

const flatDepts = computed(() => {
  const out = []
  const walk = (nodes, depth) => (nodes || []).forEach(n => {
    out.push({ deptId: n.deptId, deptName: n.deptName, depth })
    if (n.children) walk(n.children, depth + 1)
  })
  walk(depts.value, 0)
  return out
})

const filtered = computed(() => {
  let arr = cycles.value
  if (statusFilter.value !== '') arr = arr.filter(c => c.status === statusFilter.value)
  const kw = keyword.value.trim()
  if (kw) arr = arr.filter(c => (c.name || '').includes(kw))
  return arr
})

const fmtDate = (d) => d ? String(d).substring(0, 10) : ''
const percent = (c) => {
  const total = c.memberTotal || 0
  return total ? Math.round((c.measuredCount || 0) * 1000 / total) / 10 : 0
}

async function load() {
  loading.value = true
  try {
    const res = await listCycle({ pageNum: 1, pageSize: 999 })
    cycles.value = res.rows || []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, { id: null, name: '', targetDeptId: null, planStartDate: null, planEndDate: null, status: '0', remark: '' })
  formVisible.value = true
}
function openEdit(c) {
  Object.assign(form, {
    id: c.id, name: c.name, targetDeptId: c.targetDeptId ?? null,
    planStartDate: fmtDate(c.planStartDate), planEndDate: fmtDate(c.planEndDate),
    status: c.status, remark: c.remark
  })
  formVisible.value = true
}
async function submit() {
  if (!form.name.trim()) return proxy.$modal.msgWarning('请输入周期名称')
  saving.value = true
  try {
    await (form.id ? updateCycle(form) : addCycle(form))
    proxy.$modal.msgSuccess('保存成功')
    formVisible.value = false
    load()
    emit('changed')
  } finally {
    saving.value = false
  }
}
function toggleStatus(c) {
  const next = c.status === '1' ? '0' : '1'
  updateCycle({ id: c.id, status: next }).then(() => {
    proxy.$modal.msgSuccess(next === '1' ? '周期已关闭' : '周期已重新开启')
    load()
  })
}
function handleDelete(c) {
  proxy.$modal.confirm(`确认删除周期「${c.name}」吗？周期内测量记录将保留，但不再归属该周期。`).then(() =>
    delCycle(c.id)
  ).then(() => {
    proxy.$modal.msgSuccess('已删除')
    load()
  }).catch(() => {})
}

onMounted(async () => {
  load()
  const d = await listDept({ pageNum: 1, pageSize: 500 })
  depts.value = Array.isArray(d.data) ? d.data : []
})

defineExpose({ load })
</script>

<style lang="scss" scoped>
.mc-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.mc-filter { display: flex; gap: 10px; }
.mc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.mc-card {
  border: 1px solid #e8edf4; border-radius: 12px; padding: 14px 16px; background: #fff;
  display: flex; flex-direction: column; gap: 10px;
  transition: box-shadow .2s, border-color .2s;
}
.mc-card:hover { border-color: #c7d8f5; box-shadow: 0 6px 20px rgba(37,99,235,.07); }
.mc-card.is-closed { background: #fafbfc; opacity: .85; }
.mc-card-head { display: flex; justify-content: space-between; align-items: center; }
.mc-name { font-weight: 600; font-size: 14px; color: #1e293b; }
.mc-meta { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.mc-window { font-size: 11px; color: #94a3b8; }
.mc-progress-wrap { display: flex; align-items: center; gap: 8px; }
.mc-progress-bar { flex: 1; height: 7px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
.mc-progress-inner { height: 100%; background: linear-gradient(90deg, #34d399, #059669); border-radius: 999px; }
.mc-progress-text { font-size: 11px; color: #64748b; white-space: nowrap; }
.mc-actions { display: flex; gap: 14px; border-top: 1px dashed #eef2f7; padding-top: 8px; }
.mc-actions .rk-link { padding: 0; }
.mc-actions .is-danger { color: #dc2626; }
.mc-empty { grid-column: 1/-1; padding: 50px; text-align: center; color: #94a3b8; font-size: 13px; }
</style>
