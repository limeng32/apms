# 可复用代码骨架（速查）

以下为字段无关骨架，实际改造时**优先从标杆范例直接复制改名**（role/index.vue、user/index.vue、dept/index.vue）。

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

## 9. right-toolbar 收敛为 32px 描边钮

```scss
.xx-col-toolbar { margin-right: 2px; }
.xx-col-toolbar :deep(.el-button) {
  width: 32px; height: 32px; padding: 0;
  border: 1px solid $rk-line; border-radius: 10px;
  background: #fff; color: $rk-text-2;
  &:hover { background: $rk-canvas; color: $rk-brand-600; border-color: $rk-brand-500; }
}
```
