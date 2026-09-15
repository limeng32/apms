<template>
  <div class="app-container task-page">
    <!-- 搜索 -->
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="任务名称" prop="taskName">
        <el-input v-model="queryParams.taskName" clearable style="width:200px" @keyup.enter="handleQuery"/>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width:130px">
          <el-option label="未开始" value="pending"/>
          <el-option label="进行中" value="in_progress"/>
          <el-option label="已完成" value="completed"/>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['apms:testTask:add']">新增任务</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['apms:testTask:remove']">删除</el-button>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：任务列表 -->
      <el-col :span="10">
        <div class="panel-title">
          <span>测试任务</span>
          <span class="panel-total">共 {{ total }} 个</span>
        </div>
        <el-table
          :data="taskList"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
          highlight-current-row
          v-loading="loading"
          size="default"
          max-height="560"
          stripe
        >
          <el-table-column type="selection" width="40" align="center"/>
          <el-table-column label="任务名称" prop="taskName" min-width="160">
            <template #default="scope">
              <span class="task-name">{{ scope.row.taskName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="队伍" width="100">
            <template #default="scope">{{ scope.row.targetDeptName }}</template>
          </el-table-column>
          <el-table-column label="时间" width="140">
            <template #default="scope">
              <span class="date-cell">{{ formatDate(scope.row.startDate) }}</span>
              <span class="date-sep">~</span>
              <span class="date-cell">{{ formatDate(scope.row.endDate) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="scope">
              <el-tag :type="statusTag(scope.row.status)" size="small" effect="dark">{{ statusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="120">
            <template #default="scope">
              <el-progress :percentage="scope.row.progressPercent" :stroke-width="8" :show-text="false"/>
              <span class="progress-text">{{ scope.row.progressPercent }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click.stop="handleEdit(scope.row)" v-hasPermi="['apms:testTask:edit']">改</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </el-col>

      <!-- 右：详情面板 -->
      <el-col :span="14">
        <div class="panel-title">
          <span>详情</span>
          <span v-if="currentTask" class="panel-sub">{{ currentTask.taskName }}</span>
          <span v-else class="panel-sub muted">← 点击左侧任务查看</span>
        </div>

        <div v-if="currentTask" class="detail-panel" v-loading="detailLoading">
          <!-- 顶部摘要卡 -->
          <div class="task-summary">
            <div class="sum-item">
              <div class="sum-num">{{ currentTask.items?.length || 0 }}</div>
              <div class="sum-label">测试项</div>
            </div>
            <div class="sum-item">
              <div class="sum-num">{{ currentTask.memberTotal || 0 }}</div>
              <div class="sum-label">参测队员</div>
            </div>
            <div class="sum-item completed">
              <div class="sum-num">{{ currentTask.memberCompleted || 0 }}</div>
              <div class="sum-label">已完成</div>
            </div>
            <div class="sum-item partial">
              <div class="sum-num">{{ currentTask.memberPartial || 0 }}</div>
              <div class="sum-label">部分完成</div>
            </div>
            <div class="sum-item pending">
              <div class="sum-num">{{ currentTask.memberPending || 0 }}</div>
              <div class="sum-label">未开始</div>
            </div>
          </div>

          <!-- Tab -->
          <el-tabs v-model="activeTab" class="detail-tabs">
            <!-- Tab 1: 测试项 -->
            <el-tab-pane label="测试项" name="items">
              <div v-if="detail.items?.length" class="item-tab">
                <el-table :data="detail.items" size="default" border stripe>
                  <el-table-column label="#" type="index" width="40" align="center"/>
                  <el-table-column label="类型" width="90" align="center">
                    <template #default="scope">
                      <el-tag :type="scope.row.itemType === 'INDICATOR' ? 'primary' : 'success'" size="small" effect="dark">
                        {{ scope.row.itemType === 'INDICATOR' ? '指标' : '模型' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="名称" min-width="180">
                    <template #default="scope">
                      <template v-if="scope.row.itemType === 'INDICATOR'">
                        <span class="item-code">{{ scope.row.indicatorCode }}</span>
                        <span class="item-name">{{ scope.row.indicatorName }}</span>
                      </template>
                      <template v-else>
                        <span class="item-code">{{ scope.row.modelCode }}</span>
                        <span class="item-name">{{ scope.row.modelName }}</span>
                        <el-tag size="small" type="info" style="margin-left:4px">{{ scope.row.modelCategory }}</el-tag>
                      </template>
                    </template>
                  </el-table-column>
                  <el-table-column label="方向" width="120" align="center">
                    <template #default="scope">
                      <template v-if="scope.row.itemType === 'INDICATOR'">
                        {{ dirLabel(scope.row.indicatorDirection) }}
                      </template>
                      <span v-else style="color:#c0c4cc">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="必/选" width="70" align="center">
                    <template #default="scope">
                      <el-tag :type="scope.row.isRequired === '1' ? 'danger' : 'info'" size="small" effect="dark">
                        {{ scope.row.isRequired === '1' ? '必测' : '选测' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="排序" prop="sortOrder" width="60" align="center"/>
                </el-table>
              </div>
              <el-empty v-else description="暂无测试项"/>
            </el-tab-pane>

            <!-- Tab 2: 参测队员 -->
            <el-tab-pane label="参测队员" name="members">
              <div v-if="detail.members?.length" class="member-tab">
                <el-table :data="detail.members" size="default" border stripe>
                  <el-table-column label="姓名" prop="athleteName" width="120"/>
                  <el-table-column label="性别" width="60" align="center">
                    <template #default="scope">
                      <span :class="scope.row.athleteGender === 'F' ? 'female' : 'male'">
                        {{ scope.row.athleteGender === 'F' ? '♀' : '♂' }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="队伍" prop="athleteTeam" min-width="140"/>
                  <el-table-column label="状态" width="110" align="center">
                    <template #default="scope">
                      <el-tag :type="memberStatusTag(scope.row.status)" size="small" effect="dark">{{ memberStatusLabel(scope.row.status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100" fixed="right" align="center">
                    <template #default="scope">
                      <el-button link type="primary" size="small" @click="openQuickChangeStatus(scope.row)">改状态</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <el-empty v-else description="暂无参测队员"/>
            </el-tab-pane>
          </el-tabs>
        </div>
        <div v-else class="detail-empty">
          <el-empty description="选择左侧任务查看详情"/>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 任务 新增/编辑 Dialog ========== -->
    <el-dialog :title="dialogTitle" v-model="showTaskDialog" width="520px">
      <el-form ref="taskFormRef" :model="taskForm" :rules="taskRules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item label="任务名称" prop="taskName">
              <el-input v-model="taskForm.taskName" placeholder="如 U18 秋季体能测试"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标队伍" prop="targetDeptId">
              <el-tree-select v-model="taskForm.targetDeptId" :data="deptOptions" :render-after-expand="false"
                :props="{ label: 'label', value: 'id' }" :expand-on-click-node="false" filterable style="width:100%"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主测人" prop="testerId">
              <el-select v-model="taskForm.testerId" placeholder="选择主测人" style="width:100%">
                <el-option v-for="u in userOptions" :key="u.userId" :label="u.nickName" :value="u.userId"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开始日期">
              <el-date-picker v-model="taskForm.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期">
              <el-date-picker v-model="taskForm.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="taskForm.status" style="width:100%">
                <el-option label="未开始" value="pending"/>
                <el-option label="进行中" value="in_progress"/>
                <el-option label="已完成" value="completed"/>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showTaskDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitTask">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 成员状态快速变更 ========== -->
    <el-dialog title="更新参测状态" v-model="showStatusDialog" width="360px">
      <el-form label-width="90px">
        <el-form-item label="运动员">
          <span>{{ currentMember?.athleteName }}</span>
        </el-form-item>
        <el-form-item label="新状态">
          <el-radio-group v-model="memberStatus">
            <el-radio value="pending">未开始</el-radio>
            <el-radio value="partial">部分完成</el-radio>
            <el-radio value="completed">全部完成</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStatusDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitStatus">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsTestTask">
import { listTestTask, getTestTask, addTestTask, updateTestTask, delTestTask,
         updateMemberStatus } from '@/api/apms/testTask'
import { listDept } from '@/api/system/dept'
import { listUser } from '@/api/system/user'

const { proxy } = getCurrentInstance()

// ========= 查询 =========
const loading = ref(false)
const taskList = ref([])
const total = ref(0)
const ids = ref([])
const multiple = ref(true)
const showSearch = ref(true)
const queryParams = reactive({ pageNum: 1, pageSize: 10, taskName: null, status: null })

function getList() {
  loading.value = true
  listTestTask(queryParams).then(res => {
    taskList.value = res.rows
    total.value = res.total
    loading.value = false
  })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm('queryForm'); handleQuery() }
function handleSelectionChange(sel) { ids.value = sel.map(i => i.id); multiple.value = !sel.length }

// ========= 主从 =========
const currentTask = ref(null)
const detail = reactive({ items: [], members: [] })
const detailLoading = ref(false)
const activeTab = ref('items')

function handleRowClick(row) {
  currentTask.value = row
  loadDetail(row.id)
}
function loadDetail(id) {
  detailLoading.value = true
  getTestTask(id).then(res => {
    const d = res.data
    Object.assign(detail, { items: d.items || [], members: d.members || [] })
    currentTask.value = d
    detailLoading.value = false
  })
}

// ========= 辅助下拉 =========
const deptOptions = ref([])
const userOptions = ref([])
function loadAuxData() {
  listDept({ pageNum: 1, pageSize: 500 }).then(res => {
    deptOptions.value = (res.data || []).map(d => ({ id: d.deptId, label: d.deptName }))
  })
  listUser({ pageNum: 1, pageSize: 100 }).then(res => {
    userOptions.value = res.rows || []
  })
}

// ========= Task Dialog =========
const showTaskDialog = ref(false)
const taskFormRef = ref(null)
const dialogTitle = ref('')
const taskForm = reactive({ id: null, taskName: '', targetDeptId: null, testerId: null, startDate: null, endDate: null, status: 'pending' })
const taskRules = {
  taskName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  targetDeptId: [{ required: true, message: '请选择目标队伍', trigger: 'change' }]
}

function handleAdd() {
  dialogTitle.value = '新增测试任务'
  Object.assign(taskForm, { id: null, taskName: '', targetDeptId: null, testerId: null, startDate: null, endDate: null, status: 'pending' })
  loadAuxData(); showTaskDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑测试任务'
  Object.assign(taskForm, row)
  loadAuxData(); showTaskDialog.value = true
}
function submitTask() {
  proxy.$refs.taskFormRef.validate(valid => {
    if (!valid) return
    const req = taskForm.id ? updateTestTask(taskForm) : addTestTask(taskForm)
    req.then(() => {
      proxy.$modal.msgSuccess('保存成功'); showTaskDialog.value = false; getList()
      if (currentTask.value?.id === taskForm.id) loadDetail(currentTask.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除？其下测试项和成员将一并删除。').then(() => delTestTask(selIds))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功'); getList()
      if (currentTask.value && (Array.isArray(selIds) ? selIds.includes(currentTask.value.id) : selIds === currentTask.value.id)) {
        currentTask.value = null; detail.items = []; detail.members = []
      }
    }).catch(() => {})
}

// ========= 成员状态快速变更 =========
const showStatusDialog = ref(false)
const currentMember = ref(null)
const memberStatus = ref('pending')
function openQuickChangeStatus(m) {
  currentMember.value = m; memberStatus.value = m.status; showStatusDialog.value = true
}
function submitStatus() {
  updateMemberStatus({ taskId: currentTask.value.id, athleteId: currentMember.value.athleteId, status: memberStatus.value }).then(() => {
    proxy.$modal.msgSuccess('状态已更新'); showStatusDialog.value = false
    loadDetail(currentTask.value.id); getList()  // 刷新进度
  })
}

// ========= 辅助 =========
function statusLabel(s) { return { pending: '未开始', in_progress: '进行中', completed: '已完成' }[s] || s }
function statusTag(s) { return { pending: 'info', in_progress: 'warning', completed: 'success' }[s] || 'info' }
function memberStatusLabel(s) { return { pending: '未开始', partial: '部分完成', completed: '全部完成' }[s] || s }
function memberStatusTag(s) { return { pending: 'info', partial: 'warning', completed: 'success' }[s] || 'info' }
function dirLabel(d) { return ({ HIGHER_BETTER: '↑越大越好', LOWER_BETTER: '↓越小越好', RANGE_BEST: '≈范围', REFERENCE_ONLY: '—仅参考' })[d] || d }
function formatDate(d) { if (!d) return '—'; return String(d).substring(5, 10) }

getList()
</script>

<style scoped>
.task-page { padding: 12px 16px; }
.panel-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600; color: #1b4332;
  padding: 0 0 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px;
}
.panel-total { font-size: 12px; color: #909399; font-weight: 400; }
.panel-sub { font-size: 12px; color: #606266; font-weight: 400; }
.panel-sub.muted { color: #c0c4cc; }

.task-name { font-weight: 500; color: #303133; }
.date-cell { font-size: 12px; color: #606266; }
.date-sep { color: #c0c4cc; margin: 0 3px; font-size: 11px; }
.progress-text { font-size: 11px; color: #606266; margin-left: 4px; }
.detail-panel { min-height: 400px; }
.detail-empty { min-height: 400px; display: flex; align-items: center; justify-content: center; }

/* 顶部摘要 */
.task-summary {
  display: flex; gap: 10px; margin-bottom: 14px;
  background: linear-gradient(135deg, #f6fbf7, #f0f7f2);
  border: 1px solid #d4e4d9; border-radius: 6px; padding: 12px 16px;
}
.sum-item { flex: 1; text-align: center; }
.sum-num { font-size: 22px; font-weight: 700; color: #1b4332; font-family: Menlo, monospace; }
.sum-label { font-size: 11px; color: #909399; margin-top: 2px; }
.sum-item.completed .sum-num { color: #67c23a; }
.sum-item.partial  .sum-num { color: #e6a23c; }
.sum-item.pending  .sum-num { color: #909399; }

/* 测试项表格 */
.item-code { font-family: monospace; font-weight: 500; color: #1b4332; margin-right: 6px; }
.item-name { color: #606266; }

/* 队员 */
.male { color: #409eff; font-weight: 600; }
.female { color: #f56c6c; font-weight: 600; }

.detail-tabs :deep(.el-tabs__item) { font-size: 14px; }
</style>
