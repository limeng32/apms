# 可复用代码骨架（速查）

以下为字段无关骨架，实际改造时**优先从标杆范例直接复制改名**（role/index.vue、user/index.vue、dept/index.vue、athlete/detail.vue、phv/index.vue、bodyMeasure/index.vue、rtp/index.vue、medical/index.vue）。

## 1. 头像哈希 + 展示辅助

```js
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6']
function avatarChar(row) { return (row.name || '?').trim().charAt(0) }
function avatarColor(row) {
  const s = row.name || row.code || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function statusMeta(row) {
  return row.status === '0' ? { tone: 'green', label: '正常' } : { tone: 'gray', label: '停用' }
}
const fmtTime = t => t ? proxy.parseTime(t) : '—'
const fmtDate = t => t ? proxy.parseTime(t, '{y}-{m}-{d}') : '—'
```

## 2. 分页（PAGE_SIZE=12）

```js
const PAGE_SIZE = 12
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNumbers = computed(() => {
  const pages = totalPages.value, cur = queryParams.value.pageNum
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
  if (p === '…' || p < 1 || p > totalPages.value || p === queryParams.value.pageNum) return
  queryParams.value.pageNum = p
  getList()
}
// getList 成功后：空页且 pageNum>1 时 pageNum-=1 并重查
```

## 3. 多选（全选/半选/禁选）

```js
const ids = ref([]), single = ref(true), headCheckRef = ref(null)
const selectableRows = computed(() => (list.value || []).filter(checkRowSelectable))
const allChecked = computed(() => selectableRows.value.length > 0 && selectableRows.value.every(r => ids.value.includes(r.id)))
const someIndeterminate = computed(() => ids.value.length > 0 && !allChecked.value)
watch([allChecked, someIndeterminate], () => nextTick(() => {
  if (headCheckRef.value) headCheckRef.value.indeterminate = someIndeterminate.value
}))
const syncSelectionFlags = () => { single.value = ids.value.length !== 1 }
function toggleRow(row) {
  const i = ids.value.indexOf(row.id)
  i >= 0 ? ids.value.splice(i, 1) : ids.value.push(row.id)
  syncSelectionFlags()
}
function toggleAll(ev) {
  const pageIds = selectableRows.value.map(r => r.id)
  if (ev.target.checked) ids.value = Array.from(new Set([...ids.value, ...pageIds]))
  else ids.value = ids.value.filter(id => !pageIds.includes(id))
  syncSelectionFlags()
}
```

## 4. 行内 ⋮ 菜单

```js
const openMenuId = ref(null)
function onDocClick() { openMenuId.value = null }
function toggleMenu(id) {
  if (openMenuId.value === id) { openMenuId.value = null; document.removeEventListener('click', onDocClick) }
  else { openMenuId.value = id; document.addEventListener('click', onDocClick) }
}
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
// 菜单项容器加 @click.stop；onMenu 里先 openMenuId=null 再分发
```

## 5. 状态徽章切换（confirm/回滚）

```js
function toggleStatus(row) {
  if (isProtected(row)) return
  row.status = row.status === '0' ? '1' : '0'
  handleStatusChange(row)
}
function handleStatusChange(row) {
  const text = row.status === '0' ? '启用' : '停用'
  proxy.$modal.confirm(`确认要"${text}""${row.name}"吗?`)
    .then(() => changeXxxStatus(row.id, row.status))
    .then(() => proxy.$modal.msgSuccess(text + '成功'))
    .catch(() => { row.status = row.status === '0' ? '1' : '0' })
}
```

## 6. 筛选防抖 + 显式重置

```js
let filterTimer = null
watch(
  () => [queryParams.value.f1, queryParams.value.f2, dateRange.value && dateRange.value.join(',')],
  () => { clearTimeout(filterTimer); filterTimer = setTimeout(handleQuery, 300) }
)
function resetQuery() {
  dateRange.value = []
  queryParams.value.f1 = undefined
  queryParams.value.f2 = undefined
  queryParams.value.pageNum = 1
  getList()
}
```

## 7. 树表 el-table deep 收敛块（dept 模式）

```scss
.dm-tree-table {
  --el-table-border-color: #{$rk-line};
  --el-table-header-bg-color: #fff;
  --el-table-header-text-color: #{$rk-text-3};
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-row-hover-bg-color: #{$rk-canvas};
  :deep(.el-table__cell) { padding: 7px 0; }
  :deep(th.el-table__cell) { font-size: 12px; font-weight: 500; background: #fff; }
  :deep(.cell) { padding-left: 14px; padding-right: 14px; }
  :deep(.el-table__expand-icon) { color: $rk-text-3; &:hover { color: $rk-brand-600; } }
}
```

## 8. 全宽页底色 / 日期控件收敛

> 注意：侧栏 `position: fixed`（展开 200px / 折叠 54px）、头部也是 fixed，`.app-main` 只靠 `.app-container { padding: 20px }` 让出空间。用负 margin 外扩底色时，**左、上 padding 必须补偿 20px**，否则 hero 会钻到侧栏/头部下面（背景盖在它们下面无所谓，但内容起点必须保持在 x≥220 / y≥104）。

```scss
.xx-page {
  min-height: calc(100vh - 84px);
  margin: -20px;                       /* 底色满铺，盒子本身会到侧栏下（不可见） */
  padding: 40px 16px 36px 40px;        /* 左/上补偿 20px，内容起点 = 原 app-container 内容位 */
  background: $rk-canvas;
}
```

改完必须在浏览器量一次：`rk-title` 的 `getBoundingClientRect().left >= 侧栏右边`（展开态 ≥200，目标 220）、`top >= 84`（目标 104）；折叠侧栏后再量一次（窄栏右边 54，标题 74）。

日期控件收敛：

```scss
:deep(.xx-date-picker) {
  width: 260px;
  .el-range-editor.el-input__wrapper, .el-input__wrapper {
    height: 32px; border-radius: 10px; box-shadow: 0 0 0 1px $rk-line inset;
  }
  .el-range-input { font-size: 13px; }
}
```

## 9b. 详情页壳层结构（athlete/detail 模式）

class 全部已在 roster-kit.scss「详情壳层」段定义，直接使用；结构速查：

```html
<div class="app-container">
  <div class="rk-detail-page">
    <div class="rk-crumb"><a @click="goBack">花名册</a><span>/</span><span>姓名</span></div>

    <section class="rk-profile">
      <div class="rk-profile-avatar" :style="{background: groupColor}">张</div>
      <div class="rk-profile-main">
        <div class="rk-profile-name-row">
          <h2 class="rk-profile-name">姓名</h2>
          <span class="rk-status-badge is-tone-green"><i></i>正常参训</span>
          <span class="rk-soft-chip">男</span>
        </div>
        <div class="rk-profile-meta">队伍 · 编号 #1001 · 球衣 10 · 17 岁 · 出生 …</div>
        <div class="rk-profile-meta-sub">预测 PHV … · 成熟度偏移 … · 评估日 …</div>
      </div>
      <div class="rk-profile-side">
        <div class="rk-mini-stats">
          <div class="rk-mini-stat"><span class="rk-mini-stat-label">身高</span>
            <span class="rk-mini-stat-value">175.2<em class="rk-mini-stat-unit">cm</em></span></div>
          <!-- x4 -->
        </div>
        <div class="rk-profile-actions"><button class="rk-btn">返回</button><button class="rk-btn rk-btn-primary">+ 新增测量</button></div>
      </div>
    </section>

    <div class="rk-banner is-tone-red">不建议参训 …</div><!-- 仅预警态 -->

    <nav class="rk-tabs">
      <button class="rk-tab" :class="{ 'is-active': tab==='a' }" @click="tab='a'">小组归属</button>
      <!-- … -->
    </nav>

    <div class="rk-tab-panel" v-show="tab==='a'">
      <div class="rk-toolbar"><button class="rk-btn rk-btn-primary rk-btn-sm">+ 加入</button></div>
      <div class="rk-card">
        <div class="rk-card-head"><div class="rk-card-head-main"><h3 class="rk-card-title">标题</h3>
          <span class="rk-card-sub">共 N 条</span></div><div class="rk-card-actions"></div></div>
        <div class="rk-card-body flush">
          <div class="rk-table-scroll"><table class="rk-table">…</table></div>
        </div>
      </div>
    </div>
  </div>
  <!-- 原 el-dialog 全部保留 -->
</div>
```

要点：`.rk-desc-grid` 是 4 列描述网格（≤1200→2 列、≤900→1 列）；`.rk-rtp-panel` 左侧 4px 状态条 + `tone-green/amber/red/gray`；徽章统一 `rk-status-badge is-tone-*`；表格仍包 `rk-table-scroll` 防溢出。

## 10. right-toolbar 收敛为 32px 描边钮

```scss
.xx-col-toolbar { margin-right: 2px; }
.xx-col-toolbar :deep(.el-button) {
  width: 32px; height: 32px; padding: 0;
  border: 1px solid $rk-line; border-radius: 10px;
  background: #fff; color: $rk-text-2;
  &:hover { background: $rk-canvas; color: $rk-brand-600; border-color: $rk-brand-500; }
}
```

## 11. 看板壳层结构（dashboard 模式）

```html
<div class="app-container">
  <div class="rk-dash-page rk-page">
    <div class="rk-header">
      <div>
        <h1 class="rk-title">数据总览驾驶舱</h1>
        <p class="rk-subtitle">副标题</p>
      </div>
      <div class="rk-header-actions"><span class="db-scope-hint">提示 pill</span></div>
    </div>

    <div class="rk-kpi-grid">
      <div class="rk-kpi-card" v-for="k in kpiCards" :key="k.label">
        <span class="rk-kpi-accent" :style="{ background: k.accent }"></span>
        <div class="rk-kpi-label">{{ k.label }}</div>
        <div class="rk-kpi-value">{{ k.value }}<span class="rk-kpi-unit" v-if="k.unit">{{ k.unit }}</span></div>
        <span class="rk-kpi-chip" :class="k.chipTone">{{ k.chip }}</span>
      </div>
    </div>

    <div class="rk-chips-bar" v-if="keys.length">
      <span class="rk-chips-bar-label">队伍分布</span>
      <span class="rk-soft-chip" v-for="k in keys" :key="k">{{ k }} · {{ dist[k] }} 人</span>
    </div>

    <div class="rk-chart-grid">
      <div class="rk-chart-card" v-for="g in charts" :key="g.title">
        <div class="rk-chart-head">
          <span class="rk-chart-title">{{ g.title }}</span>
          <span class="rk-chart-sub">{{ g.sub }}</span>
          <div class="rk-chart-actions" v-if="g.select">…el-select.db-select…</div>
        </div>
        <div class="rk-chart-body">
          <div :ref="g.ref" class="rk-chart-box"></div>
          <div class="rk-chart-empty" v-if="!g.hasData">暂无数据</div>
        </div>
      </div>
    </div>

    <!-- 汇总表：rk-table + rk-progress + rk-status-badge -->
  </div>
</div>
```

ECharts 主题常量 + ResizeObserver 生命周期：

```js
const C = {
  brand: '#2563EB', brandLight: '#3B82F6', cyan: '#06B6D4', violet: '#8B5CF6', indigo: '#6366F1',
  ok: '#16A34A', okLight: '#4ADE80', warn: '#D97706', risk: '#DC2626', riskLight: '#F87171', slate: '#CBD5E1'
}
const AXIS_LABEL = { fontSize: 11, color: '#94A3B8' }
const SPLIT_LINE = { lineStyle: { color: '#EEF2F7' } }
const DARK_TOOLTIP = {
  backgroundColor: '#0F172A', borderWidth: 0, padding: [8, 12],
  textStyle: { color: '#fff', fontSize: 12 },
  extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.18);'
}
const LEGEND_TEXT = { fontSize: 11, color: '#64748B' }

let resizeObserver = null
function handleResize() { charts.forEach(c => c && c.resize()) }
// initCharts() 末尾（数据到达 nextTick 后）：
if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
  resizeObserver = new ResizeObserver(handleResize)   // 一个 observer 观察全部 box
  boxRefs.forEach(r => { if (r.value) resizeObserver.observe(r.value) })
}
onBeforeUnmount(() => {
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  charts.forEach((c, i) => { if (c) { c.dispose(); charts[i] = null } })
})
```

要点：正/负值横向柱渐变用 `new echarts.graphic.LinearGradient(0,0,1,0,[...])` 在 itemStyle.color 回调里按 `p.value` 分流；计数 y 轴加 `minInterval:1`；密集散点加 `labelLayout:{hideOverlap:true}` 且 grid right≥60；**不要**用 `window.addEventListener('resize')` 替代 RO（侧栏折叠无 window resize 事件）。

## 12. KPI 业务列表页（phv/bodyMeasure 模式）

部门树拍平为原生 select（全角空格缩进）：

```js
const deptOpts = ref([])                       // listDept({pageNum:1,pageSize:500}) 返回树
const flatDepts = computed(() => {
  const out = []
  const walk = (nodes, depth) => {
    (nodes || []).forEach(n => {
      out.push({ deptId: n.deptId, deptName: n.deptName, depth })
      if (n.children && n.children.length) walk(n.children, depth + 1)
    })
  }
  walk(deptOpts.value, 0)
  return out
})
```

```html
<select v-model="filters.deptId" class="rk-select">
  <option :value="null">全部队伍</option>
  <option v-for="d in flatDepts" :key="d.deptId" :value="d.deptId">
    {{ '\u3000'.repeat(d.depth) }}{{ d.deptName }}
  </option>
</select>
```

全量加载 + 即时 computed 过滤（无分页、无防抖；行数据只有队伍名字符串，按 deptName 匹配）：

```js
const rawData = ref([])
const filters = reactive({ keyword: '', deptId: null })
const filteredData = computed(() => {
  let arr = rawData.value
  const kw = filters.keyword.trim()
  if (kw) arr = arr.filter(r => (r.athleteName || '').includes(kw))
  if (filters.deptId != null) {
    const dept = flatDepts.value.find(d => d.deptId === filters.deptId)
    if (dept) arr = arr.filter(r => r.athleteTeam === dept.deptName)
  }
  return arr
})
function resetFilter() { filters.keyword = ''; filters.deptId = null }
```

前端 KPI summary（均值只算非空；去重按业务主键 Set）：

```js
const summary = reactive({ total: 0, athletes: 0, avgX: '—' })
function buildSummary(arr) {
  summary.total = arr.length
  summary.athletes = new Set(arr.map(r => r.athleteId)).size
  const vals = arr.filter(r => r.x != null && r.x !== '').map(r => Number(r.x))
  summary.avgX = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
}
// loadList 成功后 buildSummary(res.data || [])
```

要点：KPI 卡带用 `<div class="rk-kpi-grid is-4">`（4 卡，≥1100px 四列）；业务弹窗（计算/upsert）的 reactive 状态名、提交方式（params vs data）、按钮文案以源码为准原样搬；表格无 rk-pager，外壳仍包 `rk-table-scroll`。

## 13. 状态看板（rtp 模式）+ 主从双栏（medical 模式）

### 13a. 看板列 + HTML5 拖拽 + confirm 落库

```html
<div class="rk-kanban-grid">
  <div v-for="col in COLUMNS" :key="col.key" class="rk-kanban-col" :class="col.tone"
       @dragover="onDragOver($event, col.key)" @dragleave="onDragLeave($event, col.key)"
       @drop="onDrop($event, col.key)">
    <div class="rk-kanban-head">
      <span class="rk-kanban-dot"></span>
      <span class="rk-kanban-title">{{ col.title }}</span>
      <span class="rk-kanban-count">{{ columnList(col.key).length }}</span>
      <span class="rk-kanban-hint">{{ col.hint }}</span>
    </div>
    <div class="rk-kanban-body">
      <div v-for="r in columnList(col.key)" :key="r.athleteId" class="rk-kanban-card"
           :draggable="canEdit" @dragstart="onDragStart($event, r)" @click="openDrawer(r)">
        <div class="rk-kanban-card-top">
          <span class="rk-avatar" :style="{background: avatarColorById(r.athleteId)}">{{ char(r) }}</span>
          <div><div class="rk-kanban-card-name">{{ r.athleteName }}</div>
               <div class="rk-kanban-card-sub">{{ r.athleteTeam || '—' }} · #{{ r.athleteId }}</div></div>
        </div>
        <div v-if="r.reason" class="rk-kanban-card-reason">{{ r.reason }}</div>
        <div v-if="col.key!=='g' && r.trainingLimit" class="rk-kanban-card-limit">限制：{{ r.trainingLimit }}</div>
        <div class="rk-kanban-card-foot">…复检日期（逾期 is-overdue / 临近 is-soon）…更新时间</div>
      </div>
      <div v-if="!columnList(col.key).length" class="rk-kanban-empty">暂无队员</div>
    </div>
  </div>
</div>
```

```js
import { checkPermi } from '@/utils/permission'
const canEdit = checkPermi(['apms:athlete:edit'])
const dragId = ref(null), dragOverKey = ref(null)
function onDragStart(e, r) { dragId.value = r.athleteId; e.dataTransfer.setData('text/plain', String(r.athleteId)); e.dataTransfer.effectAllowed = 'move' }
function onDragOver(e, key) { e.preventDefault(); dragOverKey.value = key; e.dataTransfer.dropEffect = 'move' }
function onDragLeave(e, key) {
  // 只在离开整列时清高亮，避免卡片内部子元素间移动导致闪烁
  const col = e.currentTarget
  if (!e.relatedTarget || !col.contains(e.relatedTarget)) { if (dragOverKey.value === key) dragOverKey.value = null }
}
function onDrop(e, targetKey) {
  e.preventDefault(); dragOverKey.value = null
  const id = dragId.value || Number(e.dataTransfer.getData('text/plain')); dragId.value = null
  const row = fullList.value.find(x => x.athleteId === id)
  if (!row || (row.status || 'na') === targetKey) return           // 同列跳过
  proxy.$modalConfirmRow(row, targetKey)                            // 先 confirm 再落库
}
// confirm：取消不做任何事；确定后按目标 key 分流 update/clear，成功 loadAll + 同步抽屉
```

列高亮态绑 `:class="{'is-dragover': dragOverKey===col.key}"`，卡片拖拽中 `:class="{'is-dragging': dragId===r.athleteId}"`；只读（无权限）卡片不可拖（`:draggable` 即可，不需要 is-readonly 修饰）。

### 13b. el-drawer 详情（currentId + computed 防陈旧）

```html
<el-drawer v-model="drawerOpen" size="460px" :with-header="false" direction="rtl">
  <div class="rk-drawer-head">
    <span class="rt-avatar-lg" :style="{background: avatarColorById(cur.athleteId)}">{{ char(cur) }}</span>
    <div><div class="rk-drawer-name">{{ cur.athleteName }} <span class="rk-status-badge" :class="statusTone(cur)">{{ statusLabel(cur) }}</span></div>
         <div class="rk-drawer-sub">{{ cur.athleteTeam || '—' }} · #{{ cur.athleteId }}</div></div>
    <button class="rk-drawer-close" @click="drawerOpen=false"><el-icon><Close /></el-icon></button>
  </div>
  <!-- rk-rtp-panel（tone 跟状态）+ 快捷按钮组（v-hasPermi，当前状态按钮隐藏）+ el-timeline + 底部危险钮 -->
</el-drawer>
```

```js
const currentId = ref(null)
const currentAthlete = computed(() => fullList.value.find(x => x.athleteId === currentId.value)) // loadAll 后自动不陈旧
const logList = ref([])
function openDrawer(r) { currentId.value = r.athleteId; drawerOpen.value = true; loadLog(r.athleteId) }
async function loadLog(id) { const res = await getLog(id); if (currentId.value === id) logList.value = res.data || [] }
```

scoped 收敛：`:deep(.el-drawer__body){padding:0}`；el-timeline node 10px、`--el-timeline-node-size`、wrapper padding-left、timestamp 静态灰字。

### 13c. split-grid 主从双栏 + 服务端分页/防抖重置

```html
<div class="rk-split-grid" style="--rk-split-l:11fr;--rk-split-r:13fr">
  <div class="rk-table-card">
    <table class="rk-table">
      <tbody>
        <tr v-for="row in recordList" :key="row.id" :class="{'is-selected': current && current.id===row.id}" @click="handleRowClick(row)">…</tr>
      </tbody>
    </table>
    <div class="rk-pager" v-if="total>0">…PAGE_SIZE=10、pageNumbers 省略号、goPage…</div>
  </div>
  <div class="rk-card">
    <template v-if="current">
      <div class="md-detail-banner" :style="bannerStyle(current.recordType)">…chip + 标题 + 日期/机构/队员…</div>
      <div class="rk-card-body">…说明…附件（current.files）…</div>
    </template>
    <div v-else class="rk-empty">选择左侧记录查看详情</div>
  </div>
</div>
```

```js
// 重置防 watcher 双请求
let filterGuard = false
function resetQuery() {
  filterGuard = true
  queryParams.f1 = null; queryParams.f2 = null; queryParams.pageNum = 1
  getList(); loadStats()
  nextTick(() => { filterGuard = false })
}
watch(() => [queryParams.f1, queryParams.f2], () => {
  if (filterGuard) return
  clearTimeout(filterTimer); filterTimer = setTimeout(handleQuery, 300)
})

// list 不回传子集合：KPI + 行计数胶囊靠并发 getById（seq 防竞态）
const fileCountMap = ref({}); let statsSeq = 0
function loadStats() {
  const seq = ++statsSeq
  listX({ pageNum: 1, pageSize: 500 }).then(async r => {
    const rows = r.rows || []
    if (seq !== statsSeq) return
    const details = await Promise.all(rows.map(x => getX(x.id).then(d => d.data).catch(() => null)))
    if (seq !== statsSeq) return
    const map = {}; let n = 0
    details.forEach((d, i) => { const c = (d?.files?.length) || 0; map[rows[i].id] = c; n += c })
    fileCountMap.value = map; stats.files = n
  })
}

// 编辑回填同样必须 getById，否则后端「删旧增新」会清空附件
function handleEdit(row) {
  getX(row.id).then(res => { const detail = res.data || row; Object.assign(form, detail); form.fileList = (detail.files||[]).map(/* uid/name/url */); form.files = (detail.files||[]).map(/* 提交体字段 */); showDialog.value = true })
}
```

### 13d. 带 Bearer 的私有文件下载（兼容 200+JSON 业务错误）

```js
async function handleDownload(f) {
  const res = await fetch(import.meta.env.VITE_APP_BASE_API + downloadUrl(f.id), {
    headers: { Authorization: 'Bearer ' + getToken() }
  })
  if (!res.ok) return proxy.$modal.msgError('下载失败或无下载权限')
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    const err = await res.json().catch(() => null)
    return proxy.$modal.msgError(err?.msg || '下载失败')   // 若依：业务错误 HTTP 200 + {code:500,msg}
  }
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: f.fileName })
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}
```

