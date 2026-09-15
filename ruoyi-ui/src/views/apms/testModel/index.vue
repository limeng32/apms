<template>
  <div class="app-container model-page">
    <!-- 搜索 -->
    <el-form :model="queryParams" ref="queryForm" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="编码" prop="code">
        <el-input v-model="queryParams.code" placeholder="如 YOYO_IR1" clearable style="width: 160px" @keyup.enter="handleQuery"/>
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="queryParams.name" clearable style="width: 180px" @keyup.enter="handleQuery"/>
      </el-form-item>
      <el-form-item label="分类" prop="category">
        <el-select v-model="queryParams.category" placeholder="全部" clearable style="width: 120px">
          <el-option label="耐力" value="耐力"/>
          <el-option label="速度耐力" value="速度耐力"/>
          <el-option label="敏捷" value="敏捷"/>
          <el-option label="带球敏捷" value="带球敏捷"/>
          <el-option label="组合" value="组合"/>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['apms:testModel:add']">新增模型</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['apms:testModel:remove']">删除</el-button>
      </el-col>
    </el-row>

    <!-- 主从布局 -->
    <el-row :gutter="16">
      <el-col :span="10">
        <div class="panel-title">
          <span>测试模型库</span>
          <span class="panel-total">共 {{ total }} 个模型</span>
        </div>
        <el-table
          :data="modelList"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
          highlight-current-row
          v-loading="loading"
          size="default"
          max-height="560"
          stripe
        >
          <el-table-column type="selection" width="40" align="center"/>
          <el-table-column label="编码" prop="code" width="130"/>
          <el-table-column label="名称" prop="name" min-width="150"/>
          <el-table-column label="分类" prop="category" width="80">
            <template #default="scope">
              <el-tag size="small" :type="catTagType(scope.row.category)">{{ scope.row.category }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="组合" width="60" align="center">
            <template #default="scope">
              <el-tag v-if="scope.row.isCombo === '1'" size="small" type="warning" effect="dark">组合</el-tag>
              <span v-else style="color:#c0c4cc">—</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70" align="center">
            <template #default="scope">
              <el-switch v-model="scope.row.status" active-value="0" inactive-value="1" @change="handleStatusChange(scope.row)" size="small"/>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click="handleEdit(scope.row)" v-hasPermi="['apms:testModel:edit']">改</el-button>
              <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['apms:testModel:remove']">删</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </el-col>

      <!-- 右侧：字段定义 + 规程 -->
      <el-col :span="14">
        <div class="panel-title">
          <span>字段定义 & 规程</span>
          <span v-if="currentModel" class="panel-sub">当前：{{ currentModel.name }}（{{ currentModel.code }}）</span>
          <span v-else class="panel-sub muted">← 点击左侧模型查看</span>
          <el-button v-if="currentModel" type="primary" size="small" plain icon="Plus" @click="openFieldDialog" style="margin-left:auto">新增字段</el-button>
        </div>

        <div v-if="currentModel" class="detail-panel" v-loading="detailLoading">
          <!-- 规程 -->
          <div v-if="currentModel.protocol" class="protocol-card">
            <div class="protocol-label">📋 测试规程</div>
            <div class="protocol-content">{{ currentModel.protocol }}</div>
            <div class="protocol-meta">算法版本：{{ currentModel.algoVersion || '未指定' }}</div>
          </div>

          <!-- 字段表格 -->
          <el-table v-if="detail.fields?.length" :data="detail.fields" size="default" border stripe>
            <el-table-column label="#" type="index" width="45" align="center"/>
            <el-table-column label="字段 Key" prop="fieldKey" width="170"/>
            <el-table-column label="显示名" prop="fieldName" width="130"/>
            <el-table-column label="单位" prop="unit" width="80" align="center"/>
            <el-table-column label="类型" width="100" align="center">
              <template #default="scope">
                <el-tag size="small" :type="dataTypeTag(scope.row.dataType)">{{ scope.row.dataType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="必填" width="60" align="center">
              <template #default="scope">
                <span :style="{ color: scope.row.isRequired === '1' ? '#f56c6c' : '#909399' }">
                  {{ scope.row.isRequired === '1' ? '●' : '○' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="排序" prop="sortOrder" width="60" align="center"/>
            <el-table-column label="操作" width="130" fixed="right" align="center">
              <template #default="scope">
                <el-button link type="primary" size="small" @click="openFieldDialog(scope.row)">改</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteField(scope.row)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该模型暂无字段定义，点击上方按钮新增"/>
        </div>
        <div v-else class="detail-empty">
          <el-empty description="选择左侧模型查看字段定义"/>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 模型 新增/编辑 Dialog ========== -->
    <el-dialog :title="dialogTitle" v-model="showModelDialog" width="560px">
      <el-form ref="modelFormRef" :model="modelForm" :rules="modelRules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="模型编码" prop="code">
              <el-input v-model="modelForm.code" placeholder="如 RSA_10X20" :disabled="modelForm.id != null"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模型名称" prop="name">
              <el-input v-model="modelForm.name" placeholder="如 RSA 10×20m"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="category">
              <el-select v-model="modelForm.category" style="width:100%">
                <el-option label="耐力" value="耐力"/>
                <el-option label="速度耐力" value="速度耐力"/>
                <el-option label="敏捷" value="敏捷"/>
                <el-option label="带球敏捷" value="带球敏捷"/>
                <el-option label="组合" value="组合"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="组合模型">
              <el-radio-group v-model="modelForm.isCombo">
                <el-radio value="0">否</el-radio>
                <el-radio value="1">是</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="算法版本">
              <el-input v-model="modelForm.algoVersion" placeholder="如 rsa-sdec-v1"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="modelForm.status">
                <el-radio value="0">启用</el-radio>
                <el-radio value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="测试规程">
              <el-input v-model="modelForm.protocol" type="textarea" :rows="3" placeholder="描述测试操作流程、计时方式、计算规则等"/>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showModelDialog = false">取 消</el-button>
        <el-button type="primary" @click="submitModel">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 字段 新增/编辑 Dialog ========== -->
    <el-dialog :title="showFieldDialog?.id ? '编辑字段定义' : '新增字段定义'" v-model="showFieldDialogVisible" width="460px">
      <el-form :model="fieldForm" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="字段 Key">
              <el-input v-model="fieldForm.fieldKey" placeholder="如 sprint_1"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="显示名">
              <el-input v-model="fieldForm.fieldName" placeholder="如 第1次冲刺"/>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单位">
              <el-input v-model="fieldForm.unit" placeholder="s"/>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="类型">
              <el-select v-model="fieldForm.dataType" style="width:100%">
                <el-option label="decimal" value="decimal"/>
                <el-option label="number" value="number"/>
                <el-option label="text" value="text"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序">
              <el-input-number v-model="fieldForm.sortOrder" :min="0" :step="1" style="width:100%" controls-position="right"/>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="必填">
              <el-radio-group v-model="fieldForm.isRequired">
                <el-radio value="1">必填</el-radio>
                <el-radio value="0">选填</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showFieldDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="submitField">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsTestModel">
import {
  listTestModel, getTestModel, addTestModel, updateTestModel, delTestModel,
  addField, updateField, delField
} from '@/api/apms/testModel'

const { proxy } = getCurrentInstance()

// ========= 查询 =========
const loading = ref(false)
const modelList = ref([])
const total = ref(0)
const ids = ref([])
const multiple = ref(true)
const showSearch = ref(true)
const queryParams = reactive({ pageNum: 1, pageSize: 10, code: null, name: null, category: null })

function getList() {
  loading.value = true
  listTestModel(queryParams).then(res => {
    modelList.value = res.rows
    total.value = res.total
    loading.value = false
  })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm('queryForm'); handleQuery() }
function handleSelectionChange(sel) { ids.value = sel.map(i => i.id); multiple.value = !sel.length }

function handleStatusChange(row) {
  updateTestModel({ id: row.id, status: row.status }).then(() => proxy.$modal.msgSuccess('状态已更新'))
}

// ========= 主从 =========
const currentModel = ref(null)
const detail = reactive({ fields: [] })
const detailLoading = ref(false)

function handleRowClick(row) {
  currentModel.value = row
  loadDetail(row.id)
}

function loadDetail(id) {
  detailLoading.value = true
  getTestModel(id).then(res => {
    const d = res.data
    detail.fields = d.fields || []
    currentModel.value = d  // 更新（后端可能补全了字段）
    detailLoading.value = false
  })
}

// ========= 模型 Dialog =========
const showModelDialog = ref(false)
const modelFormRef = ref(null)
const dialogTitle = ref('')

const modelForm = reactive({ id: null, category: '速度耐力', name: '', code: '', protocol: '', isCombo: '0', algoVersion: '', status: '0' })
const modelRules = {
  code: [{ required: true, message: '请输入模型编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

function handleAdd() {
  dialogTitle.value = '新增测试模型'
  Object.assign(modelForm, { id: null, category: '速度耐力', name: '', code: '', protocol: '', isCombo: '0', algoVersion: '', status: '0' })
  showModelDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑测试模型'
  Object.assign(modelForm, row)
  showModelDialog.value = true
}
function submitModel() {
  proxy.$refs.modelFormRef.validate(valid => {
    if (!valid) return
    const req = modelForm.id ? updateTestModel(modelForm) : addTestModel(modelForm)
    req.then(() => {
      proxy.$modal.msgSuccess('保存成功')
      showModelDialog.value = false
      getList()
      if (currentModel.value?.id === modelForm.id) loadDetail(currentModel.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除？其下字段定义将一并删除。').then(() => delTestModel(selIds))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功')
      getList()
      if (currentModel.value && (Array.isArray(selIds) ? selIds.includes(currentModel.value.id) : selIds === currentModel.value.id)) {
        currentModel.value = null; detail.fields = []
      }
    }).catch(() => {})
}

// ========= 字段 Dialog =========
const showFieldDialogVisible = ref(false)
const showFieldDialog = ref(null)

const fieldForm = reactive({ id: null, modelId: null, fieldKey: '', fieldName: '', unit: '', dataType: 'decimal', isRequired: '1', sortOrder: 0 })

function openFieldDialog(field) {
  if (!currentModel.value) return proxy.$modal.msgWarning('请先选择一个模型')
  showFieldDialog.value = field || null
  const nextOrder = field ? field.sortOrder : (detail.fields.length > 0 ? Math.max(...detail.fields.map(f => f.sortOrder || 0)) + 1 : 1)
  Object.assign(fieldForm, {
    id: field?.id || null,
    modelId: currentModel.value.id,
    fieldKey: field?.fieldKey || '',
    fieldName: field?.fieldName || '',
    unit: field?.unit || '',
    dataType: field?.dataType || 'decimal',
    isRequired: field?.isRequired ?? '1',
    sortOrder: field?.sortOrder ?? nextOrder
  })
  showFieldDialogVisible.value = true
}
function submitField() {
  const req = fieldForm.id ? updateField(fieldForm) : addField(fieldForm)
  req.then(() => {
    proxy.$modal.msgSuccess('保存成功')
    showFieldDialogVisible.value = false
    loadDetail(currentModel.value.id)
  })
}
function handleDeleteField(field) {
  proxy.$modal.confirm(`确认删除字段 "${field.fieldKey}"？`).then(() => delField(field.id))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功')
      loadDetail(currentModel.value.id)
    }).catch(() => {})
}

// ========= 辅助 =========
function catTagType(c) { return { '耐力': '', '速度耐力': 'warning', '敏捷': 'success', '带球敏捷': 'danger', '组合': 'info' }[c] || 'info' }
function dataTypeTag(t) { return ({ decimal: 'warning', number: 'success', text: 'info' })[t] || 'info' }

// init
getList()
</script>

<style scoped>
.model-page { padding: 12px 16px; }
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

.protocol-card {
  background: #f6f8f7; border: 1px solid #e4ebe7; border-radius: 6px;
  padding: 10px 14px; margin-bottom: 14px;
}
.protocol-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.protocol-content { font-size: 13px; color: #303133; line-height: 1.6; }
.protocol-meta { font-size: 11px; color: #909399; margin-top: 6px; }
</style>
