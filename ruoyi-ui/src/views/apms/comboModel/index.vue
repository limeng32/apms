<template>
  <div class="app-container combo-page">
    <!-- 搜索 -->
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['apms:comboModel:add']">新增组合模型</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['apms:comboModel:remove']">删除</el-button>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：主表列表 -->
      <el-col :span="10">
        <div class="panel-title">
          <span>组合模型库</span>
          <span class="panel-total">共 {{ total }} 个</span>
        </div>
        <el-table
          :data="comboList"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
          highlight-current-row
          v-loading="loading"
          size="default"
          max-height="560"
          stripe
        >
          <el-table-column type="selection" width="40" align="center"/>
          <el-table-column label="ID" prop="id" width="55" align="center"/>
          <el-table-column label="关联测试模型" width="160">
            <template #default="scope">
              <div class="tm-cell">
                <span class="tm-code">{{ scope.row.testModelCode }}</span>
                <span class="tm-name">{{ scope.row.testModelName }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="归一化方法" prop="normalizationMethod" width="120"/>
          <el-table-column label="算法版本" prop="algoVersion" width="130"/>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click="handleEdit(scope.row)" v-hasPermi="['apms:comboModel:edit']">改</el-button>
              <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['apms:comboModel:remove']">删</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </el-col>

      <!-- 右：组成项详情 -->
      <el-col :span="14">
        <div class="panel-title">
          <span>组成项 & 权重</span>
          <span v-if="currentCombo" class="panel-sub">当前：{{ currentCombo.testModelName }}（{{ currentCombo.testModelCode }}）</span>
          <span v-else class="panel-sub muted">← 点击左侧组合模型查看</span>
          <el-button v-if="currentCombo" type="primary" size="small" plain icon="Plus" @click="openComponentDialog" style="margin-left:auto">新增组成项</el-button>
        </div>

        <div v-if="currentCombo" class="detail-panel" v-loading="detailLoading">
          <!-- 公式卡片 -->
          <div v-if="currentCombo.formula" class="formula-card">
            <div class="formula-label">📐 计算公式</div>
            <div class="formula-content">{{ currentCombo.formula }}</div>
            <div class="formula-meta">归一化：{{ currentCombo.normalizationMethod }} | 参考版本：{{ currentCombo.refVersion }} | 算法：{{ currentCombo.algoVersion }}</div>
          </div>

          <!-- 权重合计 -->
          <div class="weight-sum-bar" :class="{ error: Math.abs(weightSum - 1) > 0.001 }">
            <span>权重合计：</span>
            <span class="weight-num">{{ weightSum.toFixed(2) }}</span>
            <span class="weight-label" v-if="Math.abs(weightSum - 1) < 0.001">✓ 平衡</span>
            <span class="weight-label err" v-else>⚠ 权重之和应等于 1.00</span>
          </div>

          <!-- 组成项表格 -->
          <el-table v-if="detail.components?.length" :data="detail.components" size="default" border stripe>
            <el-table-column label="#" type="index" width="45" align="center"/>
            <el-table-column label="指标" min-width="180">
              <template #default="scope">
                <div class="ind-cell">
                  <span class="ind-code">{{ scope.row.indicatorCode }}</span>
                  <span class="ind-name">{{ scope.row.indicatorName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="方向" width="120" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.directionOverride" size="small" type="warning" effect="dark">
                  覆盖 {{ scope.row.directionOverride === '0' ? '↑越大越好' : '↓越小越好' }}
                </el-tag>
                <el-tag v-else size="small" :type="dirTagType(scope.row.indicatorDirection)" effect="plain">
                  继承 {{ dirLabel(scope.row.indicatorDirection) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="权重" width="140" align="center">
              <template #default="scope">
                <template v-if="scope.editing">
                  <el-input-number v-model="scope.row.weight" :precision="2" :step="0.05" :min="0" :max="1" size="small" controls-position="right" style="width:110px"/>
                </template>
                <template v-else>
                  <span class="w-num">{{ scope.row.weight?.toFixed(2) || '—' }}</span>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="排序" width="60" align="center">
              <template #default="scope">
                <span v-if="scope.editing">
                  <el-input-number v-model="scope.row.sortOrder" :min="0" size="small" controls-position="right" style="width:55px"/>
                </span>
                <span v-else>{{ scope.row.sortOrder }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right" align="center">
              <template #default="scope">
                <template v-if="!scope.editing">
                  <el-button link type="primary" size="small" @click="scope.editing = true">编辑</el-button>
                </template>
                <template v-else>
                  <el-button link type="primary" size="small" @click="saveComponent(scope.row)">保存</el-button>
                  <el-button link type="info" size="small" @click="scope.editing = false">取消</el-button>
                </template>
                <el-button link type="danger" size="small" @click="handleDeleteComponent(scope.row)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该组合模型暂无组成项"/>
        </div>
        <div v-else class="detail-empty">
          <el-empty description="选择左侧组合模型查看组成项"/>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 组合模型 新增/编辑 Dialog ========== -->
    <el-dialog :title="dialogTitle" v-model="showComboDialog" width="500px">
      <el-form ref="comboFormRef" :model="comboForm" :rules="comboRules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item label="关联测试模型" prop="modelId">
              <el-select v-model="comboForm.modelId" filterable placeholder="选择 is_combo=1 的测试模型" style="width:100%">
                <el-option v-for="m in comboEligibleModels" :key="m.id"
                  :label="m.code + ' — ' + m.name" :value="m.id"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归一化方法">
              <el-select v-model="comboForm.normalizationMethod" style="width:100%">
                <el-option label="Z-Score" value="z_score"/>
                <el-option label="百分位" value="percentile"/>
                <el-option label="自定义" value="custom"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="算法版本">
              <el-input v-model="comboForm.algoVersion" placeholder="如 composite-fitness-v1"/>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="计算公式">
              <el-input v-model="comboForm.formula" type="textarea" :rows="2" placeholder="人可读公式描述"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="参考组口径">
              <el-input v-model="comboForm.refVersion" placeholder="如 u18-composite-v1"/>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showComboDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitCombo">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 组成项 新增 Dialog ========== -->
    <el-dialog title="新增组成项" v-model="showCompDialogVisible" width="440px">
      <el-form :model="compForm" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item label="选择指标">
              <el-select v-model="compForm.indicatorId" filterable placeholder="选择指标" style="width:100%">
                <el-option v-for="ind in indicatorOptions" :key="ind.id"
                  :label="ind.code + ' — ' + ind.name" :value="ind.id"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权重">
              <el-input-number v-model="compForm.weight" :precision="2" :step="0.05" :min="0" :max="1" style="width:100%" controls-position="right"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number v-model="compForm.sortOrder" :min="0" style="width:100%" controls-position="right"/>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="方向覆盖">
              <el-select v-model="compForm.directionOverride" placeholder="继承指标方向" clearable style="width:100%">
                <el-option label="继承（不覆盖）" :value="null"/>
                <el-option label="覆盖为：越大越好" value="0"/>
                <el-option label="覆盖为：越小越好" value="1"/>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showCompDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="submitComponent">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsComboModel">
import {
  listComboModel, getComboModel, addComboModel, updateComboModel, delComboModel,
  addComponent, updateComponent, delComponent
} from '@/api/apms/comboModel'
import { listIndicator } from '@/api/apms/indicator'
import { listTestModel } from '@/api/apms/testModel'

const { proxy } = getCurrentInstance()

// ========= 查询 =========
const loading = ref(false)
const comboList = ref([])
const total = ref(0)
const ids = ref([])
const multiple = ref(true)
const showSearch = ref(true)
const queryParams = reactive({ pageNum: 1, pageSize: 10 })

function getList() {
  loading.value = true
  listComboModel(queryParams).then(res => {
    comboList.value = res.rows
    total.value = res.total
    loading.value = false
  })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm('queryForm'); handleQuery() }
function handleSelectionChange(sel) { ids.value = sel.map(i => i.id); multiple.value = !sel.length }

// ========= 主从 =========
const currentCombo = ref(null)
const detail = reactive({ components: [] })
const detailLoading = ref(false)

function handleRowClick(row) {
  currentCombo.value = row
  loadDetail(row.id)
}
function loadDetail(id) {
  detailLoading.value = true
  getComboModel(id).then(res => {
    const d = res.data
    detail.components = d.components || []
    currentCombo.value = d
    detailLoading.value = false
  })
}

const weightSum = computed(() => detail.components.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0))

// ========= 辅助下拉数据 =========
const comboEligibleModels = ref([])  // is_combo=1 的 test_model
const indicatorOptions = ref([])

function loadAuxData() {
  // 加载 is_combo=1 的测试模型供 combo 选择
  listTestModel({ pageNum: 1, pageSize: 100 }).then(res => {
    comboEligibleModels.value = (res.rows || []).filter(m => m.isCombo === '1')
  })
  // 加载指标供 component 选择
  listIndicator({ pageNum: 1, pageSize: 100 }).then(res => {
    indicatorOptions.value = res.rows || []
  })
}

// ========= Combo Dialog =========
const showComboDialog = ref(false)
const comboFormRef = ref(null)
const dialogTitle = ref('')
const comboForm = reactive({ id: null, modelId: null, normalizationMethod: 'z_score', formula: '', refVersion: '', algoVersion: '' })
const comboRules = {
  modelId: [{ required: true, message: '请选择关联的测试模型', trigger: 'change' }]
}

function handleAdd() {
  dialogTitle.value = '新增组合模型'
  Object.assign(comboForm, { id: null, modelId: null, normalizationMethod: 'z_score', formula: '', refVersion: '', algoVersion: '' })
  loadAuxData()
  showComboDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑组合模型'
  Object.assign(comboForm, row)
  loadAuxData()
  showComboDialog.value = true
}
function submitCombo() {
  proxy.$refs.comboFormRef.validate(valid => {
    if (!valid) return
    const req = comboForm.id ? updateComboModel(comboForm) : addComboModel(comboForm)
    req.then(() => {
      proxy.$modal.msgSuccess('保存成功')
      showComboDialog.value = false
      getList()
      if (currentCombo.value?.id === comboForm.id) loadDetail(currentCombo.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除？其下组成项将一并删除。').then(() => delComboModel(selIds))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功')
      getList()
      if (currentCombo.value && (Array.isArray(selIds) ? selIds.includes(currentCombo.value.id) : selIds === currentCombo.value.id)) {
        currentCombo.value = null; detail.components = []
      }
    }).catch(() => {})
}

// ========= Component =========
const showCompDialogVisible = ref(false)
const compForm = reactive({ comboModelId: null, indicatorId: null, weight: 0.25, directionOverride: null, sortOrder: 1 })

function openComponentDialog() {
  if (!currentCombo.value) return proxy.$modal.msgWarning('请先选择一个组合模型')
  loadAuxData()
  const nextOrder = detail.components.length > 0 ? Math.max(...detail.components.map(c => c.sortOrder || 0)) + 1 : 1
  Object.assign(compForm, { comboModelId: currentCombo.value.id, indicatorId: null, weight: 0.25, directionOverride: null, sortOrder: nextOrder })
  showCompDialogVisible.value = true
}
function submitComponent() {
  if (!compForm.indicatorId) return proxy.$modal.msgWarning('请选择指标')
  addComponent(compForm).then(() => {
    proxy.$modal.msgSuccess('添加成功')
    showCompDialogVisible.value = false
    loadDetail(currentCombo.value.id)
  })
}
function saveComponent(row) {
  updateComponent({ id: row.id, comboModelId: currentCombo.value.id, indicatorId: row.indicatorId, weight: row.weight, directionOverride: row.directionOverride, sortOrder: row.sortOrder })
    .then(() => { row.editing = false; proxy.$modal.msgSuccess('已保存') })
}
function handleDeleteComponent(row) {
  proxy.$modal.confirm(`确认移除 ${row.indicatorCode}？`).then(() => delComponent(row.id))
    .then(() => { proxy.$modal.msgSuccess('已移除'); loadDetail(currentCombo.value.id) }).catch(() => {})
}

// ========= 辅助 =========
function dirLabel(d) { return ({ HIGHER_BETTER: '↑越大越好', LOWER_BETTER: '↓越小越好', RANGE_BEST: '≈范围最佳', REFERENCE_ONLY: '—仅参考' })[d] || d }
function dirTagType(d) { return ({ HIGHER_BETTER: 'success', LOWER_BETTER: 'danger', RANGE_BEST: 'warning', REFERENCE_ONLY: 'info' })[d] || 'info' }

getList()
</script>

<style scoped>
.combo-page { padding: 12px 16px; }
.panel-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600; color: #1b4332;
  padding: 0 0 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px;
}
.panel-total { font-size: 12px; color: #909399; font-weight: 400; }
.panel-sub { font-size: 12px; color: #606266; font-weight: 400; }
.panel-sub.muted { color: #c0c4cc; }

.detail-panel { min-height: 400px; }
.detail-empty { min-height: 400px; display: flex; align-items: center; justify-content: center; }

.tm-cell { display: flex; flex-direction: column; line-height: 1.4; }
.tm-code { font-size: 13px; font-weight: 500; color: #303133; }
.tm-name { font-size: 11px; color: #909399; }

.ind-cell { display: flex; flex-direction: column; line-height: 1.4; }
.ind-code { font-size: 13px; font-weight: 500; color: #303133; font-family: monospace; }
.ind-name { font-size: 11px; color: #909399; }
.w-num { font-weight: 500; }

.formula-card {
  background: linear-gradient(135deg, #f6fbf7, #f0f7f2);
  border: 1px solid #d4e4d9; border-radius: 6px;
  padding: 12px 16px; margin-bottom: 10px;
}
.formula-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.formula-content { font-size: 13px; color: #1b4332; line-height: 1.6; font-family: Menlo, Consolas, monospace; }
.formula-meta { font-size: 11px; color: #909399; margin-top: 6px; }

.weight-sum-bar {
  display: flex; align-items: center; gap: 6px;
  background: #f6f8f7; border: 1px solid #e4ebe7; border-radius: 6px;
  padding: 8px 14px; margin-bottom: 12px;
  font-size: 13px;
}
.weight-sum-bar.error { background: #fff5f5; border-color: #fde2e2; }
.weight-num { font-size: 18px; font-weight: 700; color: #1b4332; font-family: Menlo, monospace; }
.weight-label { color: #67c23a; font-weight: 500; margin-left: auto; }
.weight-label.err { color: #f56c6c; }
</style>
