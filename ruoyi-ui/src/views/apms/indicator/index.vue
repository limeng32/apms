<template>
  <div class="app-container indicator-page">
    <!-- 顶部搜索栏 -->
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="指标编码" prop="code">
        <el-input v-model="queryParams.code" placeholder="请输入编码" clearable style="width: 180px" @keyup.enter="handleQuery"/>
      </el-form-item>
      <el-form-item label="指标名称" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入名称" clearable style="width: 180px" @keyup.enter="handleQuery"/>
      </el-form-item>
      <el-form-item label="分类" prop="category">
        <el-select v-model="queryParams.category" placeholder="全部" clearable style="width: 120px">
          <el-option label="形态" value="形态"/>
          <el-option label="机能" value="机能"/>
          <el-option label="素质" value="素质"/>
          <el-option label="筛查" value="筛查"/>
        </el-select>
      </el-form-item>
      <el-form-item label="方向" prop="evaluationDirection">
        <el-select v-model="queryParams.evaluationDirection" placeholder="全部" clearable style="width: 140px">
          <el-option label="越大越好" value="HIGHER_BETTER"/>
          <el-option label="越小越好" value="LOWER_BETTER"/>
          <el-option label="范围最佳" value="RANGE_BEST"/>
          <el-option label="仅参考" value="REFERENCE_ONLY"/>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作按钮 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['apms:indicator:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['apms:indicator:remove']">删除</el-button>
      </el-col>
    </el-row>

    <!-- 主列表：指标库（左半） -->
    <el-row :gutter="16">
      <el-col :span="10">
        <div class="panel-title">
          <span>指标库</span>
          <span class="panel-total">共 {{ total }} 项</span>
        </div>
        <el-table
          :data="indicatorList"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
          highlight-current-row
          v-loading="loading"
          size="default"
          max-height="560"
          stripe
        >
          <el-table-column type="selection" width="40" align="center"/>
          <el-table-column label="编码" prop="code" width="140"/>
          <el-table-column label="名称" prop="name" width="110"/>
          <el-table-column label="分类" prop="category" width="70">
            <template #default="scope">
              <el-tag size="small" :type="categoryTagType(scope.row.category)">{{ scope.row.category }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="单位" prop="unit" width="60" align="center"/>
          <el-table-column label="方向" width="88">
            <template #default="scope">
              <span class="dir-badge" :class="'dir-' + scope.row.evaluationDirection">{{ dirLabel(scope.row.evaluationDirection) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70" align="center">
            <template #default="scope">
              <el-switch v-model="scope.row.status" active-value="0" inactive-value="1" @change="handleStatusChange(scope.row)" size="small"/>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click="handleEdit(scope.row)" v-hasPermi="['apms:indicator:edit']">改</el-button>
              <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['apms:indicator:remove']">删</el-button>
            </template>
          </el-table-column>
        </el-table>
        <!-- 分页 -->
        <pagination
          v-show="total > 0"
          :total="total"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          @pagination="getList"
        />
      </el-col>

      <!-- 右侧：详情面板（ref + levels） -->
      <el-col :span="14">
        <div class="panel-title">
          <span>参考范围 & 三级判定</span>
          <span v-if="currentIndicator" class="panel-sub">当前：{{ currentIndicator.name }}（{{ currentIndicator.code }}）</span>
          <span v-else class="panel-sub muted">← 点击左侧指标查看</span>
          <el-button v-if="currentIndicator" type="primary" size="small" plain icon="Plus" @click="openRefDialog" style="margin-left:auto">新增参考范围</el-button>
        </div>

        <div v-if="currentIndicator" class="detail-panel" v-loading="detailLoading">
          <!-- 没有 ref 时的空状态 -->
          <el-empty v-if="!detailLoading && detail.refs?.length === 0" description="该指标暂无参考范围数据，点击上方按钮新增"/>

          <!-- 有 ref 时，一个 ref 一个卡片 -->
          <template v-for="ref in detail.refs" :key="ref.id">
            <el-card shadow="hover" class="ref-card" :class="'ref-' + ref.gender">
              <template #header>
                <div class="ref-header">
                  <div class="ref-title">
                    <el-tag size="small" :type="ref.gender === 'M' ? 'primary' : 'danger'" effect="dark">{{ ref.gender === 'M' ? '男' : ref.gender === 'F' ? '女' : '通用' }}</el-tag>
                    <el-tag v-if="ref.ageGroup" size="small" type="info">{{ ref.ageGroup }}</el-tag>
                    <span class="ref-range">参考范围：{{ ref.refMin ?? '—' }} ~ {{ ref.refMax ?? '—' }}</span>
                    <span v-if="ref.modelVersion" class="ref-version">v{{ ref.modelVersion }}</span>
                  </div>
                  <div class="ref-actions">
                    <el-button link type="primary" size="small" @click="openRefDialog(ref)">编辑</el-button>
                    <el-button link type="danger" size="small" @click="handleDeleteRef(ref)">删除</el-button>
                  </div>
                </div>
              </template>

              <!-- 三级判定表格 -->
              <el-table :data="ref.levels" size="small" border>
                <el-table-column label="评级" width="100" align="center">
                  <template #default="scope">
                    <el-tag :type="levelTag(scope.row.level)" size="default" effect="dark">{{ levelLabel(scope.row.level) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="下限" width="130" align="center">
                  <template #default="scope">
                    <el-input-number v-if="scope.editing" v-model="scope.row.minValue" :precision="4" :step="0.1" size="small" controls-position="right" style="width:110px"/>
                    <span v-else>{{ scope.row.minValue ?? '−∞' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="上限" width="130" align="center">
                  <template #default="scope">
                    <el-input-number v-if="scope.editing" v-model="scope.row.maxValue" :precision="4" :step="0.1" size="small" controls-position="right" style="width:110px"/>
                    <span v-else>{{ scope.row.maxValue ?? '+∞' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="160" align="center">
                  <template #default="scope">
                    <el-button v-if="!scope.editing" link type="primary" size="small" @click="scope.row.editing = true">编辑</el-button>
                    <template v-else>
                      <el-button link type="primary" size="small" @click="saveLevel(scope.row)">保存</el-button>
                      <el-button link type="info" size="small" @click="scope.row.editing = false">取消</el-button>
                    </template>
                  </template>
                </el-table-column>
              </el-table>
              <!-- 新增 level 快捷入口 -->
              <div class="add-level-bar">
                <el-button link type="primary" size="small" icon="Plus" @click="addNewLevel(ref)">新增 {{ addNewLevelLabel(ref.levels) }} 档</el-button>
              </div>
            </el-card>
          </template>
        </div>
        <div v-else class="detail-empty">
          <el-empty description="选择左侧指标查看参考范围"/>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 指标 新增/编辑 Dialog ========== -->
    <el-dialog :title="dialogTitle" v-model="showIndicatorDialog" width="520px">
      <el-form ref="indicatorFormRef" :model="indicatorForm" :rules="indicatorRules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="指标编码" prop="code">
              <el-input v-model="indicatorForm.code" placeholder="如 SPRINT_30M" :disabled="indicatorForm.id != null"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="指标名称" prop="name">
              <el-input v-model="indicatorForm.name" placeholder="如 30米冲刺"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="category">
              <el-select v-model="indicatorForm.category" style="width:100%">
                <el-option label="形态" value="形态"/>
                <el-option label="机能" value="机能"/>
                <el-option label="素质" value="素质"/>
                <el-option label="筛查" value="筛查"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位" prop="unit">
              <el-input v-model="indicatorForm.unit" placeholder="cm / kg / s / %"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据类型" prop="dataType">
              <el-select v-model="indicatorForm.dataType" style="width:100%">
                <el-option label="decimal (小数)" value="decimal"/>
                <el-option label="number (整数)" value="number"/>
                <el-option label="text (文本)" value="text"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采集方式" prop="collectionMethod">
              <el-select v-model="indicatorForm.collectionMethod" style="width:100%">
                <el-option label="手动录入" value="manual"/>
                <el-option label="CSV 导入" value="csv"/>
                <el-option label="设备采集" value="device"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="评价方向" prop="evaluationDirection">
              <el-radio-group v-model="indicatorForm.evaluationDirection">
                <el-radio value="HIGHER_BETTER">越大越好（力量/纵跳）</el-radio>
                <el-radio value="LOWER_BETTER">越小越好（冲刺/RSA）</el-radio>
                <el-radio value="RANGE_BEST">范围最佳（BMI）</el-radio>
                <el-radio value="REFERENCE_ONLY">仅参考（身高/体重）</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showIndicatorDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitIndicator">确 定</el-button>
      </template>
    </el-dialog>

    <!-- ========== 参考范围 Dialog ========== -->
    <el-dialog :title="showRefDialog?.id ? '编辑参考范围' : '新增参考范围'" v-model="showRefDialogVisible" width="480px">
      <el-form :model="refForm" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="适用性别">
              <el-select v-model="refForm.gender" placeholder="通用" style="width:100%">
                <el-option label="男" value="M"/>
                <el-option label="女" value="F"/>
                <el-option label="通用" value=""/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年龄组">
              <el-input v-model="refForm.ageGroup" placeholder="如 U16 / U18"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="参考下限">
              <el-input-number v-model="refForm.refMin" :precision="4" :step="0.1" style="width:100%" controls-position="right"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="参考上限">
              <el-input-number v-model="refForm.refMax" :precision="4" :step="0.1" style="width:100%" controls-position="right"/>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="口径版本">
              <el-input v-model="refForm.modelVersion" placeholder="如 norm-u18-m-v1"/>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showRefDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="submitRef">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsIndicator">
import {
  listIndicator, getIndicator, addIndicator, updateIndicator, delIndicator,
  addRef, updateRef, delRef,
  addLevel, updateLevel, delLevel
} from '@/api/apms/indicator'

const { proxy } = getCurrentInstance()

// ============ 查询参数 ============
const loading = ref(false)
const indicatorList = ref([])
const total = ref(0)
const ids = ref([])
const multiple = ref(true)
const showSearch = ref(true)

const queryParams = reactive({ pageNum: 1, pageSize: 10, code: null, name: null, category: null, evaluationDirection: null })

function getList() {
  loading.value = true
  listIndicator(queryParams).then(res => {
    indicatorList.value = res.rows
    total.value = res.total
    loading.value = false
  })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm('queryForm'); handleQuery() }
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id)
  multiple.value = !selection.length
}

// ============ 状态切换 ============
function handleStatusChange(row) {
  updateIndicator({ id: row.id, status: row.status }).then(() => proxy.$modal.msgSuccess('状态已更新'))
}

// ============ 主面板交互 ============
const currentIndicator = ref(null)
const detail = reactive({ refs: [] })
const detailLoading = ref(false)

function handleRowClick(row) {
  currentIndicator.value = row
  loadDetail(row.id)
}

function loadDetail(id) {
  detailLoading.value = true
  getIndicator(id).then(res => {
    const d = res.data
    detail.refs = d.refs || []
    detailLoading.value = false
  })
}

// ============ CRUD Dialog ============
const showIndicatorDialog = ref(false)
const indicatorFormRef = ref(null)
const dialogTitle = ref('')

const indicatorForm = reactive({ id: null, code: '', category: '素质', name: '', unit: '', dataType: 'decimal', evaluationDirection: 'HIGHER_BETTER', collectionMethod: 'manual', status: '0' })
const indicatorRules = {
  code: [{ required: true, message: '请输入指标编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入指标名称', trigger: 'blur' }],
  evaluationDirection: [{ required: true, message: '请选择评价方向', trigger: 'change' }]
}

function handleAdd() {
  dialogTitle.value = '新增指标'
  Object.assign(indicatorForm, { id: null, code: '', category: '素质', name: '', unit: '', dataType: 'decimal', evaluationDirection: 'HIGHER_BETTER', collectionMethod: 'manual', status: '0' })
  showIndicatorDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑指标'
  Object.assign(indicatorForm, row)
  showIndicatorDialog.value = true
}
function submitIndicator() {
  proxy.$refs.indicatorFormRef.validate(valid => {
    if (!valid) return
    const req = indicatorForm.id ? updateIndicator(indicatorForm) : addIndicator(indicatorForm)
    req.then(() => {
      proxy.$modal.msgSuccess('保存成功')
      showIndicatorDialog.value = false
      getList()
      if (currentIndicator.value?.id === indicatorForm.id) loadDetail(currentIndicator.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除选中指标？其下参考范围和三级判定将一并删除。').then(() => {
    return delIndicator(selIds)
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    getList()
    if (currentIndicator.value && (Array.isArray(selIds) ? selIds.includes(currentIndicator.value.id) : selIds === currentIndicator.value.id)) {
      currentIndicator.value = null
      detail.refs = []
    }
  }).catch(() => {})
}

// ============ Ref Dialog ============
const showRefDialogVisible = ref(false)
const showRefDialog = ref(null) // 编辑时为 ref 对象，新增时为 null
const refForm = reactive({ id: null, indicatorId: null, gender: '', ageGroup: '', refMin: null, refMax: null, modelVersion: '' })

function openRefDialog(ref) {
  if (!currentIndicator.value) return proxy.$modal.msgWarning('请先选择一个指标')
  showRefDialog.value = ref || null
  Object.assign(refForm, {
    id: ref?.id || null,
    indicatorId: currentIndicator.value.id,
    gender: ref?.gender || '',
    ageGroup: ref?.ageGroup || '',
    refMin: ref?.refMin ?? null,
    refMax: ref?.refMax ?? null,
    modelVersion: ref?.modelVersion || ''
  })
  showRefDialogVisible.value = true
}
function submitRef() {
  const req = refForm.id ? updateRef(refForm) : addRef(refForm)
  req.then(() => {
    proxy.$modal.msgSuccess('保存成功')
    showRefDialogVisible.value = false
    loadDetail(currentIndicator.value.id)
  })
}
function handleDeleteRef(ref) {
  proxy.$modal.confirm(`确认删除参考范围 [${ref.gender || '通用'} ${ref.ageGroup || ''}]？其下三级判定将一并删除。`).then(() => {
    return delRef(ref.id)
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    loadDetail(currentIndicator.value.id)
  }).catch(() => {})
}

// ============ Level 内联编辑 ============
function saveLevel(row) {
  updateLevel(row).then(() => {
    row.editing = false
    proxy.$modal.msgSuccess('已保存')
  })
}
function addNewLevel(ref) {
  const newLevels = ['GOOD', 'NORMAL', 'ATTENTION'].filter(l => !ref.levels.find(x => x.level === l))
  if (newLevels.length === 0) return proxy.$modal.msgWarning('三种评级已全部配置')
  const level = newLevels[0]
  addLevel({ refId: ref.id, level, minValue: null, maxValue: null }).then(() => {
    proxy.$modal.msgSuccess(`已添加 ${level} 档，请填写数值范围`)
    loadDetail(currentIndicator.value.id)
  })
}
function addNewLevelLabel(levels) {
  const missing = ['GOOD', 'NORMAL', 'ATTENTION'].filter(l => !levels?.find(x => x.level === l))
  return missing[0] || '评级'
}

// ============ 辅助 ============
function dirLabel(d) { return ({ HIGHER_BETTER: '↑ 越大越好', LOWER_BETTER: '↓ 越小越好', RANGE_BEST: '≈ 范围最佳', REFERENCE_ONLY: '— 仅参考' })[d] || d }
function categoryTagType(c) { return ({ '形态': '', '机能': 'success', '素质': 'warning', '筛查': 'danger' })[c] || 'info' }
function levelTag(l) { return ({ GOOD: 'success', NORMAL: 'warning', ATTENTION: 'danger' })[l] || 'info' }
function levelLabel(l) { return ({ GOOD: '良好', NORMAL: '正常', ATTENTION: '需关注' })[l] || l }

// ============ 初始化 ============
getList()
</script>

<style scoped>
.indicator-page { padding: 12px 16px; }
.panel-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600; color: #1b4332;
  padding: 0 0 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px;
}
.panel-total { font-size: 12px; color: #909399; font-weight: 400; }
.panel-sub { font-size: 12px; color: #606266; font-weight: 400; }
.panel-sub.muted { color: #c0c4cc; }

.dir-badge {
  display: inline-block; padding: 1px 6px; border-radius: 4px;
  font-size: 11px; font-weight: 500;
}
.dir-HIGHER_BETTER { background: #f0f9eb; color: #67c23a; }
.dir-LOWER_BETTER { background: #fef0f0; color: #f56c6c; }
.dir-RANGE_BEST   { background: #fdf6ec; color: #e6a23c; }
.dir-REFERENCE_ONLY { background: #f4f4f5; color: #909399; }

.detail-panel { min-height: 400px; }
.detail-empty { min-height: 400px; display: flex; align-items: center; justify-content: center; }

.ref-card { margin-bottom: 12px; border-left: 3px solid #dcdfe6; }
.ref-card.ref-M { border-left-color: #409eff; }
.ref-card.ref-F { border-left-color: #f56c6c; }
.ref-header { display: flex; justify-content: space-between; align-items: center; }
.ref-title { display: flex; align-items: center; gap: 8px; }
.ref-range { font-size: 13px; color: #606266; }
.ref-version { font-size: 11px; color: #909399; background: #f4f4f5; padding: 1px 6px; border-radius: 3px; }
.ref-actions { display: flex; gap: 6px; }
.add-level-bar { margin-top: 8px; text-align: right; }
</style>
