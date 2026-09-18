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

              <!-- 区间冲突/空洞 实时提示 -->
              <div v-if="getLevelValidationIssues(ref.levels).length" class="level-alerts">
                <el-alert v-for="(issue, idx) in getLevelValidationIssues(ref.levels)" :key="idx"
                  :title="issue" type="warning" :closable="false" show-icon :description="'后端保存时也会拦截，建议先修正'" />
              </div>

              <!-- 三级判定表格 -->
              <el-table :data="ref.levels" size="small" border :row-class-name="({ row }) => getLevelRowClass(row, ref.levels)">
                <el-table-column label="评级" width="140" align="center">
                  <template #default="scope">
                    <template v-if="scope.editing">
                      <el-input v-model="scope.row.level" size="small" placeholder="如 GOOD / POOR" style="width:100px" maxlength="32"/>
                    </template>
                    <template v-else>
                      <el-tag :type="levelTag(scope.row.level)" size="default" effect="dark">{{ levelLabel(scope.row.level) }}</el-tag>
                    </template>
                  </template>
                </el-table-column>
                <el-table-column label="下限" width="140" align="center">
                  <template #default="scope">
                    <el-input-number v-if="scope.editing" v-model="scope.row.minValue" :precision="4" :step="0.1" size="small" controls-position="right" style="width:120px" @change="() => getLevelValidationIssues(ref.levels)"/>
                    <span v-else>{{ scope.row.minValue ?? '−∞' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="上限" width="140" align="center">
                  <template #default="scope">
                    <el-input-number v-if="scope.editing" v-model="scope.row.maxValue" :precision="4" :step="0.1" size="small" controls-position="right" style="width:120px" @change="() => getLevelValidationIssues(ref.levels)"/>
                    <span v-else>{{ scope.row.maxValue ?? '+∞' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180" align="center">
                  <template #default="scope">
                    <el-button v-if="!scope.editing" link type="primary" size="small" @click="startLevelEdit(scope.row)">编辑</el-button>
                    <template v-else>
                      <el-button link type="primary" size="small" @click="saveLevel(scope.row)">保存</el-button>
                      <el-button link type="info" size="small" @click="cancelLevelEdit(scope.row)">取消</el-button>
                    </template>
                    <el-button link type="danger" size="small" @click="handleDeleteLevel(scope.row, ref)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <!-- 新增 level 自由入口 -->
              <div class="add-level-bar">
                <el-input v-model="newLevelName" placeholder="输入评级名（如 EXCELLENT / POOR）" size="small" style="width:180px" @keyup.enter="addNewLevel(ref)"/>
                <el-button type="primary" plain size="small" icon="Plus" @click="addNewLevel(ref)" style="margin-left:6px">新增评级</el-button>
                <el-button size="small" @click="bulkAddLevels(ref)" style="margin-left:6px">一键三档模板</el-button>
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
const newLevelName = ref('')
// 编辑时的备份（用于取消）
const levelSnapshots = new Map() // key: level.id -> { level, minValue, maxValue }

// Level 名称 → tag 颜色的动态映射（支持前后端都未知的新档位）
const LEVEL_COLOR_MAP = {
  EXCELLENT: 'success', GOOD: 'success', SUPERIOR: 'success',
  NORMAL: 'warning', MEDIUM: 'warning', MODERATE: 'warning',
  ATTENTION: 'danger', POOR: 'danger', CRITICAL: 'danger', LOW: 'danger', WEAK: 'danger',
  HIGH: 'danger', ELEVATED: 'warning',
  DEFAULT: 'info'
}

function levelTag(l) { return LEVEL_COLOR_MAP[(l || '').toUpperCase()] || LEVEL_COLOR_MAP.DEFAULT }
function levelLabel(l) {
  const map = { EXCELLENT: '优秀 ★★★★', GOOD: '良好 ★★★', NORMAL: '正常 ★★', ATTENTION: '需关注 ★', POOR: '较差', CRITICAL: '危险' }
  return map[(l || '').toUpperCase()] || l || '—'
}

function startLevelEdit(row) {
  levelSnapshots.set(row.id, { level: row.level, minValue: row.minValue, maxValue: row.maxValue })
  row.editing = true
}
function cancelLevelEdit(row) {
  const snap = levelSnapshots.get(row.id)
  if (snap) { Object.assign(row, snap); levelSnapshots.delete(row.id) }
  row.editing = false
}

function saveLevel(row) {
  if (!row.level || !row.level.trim()) return proxy.$modal.msgError('评级名称不能为空')
  updateLevel(row).then(() => {
    row.editing = false
    levelSnapshots.delete(row.id)
    proxy.$modal.msgSuccess('已保存')
  }).catch(err => {
    // 后端校验失败：IndicatorRefInvalidException 会带详细消息
    const msg = err?.response?.data?.msg || err?.message || '保存失败'
    proxy.$modal.msgError(msg)
  })
}

function handleDeleteLevel(row, ref) {
  proxy.$modal.confirm(`确认删除评级 [${row.level}]？`).then(() => {
    return delLevel(row.id)
  }).then(() => {
    proxy.$modal.msgSuccess('已删除')
    loadDetail(currentIndicator.value.id)
  }).catch(() => {})
}

function addNewLevel(ref) {
  const name = (newLevelName.value || '').trim()
  if (!name) return proxy.$modal.msgWarning('请先输入评级名称')
  const exists = ref.levels?.find(x => (x.level || '').toUpperCase() === name.toUpperCase())
  if (exists) return proxy.$modal.msgWarning(`评级 [${exists.level}] 已存在`)
  addLevel({ refId: ref.id, level: name.toUpperCase(), minValue: null, maxValue: null }).then(() => {
    newLevelName.value = ''
    loadDetail(currentIndicator.value.id)
  }).catch(err => {
    proxy.$modal.msgError(err?.response?.data?.msg || '新增失败')
  })
}

function bulkAddLevels(ref) {
  if (ref.levels?.length > 0) {
    const missing = ['GOOD', 'NORMAL', 'ATTENTION'].filter(l => !ref.levels.find(x => (x.level || '').toUpperCase() === l))
    if (missing.length === 0) return proxy.$modal.msgWarning('已有三档评级，无需添加')
    proxy.$modal.confirm(`将为当前参考范围补加 [${missing.join(', ')}] 三档（留空数值，保存时填写区间）。继续？`).then(() => {
      const promises = missing.map(l => addLevel({ refId: ref.id, level: l, minValue: null, maxValue: null }))
      Promise.all(promises).then(() => {
        loadDetail(currentIndicator.value.id)
      }).catch(err => {
        proxy.$modal.msgError(err?.response?.data?.msg || '部分新增失败')
      })
    }).catch(() => {})
  } else {
    proxy.$modal.confirm('当前参考范围无评级，将添加 GOOD / NORMAL / ATTENTION 三档模板（区间值留空，自行填写）。继续？').then(() => {
      Promise.all([
        addLevel({ refId: ref.id, level: 'GOOD', minValue: null, maxValue: null }),
        addLevel({ refId: ref.id, level: 'NORMAL', minValue: null, maxValue: null }),
        addLevel({ refId: ref.id, level: 'ATTENTION', minValue: null, maxValue: null })
      ]).then(() => {
        loadDetail(currentIndicator.value.id)
      }).catch(err => {
        proxy.$modal.msgError(err?.response?.data?.msg || '部分新增失败')
      })
    }).catch(() => {})
  }
}

// ============ 前端实时区间校验 ============
/**
 * 返回该组 levels 的校验问题列表（前端实时预览）
 * - 检测重叠（区间有交集）
 * - 检测空洞（有全局覆盖范围但中间断开）
 * - 检测 min >= max
 */
function getLevelValidationIssues(levels) {
  if (!levels || levels.length < 2) return []
  const issues = []
  const sorted = [...levels].sort((a, b) => {
    const ma = a.minValue ?? -Infinity, mb = b.minValue ?? -Infinity
    return ma - mb
  })
  // 1) min >= max
  for (const lv of sorted) {
    if (lv.minValue != null && lv.maxValue != null && lv.minValue >= lv.maxValue) {
      issues.push(`[${lv.level}] 下限 ${lv.minValue} 必须小于上限 ${lv.maxValue}`)
    }
  }
  // 2) 相邻区间重叠检测
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    // 跳过有空值的（用户还没填完）
    if (a.maxValue == null || b.minValue == null) continue
    if (a.maxValue > b.minValue) {
      issues.push(`[${a.level}](${a.minValue}~${a.maxValue}) 与 [${b.level}](${b.minValue}~${b.maxValue}) 区间重叠`)
    }
  }
  // 3) 空洞检测（首尾都明确的情况下）
  const first = sorted[0], last = sorted[sorted.length - 1]
  if (first.minValue != null && last.maxValue != null) {
    let coverage = first.minValue
    for (const lv of sorted) {
      if (lv.minValue != null && lv.minValue > coverage) {
        issues.push(`[${lv.level}] 起始于 ${lv.minValue}，与前一档之间有空洞（${coverage} ~ ${lv.minValue}）`)
      }
      if (lv.maxValue != null && lv.maxValue > coverage) coverage = lv.maxValue
    }
  }
  return issues
}

function getLevelRowClass(row, allLevels) {
  const issues = getLevelValidationIssues(allLevels)
  const level = (row.level || '').toUpperCase()
  const hasOverlap = issues.some(i => i.includes('[' + level + ']'))
  return hasOverlap ? 'level-row-error' : ''
}

// ============ 辅助 ============
function dirLabel(d) { return ({ HIGHER_BETTER: '↑ 越大越好', LOWER_BETTER: '↓ 越小越好', RANGE_BEST: '≈ 范围最佳', REFERENCE_ONLY: '— 仅参考' })[d] || d }
function categoryTagType(c) { return ({ '形态': '', '机能': 'success', '素质': 'warning', '筛查': 'danger' })[c] || 'info' }

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
.add-level-bar { margin-top: 8px; display: flex; align-items: center; flex-wrap: wrap; }

/* Level 校验样式 */
.level-alerts { margin-bottom: 8px; }
:deep(.level-row-error) { background-color: #fef0f0 !important; }
:deep(.level-row-error td) { border-bottom: 1px solid #fbc4c4; }
</style>
