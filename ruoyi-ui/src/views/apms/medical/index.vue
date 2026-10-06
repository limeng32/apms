<template>
  <div class="app-container">
    <div class="rk-dash-page rk-page md-page">

      <!-- ===== 页头 ===== -->
      <div class="rk-header">
        <div>
          <h1 class="rk-title">医疗康复</h1>
          <p class="rk-subtitle">
            {{ stats.total }} 条康复记录 · {{ stats.athletes }} 名队员 · {{ stats.files }} 份附件 · 伤病台账与影像归档
          </p>
        </div>
        <div class="rk-header-actions">
          <el-button type="primary" class="rk-btn rk-btn-primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>新增记录
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

      <!-- ===== 筛选（原生控件；修复原页 resetForm 缺 ref 导致重置不清字段的问题） ===== -->
      <div class="rk-filter">
        <label class="rk-group">
          <span class="rk-label">运动员</span>
          <select v-model="queryParams.athleteId" class="rk-select md-select-athlete">
            <option :value="null">全部运动员</option>
            <option v-for="a in athleteOptions" :key="a.athleteId" :value="a.athleteId">
              {{ a.name }}
            </option>
          </select>
        </label>
        <label class="rk-group">
          <span class="rk-label">类型</span>
          <select v-model="queryParams.recordType" class="rk-select">
            <option :value="null">全部类型</option>
            <option v-for="t in typeOptions" :key="t.v" :value="t.v">{{ t.label }}</option>
          </select>
        </label>
        <label class="rk-group" v-if="queryParams.bodySite">
          <span class="rk-label">部位</span>
          <span class="md-site-filter-chip">
            {{ siteLabel(queryParams.bodySite) }}
            <i class="md-site-filter-x" @click="queryParams.bodySite = null">✕</i>
          </span>
        </label>
        <div class="rk-filter-right">
          <button type="button" class="rk-btn-reset" @click="resetQuery">
            <el-icon><RefreshLeft /></el-icon>重置
          </button>
        </div>
      </div>

      <!-- ===== 台账 + 伤病部位分布双栏（详情走抽屉） ===== -->
      <div class="rk-split-grid md-main-grid" style="--rk-split-l: 13fr; --rk-split-r: 9fr;">

        <!-- 左：记录台账（服务端分页） -->
        <div class="rk-table-card">
          <div class="rk-card-head">
            <h3 class="rk-card-title">医疗康复</h3>
            <span class="rk-card-sub">共 {{ total }} 条 · 点击行打开详情</span>
          </div>
          <div class="rk-card-body flush">
            <div v-loading="loading" class="rk-table-scroll">
              <table class="rk-table md-table">
                <thead>
                  <tr>
                    <th class="col-athlete">运动员</th>
                    <th class="text-center col-type">类型</th>
                    <th class="text-center col-site">部位</th>
                    <th class="col-title">标题</th>
                    <th class="text-center col-date">日期</th>
                    <th class="text-center col-files">附件</th>
                    <th class="text-right col-actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in recordList" :key="row.id"
                      class="rk-row md-row"
                      :class="{ 'is-selected': current && current.id === row.id }"
                      @click="handleRowClick(row)">
                    <td class="col-athlete">
                      <span class="md-name">{{ row.athleteName || '—' }}</span>
                      <GenderBadge :gender="row.athleteGender" :size="15" class="md-gender-ic"/>
                    </td>
                    <td class="text-center col-type">
                      <span class="md-type-chip" :style="typeChipStyle(row.recordType)">
                        {{ typeLabel(row.recordType) }}
                      </span>
                    </td>
                    <td class="text-center col-site">
                      <span v-if="row.bodySite" class="md-site-cell">{{ siteLabel(row.bodySite) }}</span>
                      <span v-else class="rk-dash">—</span>
                    </td>
                    <td class="col-title">
                      <span class="md-title-text" :title="row.title">{{ row.title || '—' }}</span>
                    </td>
                    <td class="text-center rk-mono col-date">{{ formatDate(row.recordDate) || '—' }}</td>
                    <td class="text-center col-files">
                      <span v-if="fileCountMap[row.id]"
                            class="md-file-count rk-mono">{{ fileCountMap[row.id] }}</span>
                      <span v-else class="rk-dash">—</span>
                    </td>
                    <td class="text-right col-actions">
                      <div class="rk-actions">
                        <button type="button" class="rk-link" @click.stop="handleEdit(row)">编辑</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="!loading && recordList.length === 0" class="rk-empty">
                <p class="rk-empty-title">暂无医疗康复记录</p>
                <p class="rk-empty-desc">点击右上角「新增记录」建立第一条台账</p>
              </div>
            </div>

            <!-- 分页（服务端，保持原 pageSize=10） -->
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

        <!-- 右：伤病部位分布（常驻人体热力图） -->
        <div class="rk-card md-bodymap-card">
          <div class="rk-card-head md-bodymap-head">
            <h3 class="rk-card-title">伤病部位分布</h3>
            <div class="md-range-switch">
              <button type="button" :class="{ 'is-active': siteRange === '12m' }" @click="switchRange('12m')">近 12 月</button>
              <button type="button" :class="{ 'is-active': siteRange === 'all' }" @click="switchRange('all')">全部</button>
            </div>
          </div>

          <div class="md-bodymap-body">
            <BodyMap :hotspots="siteHotspots" @select="pickSite"/>
            <p class="md-bodymap-legend">
              <i class="md-dot is-red"></i>活跃（未闭环）<i class="md-dot is-green"></i>已康复 · 点大小=例数
            </p>
            <div v-if="queryParams.bodySite" class="md-site-filter-tip">
              已筛选：<b>{{ siteLabel(queryParams.bodySite) }}</b>
              <button type="button" class="rk-link" @click="pickSite(queryParams.bodySite)">清除</button>
            </div>
            <div class="md-site-rank">
              <div v-for="d in siteHotspots" :key="d.site"
                   class="md-site-rank-row" :class="{ 'is-active': queryParams.bodySite === d.site }"
                   @click="pickSite(d.site)">
                <span class="md-site-name">{{ siteLabel(d.site) }}</span>
                <div class="md-site-bar">
                  <i class="md-site-bar-blue" :style="{ width: barWidth(d.total) }"></i>
                </div>
                <span class="md-site-cnt rk-mono">{{ d.total }}</span>
              </div>
              <div v-if="!siteHotspots.length" class="md-site-empty">该时段暂无带部位的损伤/手术</div>
            </div>
            <p class="md-site-note">其后存在康复/复查记录即视为已康复，与风险预警口径一致；点击热点筛选台账。</p>
          </div>
        </div>
      </div>

      <!-- ========== 医疗记录详情抽屉 ========== -->
      <el-drawer v-model="drawerVisible" size="500px" :with-header="false" class="md-drawer-wrap">
        <div class="md-drawer" v-if="current">
          <div class="md-drawer-head">
            <span class="md-drawer-avatar" :style="{ background: typeColor(current.recordType) }">
              {{ (current.athleteName || '?').charAt(0) }}
            </span>
            <div class="md-drawer-id">
              <div class="md-drawer-name">
                {{ current.athleteName || '—' }}
                <GenderBadge :gender="current.athleteGender" :size="15"/>
              </div>
              <div class="md-drawer-sub">
                {{ current.athleteTeam || '无队伍' }} · #{{ current.athleteId }} · {{ formatDate(current.recordDate) }}
              </div>
            </div>
            <button type="button" class="md-drawer-close" @click="drawerVisible = false">
              <el-icon><Close /></el-icon>
            </button>
          </div>

          <div class="md-detail-banner" :style="bannerStyle(current.recordType)">
            <span class="md-type-chip md-type-chip-lg" :style="typeChipStyle(current.recordType)">
              {{ typeLabel(current.recordType) }}
            </span>
            <div class="md-banner-info">
              <div class="md-banner-title">{{ current.title }}</div>
              <div class="md-banner-meta">
                <span v-if="current.bodySite" class="md-site-cell">{{ siteLabel(current.bodySite) }}</span>
                <span v-if="current.institution">{{ current.institution }}</span>
              </div>
            </div>
          </div>

          <div v-if="current.remark" class="md-remark">
            <div class="md-section-title">诊疗说明</div>
            <p>{{ current.remark }}</p>
          </div>

          <div class="md-section-title md-files-title">
            附件（{{ current.files ? current.files.length : 0 }}）
            <span class="md-privacy"><el-icon><Lock /></el-icon>仅授权可下载</span>
          </div>
          <div v-if="current.files && current.files.length" class="md-file-list">
            <div v-for="f in current.files" :key="f.id" class="md-file-card">
              <span class="md-file-icon" :class="'icon-' + extKey(f.fileExt)">{{ extIcon(f.fileExt) }}</span>
              <div class="md-file-info">
                <div class="md-file-name" :title="f.fileName">{{ f.fileName }}</div>
                <div class="md-file-meta rk-mono">{{ formatSize(f.fileSize) }} · {{ formatDate(f.uploadTime) }}</div>
              </div>
              <div class="md-file-actions">
                <button type="button" class="rk-link" @click="handleDownload(f)">下载</button>
                <button type="button" class="rk-link md-link-danger" @click="handleDeleteFile(f)">删除</button>
              </div>
            </div>
          </div>
          <div v-else class="md-no-files">无附件</div>

          <div class="md-drawer-foot">
            <button type="button" class="rk-btn rk-btn-sm" @click="handleEdit(current)"
                    v-hasPermi="['apms:medicalRecord:edit']">
              <el-icon><Edit /></el-icon>编辑记录
            </button>
            <button type="button" class="rk-btn rk-btn-sm rk-btn-danger" @click="handleDelete(current)"
                    v-hasPermi="['apms:medicalRecord:remove']">删除记录</button>
          </div>
        </div>
      </el-drawer>

      <!-- ========== 新增/编辑 Dialog（损伤/手术时右侧常驻人体图点选） ========== -->
      <el-dialog :title="dialogTitle" v-model="showDialog"
                 :width="isInjuryType ? '920px' : '580px'"
                 class="md-form-dialog">
        <div class="md-form-layout">
          <div class="md-form-main">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="运动员" prop="athleteId">
                <el-select v-model="form.athleteId" placeholder="选运动员" style="width:100%" filterable>
                  <el-option v-for="a in athleteOptions" :key="a.athleteId"
                             :label="a.name + ' #' + a.athleteId"
                             :value="a.athleteId"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="记录类型" prop="recordType">
                <el-select v-model="form.recordType" placeholder="选类型" style="width:100%">
                  <el-option v-for="t in typeOptions" :key="t.v" :label="t.label" :value="t.v"/>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="日期" prop="recordDate">
                <el-date-picker v-model="form.recordDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="机构">
                <el-input v-model="form.institution" placeholder="如：北医三院"/>
              </el-form-item>
            </el-col>
            <el-col v-if="isInjuryType" :span="24">
              <el-form-item label="伤病部位" prop="bodySite">
                <el-select v-model="form.bodySite" placeholder="可在下拉选择，也可直接在右侧人体图上点选" style="width:100%">
                  <el-option-group v-for="g in BODY_SITE_GROUPS" :key="g.group" :label="g.group">
                    <el-option v-for="s in g.items" :key="s.code" :label="s.label" :value="s.code"/>
                  </el-option-group>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="标题" prop="title">
                <el-input v-model="form.title" placeholder="如：右膝内侧副韧带轻度拉伤"/>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="说明">
                <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="详细诊疗说明、处置、后续计划..."/>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="附件">
                <el-upload
                  class="medical-upload"
                  action="/dev-api/common/upload"
                  :headers="uploadHeaders"
                  :file-list="form.fileList"
                  :on-success="handleFileSuccess"
                  :on-remove="handleFileRemove"
                  :before-upload="beforeUpload"
                  :disabled="isDemoMode()"
                  multiple
                  drag>
                  <el-icon class="el-icon--upload"><upload-filled/></el-icon>
                  <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
                  <template #tip>
                    <div class="el-upload__tip">支持 PDF/JPG/PNG/DOC/XLS 等医疗报告格式</div>
                  </template>
                </el-upload>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
          </div><!-- /.md-form-main -->

          <!-- 右侧常驻：人体图点选（损伤/手术时显示，与下拉双向联动） -->
          <div v-if="isInjuryType" class="md-form-pick">
            <div class="md-form-pick-title">点选伤病部位</div>
            <BodyMap selectable v-model="form.bodySite"/>
            <div class="md-pick-current">
              当前选择：<b v-if="form.bodySite">{{ siteLabel(form.bodySite) }}</b>
              <span v-else class="rk-dash">未选择（含图下「其它」）</span>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="showDialog = false">取 消</el-button>
          <el-button type="primary" @click="submit">保 存</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup name="ApmsMedical">
import { listMedical, medicalSiteStats, getMedical, addMedical, updateMedical, delMedical, delMedicalFile, downloadMedicalFile } from '@/api/apms/medical'
import { listAthlete } from '@/api/apms/athlete'
import { getToken, isDemoMode } from '@/utils/auth'
import { Plus, RefreshLeft, ArrowLeft, ArrowRight, Lock, UploadFilled, Close, Edit } from '@element-plus/icons-vue'
import GenderBadge from '@/components/GenderBadge/index.vue'
import BodyMap from './components/BodyMap.vue'
import { BODY_SITE_GROUPS, siteLabel } from './bodySites'

const { proxy } = getCurrentInstance()

const PAGE_SIZE = 10

// ========= 字典（原口径：前端固定枚举） =========
const typeOptions = [
  { v: 'injury',         label: '损伤' },
  { v: 'illness',        label: '疾病' },
  { v: 'surgery',        label: '手术' },
  { v: 'rehabilitation', label: '康复' },
  { v: 'checkup',        label: '体检' }
]
const TYPE_META = {
  injury:         { label: '损伤', color: '#DC2626', bg: '#FCEBEB' },
  illness:        { label: '疾病', color: '#D97706', bg: '#FEF3E0' },
  surgery:        { label: '手术', color: '#16A34A', bg: '#E8F7EE' },
  rehabilitation: { label: '康复', color: '#2563EB', bg: '#EFF5FF' },
  checkup:        { label: '体检', color: '#64748B', bg: '#F1F5F9' }
}
function typeLabel(t) { return TYPE_META[t]?.label || t || '—' }
function typeColor(t) { return TYPE_META[t]?.color || '#64748B' }
function typeChipStyle(t) {
  const m = TYPE_META[t]
  if (!m) return { color: '#64748B', background: '#F1F5F9' }
  return { color: m.color, background: m.bg }
}
function bannerStyle(t) {
  const m = TYPE_META[t]
  return {
    '--pm-tone': m ? m.color : '#64748B',
    '--pm-bg': m ? m.bg : '#F1F5F9'
  }
}

// ========= KPI 统计（只读全量一次，不新增后端接口） =========
const stats = reactive({ total: 0, injury: 0, athletes: 0, files: 0 })
const kpiCards = computed(() => [
  { label: '医疗康复总数', value: stats.total, unit: '条', accent: '#8B5CF6', chip: '按 DataScope 隔离', chipTone: 'tone-info' },
  { label: '损伤记录', value: stats.injury, unit: '条', accent: '#DC2626', chip: '队医重点关注', chipTone: 'tone-risk' },
  { label: '涉及队员', value: stats.athletes, unit: '人', accent: '#06B6D4', chip: '人均 ' + (stats.athletes ? (stats.total / stats.athletes).toFixed(1) : '0') + ' 条', chipTone: '' },
  { label: '附件归档', value: stats.files, unit: '份', accent: '#2563EB', chip: '仅授权可下载', chipTone: 'tone-info' }
])
// list 接口不回传 files（仅 getById 带附件），附件统计/行胶囊需按记录并发拉详情；
// 医疗档案为低频小表且本请求只读，零后端改动能拿到真实附件数（seq 防止竞态覆盖）
const fileCountMap = ref({})
let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listMedical({ pageNum: 1, pageSize: 500 }).then(async r => {
    const rows = r.rows || []
    if (seq !== statsSeq) return
    stats.total = r.total || 0
    stats.injury = rows.filter(x => x.recordType === 'injury').length
    stats.athletes = new Set(rows.map(x => x.athleteId)).size
    const details = await Promise.all(rows.map(x =>
      getMedical(x.id).then(d => d.data).catch(() => null)
    ))
    if (seq !== statsSeq) return
    const map = {}
    let fileTotal = 0
    details.forEach((d, i) => {
      const n = (d && d.files && d.files.length) || 0
      map[rows[i].id] = n
      fileTotal += n
    })
    fileCountMap.value = map
    stats.files = fileTotal
  })
}

// ========= 查询（服务端分页） =========
const loading = ref(false)
const recordList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: PAGE_SIZE, athleteId: null, recordType: null, bodySite: null })

// ========= 伤病部位热力图 =========
const siteRange = ref('12m')
const siteHotspots = ref([])
// 条形按固定基准 10 例换算：n 例 → n/10 占比（5=半条、3=30%、2=20%），满 10 例即满格
const SITE_BAR_BASE = 10
function barWidth(n) {
  const pct = Math.min(100, Math.max(0, (Number(n) || 0) / SITE_BAR_BASE * 100))
  return pct + '%'
}
function loadSiteStats() {
  medicalSiteStats({ range: siteRange.value }).then(r => { siteHotspots.value = r.data || [] })
}
function switchRange(r) {
  if (siteRange.value === r) return
  siteRange.value = r
  loadSiteStats()
}
// 点热点/部位行：同部位再点一次取消；查询由 bodySite watcher 统一触发，避免双请求
function pickSite(site) {
  queryParams.bodySite = queryParams.bodySite === site ? null : site
}

// ========= 表单内人体图（损伤/手术时右侧常驻） =========
const isInjuryType = computed(() => form.recordType === 'injury' || form.recordType === 'surgery')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNumbers = computed(() => {
  const pages = totalPages.value, cur = queryParams.pageNum
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(pages - 4, cur - 2))
  const nums = [1]
  if (start > 2) nums.push('…')
  for (let p = start; p < start + 4 && p < pages; p++) nums.push(p)
  if (start + 3 < pages - 1) nums.push('…')
  nums.push(pages)
  return nums
})
function goPage(p) {
  if (p === '…' || p < 1 || p > totalPages.value || p === queryParams.pageNum) return
  queryParams.pageNum = p
  getList()
}

function getList() {
  loading.value = true
  listMedical(queryParams).then(r => {
    recordList.value = r.rows || []
    total.value = r.total || 0
    // 删除后落在空页：自动回退一页
    if (recordList.value.length === 0 && queryParams.pageNum > 1) {
      queryParams.pageNum -= 1
      getList()
      return
    }
    loading.value = false
  }).catch(() => { loading.value = false })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
// 程序化重置时跳过 watcher，避免重复请求
let filterGuard = false
function resetQuery() {
  filterGuard = true
  queryParams.athleteId = null
  queryParams.recordType = null
  queryParams.bodySite = null
  queryParams.pageNum = 1
  getList()
  loadStats()
  nextTick(() => { filterGuard = false })
}

// 筛选变化 300ms 防抖自动查询（服务端分页口径）
let filterTimer = null
watch(() => [queryParams.athleteId, queryParams.recordType, queryParams.bodySite], () => {
  if (filterGuard) return
  clearTimeout(filterTimer)
  filterTimer = setTimeout(handleQuery, 300)
})

// ========= 辅助下拉 =========
const athleteOptions = ref([])
listAthlete({ pageNum: 1, pageSize: 300 }).then(r => { athleteOptions.value = r.rows || [] })

// ========= 主从（点行打开详情抽屉，含 files） =========
const drawerVisible = ref(false)
const current = ref(null)
function handleRowClick(row) {
  current.value = row
  drawerVisible.value = true
  loadDetail(row.id)
}
function loadDetail(id) {
  getMedical(id).then(r => {
    // 仅在仍选中同一条时覆盖，避免快速切换闪烁
    if (current.value && current.value.id === id) current.value = r.data
  })
}

// ========= Dialog（原逻辑保留） =========
const showDialog = ref(false)
const formRef = ref(null)
const dialogTitle = ref('')
const form = reactive({ id: null, athleteId: null, recordType: 'injury', bodySite: null, recordDate: null, institution: '', title: '', remark: '', fileList: [], files: [] })
const rules = {
  athleteId: [{ required: true, message: '请选运动员', trigger: 'change' }],
  recordType: [{ required: true, message: '请选记录类型', trigger: 'change' }],
  bodySite: [{
    validator: (rule, value, cb) =>
      (isInjuryType.value && !value) ? cb(new Error('损伤/手术记录必须选择伤病部位')) : cb(),
    trigger: 'change'
  }],
  recordDate: [{ required: true, message: '请选日期', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }]
}
// 切到非伤病类型时清掉部位（人体图面板随 v-if 隐藏、弹窗宽度自动收回）
watch(() => form.recordType, (t) => {
  if (t !== 'injury' && t !== 'surgery') form.bodySite = null
})

const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + getToken() }))

function handleAdd() {
  dialogTitle.value = '新增医疗康复'
  Object.assign(form, { id: null, athleteId: null, recordType: 'injury', bodySite: null, recordDate: null, institution: '', title: '', remark: '', fileList: [], files: [] })
  showDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑医疗康复'
  // 编辑在抽屉上层弹窗进行；修复原页缺陷：list 不回传 files，必须先 getById 回填附件
  getMedical(row.id).then(res => {
    const detail = res.data || row
    Object.assign(form, detail)
    form.fileList = (detail.files || []).map(f => ({
      uid: f.id, name: f.fileName, url: downloadMedicalFile(f.id),
      response: { url: f.filePath, name: f.fileName, path: f.filePath, size: f.fileSize }
    }))
    form.files = (detail.files || []).map(f => ({ recordId: f.recordId, fileName: f.fileName, filePath: f.filePath, fileSize: f.fileSize, fileExt: f.fileExt }))
    showDialog.value = true
  })
}

function beforeUpload(file) {
  // 演示模式：el-upload 已 :disabled，这里再兜一道，零真实上传
  if (isDemoMode()) {
    proxy.$modal.msgWarning('演示环境暂不支持文件上传')
    return false
  }
  // 仅限制大小 20MB
  const MAX = 20 * 1024 * 1024
  if (file.size > MAX) {
    proxy.$modal.msgError('文件不能超过 20MB')
    return false
  }
  return true
}
function handleFileSuccess(res, file) {
  // RuoYi /common/upload 返回 {url, name, path, size}
  const saved = form.files || []
  saved.push({ fileName: res.name || file.name, filePath: res.url || res.path, fileSize: res.size, fileExt: file.name.split('.').pop()?.toLowerCase() })
  form.files = saved
}
function handleFileRemove(file) {
  // 从 form.files 里剔除
  form.files = (form.files || []).filter(f => f.fileName !== file.name)
}

function submit() {
  proxy.$refs.formRef.validate(valid => {
    if (!valid) return
    const body = { record: { ...form }, files: form.files || [] }
    const req = form.id ? updateMedical(body) : addMedical(body)
    req.then(() => {
      proxy.$modal.msgSuccess('保存成功'); showDialog.value = false
      getList(); loadStats(); loadSiteStats()
      if (current.value && current.value.id === form.id) loadDetail(current.value.id)
    })
  })
}

// ========= 附件操作（原逻辑保留） =========
async function handleDownload(f) {
  // 演示模式：原生 fetch 不走 service 实例（adapter 换不到），必须前置拦截，零真实请求
  if (isDemoMode()) {
    proxy.$modal.msgWarning('演示环境暂不支持文件下载')
    return
  }
  // 修复原页缺陷：window.open 既无 /dev-api 前缀也无法携带 Bearer，dev 下必失败；
  // 改为带鉴权头的 blob 下载，保留私有下载端点的权限点校验
  try {
    const res = await fetch(import.meta.env.VITE_APP_BASE_API + downloadMedicalFile(f.id), {
      headers: { Authorization: 'Bearer ' + getToken() }
    })
    if (!res.ok) {
      proxy.$modal.msgError('下载失败或无下载权限')
      return
    }
    // 若依业务错误为 200 + JSON（如文件未实际落盘），需识别后提示而非下载错误体
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const errBody = await res.json().catch(() => null)
      proxy.$modal.msgError(errBody?.msg || '下载失败')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = f.fileName || ('medical-file-' + f.id)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    proxy.$modal.msgError('下载失败：' + (e.message || '网络异常'))
  }
}
function handleDeleteFile(f) {
  proxy.$modal.confirm(`确认删除附件 "${f.fileName}"？`).then(() => {
    delMedicalFile(f.id).then(() => {
      proxy.$modal.msgSuccess('已删除')
      loadDetail(current.value.id)
      getList(); loadStats()
    })
  }).catch(() => {})
}

function handleDelete(row) {
  proxy.$modal.confirm('确认删除该条医疗康复记录？附件一并删除。').then(() => {
    delMedical(row.id).then(() => {
      proxy.$modal.msgSuccess('删除成功')
      getList(); loadStats(); loadSiteStats()
      drawerVisible.value = false
      current.value = null
    })
  }).catch(() => {})
}

// ========= 辅助 =========
function formatDate(d) { if (!d) return ''; return String(d).substring(0, 10) }
function formatSize(b) {
  if (!b) return '—'
  if (b < 1024) return b + 'B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + 'KB'
  return (b / 1024 / 1024).toFixed(1) + 'MB'
}
function extKey(ext) {
  ext = (ext || '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'img'
  if (['doc', 'docx'].includes(ext)) return 'doc'
  if (['xls', 'xlsx'].includes(ext)) return 'xls'
  return 'file'
}
function extIcon(ext) {
  const key = extKey(ext)
  return { pdf: 'PDF', img: 'IMG', doc: 'DOC', xls: 'XLS', file: (ext || 'FILE').toUpperCase() }[key]
}

getList()
loadStats()
loadSiteStats()
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.md-select-athlete { width: 170px; }

/* ===== 左：台账表 ===== */
.md-table { min-width: 480px; }
.col-athlete { width: 96px; }
.col-type { width: 72px; }
.col-date { width: 88px; }
.col-files { width: 52px; }
.col-actions { width: 56px; }

.md-row { cursor: pointer; }
.md-row.is-selected {
  background: $rk-brand-50;
  box-shadow: inset 3px 0 0 $rk-brand-600;
}
.md-name {
  font-size: 13px;
  font-weight: 500;
  color: $rk-text-1;
  margin-right: 5px;
}
.md-name { display: inline-flex; align-items: center; gap: 5px; }
.md-gender-ic { flex: none; }
.md-banner-meta .rk-soft-chip { display: inline-flex; align-items: center; gap: 4px; }
.md-type-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  border-radius: 999px;
  white-space: nowrap;
}
.md-type-chip-lg { padding: 3px 12px; font-size: 13px; font-weight: 700; }
.md-title-text {
  font-size: 13px;
  color: $rk-text-1;
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.md-file-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 700;
  color: $rk-brand-700;
  background: $rk-brand-50;
  border-radius: 999px;
}
.md-link-danger { color: $rk-risk; &:hover { color: #b91c1c; } }

/* ===== 右：详情 banner（详情已移入抽屉） ===== */
.md-detail-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 4px 20px 0;
  padding: 14px 16px;
  background: var(--pm-bg, #f1f5f9);
  border: 1px solid var(--pm-tone, #94a3b8);
  border-left-width: 4px;
  border-radius: 12px;
}
.md-banner-info { min-width: 0; }
.md-banner-title {
  font-size: 15px;
  font-weight: 700;
  color: $rk-text-1;
  margin-bottom: 5px;
}
.md-banner-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $rk-text-3;
}

.md-remark p {
  margin: 6px 0 0;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.8;
  color: $rk-text-2;
  background: $rk-canvas;
  border-radius: 10px;
}
.md-only-files-gap { height: 4px; }

.md-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 10px;
  padding-left: 9px;
  border-left: 3px solid $rk-brand-600;
  font-size: 13px;
  font-weight: 600;
  color: $rk-text-1;
}
.md-files-title { margin-top: 18px; }
.md-privacy {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 400;
  color: $rk-risk;
}
.md-file-list { display: flex; flex-direction: column; gap: 8px; }
.md-file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid $rk-line;
  border-radius: 12px;
  transition: border-color .15s, background .15s;
  &:hover { border-color: #cdd5e3; background: #fcfdff; }
}
.md-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  &.icon-pdf { background: #f56c6c; }
  &.icon-img { background: #409eff; }
  &.icon-doc { background: #1b4332; }
  &.icon-xls { background: #67c23a; }
  &.icon-file { background: #909399; }
}
.md-file-info { flex: 1; min-width: 0; }
.md-file-name {
  font-size: 13px;
  font-weight: 500;
  color: $rk-text-1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.md-file-meta { margin-top: 2px; font-size: 11px; color: $rk-text-3; }
.md-file-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
.md-no-files {
  padding: 22px 0;
  font-size: 12px;
  color: $rk-text-3;
  text-align: center;
}

/* ===== 弹窗上传区收敛 ===== */
.medical-upload { width: 100%; }
.medical-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 20px;
  border-radius: 12px;
}

/* ===== 右栏：伤病部位热力图卡（纵向） ===== */
.md-bodymap-card { min-height: 420px; }
.md-bodymap-head { justify-content: space-between; }
.md-range-switch {
  display: inline-flex;
  border: 1px solid $rk-line;
  border-radius: 9px;
  overflow: hidden;
  button {
    border: 0;
    background: #fff;
    padding: 4px 10px;
    font-size: 12px;
    color: $rk-text-2;
    cursor: pointer;
    &.is-active { background: $rk-brand-600; color: #fff; }
  }
}
.md-bodymap-body { padding: 6px 16px 14px; }
.md-bodymap-legend {
  margin: 4px 0 2px;
  font-size: 11.5px;
  color: $rk-text-3;
  text-align: center;
}
.md-site-filter-tip {
  margin: 8px auto 0;
  width: fit-content;
  font-size: 12px;
  color: $rk-text-2;
  b { color: $rk-brand-700; margin: 0 2px; }
}
.md-dot {
  display: inline-block;
  width: 9px; height: 9px;
  border-radius: 50%;
  margin: 0 5px 0 12px;
  vertical-align: -1px;
  &:first-child { margin-left: 0; }
  &.is-red { background: rgba(220, 38, 38, 0.88); }
  &.is-green { background: rgba(22, 163, 74, 0.82); }
}
.md-site-rank { display: flex; flex-direction: column; gap: 9px; margin-top: 10px; }
.md-site-rank-row {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 8px;
  &:hover { background: $rk-canvas; }
  &.is-active { background: $rk-brand-50; }
}
.md-site-name { width: 84px; flex: none; font-size: 12px; color: $rk-text-2; }
.md-site-bar {
  position: relative;
  flex: 1;
  height: 9px;
  border-radius: 999px;
  background: #EEF2F7;
}
.md-site-bar-blue {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: $rk-brand-600;
  border-radius: 999px;
}
.md-site-cnt {
  width: 40px; flex: none; text-align: right;
  font-size: 12px; font-weight: 600; color: $rk-text-1;
  em { font-style: normal; color: $rk-risk; font-weight: 700; }
}
.md-site-empty { padding: 14px 0; font-size: 12.5px; color: $rk-text-3; text-align: center; }
.md-site-note {
  margin: 14px 0 0;
  padding: 9px 11px;
  border-radius: 9px;
  background: $rk-canvas;
  font-size: 11.5px;
  line-height: 18px;
  color: $rk-text-3;
}

/* ===== 医疗详情抽屉 ===== */
.md-drawer-wrap :deep(.el-drawer__body) { padding: 0; }
.md-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 18px 0 20px;
  overflow-y: auto;
}
.md-drawer-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 20px 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid $rk-line;
}
.md-drawer-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}
.md-drawer-id { flex: 1; min-width: 0; }
.md-drawer-name {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 700; color: $rk-text-1;
}
.md-drawer-sub { margin-top: 4px; font-size: 12px; color: $rk-text-3; }
.md-drawer-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex: none;
  color: $rk-text-3; background: #fff;
  border: 1px solid $rk-line; border-radius: 9px;
  cursor: pointer;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}
.md-drawer :deep(.md-remark),
.md-drawer .md-remark { margin: 14px 20px 0; }
.md-drawer .md-files-title { margin: 18px 20px 10px; }
.md-drawer .md-file-list { margin: 0 20px; }
.md-drawer .md-no-files { margin: 0 20px; }
.md-drawer-foot {
  margin: auto 20px 0;
  padding-top: 16px;
  display: flex; gap: 10px; flex-wrap: wrap;
  border-top: 1px solid $rk-line;
}
@media (max-width: 1279px) {
  .md-main-grid { --rk-split-l: 1fr; --rk-split-r: 1fr; }
}

/* 列表/详情的部位 */
.col-site { width: 92px; }
.md-site-cell {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 7px;
  font-size: 12px;
  color: $rk-brand-700;
  background: $rk-brand-50;
  white-space: nowrap;
}
.md-site-filter-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 10px;
  border: 1px solid #bfd9fb;
  border-radius: 9px;
  font-size: 13px; color: $rk-brand-700; background: $rk-brand-50;
}
.md-site-filter-x { font-style: normal; cursor: pointer; font-size: 12px; opacity: .7; &:hover { opacity: 1; } }

/* 编辑弹窗：左表单 + 右侧常驻人体图点选面板 */
.md-form-dialog { transition: width .22s ease; }
.md-form-dialog :deep(.el-dialog__body) { padding-top: 10px; }
.md-form-layout {
  display: flex;
  align-items: flex-start;
  gap: 22px;
}
.md-form-main { flex: 1; min-width: 0; }
.md-form-pick {
  width: 300px;
  flex: none;
  padding-left: 20px;
  border-left: 1px solid $rk-line;
}
.md-form-pick-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: $rk-text-1;
}
.md-pick-current {
  text-align: center;
  margin-top: 10px;
  font-size: 12.5px;
  color: $rk-text-2;
  b { color: $rk-brand-700; }
}
</style>
