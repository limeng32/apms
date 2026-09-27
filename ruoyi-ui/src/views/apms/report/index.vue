<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page rp-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">报告中心</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 份 PDF 报告 · 数据快照锁定口径，历史不漂移、可复现
          </p>
        </div>
        <div class="rk-header-actions">
          <button type="button" class="rk-btn rk-btn-primary" @click="openGen"
                  v-hasPermi="['apms:report:generate']">
            <el-icon><Plus /></el-icon>生成新报告
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

      <!-- ===== 筛选卡 ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">报告类型</span>
          <select v-model="queryParams.reportType" class="rk-select rp-select-type">
            <option :value="null">全部类型</option>
            <option v-for="t in typeOpts" :key="t.v" :value="t.v">{{ t.label }}</option>
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

        <!-- 左：报告列表（服务端分页） -->
        <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">PDF 报告</h3>
            <span class="rk-card-sub">共 {{ total }} 份 · 点击行查看快照详情</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table rp-table is-compact">
                <thead>
                  <tr>
                    <th class="text-center col-id">#</th>
                    <th class="text-center col-type">类型</th>
                    <th class="col-subject">主体</th>
                    <th class="col-time">生成时间</th>
                    <th class="text-center col-ver">版本</th>
                    <th class="text-center col-ops">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in reportList" :key="row.id" class="rk-row"
                      :class="{ 'is-selected': current && current.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="text-center rk-mono">{{ row.id }}</td>
                    <td class="text-center">
                      <span class="rk-soft-chip" :class="typeChipClass(row.reportType)">
                        {{ typeLabel(row.reportType) }}
                      </span>
                    </td>
                    <td>
                      <div class="rp-subject">
                        <span class="rp-subject-name">{{ subjectOf(row) }}</span>
                        <span class="rp-subject-sub">{{ subjectSub(row) }}</span>
                      </div>
                    </td>
                    <td class="rk-mono rp-time">{{ formatDateTime(row.generateTime) }}</td>
                    <td class="text-center">
                      <span class="rk-soft-chip rp-ver-chip">{{ row.templateVersion || '—' }}</span>
                    </td>
                    <td class="text-center col-ops">
                      <button type="button" class="rk-link" @click.stop="handleDownload(row)"
                              v-hasPermi="['apms:report:download']">下载</button>
                      <button type="button" class="rk-link is-danger" @click.stop="handleDelete(row)"
                              v-hasPermi="['apms:report:remove']">删</button>
                    </td>
                  </tr>
                  <tr v-if="!loading && reportList.length === 0">
                    <td colspan="6" class="rk-empty-cell">
                      <div class="rk-empty">
                        <p class="rk-empty-title">暂无报告</p>
                        <p class="rk-empty-desc">点击右上角「生成新报告」生成单人 / 任务 / 队伍 PDF 报告</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="rk-pager" v-if="total > 0">
              <span class="rk-pager-info">
                共 <b class="rk-mono">{{ total }}</b> 份 · 第 <span class="rk-mono">{{ queryParams.pageNum }}</span> / {{ totalPages }} 页
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

        <!-- 右：报告详情 -->
        <div class="rk-card rp-detail-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">报告详情</h3>
            <span v-if="current" class="rk-card-sub">
              {{ typeLabel(current.reportType) }} · {{ formatDateTime(current.generateTime) }}
            </span>
            <span v-else class="rk-card-sub">← 点击左侧报告查看</span>
          </div>

          <template v-if="current">
            <!-- 类型 banner -->
            <div class="rp-banner" :class="bannerClass(current.reportType)">
              <div class="rp-banner-id rk-mono">#{{ current.id }}</div>
              <div class="rp-banner-title">
                <span class="rk-soft-chip" :class="typeChipClass(current.reportType)">
                  {{ typeLabel(current.reportType) }}
                </span>
                <span>{{ subjectOf(current) }}</span>
              </div>
              <div class="rp-banner-meta">
                <span v-if="current.athleteName">
                  Athlete: <b>{{ current.athleteName }}（{{ genderText(current.athleteGender) }}/{{ current.athleteTeam || '—' }}）</b>
                </span>
                <span v-if="current.taskName">Task: <b>{{ current.taskName }}</b></span>
                <span v-if="current.deptName">Team: <b>{{ current.deptName }}</b></span>
              </div>
              <div class="rp-banner-foot">
                Generated by <b>{{ current.generateBy || '—' }}</b>
                @ <span class="rk-mono">{{ formatDateTime(current.generateTime) }}</span>
                · Template <b class="rk-mono">{{ current.templateVersion || '—' }}</b>
              </div>
            </div>

            <div class="rk-card-body rp-detail-body" v-loading="detailLoading">
              <!-- 文件状态 -->
              <div class="rp-file">
                <el-icon class="rp-file-icon"><Document /></el-icon>
                <span class="rp-file-name">{{ current.filePath?.split('/').pop() || '未生成' }}</span>
                <span v-if="current.filePath" class="rk-soft-chip rp-file-ready">PDF Ready</span>
                <span v-else class="rk-soft-chip rp-file-missing">No File</span>
              </div>

              <!-- JSON 快照 -->
              <div class="rp-section-title">
                Data Snapshot 🔒
                <span class="rp-privacy-note">历史不漂移 · 可复现</span>
              </div>
              <div class="rp-snapshot">
                <pre>{{ formatSnapshot(current.contentSnapshot) }}</pre>
              </div>

              <!-- 下载 -->
              <div v-if="current.filePath" class="rp-download-bar">
                <button type="button" class="rk-btn rk-btn-sm rk-btn-primary" @click="handleDownload(current)"
                        v-hasPermi="['apms:report:download']">
                  <el-icon><Download /></el-icon>下载 PDF 报告
                </button>
                <span class="rp-file-path rk-mono">{{ current.filePath }}</span>
              </div>
              <div v-else class="rp-no-file">
                <div class="rk-empty">
                  <p class="rk-empty-title">PDF 文件未生成</p>
                  <p class="rk-empty-desc">该报告仅保留数据快照，无 PDF 产物</p>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="rp-detail-empty">
            <div class="rk-empty">
              <p class="rk-empty-title">选择左侧报告查看详情</p>
              <p class="rk-empty-desc">报告头信息、PDF 文件状态与生成时的数据快照将在此展示</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 生成 Dialog（原逻辑保留） ========== -->
      <el-dialog title="生成新报告" v-model="showGenDialog" width="520px">
        <el-form :model="genForm" :rules="genRules" ref="genFormRef" label-width="100px">
          <el-form-item label="报告类型" prop="reportType">
            <el-radio-group v-model="genForm.reportType">
              <el-radio value="INDIVIDUAL">单人综合</el-radio>
              <el-radio value="TASK">任务报告</el-radio>
              <el-radio value="TEAM">队伍汇总</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="genForm.reportType === 'INDIVIDUAL'" label="运动员" prop="athleteId">
            <el-select v-model="genForm.athleteId" placeholder="选运动员" filterable style="width:100%">
              <el-option v-for="a in athleteOpts" :key="a.athleteId"
                         :label="a.name + '（' + genderText(a.gender) + '）'" :value="a.athleteId"/>
            </el-select>
          </el-form-item>
          <el-form-item v-if="genForm.reportType === 'TASK'" label="测试任务" prop="taskId">
            <el-select v-model="genForm.taskId" placeholder="选任务" filterable style="width:100%">
              <el-option v-for="t in taskOpts" :key="t.id" :label="t.taskName" :value="t.id"/>
            </el-select>
          </el-form-item>
          <el-form-item v-if="genForm.reportType === 'TEAM'" label="队伍" prop="deptId">
            <el-tree-select v-model="genForm.deptId" :data="deptOpts" filterable
                            :props="{ label: 'deptName', value: 'deptId' }" style="width:100%"/>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showGenDialog = false">取 消</el-button>
          <el-button type="primary" :loading="genLoading" @click="submitGen">生成</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup name="ApmsReport">
import { listReport, getReport, generateReport, delReport, downloadReportUrl } from '@/api/apms/report'
import { listTestTask } from '@/api/apms/testTask'
import { listAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'
import { getToken } from '@/utils/auth'
import { Plus, RefreshLeft, ArrowLeft, ArrowRight, Download, Document } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()

const PAGE_SIZE = 10

// ========= 字典 =========
const typeOpts = [
  { v: 'INDIVIDUAL', label: '单人综合' },
  { v: 'TASK',       label: '任务报告' },
  { v: 'TEAM',       label: '队伍汇总' }
]
function typeLabel(t) { return typeOpts.find(x => x.v === t)?.label || t }
function typeChipClass(t) {
  return ({ INDIVIDUAL: 'rp-type-ind', TASK: 'rp-type-task', TEAM: 'rp-type-team' })[t] || ''
}
function bannerClass(t) {
  return ({ INDIVIDUAL: 'is-individual', TASK: 'is-task', TEAM: 'is-team' })[t] || ''
}
function genderText(g) { return g === 'F' ? '女' : '男' }
function subjectOf(row) { return row.athleteName || row.taskName || row.deptName || '—' }
function subjectSub(row) {
  if (row.reportType === 'INDIVIDUAL') {
    return [genderText(row.athleteGender), row.athleteTeam].filter(Boolean).join(' · ')
  }
  return ({ TASK: '测试任务', TEAM: '部门队伍' })[row.reportType] || ''
}

// ========= 查询 =========
const loading = ref(false)
const reportList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE, reportType: null })

function getList() {
  loading.value = true
  listReport(queryParams).then(r => { reportList.value = r.rows; total.value = r.total }).finally(() => { loading.value = false })
}
function handleQuery() { queryParams.pageNum = 1; getList() }

let filterGuard = false
function resetQuery() {
  filterGuard = true
  queryParams.reportType = null
  queryParams.pageNum = 1
  getList()
  nextTick(() => { filterGuard = false })
}

let filterTimer = null
watch(() => queryParams.reportType, () => {
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

// ========= KPI 统计 =========
const stats = reactive({ total: 0, INDIVIDUAL: 0, TASK: 0, TEAM: 0 })
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listReport({ pageNum: 1, pageSize: 500 }).then(r => {
    if (seq !== statsSeq) return
    const rows = r.rows || []
    stats.total = r.total || rows.length
    stats.INDIVIDUAL = rows.filter(x => x.reportType === 'INDIVIDUAL').length
    stats.TASK = rows.filter(x => x.reportType === 'TASK').length
    stats.TEAM = rows.filter(x => x.reportType === 'TEAM').length
  })
}
const kpiCards = computed(() => [
  { label: '报告总数', value: stats.total, unit: '份', accent: '#2563EB', chip: '快照可复现', chipTone: 'tone-info' },
  { label: '单人综合', value: stats.INDIVIDUAL, unit: '份', accent: '#06B6D4', chip: 'INDIVIDUAL', chipTone: '' },
  { label: '任务报告', value: stats.TASK, unit: '份', accent: '#16A34A', chip: 'TASK', chipTone: '' },
  { label: '队伍汇总', value: stats.TEAM, unit: '份', accent: '#D97706', chip: 'TEAM', chipTone: '' }
])

// ========= 辅助下拉 =========
const athleteOpts = ref([]), taskOpts = ref([]), deptOpts = ref([])
listAthlete({ pageNum: 1, pageSize: 300 }).then(r => { athleteOpts.value = r.rows || [] })
listTestTask({ pageNum: 1, pageSize: 200 }).then(r => { taskOpts.value = r.rows || [] })
listDept({ pageNum: 1, pageSize: 500 }).then(r => { deptOpts.value = r.data || [] })

// ========= 主从 =========
const current = ref(null)
const detailLoading = ref(false)
function handleRowClick(row) {
  current.value = row
  detailLoading.value = true
  getReport(row.id).then(r => {
    if (current.value?.id !== row.id) return
    current.value = r.data
  }).finally(() => { detailLoading.value = false })
}

// ========= 生成 =========
const showGenDialog = ref(false)
const genLoading = ref(false)
const genFormRef = ref(null)
const genForm = reactive({ reportType: 'INDIVIDUAL', athleteId: null, taskId: null, deptId: null })
// 修复原页缺陷：rules 的 key 原为 INDIVIDUAL/TASK/TEAM，与表单项 prop（athleteId/taskId/deptId）不匹配，条件必填从未生效
const genRules = {
  athleteId: [{ required: true, message: '请选运动员', trigger: 'change' }],
  taskId: [{ required: true, message: '请选测试任务', trigger: 'change' }],
  deptId: [{ required: true, message: '请选队伍', trigger: 'change' }]
}

function openGen() {
  // 每次打开重置（修复原页残留：上次生成的 id 会被无条件带入下一次生成参数）
  Object.assign(genForm, { reportType: 'INDIVIDUAL', athleteId: null, taskId: null, deptId: null })
  showGenDialog.value = true
  nextTick(() => genFormRef.value?.clearValidate())
}
function submitGen() {
  genFormRef.value.validate(valid => {
    if (!valid) return
    genLoading.value = true
    const params = { reportType: genForm.reportType }
    if (genForm.athleteId) params.athleteId = genForm.athleteId
    if (genForm.taskId) params.taskId = genForm.taskId
    if (genForm.deptId) params.deptId = genForm.deptId
    generateReport(params).then(() => {
      proxy.$modal.msgSuccess('报告生成成功 📄')
      showGenDialog.value = false
      getList()
      loadStats()
    }).finally(() => { genLoading.value = false })
  })
}

// ========= 操作 =========
async function handleDownload(row) {
  // 修复原页缺陷：裸相对路径缺 /dev-api 前缀且读 localStorage（本项目 token 在 Cookie），dev 下必失败；
  // 改为带鉴权头的 blob 下载，并识别 200+JSON 业务错误（如 PDF 物理文件被清理）而非把错误体存成 .pdf
  try {
    const res = await fetch(import.meta.env.VITE_APP_BASE_API + downloadReportUrl(row.id), {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    })
    if (!res.ok) {
      proxy.$modal.msgError('下载失败或无下载权限')
      return
    }
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const errBody = await res.json().catch(() => null)
      proxy.$modal.msgError(errBody?.msg || '下载失败')
      return
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = row.filePath?.split('/').pop() || 'report.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    proxy.$modal.msgError('下载失败')
  }
}

function handleDelete(row) {
  proxy.$modal.confirm('确认删除该报告？PDF 文件一并清理。').then(() => delReport(row.id))
    .then(() => {
      proxy.$modal.msgSuccess('已删除')
      if (current.value?.id === row.id) current.value = null
      getList()
      loadStats()
    }).catch(() => {})
}

function formatSnapshot(snap) {
  if (!snap) return '(empty)'
  try {
    return JSON.stringify(JSON.parse(snap), null, 2)
  } catch { return snap }
}
function formatDateTime(d) { if (!d) return ''; return String(d).substring(0, 19).replace('T', ' ') }

getList()
loadStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rp-select-type { width: 160px; }

/* 左表 */
.col-id { width: 48px; }
.col-type { width: 88px; }
.col-time { width: 150px; }
.col-ver { width: 72px; }
.col-ops { width: 104px; }
.rk-empty-cell { padding: 36px 0; }
.rp-table tbody tr { cursor: pointer; }
.rp-time { font-size: 12px; color: $rk-text-2; }
.rp-subject { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rp-subject-name {
  font-size: 13px; font-weight: 600; color: $rk-text-1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rp-subject-sub { font-size: 11px; color: $rk-text-3; }

:deep(.rk-link.is-danger) { color: $rk-risk; }
:deep(.rk-link.is-danger:hover) { color: #a13a3a; }

:deep(.rk-soft-chip.rp-type-ind) { background: $rk-brand-50; color: $rk-brand-600; }
:deep(.rk-soft-chip.rp-type-task) { background: #e8f7ee; color: $rk-ok; }
:deep(.rk-soft-chip.rp-type-team) { background: #fdf1d6; color: #9a6b13; }
:deep(.rk-soft-chip.rp-ver-chip) { background: #f1f5f9; color: $rk-text-3; font-family: var(--app-font-mono); }
:deep(.rk-soft-chip.rp-file-ready) { background: #e8f7ee; color: $rk-ok; margin-left: auto; }
:deep(.rk-soft-chip.rp-file-missing) { background: #f1f5f9; color: $rk-text-3; margin-left: auto; }

/* 右详情 */
.rp-detail-card { overflow: hidden; }
.rp-detail-empty { padding: 80px 20px; }

.rp-banner {
  padding: 14px 18px;
  border-bottom: 1px solid $rk-line;
  &.is-individual { background: linear-gradient(180deg, #eef4ff, #fff 85%); }
  &.is-task { background: linear-gradient(180deg, #eefaf1, #fff 85%); }
  &.is-team { background: linear-gradient(180deg, #fdf5e7, #fff 85%); }
}
.rp-banner-id { font-size: 11px; color: $rk-text-3; margin-bottom: 4px; }
.rp-banner-title {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 16px; font-weight: 700; color: $rk-text-1;
}
.rp-banner-meta {
  margin-top: 6px; font-size: 12px; color: $rk-text-2;
  b { color: $rk-text-1; font-weight: 700; }
}
.rp-banner-foot {
  margin-top: 5px; font-size: 11px; color: $rk-text-3;
  b { color: $rk-text-2; font-weight: 600; }
}

.rp-detail-body { padding-top: 14px; }

/* 文件状态 */
.rp-file {
  display: flex; align-items: center; gap: 10px;
  border: 1px solid $rk-line; border-radius: 12px;
  padding: 10px 14px; margin-bottom: 14px;
  background: #fff;
}
.rp-file-icon { font-size: 22px; color: $rk-brand-600; }
.rp-file-name {
  font-size: 13px; font-weight: 600; color: $rk-text-1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* JSON 快照 */
.rp-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700; color: $rk-text-1;
  margin: 14px 0 8px; padding-left: 9px;
  border-left: 3px solid $rk-brand-600;
}
.rp-privacy-note { margin-left: auto; font-size: 11px; font-weight: 400; color: $rk-ok; }
.rp-snapshot {
  background: #14181f; color: #c9d4e3;
  border-radius: 12px; padding: 12px 16px;
  font-family: var(--app-font-mono);
  font-size: 12px; line-height: 1.6;
  max-height: 300px; overflow: auto;
  pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
}

/* 下载条 */
.rp-download-bar {
  display: flex; align-items: center; gap: 12px;
  margin-top: 14px; padding: 10px 14px;
  background: #f4f8ff; border: 1px solid #d6e4fb; border-radius: 12px;
}
.rp-file-path {
  font-size: 11px; color: $rk-text-3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rp-no-file {
  margin-top: 14px; padding: 24px 10px;
  border: 1px dashed $rk-line; border-radius: 12px;
}
</style>
