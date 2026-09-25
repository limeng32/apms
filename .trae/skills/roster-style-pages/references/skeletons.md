# 可复用代码骨架（速查）

以下为字段无关骨架，实际改造时**优先从标杆范例直接复制改名**（role/index.vue、user/index.vue、dept/index.vue、athlete/detail.vue）。

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
