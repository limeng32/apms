<template>
  <div class="app-container">

    <!-- 筛选条 -->
    <el-form :inline="true" :model="filters" class="filter-bar">
      <el-form-item label="队员">
        <el-input v-model="filters.keyword" placeholder="姓名" clearable style="width:130px"/>
      </el-form-item>
      <el-form-item label="队伍">
        <el-tree-select v-model="filters.deptId" :data="deptOpts" filterable clearable
                        :props="{ label: 'deptName', value: 'deptId' }" style="width:150px"/>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="loadList">查询</el-button>
        <el-button icon="Refresh" @click="resetFilter">重置</el-button>
        <el-button type="success" icon="Plus" @click="showAddDialog" v-hasPermi="['apms:body:edit']">新增测量</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="tableData" border stripe v-loading="loading" max-height="600"
              row-key="id" @row-click="handleRowClick" highlight-current-row>
      <el-table-column label="#" type="index" width="50" align="center"/>
      <el-table-column label="队员" min-width="130">
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
      <el-table-column label="测量日期" width="120" align="center" prop="measureDate"/>
      <el-table-column label="身高(cm)" width="100" align="right">
        <template #default="scope">{{ scope.row.height ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="体重(kg)" width="100" align="right">
        <template #default="scope">{{ scope.row.weight ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="坐高(cm)" width="100" align="right">
        <template #default="scope">{{ scope.row.sitHeight ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="腿长(cm)" width="100" align="right">
        <template #default="scope">
          <span class="calc-val">{{ calcLeg(scope.row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="体脂(%)" width="90" align="right">
        <template #default="scope">{{ scope.row.bodyFatRate ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="腰围(cm)" width="90" align="right">
        <template #default="scope">{{ scope.row.waist ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="BMI" width="90" align="right">
        <template #default="scope">
          <span v-if="scope.row.height && scope.row.weight" class="calc-val">{{ calcBmi(scope.row) }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="90" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.dataSource" :type="sourceTag(scope.row.dataSource)" size="small">
            {{ sourceLabel(scope.row.dataSource) }}
          </el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click.stop="showEditDialog(scope.row)" v-hasPermi="['apms:body:edit']">编辑</el-button>
          <el-button link type="danger" icon="Delete" @click.stop="handleDelete(scope.row)" v-hasPermi="['apms:body:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

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
        <el-form-item label="数据来源">
          <el-select v-model="editForm.dataSource" style="width:100%">
            <el-option label="手动录入" value="manual"/>
            <el-option label="CSV 导入" value="csv"/>
            <el-option label="测量任务" value="task"/>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsBodyMeasure">
import { list as listMeasures, upsert, delMeasure } from '@/api/apms/bodyMeasure'
import { listAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'

const { proxy } = getCurrentInstance()

const loading = ref(false)
const tableData = ref([])
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

const avatarColors = ['#f0a23a', '#7b9dc9', '#c14747', '#5fa080', '#a878d8', '#d88a3a']
const avatarColor = (row) => avatarColors[(row.athleteId || 0) % avatarColors.length]
const calcLeg = (r) => r.height && r.sitHeight ? (r.height - r.sitHeight).toFixed(1) : '—'
const calcBmi = (r) => {
  if (!r.height || !r.weight) return null
  const m = r.height / 100
  return (r.weight / (m * m)).toFixed(1)
}
const sourceLabel = (s) => s === 'manual' ? '手动' : s === 'csv' ? 'CSV' : s === 'task' ? '任务' : s
const sourceTag = (s) => s === 'manual' ? '' : s === 'csv' ? 'warning' : 'success'

function loadList() {
  loading.value = true
  listMeasures({}).then(res => {
    let arr = res.data || []
    if (filters.keyword) arr = arr.filter(r => (r.athleteName || '').includes(filters.keyword))
    tableData.value = arr
  }).finally(() => loading.value = false)
}
function resetFilter() { filters.keyword = ''; filters.deptId = null; loadList() }

Promise.all([
  listAthlete({ pageNum: 1, pageSize: 500 }),
  listDept({ pageNum: 1, pageSize: 500 })
]).then(([a, d]) => {
  athleteOpts.value = a.rows || []
  deptOpts.value = Array.isArray(d.data) ? d.data : []
})

function showAddDialog() {
  Object.assign(editForm, { id: null, athleteId: null, measureDate: new Date().toISOString().slice(0,10),
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
  }).finally(() => saving.value = false)
}
function handleDelete(row) {
  proxy.$modal.confirm(`确认删除 ${row.athleteName} 的测量记录 (${row.measureDate}) 吗？`).then(() => {
    delMeasure(row.id).then(() => { proxy.$modal.msgSuccess('已删除'); loadList() })
  }).catch(() => {})
}

function handleRowClick(row) { /* 预留：点击行跳转 PHV 详情 或 高亮关联 */ }

loadList()
</script>

<style scoped>
.ath-cell { display: flex; align-items: center; gap: 10px; }
.ath-avatar { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 600; }
.ath-name { font-weight: 500; color: #303133; }
.ath-sub { font-size: 11.5px; color: #909399; margin-top: 2px; }
.calc-val { color: #53655e; font-weight: 600; }
.muted { color: #c0c4cc; }
.filter-bar { margin-bottom: 12px; }
</style>
