<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page tm-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">测试模型库</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 个模型 · {{ stats.combo }} 个组合模型 · {{ stats.fields }} 条字段定义 · 测试规程与录入字段维护
          </p>
        </div>
        <div class="rk-header-actions">
          <button type="button" class="rk-btn rk-btn-primary" @click="handleAdd" v-hasPermi="['apms:testModel:add']">
            <el-icon><Plus /></el-icon>新增模型
          </button>
          <button type="button" class="rk-btn rk-btn-danger" :disabled="multiple"
                  @click="handleDelete()" v-hasPermi="['apms:testModel:remove']">
            <el-icon><Delete /></el-icon>批量删除
          </button>
        </div>
      </div>

      <!-- ===== KPI 卡带（额外只读全量请求统计，零后端改动） ===== -->
      <div class="rk-kpi-grid is-4">
        <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
          <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
          <div class="rk-kpi-label">{{ k.label }}</div>
          <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
          <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
        </div>
      </div>

      <!-- ===== 筛选（原生控件，服务端防抖） ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">模型编码</span>
          <input v-model="queryParams.code" class="rk-input tm-input-code" type="text" placeholder="如 YOYO_IR1" @keyup.enter="handleQuery"/>
        </label>
        <label class="rk-group">
          <span class="rk-label">模型名称</span>
          <input v-model="queryParams.name" class="rk-input tm-input-name" type="text" placeholder="如 RSA 10×20m" @keyup.enter="handleQuery"/>
        </label>
        <label class="rk-group">
          <span class="rk-label">分类</span>
          <select v-model="queryParams.category" class="rk-select tm-select-cat">
            <option :value="null">全部分类</option>
            <option value="耐力">耐力</option>
            <option value="速度耐力">速度耐力</option>
            <option value="敏捷">敏捷</option>
            <option value="带球敏捷">带球敏捷</option>
            <option value="组合">组合</option>
          </select>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetQuery">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 主从双栏 ===== -->
      <div class="rk-split-grid" style="--rk-split-l: 13fr; --rk-split-r: 11fr;">

        <!-- 左：模型列表（服务端分页） -->
        <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">测试模型库</h3>
            <span class="rk-card-sub">共 {{ total }} 个 · 点击行查看字段定义</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table tm-table is-compact">
                <thead>
                  <tr>
                    <th class="col-check">
                      <input type="checkbox" class="rk-check" :checked="allChecked" @change="toggleAll"/>
                    </th>
                    <th class="col-code">编码</th>
                    <th class="col-name">名称</th>
                    <th class="text-center col-cat">分类</th>
                    <th class="text-center col-combo">组合</th>
                    <th class="text-center col-status">状态</th>
                    <th class="text-center col-ops">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in modelList" :key="row.id"
                      class="rk-row"
                      :class="{ 'is-selected': currentModel && currentModel.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="col-check" @click.stop>
                      <input type="checkbox" class="rk-check" :checked="ids.includes(row.id)"
                             @change="toggleRow(row)"/>
                    </td>
                    <td class="rk-mono tm-code">{{ row.code }}</td>
                    <td>{{ row.name }}</td>
                    <td class="text-center">
                      <span class="rk-soft-chip" :class="categoryChipClass(row.category)">{{ row.category || '—' }}</span>
                    </td>
                    <td class="text-center">
                      <span v-if="row.isCombo === '1'" class="rk-soft-chip tm-combo">组合</span>
                      <span v-else class="rk-dash">—</span>
                    </td>
                    <td class="text-center col-switch" @click.stop>
                      <el-switch v-model="row.status" active-value="0" inactive-value="1" size="small"
                                 @change="handleStatusChange(row)"/>
                    </td>
                    <td class="text-center col-ops">
                      <button type="button" class="rk-link" @click.stop="handleEdit(row)"
                              v-hasPermi="['apms:testModel:edit']">编辑</button>
                      <button type="button" class="rk-link is-danger" @click.stop="handleDelete(row)"
                              v-hasPermi="['apms:testModel:remove']">删除</button>
                    </td>
                  </tr>
                  <tr v-if="!loading && modelList.length === 0">
                    <td colspan="7" class="rk-empty-cell">
                      <div class="rk-empty">
                        <p class="rk-empty-title">暂无模型</p>
                        <p class="rk-empty-desc">调整筛选条件，或点击右上角新增模型</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rk-pager" v-if="total > 0">
              <span class="rk-pager-info">
                共 <b class="rk-mono">{{ total }}</b> 个 · 第 <span class="rk-mono">{{ queryParams.pageNum }}</span> / {{ totalPages }} 页
              </span>
              <div class="rk-pager-btns">
                <button type="button" class="rk-page-btn" :disabled="queryParams.pageNum <= 1" @click="goPage(queryParams.pageNum - 1)">
                  <el-icon><ArrowLeft /></el-icon>
                </button>
                <template v-for="p in pageNumbers" :key="p">
                  <span v-if="p === '…'" class="rk-page-btn is-ellipsis rk-mono">…</span>
                  <button v-else type="button" class="rk-page-btn rk-mono"
                          :class="{ 'is-active': p === queryParams.pageNum }"
                          @click="goPage(p)">{{ p }}</button>
                </template>
                <button type="button" class="rk-page-btn" :disabled="queryParams.pageNum >= totalPages" @click="goPage(queryParams.pageNum + 1)">
                  <el-icon><ArrowRight /></el-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右：字段定义 & 规程 -->
        <div class="rk-card tm-detail-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">字段定义 &amp; 规程</h3>
            <span v-if="currentModel" class="rk-card-sub">
              当前：{{ currentModel.name }}（<span class="rk-mono">{{ currentModel.code }}</span>）
            </span>
            <span v-else class="rk-card-sub">← 点击左侧模型查看</span>
            <div class="rk-card-actions" v-if="currentModel">
              <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" @click="openFieldDialog()">
                <el-icon><Plus /></el-icon>新增字段
              </button>
            </div>
          </div>

          <template v-if="currentModel">
            <div class="tm-banner">
              <div class="tm-banner-title">
                <span class="rk-soft-chip" :class="categoryChipClass(currentModel.category)">{{ currentModel.category }}</span>
                <span v-if="currentModel.isCombo === '1'" class="rk-soft-chip tm-combo">组合模型</span>
                <span class="rk-mono">{{ currentModel.code }}</span>
                <span>{{ currentModel.name }}</span>
                <span class="rk-status-badge" :class="currentModel.status === '0' ? 'tone-green' : 'tone-gray'">
                  {{ currentModel.status === '0' ? '启用中' : '已停用' }}
                </span>
              </div>
              <div class="tm-banner-meta">
                <span>算法版本 <b class="rk-mono">{{ currentModel.algoVersion || '未指定' }}</b></span>
                <span>字段 <b class="rk-mono">{{ detail.fields.length }}</b> 条</span>
                <span>必填 <b class="rk-mono">{{ requiredCount }}</b> 条</span>
              </div>
            </div>

            <div class="rk-card-body tm-detail-body" v-loading="detailLoading">
              <!-- 规程 -->
              <div v-if="currentModel.protocol" class="tm-protocol">
                <div class="tm-protocol-label">📋 测试规程</div>
                <div class="tm-protocol-content">{{ currentModel.protocol }}</div>
              </div>

              <!-- 字段表格 -->
              <div class="tm-section-title">
                字段定义
                <span class="tm-section-count rk-mono">{{ detail.fields.length }}</span>
              </div>
              <div v-if="detail.fields.length" class="rk-table-scroll tm-field-scroll">
                <table class="rk-table tm-field-table">
                  <thead>
                    <tr>
                      <th class="text-center col-idx">#</th>
                      <th class="col-key">字段 Key</th>
                      <th class="col-fname">显示名</th>
                      <th class="text-center col-unit">单位</th>
                      <th class="text-center col-type">类型</th>
                      <th class="text-center col-req">必填</th>
                      <th class="text-center col-sort">排序</th>
                      <th class="text-center col-fops">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(f, idx) in detail.fields" :key="f.id">
                      <td class="text-center rk-mono">{{ idx + 1 }}</td>
                      <td class="rk-mono tm-field-key">{{ f.fieldKey }}</td>
                      <td>{{ f.fieldName }}</td>
                      <td class="text-center">{{ f.unit || '—' }}</td>
                      <td class="text-center">
                        <span class="rk-soft-chip" :class="dataTypeChipClass(f.dataType)">{{ f.dataType }}</span>
                      </td>
                      <td class="text-center">
                        <span class="tm-req" :class="f.isRequired === '1' ? 'is-req' : 'is-opt'">
                          {{ f.isRequired === '1' ? '●' : '○' }}
                        </span>
                      </td>
                      <td class="text-center rk-mono">{{ f.sortOrder }}</td>
                      <td class="text-center">
                        <button type="button" class="rk-link" @click="openFieldDialog(f)">编辑</button>
                        <button type="button" class="rk-link is-danger" @click="handleDeleteField(f)">删除</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="tm-field-empty">
                <div class="rk-empty">
                  <p class="rk-empty-title">该模型暂无字段定义</p>
                  <p class="rk-empty-desc">点击右上角「新增字段」配置成绩录入口径</p>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="tm-detail-empty">
            <div class="rk-empty">
              <p class="rk-empty-title">选择左侧模型查看字段定义</p>
              <p class="rk-empty-desc">测试规程、字段 Key、类型与必填约束将在此展示</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 模型 新增/编辑 Dialog（原逻辑保留） ========== -->
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

      <!-- ========== 字段 新增/编辑 Dialog（原逻辑保留） ========== -->
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
  </div>
</template>

<script setup name="ApmsTestModel">
import {
  listTestModel, getTestModel, addTestModel, updateTestModel, delTestModel,
  addField, updateField, delField
} from '@/api/apms/testModel'
import { Plus, Delete, RefreshLeft, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()

const PAGE_SIZE = 10

// ========= 查询 =========
const loading = ref(false)
const modelList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE, code: null, name: null, category: null })

function getList() {
  loading.value = true
  listTestModel(queryParams).then(res => {
    modelList.value = res.rows || []
    total.value = res.total || 0
  }).finally(() => { loading.value = false })
}
function handleQuery() { queryParams.pageNum = 1; getList() }

let filterGuard = false
function resetQuery() {
  filterGuard = true
  queryParams.code = null
  queryParams.name = null
  queryParams.category = null
  queryParams.pageNum = 1
  getList()
  nextTick(() => { filterGuard = false })
}

let filterTimer = null
watch(() => [queryParams.code, queryParams.name, queryParams.category], () => {
  if (filterGuard) return
  clearTimeout(filterTimer)
  filterTimer = setTimeout(handleQuery, 300)
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNumbers = computed(() => {
  const pages = totalPages.value, cur = queryParams.pageNum
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(pages - 4, cur - 2))
  const nums = [1]
  for (let i = start; i < Math.min(pages, start + 3); i++) nums.push(i)
  nums.push(pages)
  return nums
})
function goPage(p) {
  if (p === '…' || p < 1 || p > totalPages.value || p === queryParams.pageNum) return
  queryParams.pageNum = p
  getList()
}

// ========= 多选（原生复选列） =========
const ids = ref([])
const multiple = computed(() => !ids.value.length)
const allChecked = computed(() => modelList.value.length > 0 && modelList.value.every(r => ids.value.includes(r.id)))
function toggleRow(row) {
  const i = ids.value.indexOf(row.id)
  if (i >= 0) ids.value.splice(i, 1); else ids.value.push(row.id)
}
function toggleAll() {
  const every = allChecked.value
  const set = new Set(ids.value)
  modelList.value.forEach(r => {
    if (every) set.delete(r.id); else set.add(r.id)
  })
  ids.value = Array.from(set)
}

// ========= KPI 统计（只读全量 + getById 汇总，零后端改动） =========
const stats = reactive({ total: 0, enabled: 0, combo: 0, fields: 0 })
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listTestModel({ pageNum: 1, pageSize: 500 }).then(r => {
    if (seq !== statsSeq) return null
    const rows = r.rows || []
    stats.total = r.total || rows.length
    stats.enabled = rows.filter(x => x.status === '0').length
    stats.combo = rows.filter(x => x.isCombo === '1').length
    return Promise.all(rows.map(x => getTestModel(x.id).then(res => res.data).catch(() => null)))
  }).then(details => {
    if (seq !== statsSeq || !details) return
    stats.fields = details.filter(Boolean).reduce((s, d) => s + ((d.fields || []).length), 0)
  })
}
const kpiCards = computed(() => [
  { label: '测试模型总数', value: stats.total, unit: '个', accent: '#2563EB', chip: '字段口径定义', chipTone: 'tone-info' },
  { label: '启用中', value: stats.enabled, unit: '个', accent: '#16A34A', chip: stats.total - stats.enabled ? `停用 ${stats.total - stats.enabled} 个` : '全部启用', chipTone: stats.total - stats.enabled ? 'tone-warn' : 'tone-ok' },
  { label: '组合模型', value: stats.combo, unit: '个', accent: '#8B5CF6', chip: '供组合分计算使用', chipTone: '' },
  { label: '字段定义', value: stats.fields, unit: '条', accent: '#06B6D4', chip: stats.total ? '平均每模型 ' + (stats.fields / stats.total).toFixed(1) + ' 条' : '—', chipTone: '' }
])

// 后端 UPDATE 为全字段内联更新（无动态 <if>），只发 {id,status} 会因 name 等 NOT NULL 列置空而 500，
// 必须带齐列表行中的全部持久化字段（原页遗留缺陷修复）
function handleStatusChange(row) {
  updateTestModel({
    id: row.id, code: row.code, category: row.category, name: row.name, protocol: row.protocol,
    isCombo: row.isCombo, algoVersion: row.algoVersion, status: row.status
  }).then(() => {
    proxy.$modal.msgSuccess('状态已更新')
    loadStats()
  })
}

// ========= 主从 =========
const currentModel = ref(null)
const detail = reactive({ fields: [] })
const detailLoading = ref(false)
const requiredCount = computed(() => detail.fields.filter(f => f.isRequired === '1').length)

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
  }).finally(() => { detailLoading.value = false })
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
      loadStats()
      if (currentModel.value?.id === modelForm.id) loadDetail(currentModel.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除？其下字段定义将一并删除。').then(() => delTestModel(selIds))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功')
      ids.value = []
      getList()
      loadStats()
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
    loadStats()
  })
}
function handleDeleteField(field) {
  proxy.$modal.confirm(`确认删除字段 "${field.fieldKey}"？`).then(() => delField(field.id))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功')
      loadDetail(currentModel.value.id)
      loadStats()
    }).catch(() => {})
}

// ========= 辅助 =========
function categoryChipClass(c) {
  return ({ '耐力': 'tm-cat-endurance', '速度耐力': 'tm-cat-speed', '敏捷': 'tm-cat-agility', '带球敏捷': 'tm-cat-dribble', '组合': 'tm-cat-combo' })[c] || 'tm-cat-combo'
}
function dataTypeChipClass(t) { return ({ decimal: 'tm-type-decimal', number: 'tm-type-number', text: 'tm-type-text' })[t] || 'tm-type-text' }

// init
getList()
loadStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.tm-input-code { width: 150px; }
.tm-input-name { width: 170px; }
.tm-select-cat { width: 120px; }

/* 左表 */
.col-check { width: 40px; text-align: center; }
.col-code { width: 120px; }
.col-cat { width: 80px; }
.col-combo { width: 64px; }
.col-status { width: 62px; }
.col-ops { width: 96px; }
.rk-empty-cell { padding: 36px 0; }
.tm-table tbody tr { cursor: pointer; }
.tm-code { font-size: 12px; font-weight: 600; color: $rk-brand-600; }

:deep(.rk-link.is-danger) { color: $rk-risk; }
:deep(.rk-link.is-danger:hover) { color: #a13a3a; }

:deep(.rk-soft-chip.tm-cat-endurance) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.rk-soft-chip.tm-cat-speed) { background: #fef3e0; color: #b45309; }
:deep(.rk-soft-chip.tm-cat-agility) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.tm-cat-dribble) { background: #fcebeb; color: $rk-risk; }
:deep(.rk-soft-chip.tm-cat-combo) { background: #f1f5f9; color: $rk-text-3; }
:deep(.rk-soft-chip.tm-combo) { background: #fdf1d6; color: #9a6b13; }

:deep(.rk-soft-chip.tm-type-decimal) { background: #fef3e0; color: #b45309; }
:deep(.rk-soft-chip.tm-type-number) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.tm-type-text) { background: #f1f5f9; color: $rk-text-3; }

/* 右详情 */
.tm-detail-card { overflow: hidden; }
.tm-detail-empty { padding: 80px 20px; }
.tm-banner {
  padding: 14px 18px;
  background: linear-gradient(180deg, #f4f7ff, #fff 85%);
  border-bottom: 1px solid $rk-line;
}
.tm-banner-title {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 15px; font-weight: 700; color: $rk-text-1;
  .rk-mono { color: $rk-brand-600; font-size: 12px; font-weight: 600; }
}
.tm-banner-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  margin-top: 7px; font-size: 12px; color: $rk-text-3;
  b { color: $rk-text-2; font-weight: 700; }
}
.tm-detail-body { padding-top: 14px; }

/* 规程 */
.tm-protocol {
  background: #f8fafc; border: 1px solid $rk-line; border-radius: 12px;
  padding: 11px 14px; margin-bottom: 16px;
}
.tm-protocol-label { font-size: 11px; font-weight: 600; color: $rk-text-3; margin-bottom: 5px; }
.tm-protocol-content { font-size: 13px; color: $rk-text-1; line-height: 1.7; white-space: pre-wrap; }

.tm-section-title {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px;
  font-size: 13px; font-weight: 700; color: $rk-text-1;
  &::before {
    content: ''; width: 3px; height: 13px; border-radius: 2px; background: $rk-brand-600;
  }
}
.tm-section-count {
  font-size: 11px; font-weight: 600; color: $rk-brand-600;
  background: $rk-brand-50; border-radius: 999px; padding: 0 7px; line-height: 17px;
}

.tm-field-scroll { border: 1px solid $rk-line; border-radius: 12px; }
.tm-field-table { font-size: 12px; }
.col-idx { width: 44px; }
.col-key { width: 150px; }
.col-unit { width: 64px; }
.col-type { width: 92px; }
.col-req { width: 54px; }
.col-sort { width: 54px; }
.col-fops { width: 110px; }
.tm-field-key { font-size: 12px; font-weight: 600; color: $rk-text-1; }
.tm-req { font-size: 13px; &.is-req { color: $rk-risk; } &.is-opt { color: #cbd5e1; } }

.tm-field-empty {
  padding: 30px 10px;
  border: 1px dashed $rk-line; border-radius: 12px;
}
</style>
