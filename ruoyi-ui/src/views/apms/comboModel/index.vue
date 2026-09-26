<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page cm-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">组合模型库</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 个组合模型 · {{ stats.comps }} 个组成项 · 跨指标加权综合分口径与权重平衡
          </p>
        </div>
        <div class="rk-header-actions">
          <button type="button" class="rk-btn rk-btn-primary" @click="handleAdd" v-hasPermi="['apms:comboModel:add']">
            <el-icon><Plus /></el-icon>新增组合模型
          </button>
          <button type="button" class="rk-btn rk-btn-danger" :disabled="multiple"
                  @click="handleDelete()" v-hasPermi="['apms:comboModel:remove']">
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

      <!-- ===== 主从双栏 ===== -->
      <div class="rk-split-grid" style="--rk-split-l: 10fr; --rk-split-r: 14fr;">

        <!-- 左：组合模型列表（服务端分页） -->
        <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">组合模型库</h3>
            <span class="rk-card-sub">共 {{ total }} 个 · 点击行查看组成项</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table cm-table">
                <thead>
                  <tr>
                    <th class="col-check">
                      <input type="checkbox" class="rk-check" :checked="allChecked" @change="toggleAll"/>
                    </th>
                    <th class="text-center col-id">ID</th>
                    <th class="col-model">关联测试模型</th>
                    <th class="text-center col-norm">归一化</th>
                    <th class="col-algo">算法版本</th>
                    <th class="text-center col-ops">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in comboList" :key="row.id"
                      class="rk-row"
                      :class="{ 'is-selected': currentCombo && currentCombo.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="col-check" @click.stop>
                      <input type="checkbox" class="rk-check" :checked="ids.includes(row.id)"
                             @change="toggleRow(row)"/>
                    </td>
                    <td class="text-center rk-mono">{{ row.id }}</td>
                    <td>
                      <div class="cm-model">
                        <span class="cm-model-code rk-mono">{{ row.testModelCode }}</span>
                        <span class="cm-model-name">{{ row.testModelName }}</span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="rk-soft-chip" :class="normChipClass(row.normalizationMethod)">
                        {{ normLabel(row.normalizationMethod) }}
                      </span>
                    </td>
                    <td class="rk-mono cm-algo">{{ row.algoVersion || '—' }}</td>
                    <td class="text-center col-ops">
                      <button type="button" class="rk-link" @click.stop="handleEdit(row)"
                              v-hasPermi="['apms:comboModel:edit']">编辑</button>
                      <button type="button" class="rk-link is-danger" @click.stop="handleDelete(row)"
                              v-hasPermi="['apms:comboModel:remove']">删除</button>
                    </td>
                  </tr>
                  <tr v-if="!loading && comboList.length === 0">
                    <td colspan="6" class="rk-empty-cell">
                      <div class="rk-empty">
                        <p class="rk-empty-title">暂无组合模型</p>
                        <p class="rk-empty-desc">点击右上角「新增组合模型」关联 is_combo 测试模型</p>
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

        <!-- 右：组成项 & 权重 -->
        <div class="rk-card cm-detail-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">组成项 &amp; 权重</h3>
            <span v-if="currentCombo" class="rk-card-sub">
              当前：{{ currentCombo.testModelName }}（<span class="rk-mono">{{ currentCombo.testModelCode }}</span>）
            </span>
            <span v-else class="rk-card-sub">← 点击左侧组合模型查看</span>
            <div class="rk-card-actions" v-if="currentCombo">
              <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" @click="openComponentDialog">
                <el-icon><Plus /></el-icon>新增组成项
              </button>
            </div>
          </div>

          <template v-if="currentCombo">
            <div class="cm-banner">
              <div class="cm-banner-title">
                <span class="rk-soft-chip" :class="normChipClass(currentCombo.normalizationMethod)">
                  {{ normLabel(currentCombo.normalizationMethod) }}
                </span>
                <span class="rk-mono">{{ currentCombo.testModelCode }}</span>
                <span>{{ currentCombo.testModelName }}</span>
              </div>
              <div class="cm-banner-meta">
                <span>算法版本 <b class="rk-mono">{{ currentCombo.algoVersion || '—' }}</b></span>
                <span>参考组口径 <b class="rk-mono">{{ currentCombo.refVersion || '—' }}</b></span>
                <span>组成项 <b class="rk-mono">{{ detail.components.length }}</b> 个</span>
              </div>
            </div>

            <div class="rk-card-body cm-detail-body" v-loading="detailLoading">
              <!-- 公式卡片 -->
              <div v-if="currentCombo.formula" class="cm-formula">
                <div class="cm-formula-label">📐 计算公式</div>
                <div class="cm-formula-content">{{ currentCombo.formula }}</div>
              </div>

              <!-- 权重合计 -->
              <div class="cm-weight" :class="weightBalanced ? 'is-ok' : 'is-err'">
                <span class="cm-weight-label">权重合计</span>
                <span class="cm-weight-num rk-mono">{{ weightSum.toFixed(2) }}</span>
                <span class="cm-weight-flag">
                  {{ weightBalanced ? '✓ 平衡' : '⚠ 权重之和应等于 1.00' }}
                </span>
              </div>

              <!-- 组成项表格 -->
              <div v-if="detail.components.length" class="rk-table-scroll cm-comp-scroll">
                <table class="rk-table cm-comp-table">
                  <thead>
                    <tr>
                      <th class="text-center col-idx">#</th>
                      <th class="col-ind">指标</th>
                      <th class="text-center col-dir">方向</th>
                      <th class="text-center col-weight">权重</th>
                      <th class="text-center col-sort">排序</th>
                      <th class="text-center col-cops">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(c, idx) in detail.components" :key="c.id">
                      <td class="text-center rk-mono">{{ idx + 1 }}</td>
                      <td>
                        <div class="cm-ind">
                          <span class="cm-ind-code rk-mono">{{ c.indicatorCode }}</span>
                          <span class="cm-ind-name">{{ c.indicatorName }}</span>
                        </div>
                      </td>
                      <td class="text-center">
                        <span v-if="c.directionOverride" class="rk-soft-chip cm-dir-override">
                          覆盖 {{ c.directionOverride === '0' ? '↑越大越好' : '↓越小越好' }}
                        </span>
                        <span v-else class="rk-soft-chip" :class="dirChipClass(c.indicatorDirection)">
                          继承 {{ dirLabel(c.indicatorDirection) }}
                        </span>
                      </td>
                      <td class="text-center">
                        <el-input-number v-if="c.editing" v-model="c.weight" :precision="2" :step="0.05" :min="0" :max="1"
                                         size="small" controls-position="right" class="cm-weight-input"/>
                        <span v-else class="rk-mono cm-weight-val">{{ c.weight?.toFixed(2) || '—' }}</span>
                      </td>
                      <td class="text-center">
                        <el-input-number v-if="c.editing" v-model="c.sortOrder" :min="0" size="small"
                                         controls-position="right" class="cm-sort-input"/>
                        <span v-else class="rk-mono">{{ c.sortOrder }}</span>
                      </td>
                      <td class="text-center">
                        <template v-if="!c.editing">
                          <button type="button" class="rk-link" @click="startCompEdit(c)">编辑</button>
                        </template>
                        <template v-else>
                          <button type="button" class="rk-link" @click="saveComponent(c)">保存</button>
                          <button type="button" class="rk-link" @click="cancelCompEdit(c)">取消</button>
                        </template>
                        <button type="button" class="rk-link is-danger" @click="handleDeleteComponent(c)">删</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="cm-comp-empty">
                <div class="rk-empty">
                  <p class="rk-empty-title">该组合模型暂无组成项</p>
                  <p class="rk-empty-desc">点击右上角「新增组成项」选择指标并设置权重</p>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="cm-detail-empty">
            <div class="rk-empty">
              <p class="rk-empty-title">选择左侧组合模型查看组成项</p>
              <p class="rk-empty-desc">指标方向、权重与计算公式将在此展示</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 组合模型 新增/编辑 Dialog（原逻辑保留） ========== -->
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

      <!-- ========== 组成项 新增 Dialog（原逻辑保留） ========== -->
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
  </div>
</template>

<script setup name="ApmsComboModel">
import {
  listComboModel, getComboModel, addComboModel, updateComboModel, delComboModel,
  addComponent, updateComponent, delComponent
} from '@/api/apms/comboModel'
import { listIndicator } from '@/api/apms/indicator'
import { listTestModel } from '@/api/apms/testModel'
import { Plus, Delete, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()

const PAGE_SIZE = 10

// ========= 查询 =========
const loading = ref(false)
const comboList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE })

function getList() {
  loading.value = true
  listComboModel(queryParams).then(res => {
    comboList.value = res.rows || []
    total.value = res.total || 0
  }).finally(() => { loading.value = false })
}

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
const allChecked = computed(() => comboList.value.length > 0 && comboList.value.every(r => ids.value.includes(r.id)))
function toggleRow(row) {
  const i = ids.value.indexOf(row.id)
  if (i >= 0) ids.value.splice(i, 1); else ids.value.push(row.id)
}
function toggleAll() {
  const every = allChecked.value
  const set = new Set(ids.value)
  comboList.value.forEach(r => {
    if (every) set.delete(r.id); else set.add(r.id)
  })
  ids.value = Array.from(set)
}

// ========= KPI 统计（list 行 components 为 null，需 getById 汇总） =========
const stats = reactive({ total: 0, comps: 0, balanced: 0 })
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listComboModel({ pageNum: 1, pageSize: 500 }).then(r => {
    if (seq !== statsSeq) return null
    const rows = r.rows || []
    stats.total = r.total || rows.length
    return Promise.all(rows.map(m => getComboModel(m.id).then(res => res.data).catch(() => null)))
  }).then(details => {
    if (seq !== statsSeq || !details) return
    const models = details.filter(Boolean)
    stats.comps = models.reduce((s, m) => s + ((m.components || []).length), 0)
    stats.balanced = models.filter(m => {
      const sum = (m.components || []).reduce((s, c) => s + (parseFloat(c.weight) || 0), 0)
      return Math.abs(sum - 1) <= 0.001
    }).length
  })
}
const kpiCards = computed(() => [
  { label: '组合模型', value: stats.total, unit: '个', accent: '#2563EB', chip: '组合评分口径', chipTone: 'tone-info' },
  { label: '组成项合计', value: stats.comps, unit: '项', accent: '#06B6D4', chip: '跨指标加权', chipTone: '' },
  { label: '权重平衡', value: stats.balanced, unit: '个', accent: '#16A34A',
    chip: stats.balanced === stats.total && stats.total > 0 ? '全部平衡' : `${stats.total - stats.balanced} 个待调整`,
    chipTone: stats.balanced === stats.total && stats.total > 0 ? 'tone-ok' : 'tone-warn' },
  { label: '平均组成项', value: stats.total ? (stats.comps / stats.total).toFixed(1) : '0', unit: '项/模型', accent: '#8B5CF6', chip: '权重之和应为 1.00', chipTone: '' }
])

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
    detail.components = (d.components || []).map(c => ({ ...c, editing: false }))
    currentCombo.value = d
  }).finally(() => { detailLoading.value = false })
}

const weightSum = computed(() => detail.components.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0))
const weightBalanced = computed(() => Math.abs(weightSum.value - 1) <= 0.001)

// ========= 组成项内联编辑（带取消快照，修复原页取消不还原缺陷） =========
const compSnapshots = new Map()
function startCompEdit(row) {
  compSnapshots.set(row.id, { weight: row.weight, sortOrder: row.sortOrder })
  row.editing = true
}
function cancelCompEdit(row) {
  const snap = compSnapshots.get(row.id)
  if (snap) { Object.assign(row, snap); compSnapshots.delete(row.id) }
  row.editing = false
}

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
      loadStats()
      if (currentCombo.value?.id === comboForm.id) loadDetail(currentCombo.value.id)
    })
  })
}
function handleDelete(row) {
  const selIds = row ? row.id : ids.value
  proxy.$modal.confirm('确认删除？其下组成项将一并删除。').then(() => delComboModel(selIds))
    .then(() => {
      proxy.$modal.msgSuccess('删除成功')
      ids.value = []
      getList()
      loadStats()
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
    loadStats()
  })
}
function saveComponent(row) {
  updateComponent({ id: row.id, comboModelId: currentCombo.value.id, indicatorId: row.indicatorId, weight: row.weight, directionOverride: row.directionOverride, sortOrder: row.sortOrder })
    .then(() => {
      row.editing = false
      compSnapshots.delete(row.id)
      proxy.$modal.msgSuccess('已保存')
      loadStats()
    })
}
function handleDeleteComponent(row) {
  proxy.$modal.confirm(`确认移除 ${row.indicatorCode}？`).then(() => delComponent(row.id))
    .then(() => {
      proxy.$modal.msgSuccess('已移除')
      loadDetail(currentCombo.value.id)
      loadStats()
    }).catch(() => {})
}

// ========= 辅助 =========
function dirLabel(d) { return ({ HIGHER_BETTER: '↑越大越好', LOWER_BETTER: '↓越小越好', RANGE_BEST: '≈范围最佳', REFERENCE_ONLY: '—仅参考' })[d] || d || '—' }
function dirChipClass(d) { return ({ HIGHER_BETTER: 'cm-higher', LOWER_BETTER: 'cm-lower', RANGE_BEST: 'cm-range', REFERENCE_ONLY: 'cm-ref' })[d] || 'cm-ref' }
function normLabel(n) { return ({ z_score: 'Z-Score', percentile: '百分位', custom: '自定义' })[n] || n || '—' }
function normChipClass(n) { return ({ z_score: 'cm-norm-z', percentile: 'cm-norm-pct', custom: 'cm-norm-custom' })[n] || 'cm-norm-custom' }

getList()
loadStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

/* 左表 */
.col-check { width: 40px; text-align: center; }
.col-id { width: 52px; }
.col-norm { width: 92px; }
.col-ops { width: 96px; }
.rk-empty-cell { padding: 36px 0; }
.cm-table tbody tr { cursor: pointer; }
.cm-model { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cm-model-code { font-size: 12px; font-weight: 600; color: $rk-brand-600; }
.cm-model-name {
  font-size: 12px; color: $rk-text-3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cm-algo { font-size: 12px; color: $rk-text-2; }

:deep(.rk-link.is-danger) { color: $rk-risk; }
:deep(.rk-link.is-danger:hover) { color: #a13a3a; }

:deep(.rk-soft-chip.cm-norm-z) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.rk-soft-chip.cm-norm-pct) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.cm-norm-custom) { background: #f1f5f9; color: $rk-text-3; }

:deep(.rk-soft-chip.cm-higher) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.cm-lower) { background: #fcebeb; color: $rk-risk; }
:deep(.rk-soft-chip.cm-range) { background: #fef3e0; color: #b45309; }
:deep(.rk-soft-chip.cm-ref) { background: #f1f5f9; color: $rk-text-3; }
:deep(.rk-soft-chip.cm-dir-override) { background: #fdf1d6; color: #9a6b13; }

/* 右详情 */
.cm-detail-card { overflow: hidden; }
.cm-detail-empty { padding: 80px 20px; }
.cm-banner {
  padding: 14px 18px;
  background: linear-gradient(180deg, #f4f7ff, #fff 85%);
  border-bottom: 1px solid $rk-line;
}
.cm-banner-title {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 15px; font-weight: 700; color: $rk-text-1;
  .rk-mono { color: $rk-brand-600; font-size: 12px; font-weight: 600; }
}
.cm-banner-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  margin-top: 7px; font-size: 12px; color: $rk-text-3;
  b { color: $rk-text-2; font-weight: 700; }
}
.cm-detail-body { padding-top: 14px; }

/* 公式卡 */
.cm-formula {
  background: linear-gradient(135deg, #f4f8ff, #f6faf7);
  border: 1px solid #dbe6f2; border-radius: 12px;
  padding: 11px 14px; margin-bottom: 10px;
}
.cm-formula-label { font-size: 11px; font-weight: 600; color: $rk-text-3; margin-bottom: 4px; }
.cm-formula-content {
  font-size: 13px; color: $rk-text-1; line-height: 1.7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap; word-break: break-all;
}

/* 权重合计条 */
.cm-weight {
  display: flex; align-items: center; gap: 10px;
  border-radius: 12px; padding: 9px 14px; margin-bottom: 12px;
  border: 1px solid transparent;
  &.is-ok { background: #f2faf5; border-color: #cfe9d8; }
  &.is-err { background: #fef2f2; border-color: #f5c6c6; }
}
.cm-weight-label { font-size: 12px; color: $rk-text-3; }
.cm-weight-num { font-size: 19px; font-weight: 700; color: $rk-text-1; }
.cm-weight-flag {
  margin-left: auto; font-size: 12px; font-weight: 600;
  .is-ok & { color: $rk-ok; }
  .is-err & { color: $rk-risk; }
}

/* 组成项表 */
.cm-comp-scroll { border: 1px solid $rk-line; border-radius: 12px; }
.cm-comp-table { font-size: 12px; }
.col-idx { width: 44px; }
.col-dir { width: 132px; }
.col-weight { width: 130px; }
.col-sort { width: 80px; }
.col-cops { width: 150px; }
.cm-ind { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cm-ind-code { font-size: 12px; font-weight: 600; color: $rk-text-1; }
.cm-ind-name { font-size: 11px; color: $rk-text-3; }
.cm-weight-val { font-size: 13px; font-weight: 700; color: $rk-text-1; }
.cm-weight-input { width: 110px; }
.cm-sort-input { width: 70px; }

.cm-comp-empty {
  padding: 30px 10px;
  border: 1px dashed $rk-line; border-radius: 12px;
}
</style>
