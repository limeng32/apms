<template>
  <div class="app-container" :class="{ 'is-embedded': embedded }">
    <div class="rk-dash-page rk-page ind-page">

      <!-- ===== 页头（合并页内也保留：统计信息 + 新增指标/批量删除入口） ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">指标库</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 项指标 · {{ stats.enabled }} 项启用 · {{ stats.withRefs }} 项已配参考范围 · 评价方向与三级判定维护
          </p>
        </div>
        <div class="rk-header-actions">
          <button type="button" class="rk-btn rk-btn-primary" @click="handleAdd" v-hasPermi="['apms:indicator:add']">
            <el-icon><Plus /></el-icon>新增指标
          </button>
          <button type="button" class="rk-btn rk-btn-danger" :disabled="multiple"
                  @click="handleDelete()" v-hasPermi="['apms:indicator:remove']">
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
          <span class="rk-label">指标编码</span>
          <input v-model="queryParams.code" class="rk-input ind-input-code" type="text" placeholder="如 SPRINT_30M" @keyup.enter="handleQuery"/>
        </label>
        <label class="rk-group">
          <span class="rk-label">指标名称</span>
          <input v-model="queryParams.name" class="rk-input ind-input-name" type="text" placeholder="如 30米冲刺" @keyup.enter="handleQuery"/>
        </label>
        <label class="rk-group">
          <span class="rk-label">分类</span>
          <select v-model="queryParams.category" class="rk-select ind-select-sm">
            <option :value="null">全部分类</option>
            <option value="形态">形态</option>
            <option value="机能">机能</option>
            <option value="素质">素质</option>
            <option value="筛查">筛查</option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">方向</span>
          <select v-model="queryParams.evaluationDirection" class="rk-select ind-select-dir">
            <option :value="null">全部方向</option>
            <option value="HIGHER_BETTER">越大越好</option>
            <option value="LOWER_BETTER">越小越好</option>
            <option value="RANGE_BEST">范围最佳</option>
            <option value="REFERENCE_ONLY">仅参考</option>
          </select>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetQuery">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 指标台账（点击行右侧抽屉查看参考范围） ===== -->
      <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">指标库</h3>
            <span class="rk-card-sub">共 {{ total }} 项 · 点击行查看参考范围</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table ind-table is-compact">
                <thead>
                  <tr>
                    <th class="col-check">
                      <input type="checkbox" class="rk-check" :checked="allChecked" @change="toggleAll"/>
                    </th>
                    <th class="col-code">编码</th>
                    <th class="col-name">名称</th>
                    <th class="text-center col-cat">分类</th>
                    <th class="text-center col-unit">单位</th>
                    <th class="text-center col-dir">方向</th>
                    <th class="text-center col-status">状态</th>
                    <th class="text-center col-ops">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in indicatorList" :key="row.id"
                      class="rk-row"
                      :class="{ 'is-selected': currentIndicator && currentIndicator.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="col-check" @click.stop>
                      <input type="checkbox" class="rk-check" :checked="ids.includes(row.id)"
                             @change="toggleRow(row)"/>
                    </td>
                    <td class="rk-mono ind-code">{{ row.code }}</td>
                    <td>{{ row.name }}</td>
                    <td class="text-center">
                      <span class="rk-soft-chip" :class="categoryChipClass(row.category)">{{ row.category || '—' }}</span>
                    </td>
                    <td class="text-center">{{ row.unit || '—' }}</td>
                    <td class="text-center">
                      <span class="rk-soft-chip" :class="dirChipClass(row.evaluationDirection)">
                        {{ dirLabel(row.evaluationDirection) }}
                      </span>
                    </td>
                    <td class="text-center col-switch" @click.stop>
                      <el-switch v-model="row.status" active-value="0" inactive-value="1" size="small"
                                 @change="handleStatusChange(row)"/>
                    </td>
                    <td class="text-center col-ops">
                      <button type="button" class="rk-link" @click.stop="handleEdit(row)"
                              v-hasPermi="['apms:indicator:edit']">编辑</button>
                      <button type="button" class="rk-link is-danger" @click.stop="handleDelete(row)"
                              v-hasPermi="['apms:indicator:remove']">删除</button>
                    </td>
                  </tr>
                  <tr v-if="!loading && indicatorList.length === 0">
                    <td colspan="8" class="rk-empty-cell">
                      <div class="rk-empty">
                        <p class="rk-empty-title">暂无指标</p>
                        <p class="rk-empty-desc">调整筛选条件，或点击右上角新增指标</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rk-pager" v-if="total > 0">
              <span class="rk-pager-info">
                共 <b class="rk-mono">{{ total }}</b> 项 · 第 <span class="rk-mono">{{ queryParams.pageNum }}</span> / {{ totalPages }} 页
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

      <!-- ===== 参考范围 & 三级判定 抽屉（点击左表行打开） ===== -->
      <el-drawer v-model="detailDrawerVisible" :size="drawerSize" :with-header="false"
                 destroy-on-close class="ind-drawer-wrap" :style="drawerPanelStyle">
        <div class="ind-drawer" v-if="currentIndicator">
          <div class="ind-drawer-head">
            <div class="ind-drawer-id">
              <div class="ind-drawer-title">参考范围 &amp; 三级判定</div>
              <div class="ind-drawer-sub">
                {{ currentIndicator.name }}（<span class="rk-mono">{{ currentIndicator.code }}</span>）
              </div>
            </div>
            <div class="ind-drawer-tools">
              <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" @click="openRefDialog()">
                <el-icon><Plus /></el-icon>新增参考范围
              </button>
              <button type="button" class="ind-drawer-close" @click="detailDrawerVisible = false">
                <el-icon><Close /></el-icon>
              </button>
            </div>
          </div>

          <div class="ind-drawer-body" v-loading="detailLoading">
            <div class="ind-banner">
              <div class="ind-banner-title">
                <span class="rk-soft-chip" :class="categoryChipClass(currentIndicator.category)">{{ currentIndicator.category }}</span>
                <span class="rk-mono">{{ currentIndicator.code }}</span>
                <span>{{ currentIndicator.name }}</span>
                <span class="rk-status-badge" :class="currentIndicator.status === '0' ? 'tone-green' : 'tone-gray'">
                  {{ currentIndicator.status === '0' ? '启用中' : '已停用' }}
                </span>
              </div>
              <div class="ind-banner-meta">
                <span>单位 <b class="rk-mono">{{ currentIndicator.unit || '—' }}</b></span>
                <span>数据类型 <b class="rk-mono">{{ currentIndicator.dataType || '—' }}</b></span>
                <span>采集 <b>{{ collectLabel(currentIndicator.collectionMethod) }}</b></span>
                <span class="rk-soft-chip" :class="dirChipClass(currentIndicator.evaluationDirection)">
                  {{ dirLabel(currentIndicator.evaluationDirection) }}
                </span>
              </div>
            </div>

            <div v-if="!detailLoading && detail.refs.length === 0" class="ind-ref-empty">
              <div class="rk-empty">
                <p class="rk-empty-title">该指标暂无参考范围</p>
                <p class="rk-empty-desc">点击右上角「新增参考范围」配置性别 / 年龄组口径与三级判定</p>
              </div>
            </div>

            <div v-for="ref in detail.refs" :key="ref.id" class="ind-ref-card" :class="'is-' + (ref.gender || 'U')">
                <div class="ind-ref-head">
                  <div class="ind-ref-id">
                    <span class="ind-gender" :class="ref.gender === 'M' ? 'is-m' : ref.gender === 'F' ? 'is-f' : 'is-u'">
                      {{ ref.gender === 'M' ? '男' : ref.gender === 'F' ? '女' : '通用' }}
                    </span>
                    <span v-if="ref.ageGroup" class="rk-soft-chip">{{ ref.ageGroup }}</span>
                    <span class="ind-ref-range">
                      参考范围 <b class="rk-mono">{{ ref.refMin ?? '—' }} ~ {{ ref.refMax ?? '—' }}</b>
                    </span>
                    <span v-if="ref.modelVersion" class="ind-ref-version rk-mono">v{{ ref.modelVersion }}</span>
                  </div>
                  <div class="ind-ref-actions">
                    <button type="button" class="rk-link" @click="openRefDialog(ref)">编辑</button>
                    <button type="button" class="rk-link is-danger" @click="handleDeleteRef(ref)">删除</button>
                  </div>
                </div>

                <!-- 区间冲突/空洞 实时提示 -->
                <div v-if="getLevelValidationIssues(ref.levels).length" class="ind-alerts">
                  <el-alert v-for="(issue, idx) in getLevelValidationIssues(ref.levels)" :key="idx"
                            :title="issue" type="warning" :closable="false" show-icon
                            description="区间重叠或上下限颠倒保存时会被后端拦截；区间空洞仅提示，建议补齐"/>
                </div>

                <div class="rk-table-scroll ind-level-scroll">
                  <table class="rk-table ind-level-table">
                    <thead>
                      <tr>
                        <th class="text-center col-lv">评级</th>
                        <th class="text-center col-bound">下限</th>
                        <th class="text-center col-bound">上限</th>
                        <th class="text-center col-lv-ops">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="lv in ref.levels" :key="lv.id"
                          :class="{ 'is-level-error': isLevelRowError(lv, ref.levels) }">
                        <td class="text-center">
                          <el-select v-if="lv.editing" v-model="lv.level" size="small"
                                     filterable allow-create default-first-option
                                     placeholder="选或输评级码" class="ind-lv-input">
                            <el-option v-for="p in inlineLevelPresets(lv)" :key="p.code"
                                       :label="`${p.code} ${p.name}`" :value="p.code">
                              <span class="ind-opt-code">{{ p.code }}</span>
                              <span class="ind-opt-name">{{ p.name }}</span>
                            </el-option>
                          </el-select>
                          <span v-else class="rk-soft-chip" :class="levelChipClass(lv.level)">{{ levelLabel(lv.level) }}</span>
                        </td>
                        <td class="text-center">
                          <el-input-number v-if="lv.editing" v-model="lv.minValue" :precision="4" :step="0.1"
                                           size="small" controls-position="right" class="ind-bound-input"/>
                          <span v-else class="rk-mono">{{ lv.minValue ?? '−∞' }}</span>
                        </td>
                        <td class="text-center">
                          <el-input-number v-if="lv.editing" v-model="lv.maxValue" :precision="4" :step="0.1"
                                           size="small" controls-position="right" class="ind-bound-input"/>
                          <span v-else class="rk-mono">{{ lv.maxValue ?? '+∞' }}</span>
                        </td>
                        <td class="text-center">
                          <template v-if="!lv.editing">
                            <button type="button" class="rk-link" @click="startLevelEdit(lv)">编辑</button>
                          </template>
                          <template v-else>
                            <button type="button" class="rk-link" @click="saveLevel(lv)">保存</button>
                            <button type="button" class="rk-link" @click="cancelLevelEdit(lv)">取消</button>
                          </template>
                          <button type="button" class="rk-link is-danger" @click="handleDeleteLevel(lv, ref)">删除</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="ind-add-level">
                  <el-select v-model="newLevelName" filterable allow-create default-first-option
                             class="ind-new-level" size="small"
                             placeholder="选择或输入评级码（如 GOOD / POOR）"
                             @change="addNewLevel(ref)">
                    <el-option v-for="p in availableLevelPresets(ref)" :key="p.code"
                               :label="`${p.code} ${p.name}`" :value="p.code">
                      <span class="ind-opt-code">{{ p.code }}</span>
                      <span class="ind-opt-name">{{ p.name }}</span>
                    </el-option>
                  </el-select>
                  <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" @click="addNewLevel(ref)">
                    <el-icon><Plus /></el-icon>新增评级
                  </button>
                  <button type="button" class="rk-btn rk-btn-sm" @click="bulkAddLevels(ref)">一键三档模板</button>
                  <span class="ind-add-hint">先建空档位（−∞~+∞），再在列表中点「编辑」填写上下限</span>
                </div>
            </div>
          </div>
        </div>
      </el-drawer>

      <!-- ========== 指标 新增/编辑 Dialog（原逻辑保留） ========== -->
      <el-dialog :title="dialogTitle" v-model="showIndicatorDialog" width="520px">
        <el-form ref="indicatorFormRef" :model="indicatorForm" :rules="indicatorRules" label-width="100px">
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="指标编码" prop="code">
                <el-input v-model="indicatorForm.code" placeholder="如 SPRINT_30M" maxlength="50"
                          :disabled="indicatorForm.id != null"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="指标名称" prop="name">
                <el-input v-model="indicatorForm.name" placeholder="如 30米冲刺" maxlength="50"/>
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

      <!-- ========== 参考范围 Dialog（原逻辑保留） ========== -->
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
  </div>
</template>

<script setup name="ApmsIndicator">

// 嵌入模式：由合并页（dispatch/growth/comboDispatch）堆叠使用
defineProps({ embedded: { type: Boolean, default: false } })
import {
  listIndicator, getIndicator, addIndicator, updateIndicator, delIndicator,
  addRef, updateRef, delRef,
  addLevel, updateLevel, delLevel
} from '@/api/apms/indicator'
import { Plus, Delete, RefreshLeft, ArrowLeft, ArrowRight, Close } from '@element-plus/icons-vue'
import { useDrawerOffset, useDrawerSize } from '@/utils/drawerOffset'

const { proxy } = getCurrentInstance()
const { drawerPanelStyle } = useDrawerOffset()
const { drawerSize } = useDrawerSize('760px')

const PAGE_SIZE = 10

// ============ 查询参数 ============
const loading = ref(false)
const indicatorList = ref([])
const total = ref(0)

const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE, code: null, name: null, category: null, evaluationDirection: null })

function getList() {
  loading.value = true
  listIndicator(queryParams).then(res => {
    indicatorList.value = res.rows || []
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
  queryParams.evaluationDirection = null
  queryParams.pageNum = 1
  getList()
  nextTick(() => { filterGuard = false })
}

let filterTimer = null
watch(() => [queryParams.code, queryParams.name, queryParams.category, queryParams.evaluationDirection], () => {
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

// ============ 多选（原生复选列） ============
const ids = ref([])
const multiple = computed(() => !ids.value.length)
const allChecked = computed(() => indicatorList.value.length > 0 && indicatorList.value.every(r => ids.value.includes(r.id)))
function toggleRow(row) {
  const i = ids.value.indexOf(row.id)
  if (i >= 0) ids.value.splice(i, 1); else ids.value.push(row.id)
}
function toggleAll() {
  const every = allChecked.value
  const set = new Set(ids.value)
  indicatorList.value.forEach(r => {
    if (every) set.delete(r.id); else set.add(r.id)
  })
  ids.value = Array.from(set)
}

// ============ KPI 统计（只读全量 + getById 汇总，零后端改动） ============
const stats = reactive({ total: 0, enabled: 0, withRefs: 0, levels: 0 })
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listIndicator({ pageNum: 1, pageSize: 500 }).then(r => {
    if (seq !== statsSeq) return null
    const rows = r.rows || []
    stats.total = r.total || rows.length
    stats.enabled = rows.filter(x => x.status === '0').length
    return Promise.all(rows.map(x => getIndicator(x.id).then(res => res.data).catch(() => null)))
  }).then(details => {
    if (seq !== statsSeq || !details) return
    const refs = details.filter(Boolean).flatMap(d => d.refs || [])
    stats.withRefs = refs.length
    stats.levels = refs.reduce((s, rf) => s + ((rf.levels || []).length), 0)
  })
}
const kpiCards = computed(() => [
  { label: '指标总数', value: stats.total, unit: '项', accent: '#2563EB', chip: '测评基础字典', chipTone: 'tone-info' },
  { label: '启用中', value: stats.enabled, unit: '项', accent: '#16A34A', chip: stats.total - stats.enabled ? `停用 ${stats.total - stats.enabled} 项` : '全部启用', chipTone: stats.total - stats.enabled ? 'tone-warn' : 'tone-ok' },
  { label: '已配参考范围', value: stats.withRefs, unit: '个', accent: '#06B6D4', chip: stats.total ? '覆盖 ' + Math.round(stats.withRefs / stats.total * 100) + '% 指标' : '—', chipTone: '' },
  { label: '评级档总数', value: stats.levels, unit: '档', accent: '#8B5CF6', chip: stats.withRefs ? '平均每范围 ' + (stats.levels / stats.withRefs).toFixed(1) + ' 档' : '暂无范围', chipTone: '' }
])

// ============ 状态切换 ============
// 后端 UPDATE 为全字段内联更新（无动态 <if>），只发 {id,status} 会因 name 等 NOT NULL 列置空而 500，
// 必须带齐列表行中的全部持久化字段（原页遗留缺陷修复）
function handleStatusChange(row) {
  updateIndicator({
    id: row.id, code: row.code, category: row.category, name: row.name, unit: row.unit,
    dataType: row.dataType, evaluationDirection: row.evaluationDirection,
    collectionMethod: row.collectionMethod, status: row.status, version: row.version
  }).then(() => {
    proxy.$modal.msgSuccess('状态已更新')
    loadStats()
  })
}

// ============ 主面板交互（右侧抽屉） ============
const detailDrawerVisible = ref(false)
const currentIndicator = ref(null)
const detail = reactive({ refs: [] })
const detailLoading = ref(false)

function handleRowClick(row) {
  currentIndicator.value = row
  detailDrawerVisible.value = true
  loadDetail(row.id)
}

function loadDetail(id) {
  detailLoading.value = true
  getIndicator(id).then(res => {
    const d = res.data
    detail.refs = (d.refs || []).map(rf => ({ ...rf, levels: (rf.levels || []).map(lv => ({ ...lv, editing: false })) }))
  }).finally(() => { detailLoading.value = false })
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
      loadStats()
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
    ids.value = []
    getList()
    loadStats()
    if (currentIndicator.value && (Array.isArray(selIds) ? selIds.includes(currentIndicator.value.id) : selIds === currentIndicator.value.id)) {
      detailDrawerVisible.value = false
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
  if (refForm.refMin != null && refForm.refMax != null && Number(refForm.refMin) > Number(refForm.refMax)) {
    return proxy.$modal.msgError('参考下限不能大于参考上限')
  }
  const req = refForm.id ? updateRef(refForm) : addRef(refForm)
  req.then(() => {
    proxy.$modal.msgSuccess('保存成功')
    showRefDialogVisible.value = false
    loadDetail(currentIndicator.value.id)
    loadStats()
  })
}
function handleDeleteRef(ref) {
  proxy.$modal.confirm(`确认删除参考范围 [${ref.gender || '通用'} ${ref.ageGroup || ''}]？其下三级判定将一并删除。`).then(() => {
    return delRef(ref.id)
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    loadDetail(currentIndicator.value.id)
    loadStats()
  }).catch(() => {})
}

// ============ Level 内联编辑 ============
const newLevelName = ref('')
// 编辑时的备份（用于取消）
const levelSnapshots = new Map() // key: level.id -> { level, minValue, maxValue }

// Level 名称 → chip 配色的动态映射（支持前后端都未知的新档位）
const LEVEL_TONE_MAP = {
  EXCELLENT: 'is-lv-ok', GOOD: 'is-lv-ok', SUPERIOR: 'is-lv-ok',
  NORMAL: 'is-lv-warn', MEDIUM: 'is-lv-warn', MODERATE: 'is-lv-warn',
  ATTENTION: 'is-lv-risk', POOR: 'is-lv-risk', CRITICAL: 'is-lv-risk', LOW: 'is-lv-risk', WEAK: 'is-lv-risk',
  HIGH: 'is-lv-warn', ELEVATED: 'is-lv-warn',
  DEFAULT: 'is-lv-info'
}

// 评级码预设：下拉可选，也允许自由输入（el-select allow-create）
const LEVEL_NAME_MAP = {
  EXCELLENT: '优秀 ★★★★', GOOD: '良好 ★★★', NORMAL: '正常 ★★',
  ATTENTION: '需关注 ★', POOR: '较差', CRITICAL: '危险'
}
const LEVEL_PRESETS = Object.freeze(
  ['EXCELLENT', 'GOOD', 'NORMAL', 'ATTENTION', 'POOR', 'CRITICAL']
    .map(code => ({ code, name: LEVEL_NAME_MAP[code] }))
)

function levelChipClass(l) { return LEVEL_TONE_MAP[(l || '').toUpperCase()] || LEVEL_TONE_MAP.DEFAULT }
function levelLabel(l) {
  const key = (l || '').toUpperCase()
  return LEVEL_NAME_MAP[key] ? `${key} ${LEVEL_NAME_MAP[key]}` : (l || '—')
}

/** 新增评级下拉：预设码中过滤掉当前参考范围已存在的（大小写不敏感） */
function availableLevelPresets(ref) {
  const owned = new Set((ref.levels || []).map(x => (x.level || '').toUpperCase()))
  return LEVEL_PRESETS.filter(p => !owned.has(p.code))
}

/** 行内编辑下拉：预设码 + 当前行自身值（自定义码也要能正常回显） */
function inlineLevelPresets(lv) {
  const cur = (lv.level || '').trim()
  if (cur && !LEVEL_NAME_MAP[cur.toUpperCase()]) {
    return [{ code: cur, name: '自定义' }, ...LEVEL_PRESETS]
  }
  return LEVEL_PRESETS
}

// 评级码：非空、≤32 字符、不含空白与方括号/逗号（区间告警消息以这些符号拼档位名）
function validateLevelName(raw) {
  const name = (raw || '').trim()
  if (!name) return '评级名称不能为空'
  if (name.length > 32) return '评级名称不能超过 32 个字符'
  if (/\s|[,\[\]]/.test(name)) return '评级名称不能包含空格或 , [ ] 符号'
  return null
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
  const nameErr = validateLevelName(row.level)
  if (nameErr) return proxy.$modal.msgError(nameErr)
  if (row.minValue != null && row.maxValue != null && Number(row.minValue) >= Number(row.maxValue)) {
    return proxy.$modal.msgError(`下限 ${row.minValue} 必须小于上限 ${row.maxValue}`)
  }
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
    loadStats()
  }).catch(() => {})
}

function addNewLevel(ref) {
  const name = (newLevelName.value || '').trim()
  const nameErr = validateLevelName(name)
  if (nameErr) return proxy.$modal.msgWarning(nameErr)
  const exists = ref.levels?.find(x => (x.level || '').toUpperCase() === name.toUpperCase())
  if (exists) return proxy.$modal.msgWarning(`评级 [${exists.level}] 已存在`)
  addLevel({ refId: ref.id, level: name.toUpperCase(), minValue: null, maxValue: null }).then(() => {
    newLevelName.value = ''
    loadDetail(currentIndicator.value.id)
    loadStats()
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
        loadStats()
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
        loadStats()
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

function isLevelRowError(row, allLevels) {
  const issues = getLevelValidationIssues(allLevels)
  // 评级名可能是 Normal / NORMAL 等混合大小写，统一大写比对（原代码大写比对原始大小写文本导致高亮永不生效）
  const level = (row.level || '').toUpperCase()
  return issues.some(i => i.toUpperCase().includes('[' + level + ']'))
}

// ============ 辅助 ============
function dirLabel(d) { return ({ HIGHER_BETTER: '↑ 越大越好', LOWER_BETTER: '↓ 越小越好', RANGE_BEST: '≈ 范围最佳', REFERENCE_ONLY: '— 仅参考' })[d] || d || '—' }
function dirChipClass(d) { return ({ HIGHER_BETTER: 'ind-higher', LOWER_BETTER: 'ind-lower', RANGE_BEST: 'ind-range', REFERENCE_ONLY: 'ind-ref' })[d] || 'ind-ref' }
function categoryChipClass(c) { return ({ '形态': 'ind-cat-form', '机能': 'ind-cat-func', '素质': 'ind-cat-qual', '筛查': 'ind-cat-screen' })[c] || 'ind-cat-form' }
function collectLabel(m) { return ({ manual: '手动录入', csv: 'CSV 导入', device: '设备采集' })[m] || m || '—' }

// ============ 初始化 ============
getList()
loadStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.ind-input-code { width: 160px; }
.ind-input-name { width: 160px; }
.ind-select-sm { width: 110px; }
.ind-select-dir { width: 130px; }

/* 左表 */
.col-check { width: 40px; text-align: center; }
.col-code { width: 120px; }
.col-cat { width: 74px; }
.col-unit { width: 58px; }
.col-dir { width: 96px; }
.col-status { width: 62px; }
.col-ops { width: 96px; }
.rk-empty-cell { padding: 36px 0; }
.ind-table tbody tr { cursor: pointer; }
.ind-code { font-size: 12px; font-weight: 600; color: $rk-brand-600; }

:deep(.rk-link.is-danger) { color: $rk-risk; }
:deep(.rk-link.is-danger:hover) { color: #a13a3a; }

:deep(.rk-soft-chip.ind-higher) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.ind-lower) { background: #fcebeb; color: $rk-risk; }
:deep(.rk-soft-chip.ind-range) { background: #fef3e0; color: #b45309; }
:deep(.rk-soft-chip.ind-ref) { background: #f1f5f9; color: $rk-text-3; }
:deep(.rk-soft-chip.ind-cat-form) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.rk-soft-chip.ind-cat-func) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.ind-cat-qual) { background: #fef3e0; color: #b45309; }
:deep(.rk-soft-chip.ind-cat-screen) { background: #fcebeb; color: $rk-risk; }

:deep(.rk-soft-chip.is-lv-ok) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.is-lv-warn) { background: #fef3e0; color: #b45309; }
:deep(.rk-soft-chip.is-lv-risk) { background: #fcebeb; color: $rk-risk; }
:deep(.rk-soft-chip.is-lv-info) { background: #f1f5f9; color: $rk-text-3; }

/* 详情抽屉（teleport 到 body，头部固定、内容独立滚动） */
.ind-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $rk-canvas;
  overflow: hidden;
}
.ind-drawer-head {
  flex: none;
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; padding: 16px 20px;
  background: #fff; border-bottom: 1px solid $rk-line;
}
.ind-drawer-title { font-size: 16px; font-weight: 700; color: $rk-text-1; line-height: 22px; }
.ind-drawer-sub {
  margin-top: 2px; font-size: 12px; color: $rk-text-3;
  .rk-mono { color: $rk-brand-600; }
}
.ind-drawer-tools { display: flex; align-items: center; gap: 10px; flex: none; }
.ind-drawer-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  color: $rk-text-3; background: none; border: none; border-radius: 8px;
  cursor: pointer; font-size: 16px;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}
.ind-drawer-body {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 16px 20px 28px;
}
.ind-banner {
  padding: 12px 16px;
  margin-bottom: 14px;
  background: linear-gradient(180deg, #f4f7ff, #fff 85%);
  border: 1px solid $rk-line;
  border-radius: 12px;
}
.ind-banner-title {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 15px; font-weight: 700; color: $rk-text-1;
  .rk-mono { color: $rk-brand-600; font-size: 12px; font-weight: 600; }
}
.ind-banner-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  margin-top: 7px; font-size: 12px; color: $rk-text-3;
  b { color: $rk-text-2; font-weight: 600; }
}
.ind-ref-empty {
  padding: 30px 10px;
  border: 1px dashed $rk-line; border-radius: 12px;
}

/* 参考范围卡 */
.ind-ref-card {
  border: 1px solid $rk-line; border-radius: 12px;
  margin-bottom: 14px; overflow: hidden;
  border-left-width: 3px;
  background: #fff;
  &.is-M { border-left-color: #2563eb; }
  &.is-F { border-left-color: #dc2626; }
  &.is-U { border-left-color: #94a3b8; }
}
.ind-ref-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; background: #f8fafc;
  border-bottom: 1px solid $rk-line;
}
.ind-ref-id { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ind-gender {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 30px; height: 20px; padding: 0 9px;
  border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff;
  &.is-m { background: #2563eb; }
  &.is-f { background: #dc2626; }
  &.is-u { background: #94a3b8; }
}
.ind-ref-range { font-size: 12px; color: $rk-text-2; b { color: $rk-text-1; font-weight: 700; margin-left: 3px; } }
.ind-ref-version {
  font-size: 10px; color: $rk-text-3;
  background: #eef2f7; border-radius: 4px; padding: 1px 6px;
}
.ind-ref-actions { display: flex; align-items: center; gap: 4px; }

.ind-alerts {
  padding: 10px 14px 0;
  display: flex; flex-direction: column; gap: 6px;
  :deep(.el-alert) { border-radius: 10px; }
}

/* 三级判定表 */
.ind-level-scroll { margin: 10px 14px 0; border: 1px solid $rk-line; border-radius: 10px; }
.ind-level-table { font-size: 12px; }
.col-lv { width: 150px; }
.col-bound { width: 150px; }
.col-lv-ops { width: 170px; }
.ind-level-table :deep(tr.is-level-error) { background: #fef2f2; }
.ind-level-table :deep(tr.is-level-error td) { border-bottom-color: #f5c6c6; }
.ind-lv-input { width: 145px; }
.ind-bound-input { width: 120px; }

.ind-add-level {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 10px 14px 12px;
}
.ind-new-level { width: 230px; }
.ind-add-hint { margin-left: 4px; font-size: 12px; color: #94A3B8; }
/* 评级码下拉选项：左编码右中文释义 */
.ind-opt-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.ind-opt-name { float: right; font-size: 12px; color: #94A3B8; margin-left: 16px; }

@media (max-width: 768px) {
  .ind-drawer-body { padding: 14px 14px 24px; }
}

/* ===== 嵌入模式：供合并页堆叠（隐藏页头、归零满铺外壳） ===== */
.app-container.is-embedded {
  padding: 0;
  :deep(.rk-dash-page) {
    margin: 0;
    padding: 0;
    min-height: 0;
    background: transparent;
  }
}

</style>

<!-- 全局：el-drawer 面板 teleport 到 body，scoped 选择器无法可靠命中其内部 -->
<style lang="scss">
.el-drawer.ind-drawer-wrap .el-drawer__body {
  padding: 0;
}
</style>
