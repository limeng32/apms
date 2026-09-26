<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page tr-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">测试结果</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 条结果 · {{ stats.athletes }} 名队员 · {{ stats.selected }} 条已选最佳 · 尝试记录与 REP 评价
          </p>
        </div>
        <div class="rk-header-actions">
          <el-button class="rk-btn rk-btn-primary" :disabled="!hasImportPerm" @click="importDialogRef?.open()">
            <el-icon><Upload /></el-icon>CSV 批量导入
          </el-button>
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

      <!-- ===== 筛选（原生控件；默认只看已选最佳） ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">关联任务</span>
          <select v-model="queryParams.taskId" class="rk-select tr-select-task">
            <option :value="null">全部任务</option>
            <option v-for="t in taskOptions" :key="t.id" :value="t.id">{{ t.taskName }}</option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">运动员</span>
          <select v-model="queryParams.athleteId" class="rk-select">
            <option :value="null">全部运动员</option>
            <option v-for="a in athleteOptions" :key="a.athleteId" :value="a.athleteId">{{ a.name }}</option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">类型</span>
          <select v-model="queryParams.itemType" class="rk-select tr-select-sm">
            <option :value="null">全部类型</option>
            <option value="INDICATOR">指标</option>
            <option value="MODEL">模型</option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">选中</span>
          <select v-model="queryParams.isSelected" class="rk-select tr-select-sm">
            <option :value="null">全部</option>
            <option value="1">已选中</option>
            <option value="0">未选中</option>
          </select>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetQuery">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 主从双栏 ===== -->
      <div class="rk-split-grid" style="--rk-split-l: 11fr; --rk-split-r: 13fr;">

        <!-- 左：结果列表（服务端分页） -->
        <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">测试结果</h3>
            <span class="rk-card-sub">共 {{ total }} 条 · 点击行查看详情</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table tr-table">
                <thead>
                  <tr>
                    <th class="text-center col-id">#</th>
                    <th class="col-athlete">运动员</th>
                    <th class="text-center col-type">类型</th>
                    <th class="col-item">项目</th>
                    <th class="text-center col-attempt">尝试</th>
                    <th class="text-center col-date">日期</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in resultList" :key="row.id"
                      class="rk-row"
                      :class="{ 'is-selected': current && current.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="text-center rk-mono">{{ row.id }}</td>
                    <td>
                      <div class="tr-athlete">
                        <span class="tr-name">{{ row.athleteName }}</span>
                        <span class="tr-gender" :class="row.athleteGender === 'F' ? 'is-f' : 'is-m'">
                          {{ row.athleteGender === 'F' ? '♀' : '♂' }}
                        </span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span class="rk-soft-chip" :class="row.itemType === 'INDICATOR' ? 'is-indicator' : 'is-model'">
                        {{ row.itemType === 'INDICATOR' ? '指标' : '模型' }}
                      </span>
                    </td>
                    <td>
                      <div class="tr-item">
                        <span class="tr-code rk-mono">{{ row.indicatorCode || row.modelCode }}</span>
                        <span class="tr-item-name">{{ row.indicatorName || row.modelName }}</span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span v-if="row.isSelected === '1'" class="tr-attempt is-star">★{{ row.attemptNo }}</span>
                      <span v-else class="tr-attempt is-alt">#{{ row.attemptNo }}</span>
                    </td>
                    <td class="text-center rk-mono">{{ formatDate(row.measureDate) }}</td>
                  </tr>
                  <tr v-if="!loading && resultList.length === 0">
                    <td colspan="6" class="rk-empty-cell">
                      <div class="rk-empty">
                        <p class="rk-empty-title">暂无结果</p>
                        <p class="rk-empty-desc">调整筛选条件，或先通过 CSV 导入成绩</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rk-pager" v-if="total > 0">
              <span class="rk-pager-info">
                共 <b class="rk-mono">{{ total }}</b> 条 · 第 <span class="rk-mono">{{ queryParams.pageNum }}</span> / {{ totalPages }} 页
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

        <!-- 右：结果详情 -->
        <div class="rk-card tr-detail-card">
          <template v-if="current">
            <div class="tr-detail-banner">
              <span class="rk-soft-chip tr-type-lg" :class="current.itemType === 'INDICATOR' ? 'is-indicator' : 'is-model'">
                {{ current.itemType === 'INDICATOR' ? '指标' : '模型' }}
              </span>
              <div class="tr-banner-info">
                <div class="tr-banner-title">
                  <span class="rk-mono">{{ current.indicatorCode || current.modelCode }}</span>
                  {{ current.indicatorName || current.modelName }}
                </div>
                <div class="tr-banner-meta">
                  <span class="rk-soft-chip">{{ current.athleteName }}（{{ current.athleteTeam || '无队伍' }}）</span>
                  <span class="rk-mono">{{ formatDate(current.measureDate) }}</span>
                  <span class="tr-dir-banner" :class="dirClass(current.indicatorDirection)">
                    {{ dirLabel(current.indicatorDirection) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="rk-card-body tr-detail-body" v-loading="detailLoading">

              <!-- Attempt 历史 -->
              <template v-if="attempts.length">
                <div class="tr-section-title">
                  同项目尝试记录
                  <span class="tr-section-count rk-mono">{{ attempts.length }}</span>
                  <span class="tr-section-hint">方向：{{ dirLabel(current.indicatorDirection) }}</span>
                </div>
                <div class="rk-table-scroll tr-attempt-scroll">
                  <table class="rk-table tr-attempt-table">
                    <thead>
                      <tr>
                        <th class="text-center">尝试</th>
                        <th class="text-center">日期</th>
                        <th class="text-center">状态</th>
                        <th>值</th>
                        <th class="text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="a in attempts" :key="a.id">
                        <td class="text-center">
                          <span v-if="a.isSelected === '1'" class="tr-attempt is-star">★{{ a.attemptNo }}</span>
                          <span v-else class="tr-attempt is-alt">#{{ a.attemptNo }}</span>
                        </td>
                        <td class="text-center rk-mono">{{ formatDate(a.measureDate) }}</td>
                        <td class="text-center">
                          <span v-if="a.isSelected === '1'" class="rk-status-badge tone-green">✓ 已选</span>
                          <span v-else class="rk-status-badge tone-gray">备选</span>
                        </td>
                        <td>
                          <template v-if="a.values && a.values.length">
                            <template v-for="(v, idx) in a.values.filter(vv => vv.isDerived !== '1')" :key="v.id || idx">
                              <span class="tr-attempt-value rk-mono">{{ v.numericValue ?? v.textValue }}<i>{{ v.unit }}</i></span>
                              <span v-if="idx < a.values.filter(vv => vv.isDerived !== '1').length - 1" class="tr-value-sep">/</span>
                            </template>
                          </template>
                          <span v-else class="rk-dash">—</span>
                        </td>
                        <td class="text-center">
                          <button v-if="a.isSelected !== '1'" type="button" class="rk-link"
                                  :disabled="selectingId != null"
                                  @click="handleSelectAttempt(a)">选为最佳</button>
                          <span v-else class="rk-dash">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="attempts.length > 1" class="tr-tip">
                  自动选最佳按方向（{{ dirLabel(current.indicatorDirection) }}）判定；手动「选为最佳」可覆盖。
                </div>
              </template>

              <!-- 测试值 -->
              <div class="tr-section-title">
                测试值
                <span class="tr-section-count rk-mono">{{ current.values ? current.values.length : 0 }}</span>
              </div>
              <div v-if="current.values && current.values.length" class="tr-values-grid">
                <div v-for="v in current.values" :key="v.id" class="tr-value-card" :class="{ 'is-derived': v.isDerived === '1' }">
                  <div class="tr-value-key">
                    <span class="rk-mono">{{ v.fieldKey }}</span>
                    <span v-if="v.isDerived === '1'" class="tr-derived-tag">派生</span>
                  </div>
                  <div class="tr-value-num rk-mono">
                    {{ v.numericValue ?? v.textValue ?? '—' }}<i>{{ v.unit }}</i>
                  </div>
                  <div v-if="v.fieldName && v.fieldName !== v.fieldKey" class="tr-value-label">{{ v.fieldName }}</div>
                </div>
              </div>
              <div v-else class="tr-mini-empty">暂无值</div>

              <!-- REP 评价 -->
              <div class="tr-section-title tr-rep-title">
                REP 评价
                <span v-if="current.indicatorDirection" class="tr-section-hint">方向：{{ dirLabel(current.indicatorDirection) }}</span>
              </div>
              <div v-if="current.reps && current.reps.length" class="tr-rep-list">
                <div v-for="rep in current.reps" :key="rep.id" class="tr-rep-item" :class="'rep-' + rep.repNo">
                  <div class="tr-rep-level">{{ repLevelLabel(rep.repNo) }}</div>
                  <div class="tr-rep-value rk-mono">{{ rep.value }}<i>{{ rep.unit }}</i></div>
                  <div class="tr-rep-bar"><div :style="{ width: (25 * rep.repNo) + '%' }"></div></div>
                </div>
              </div>
              <div v-else class="tr-mini-empty">无 REP 评价（模型或缺少参照系）</div>
            </div>
          </template>

          <div v-else class="tr-detail-empty">
            <div class="rk-empty">
              <p class="rk-empty-title">选择左侧结果查看详情</p>
              <p class="rk-empty-desc">尝试历史、测试值与 REP 评价将在此展示</p>
            </div>
          </div>
        </div>
      </div>

      <!-- CSV 导入对话框（原逻辑保留） -->
      <csv-import-dialog ref="importDialogRef" action="/apms/test-result/import/csv" @success="handleImportSuccess" />
    </div>
  </div>
</template>

<script setup name="ApmsTestResult">
import { listTestResult, getTestResult, listByTaskMember, selectAttempt } from '@/api/apms/testResult'
import { listTestTask } from '@/api/apms/testTask'
import { listAthlete } from '@/api/apms/athlete'
import CsvImportDialog from '@/components/CsvImportDialog/index.vue'
import { checkPermi } from '@/utils/permission'
import { Upload, RefreshLeft, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()

const PAGE_SIZE = 10

// ========= CSV 导入 =========
const importDialogRef = ref(null)
// 修复原页缺陷：proxy.$checkPermi 全局未注册（main.js 无此挂载）且 checkPermi 要求传数组（原传字符串），
// 导致 hasImportPerm 恒为 undefined、导入按钮恒禁用
const hasImportPerm = computed(() => checkPermi(['apms:testResult:add']))
function handleImportSuccess() { getList(); loadStats() }

// ========= 查询（服务端分页，默认只看已选最佳） =========
const loading = ref(false)
const resultList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE, taskId: null, athleteId: null, itemType: null, isSelected: '1' })

function getList() {
  loading.value = true
  listTestResult(queryParams).then(res => {
    resultList.value = res.rows || []
    total.value = res.total || 0
  }).finally(() => { loading.value = false })
}
function handleQuery() { queryParams.pageNum = 1; getList() }

let filterGuard = false
function resetQuery() {
  filterGuard = true
  queryParams.taskId = null
  queryParams.athleteId = null
  queryParams.itemType = null
  queryParams.isSelected = '1'
  queryParams.pageNum = 1
  getList()
  nextTick(() => { filterGuard = false })
}

let filterTimer = null
watch(() => [queryParams.taskId, queryParams.athleteId, queryParams.itemType, queryParams.isSelected], () => {
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

// ========= KPI 统计（只读全量一次，不新增后端接口） =========
const stats = reactive({ total: 0, athletes: 0, selected: 0, tasks: 0 })
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listTestResult({ pageNum: 1, pageSize: 500 }).then(r => {
    if (seq !== statsSeq) return
    const rows = r.rows || []
    stats.total = r.total || 0
    stats.athletes = new Set(rows.map(x => x.athleteId).filter(Boolean)).size
    stats.selected = rows.filter(x => x.isSelected === '1').length
    stats.tasks = new Set(rows.map(x => x.taskId).filter(Boolean)).size
  })
}
const kpiCards = computed(() => [
  { label: '测试结果总数', value: stats.total, unit: '条', accent: '#2563EB', chip: '按 DataScope 隔离', chipTone: 'tone-info' },
  { label: '涉及队员', value: stats.athletes, unit: '人', accent: '#06B6D4', chip: '人均 ' + (stats.athletes ? (stats.total / stats.athletes).toFixed(1) : '0') + ' 条结果', chipTone: '' },
  { label: '已选最佳', value: stats.selected, unit: '条', accent: '#16A34A', chip: stats.total ? '占比 ' + Math.round(stats.selected / stats.total * 100) + '%' : '—', chipTone: 'tone-ok' },
  { label: '关联任务', value: stats.tasks, unit: '个', accent: '#8B5CF6', chip: '每任务含多次尝试', chipTone: '' }
])

// ========= 辅助下拉 =========
const taskOptions = ref([])
const athleteOptions = ref([])
listTestTask({ pageNum: 1, pageSize: 200 }).then(r => { taskOptions.value = r.rows || [] })
listAthlete({ pageNum: 1, pageSize: 300 }).then(r => { athleteOptions.value = r.rows || [] })

// ========= 主从 =========
const current = ref(null)
const attempts = ref([])
const detailLoading = ref(false)
const selectingId = ref(null)  // 手动选为最佳的锁

function handleRowClick(row) {
  current.value = row
  loadDetail(row.id)
}
function loadDetail(id) {
  detailLoading.value = true
  attempts.value = []
  getTestResult(id).then(res => {
    current.value = res.data
    // 查同 athlete + task_item 下的所有 attempt
    if (res.data && res.data.taskId && res.data.taskItemId && res.data.athleteId) {
      listByTaskMember(res.data.taskId, res.data.athleteId).then(r => {
        attempts.value = (r.data || []).filter(x => x.taskItemId === res.data.taskItemId)
      }).finally(() => { detailLoading.value = false })
    } else {
      detailLoading.value = false
    }
  }).catch(() => { detailLoading.value = false })
}

// ========= 手动选最佳 =========
function handleSelectAttempt(row) {
  if (selectingId.value != null) return
  proxy.$modal.confirm(`确认将 attempt #${row.attemptNo} 选为最佳？原来的选中项会被覆盖。`).then(() => {
    selectingId.value = row.id
    return selectAttempt(row.id)
  }).then(() => {
    proxy.$modal.msgSuccess(`已将 attempt #${row.attemptNo} 选为最佳`)
    selectingId.value = null
    // 刷新：左侧列表（选中项变了）+ 统计 + 右侧详情
    getList()
    loadStats()
    loadDetail(row.id)
  }).catch(() => { selectingId.value = null })
}

// ========= 辅助 =========
function formatDate(d) { if (!d) return ''; return String(d).substring(0, 10) }
function dirLabel(d) { return ({ HIGHER_BETTER: '↑越大越好', LOWER_BETTER: '↓越小越好', RANGE_BEST: '≈范围' })[d] || d || '—' }
function dirClass(d) { return ({ HIGHER_BETTER: 'higher', LOWER_BETTER: 'lower' })[d] || '' }
function repLevelLabel(n) { return [null, 'Excellent ★★★★', 'Good ★★★', 'Normal ★★', 'Poor ★'][n] || '—' }

getList()
loadStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.tr-select-task { width: 200px; }
.tr-select-sm { width: 110px; }

/* 左表 */
.tr-table tbody tr { cursor: pointer; }
.col-id { width: 52px; }
.col-athlete { width: 104px; }
.col-type { width: 68px; }
.col-attempt { width: 64px; }
.col-date { width: 104px; }
.rk-empty-cell { padding: 36px 0; }

.tr-athlete { display: flex; align-items: center; gap: 6px; }
.tr-name { font-size: 13px; font-weight: 600; color: $rk-text-1; }
.tr-gender {
  display: inline-flex; align-items: center; justify-content: center;
  width: 17px; height: 17px; border-radius: 50%;
  font-size: 11px; font-style: normal; font-weight: 700; line-height: 1;
  &.is-m { background: #eff5ff; color: #2563eb; }
  &.is-f { background: #fdeef1; color: #dc2626; }
}
.tr-item { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tr-code { font-size: 12px; font-weight: 600; color: $rk-brand-600; }
.tr-item-name {
  font-size: 12px; color: $rk-text-3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tr-attempt {
  display: inline-block; min-width: 30px; padding: 1px 7px;
  border-radius: 999px; font-size: 12px; font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  &.is-star { background: #e8f7ee; color: $rk-ok; }
  &.is-alt { color: $rk-text-3; background: #f1f5f9; }
}

:deep(.rk-soft-chip.is-indicator) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.rk-soft-chip.is-model) { background: #e8f7ee; color: $rk-ok; }

/* 右详情 */
.tr-detail-card { overflow: hidden; }
.tr-detail-empty { padding: 80px 20px; }
.tr-detail-banner {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: linear-gradient(180deg, #f4f7ff, #fff 85%);
  border-bottom: 1px solid $rk-line;
}
.tr-type-lg { font-size: 12px; padding: 3px 10px; }
.tr-banner-title {
  font-size: 16px; font-weight: 700; color: $rk-text-1;
  .rk-mono { color: $rk-brand-600; margin-right: 8px; font-size: 13px; }
}
.tr-banner-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 5px; }
.tr-dir-banner {
  font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
  &.higher { background: #e8f7ee; color: $rk-ok; }
  &.lower { background: #fef3e0; color: $rk-warn; }
}
.tr-detail-body { padding-top: 16px; }

.tr-section-title {
  display: flex; align-items: center; gap: 8px;
  margin: 18px 0 10px;
  font-size: 13px; font-weight: 700; color: $rk-text-1;
  &:first-child { margin-top: 0; }
  &::before {
    content: ''; width: 3px; height: 13px; border-radius: 2px; background: $rk-brand-600;
  }
}
.tr-rep-title::before { background: $rk-warn; }
.tr-section-count {
  font-size: 11px; font-weight: 600; color: $rk-brand-600;
  background: $rk-brand-50; border-radius: 999px; padding: 0 7px; line-height: 17px;
}
.tr-section-hint { font-size: 11px; font-weight: 400; color: $rk-text-3; }

/* Attempt 表 */
.tr-attempt-scroll { border: 1px solid $rk-line; border-radius: 12px; }
.tr-attempt-table { font-size: 12px; }
.tr-attempt-value { font-size: 13px; font-weight: 700; color: $rk-text-1; i { font-style: normal; font-size: 11px; font-weight: 500; color: $rk-text-3; margin-left: 2px; } }
.tr-value-sep { margin: 0 5px; color: $rk-text-3; }
.tr-tip {
  margin-top: 8px; padding: 7px 12px;
  font-size: 12px; color: $rk-text-2; line-height: 1.6;
  background: #f8faff; border: 1px solid $rk-line; border-radius: 10px;
}

/* 测试值网格 */
.tr-values-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.tr-value-card {
  padding: 11px 13px;
  background: #f8faff;
  border: 1px solid #e3eaff;
  border-radius: 12px;
  &.is-derived { background: #f8fafc; border-color: $rk-line; }
}
.tr-value-key {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  font-size: 11px; font-weight: 600; color: $rk-text-3; margin-bottom: 5px;
}
.tr-derived-tag {
  font-size: 10px; font-weight: 600; color: $rk-text-3;
  background: #eef2f7; border-radius: 999px; padding: 0 6px; line-height: 16px;
}
.tr-value-num {
  font-size: 22px; font-weight: 700; color: $rk-brand-600; line-height: 1.15;
  i { font-style: normal; font-size: 11px; font-weight: 500; color: $rk-text-3; margin-left: 3px; }
  .is-derived & { color: $rk-text-2; }
}
.tr-value-label { font-size: 11px; color: $rk-text-3; margin-top: 3px; }
.tr-mini-empty {
  padding: 14px; text-align: center; font-size: 12px; color: $rk-text-3;
  background: #f8fafc; border: 1px dashed $rk-line; border-radius: 12px;
}

/* REP */
.tr-rep-list { display: flex; flex-direction: column; gap: 8px; }
.tr-rep-item {
  display: grid; grid-template-columns: 140px 110px minmax(0, 1fr);
  gap: 14px; align-items: center;
  padding: 9px 14px; border-radius: 12px; border: 1px solid transparent;
  &.rep-1 { background: #eefaf2; border-color: #bfe6cd; .tr-rep-level { color: $rk-ok; } .tr-rep-bar div { background: $rk-ok; } }
  &.rep-2 { background: #fffaf0; border-color: #f4dfb6; .tr-rep-level { color: $rk-warn; } .tr-rep-bar div { background: $rk-warn; } }
  &.rep-3 { background: #f8fafc; border-color: $rk-line; .tr-rep-level { color: $rk-text-2; } .tr-rep-bar div { background: #94a3b8; } }
  &.rep-4 { background: #fef2f2; border-color: #f5c6c6; .tr-rep-level { color: $rk-risk; } .tr-rep-bar div { background: $rk-risk; } }
}
.tr-rep-level { font-size: 12px; font-weight: 700; }
.tr-rep-value { font-size: 17px; font-weight: 700; color: $rk-text-1; i { font-style: normal; font-size: 11px; font-weight: 500; color: $rk-text-3; margin-left: 2px; } }
.tr-rep-bar { height: 6px; border-radius: 999px; background: rgba(15, 23, 42, .07); overflow: hidden; }
.tr-rep-bar div { height: 100%; border-radius: 999px; transition: width .3s ease; }

@media (max-width: 1280px) {
  .tr-rep-item { grid-template-columns: 120px 90px minmax(0, 1fr); }
}
</style>
