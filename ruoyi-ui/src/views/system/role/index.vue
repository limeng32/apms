<template>
  <div class="app-container rm-page">
    <!-- ===== 页头（花名册风格） ===== -->
    <div class="rk-header">
      <div>
        <h1 class="rk-title">角色权限管理</h1>
        <p class="rk-subtitle">角色权限分配 · 部门组织维护</p>
      </div>
    </div>

    <!-- ===== 子模块 Tab：角色权限 / 部门管理 ===== -->
    <div class="rk-tabs rm-tabs">
      <button
        class="rk-tab"
        :class="{ 'is-active': activeTab === 'role' }"
        @click="switchTab('role')"
      >角色权限</button>
      <button
        v-if="canViewDept"
        class="rk-tab"
        :class="{ 'is-active': activeTab === 'dept' }"
        @click="switchTab('dept')"
      >部门管理</button>
    </div>

    <!-- ===== 子模块：角色权限 ===== -->
    <div v-show="activeTab === 'role'" class="rm-tab-panel">
      <div class="rk-header rm-sub-header">
        <div>
          <h2 class="rk-sub-title">{{ total }} 个角色</h2>
        </div>
        <div class="rk-header-actions">
        <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" class="rm-col-toolbar" />
        <el-button v-if="ids.length" plain class="rk-btn" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:role:edit']">
          <el-icon><Edit /></el-icon>修改选中
        </el-button>
        <el-button v-if="ids.length" plain class="rk-btn rk-btn-danger" @click="handleDelete()" v-hasPermi="['system:role:remove']">
          <el-icon><Delete /></el-icon>已选 {{ ids.length }} 项 · 删除
        </el-button>
        <el-button plain class="rk-btn" @click="handleExport" v-hasPermi="['system:role:export']">
          <el-icon><Download /></el-icon>导出
        </el-button>
        <el-button type="primary" class="rk-btn rk-btn-primary" :icon="Plus" @click="handleAdd" v-hasPermi="['system:role:add']">新增角色</el-button>
      </div>
    </div>

    <!-- ===== 筛选条卡片 ===== -->
    <div class="rk-filter rm-filter" v-show="showSearch">
      <label class="rk-group">
        <span class="rk-label">角色名称</span>
        <input v-model="queryParams.roleName" class="rk-input" type="text" placeholder="角色名称" @keyup.enter="handleQuery" />
      </label>

      <label class="rk-group">
        <span class="rk-label">权限字符</span>
        <input v-model="queryParams.roleKey" class="rk-input rm-input-key" type="text" placeholder="权限字符" @keyup.enter="handleQuery" />
      </label>

      <label class="rk-group">
        <span class="rk-label">状态</span>
        <select v-model="queryParams.status" class="rk-select">
          <option value="">全部</option>
          <option v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</option>
        </select>
      </label>

      <label class="rk-group rm-date-field">
        <span class="rk-label">创建时间</span>
        <el-date-picker
          v-model="dateRange"
          class="rm-date-picker"
          value-format="YYYY-MM-DD"
          type="daterange"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
      </label>

      <div class="rk-filter-right">
        <button type="button" class="rk-btn-reset" @click="resetQuery">
          <el-icon><RefreshLeft /></el-icon>重置
        </button>
      </div>
    </div>

    <!-- ===== 角色表格卡片 ===== -->
    <div v-loading="loading" class="rk-table-card">
      <div class="rk-table-scroll">
        <table class="rk-table rm-table">
          <thead>
            <tr>
              <th class="col-check">
                <input
                  ref="headCheckRef"
                  type="checkbox"
                  class="rk-check"
                  :checked="allChecked"
                  @change="toggleAll($event)"
                />
              </th>
              <th class="text-left col-id">编号</th>
              <th class="text-left">角色名称</th>
              <th class="text-left">权限字符</th>
              <th class="text-left col-sort">顺序</th>
              <th class="text-left">状态</th>
              <th class="text-left col-time">创建时间</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in roleList"
              :key="row.roleId"
              class="rk-row"
              :class="{ 'is-zebra': idx % 2 === 1 }"
            >
              <td class="col-check">
                <input
                  type="checkbox"
                  class="rk-check"
                  :disabled="!checkRowSelectable(row)"
                  :checked="ids.includes(row.roleId)"
                  @change="toggleRow(row)"
                />
              </td>
              <td class="col-id">
                <span class="rk-mono rk-dash">#{{ row.roleId }}</span>
              </td>
              <td>
                <div class="rk-person">
                  <span class="rk-avatar rm-avatar" :style="{ background: avatarColor(row) }">{{ avatarChar(row) }}</span>
                  <div class="rk-person-meta">
                    <span class="rk-person-main rm-name-text" :title="row.roleName">{{ row.roleName }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="rk-mono rk-soft-chip rm-key-chip" :title="row.roleKey">{{ row.roleKey }}</span>
              </td>
              <td class="col-sort">
                <span class="rk-mono rk-num">{{ row.roleSort }}</span>
              </td>
              <td>
                <button
                  type="button"
                  class="rk-status-badge"
                  :class="'tone-' + statusMeta(row).tone"
                  :title="isReadonlyRole(row) ? '系统内置角色不可停用' : (row.status === '0' ? '点击停用' : '点击启用')"
                  :disabled="isReadonlyRole(row)"
                  @click="toggleStatus(row)"
                >
                  <span class="rk-status-dot-wrap"><span class="rk-status-dot"></span></span>
                  {{ statusMeta(row).label }}
                </button>
              </td>
              <td class="col-time">
                <span class="rk-mono rk-num rm-cell-time" :title="fmtTime(row.createTime)">{{ fmtDate(row.createTime) }}</span>
              </td>
              <td>
                <div class="rk-actions">
                  <template v-if="isReadonlyRole(row)">
                    <span class="rk-dash rm-builtin">系统内置 · 只读</span>
                  </template>
                  <template v-else-if="row.roleId === 1">
                    <span class="rk-dash rm-builtin">内置角色</span>
                  </template>
                  <template v-else>
                    <button type="button" class="rk-link" @click="handleUpdate(row)" v-hasPermi="['system:role:edit']">编辑 →</button>
                    <div class="rk-menu" @click.stop>
                      <button type="button" class="rk-menu-btn" aria-label="更多操作" @click="toggleMenu(row.roleId)">
                        <el-icon><MoreFilled /></el-icon>
                      </button>
                      <div v-if="openMenuId === row.roleId" class="rk-menu-pop">
                        <button
                          type="button"
                          class="rk-menu-item is-danger"
                          @click="onMenu(row, 'delete')"
                          v-hasPermi="['system:role:remove']"
                        ><el-icon><Delete /></el-icon>删除</button>
                        <button
                          type="button"
                          class="rk-menu-item"
                          @click="onMenu(row, 'dataScope')"
                          v-hasPermi="['system:role:edit']"
                        ><el-icon><CircleCheck /></el-icon>数据权限</button>
                        <button
                          type="button"
                          class="rk-menu-item"
                          @click="onMenu(row, 'authUser')"
                          v-hasPermi="['system:role:edit']"
                        ><el-icon><User /></el-icon>分配用户</button>
                      </div>
                    </div>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="!loading && roleList.length === 0" class="rk-empty">
          <p class="rk-empty-title">没有匹配的角色</p>
          <p class="rk-empty-desc">请调整筛选条件后重试</p>
        </div>
      </div>

      <!-- ===== 分页（花名册风格，每页 12 条） ===== -->
      <div class="rk-pager">
        <span class="rk-pager-info">
          共 <b class="rk-mono">{{ total }}</b> 个角色 · 每页 <span class="rk-mono">{{ queryParams.pageSize }}</span> 条
        </span>
        <div class="rk-pager-btns">
          <button type="button" class="rk-page-btn" :disabled="queryParams.pageNum <= 1" @click="goPage(queryParams.pageNum - 1)">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <template v-for="p in pageNumbers" :key="p">
            <span v-if="p === '…'" class="rk-page-btn is-ellipsis rk-mono">…</span>
            <button
              v-else
              type="button"
              class="rk-page-btn rk-mono"
              :class="{ 'is-active': p === queryParams.pageNum }"
              @click="goPage(p)"
            >{{ p }}</button>
          </template>
          <button type="button" class="rk-page-btn" :disabled="queryParams.pageNum >= totalPages" @click="goPage(queryParams.pageNum + 1)">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </div>
    </div>
    </div><!-- /角色权限 panel -->

    <!-- ===== 子模块：部门管理（复用 system/dept 页面，super 可建 APMS 总部下级） ===== -->
    <div v-if="canViewDept && deptMounted" v-show="activeTab === 'dept'" class="rm-tab-panel">
      <DeptPage embedded />
    </div>

    <!-- 添加或修改角色配置对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form ref="roleRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="form.roleName" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item prop="roleKey">
          <template #label>
            <span>
              <el-tooltip content="控制器中定义的权限字符，如：@PreAuthorize(`@ss.hasRole('admin')`)" placement="top">
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
              权限字符
            </span>
          </template>
          <el-input v-model="form.roleKey" placeholder="请输入权限字符" />
        </el-form-item>
        <el-form-item label="角色顺序" prop="roleSort">
          <el-input-number v-model="form.roleSort" controls-position="right" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio
              v-for="dict in sys_normal_disable"
              :key="dict.value"
              :value="dict.value"
            >{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Portal模式">
          <el-switch v-model="form.portalMode" active-value="1" inactive-value="0" />
          <span class="form-tip">开启后为专岗账号（无导航精简界面、强制单角色）</span>
        </el-form-item>
        <el-form-item v-if="form.portalMode === '1'" label="落地页" prop="homePath">
          <el-select v-model="form.homePath" placeholder="请先勾选菜单，再选择落地页">
            <el-option
              v-for="item in homePathOptions"
              :key="item.menuId"
              :label="item.fullPath"
              :value="item.fullPath"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="菜单权限">
          <el-checkbox v-model="menuExpand" @change="handleCheckedTreeExpand($event, 'menu')">展开/折叠</el-checkbox>
          <el-checkbox v-model="menuNodeAll" @change="handleCheckedTreeNodeAll($event, 'menu')">全选/全不选</el-checkbox>
          <el-checkbox v-model="form.menuCheckStrictly" @change="handleCheckedTreeConnect($event, 'menu')">父子联动</el-checkbox>
          <el-tree
            class="tree-border"
            :data="menuOptions"
            show-checkbox
            ref="menuRef"
            node-key="id"
            :check-strictly="!form.menuCheckStrictly"
            empty-text="加载中，请稍候"
            :props="{ label: 'label', children: 'children' }"
            @check="handleMenuCheck"
          ></el-tree>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" placeholder="请输入内容"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 分配角色数据权限对话框 -->
    <el-dialog :title="title" v-model="openDataScope" width="500px" append-to-body>
      <el-form :model="form" label-width="80px">
        <el-form-item label="角色名称">
          <el-input v-model="form.roleName" :disabled="true" />
        </el-form-item>
        <el-form-item label="权限字符">
          <el-input v-model="form.roleKey" :disabled="true" />
        </el-form-item>
        <el-form-item label="权限范围">
          <el-select v-model="form.dataScope" @change="dataScopeSelectChange">
            <el-option
              v-for="item in dataScopeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="数据权限" v-show="form.dataScope == 2">
          <el-checkbox v-model="deptExpand" @change="handleCheckedTreeExpand($event, 'dept')">展开/折叠</el-checkbox>
          <el-checkbox v-model="deptNodeAll" @change="handleCheckedTreeNodeAll($event, 'dept')">全选/全不选</el-checkbox>
          <el-checkbox v-model="form.deptCheckStrictly" @change="handleCheckedTreeConnect($event, 'dept')">父子联动</el-checkbox>
          <el-tree
            class="tree-border"
            :data="deptOptions"
            show-checkbox
            default-expand-all
            ref="deptRef"
            node-key="id"
            :check-strictly="!form.deptCheckStrictly"
            empty-text="加载中，请稍候"
            :props="{ label: 'label', children: 'children' }"
          ></el-tree>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitDataScope">确 定</el-button>
          <el-button @click="cancelDataScope">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Role">
import { addRole, changeRoleStatus, dataScope, delRole, getRole, listRole, updateRole, deptTreeSelect } from "@/api/system/role"
import { roleMenuTreeselect, treeselect as menuTreeselect, roleMenuFlatList } from "@/api/system/menu"
import { Plus, RefreshLeft, MoreFilled, ArrowLeft, ArrowRight, Download, Edit, Delete, CircleCheck, User } from '@element-plus/icons-vue'
import useUserStore from "@/store/modules/user"
import { checkPermi } from '@/utils/permission'
import DeptPage from '../dept/index.vue'

const router = useRouter()
const { proxy } = getCurrentInstance()
const { sys_normal_disable } = useDict("sys_normal_disable")

/* ===== 子模块 Tab ===== */
const activeTab = ref('role')
// 部门管理仅对具备 dept:list 的角色呈现（super/admin）；首次切换时才挂载，避免提前请求
const canViewDept = checkPermi(['system:dept:list'])
const deptMounted = ref(false)
function switchTab(key) {
  activeTab.value = key
  if (key === 'dept') deptMounted.value = true
}

const PAGE_SIZE = 12
const roleList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const total = ref(0)
const title = ref("")
const dateRange = ref([])
const menuOptions = ref([])
const menuExpand = ref(false)
const menuNodeAll = ref(false)
const deptExpand = ref(true)
const deptNodeAll = ref(false)
const deptOptions = ref([])
const openDataScope = ref(false)
const menuRef = ref(null)
const deptRef = ref(null)
const openMenuId = ref(null)
const headCheckRef = ref(null)
// 全量菜单平铺数据（用于落地页路径拼接），当前树勾选的菜单ID
const menuAllList = ref([])
const checkedMenuIds = ref([])

/** 数据范围选项*/
const dataScopeOptions = ref([
  { value: "1", label: "全部数据权限" },
  { value: "2", label: "自定数据权限" },
  { value: "3", label: "本部门数据权限" },
  { value: "4", label: "本部门及以下数据权限" },
  { value: "5", label: "仅本人数据权限" }
])

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: PAGE_SIZE,
    roleName: undefined,
    roleKey: undefined,
    status: undefined
  },
  rules: {
    roleName: [{ required: true, message: "角色名称不能为空", trigger: "blur" }],
    roleKey: [{ required: true, message: "权限字符不能为空", trigger: "blur" }],
    roleSort: [{ required: true, message: "角色顺序不能为空", trigger: "blur" }]
  },
})

const { queryParams, form, rules } = toRefs(data)

/** business_admin 对 super 只读；平台 admin 可正常管理（用于交付方调整 super 权限） */
const isPlatformAdmin = computed(() => useUserStore().roles.includes('admin'))
function isReadonlyRole(row) {
  return row.roleKey === 'business_admin' && !isPlatformAdmin.value
}
function checkRowSelectable(row) {
  return !isReadonlyRole(row)
}

/* ===== 花名册风格展示辅助 ===== */
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6']
function avatarChar(row) {
  const s = (row.roleName || '?').trim()
  return s.charAt(0)
}
function avatarColor(row) {
  const s = row.roleName || row.roleKey || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function statusMeta(row) {
  return row.status === '0' ? { tone: 'green', label: '正常' } : { tone: 'gray', label: '停用' }
}
function fmtTime(t) {
  return t ? proxy.parseTime(t) : '—'
}
function fmtDate(t) {
  return t ? proxy.parseTime(t, '{y}-{m}-{d}') : '—'
}

/* ===== 分页 ===== */
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNumbers = computed(() => {
  const pages = totalPages.value
  const cur = queryParams.value.pageNum
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

/* ===== 多选（当前页可选行） ===== */
const selectableRows = computed(() => (roleList.value || []).filter(checkRowSelectable))
const allChecked = computed(() => selectableRows.value.length > 0 && selectableRows.value.every(r => ids.value.includes(r.roleId)))
const someIndeterminate = computed(() => ids.value.length > 0 && !allChecked.value)
watch([allChecked, someIndeterminate], () => {
  nextTick(() => {
    if (headCheckRef.value) headCheckRef.value.indeterminate = someIndeterminate.value
  })
})
function syncSelectionFlags() {
  single.value = ids.value.length !== 1
}
function toggleRow(row) {
  const i = ids.value.indexOf(row.roleId)
  if (i >= 0) ids.value.splice(i, 1)
  else ids.value.push(row.roleId)
  syncSelectionFlags()
}
function toggleAll(ev) {
  const checked = ev.target.checked
  const pageIds = selectableRows.value.map(r => r.roleId)
  if (checked) {
    const set = new Set([...ids.value, ...pageIds])
    ids.value = Array.from(set)
  } else {
    ids.value = ids.value.filter(id => !pageIds.includes(id))
  }
  syncSelectionFlags()
}

/* ===== 行内操作菜单 ===== */
function onDocClick() {
  openMenuId.value = null
}
function toggleMenu(id) {
  if (openMenuId.value === id) {
    openMenuId.value = null
    document.removeEventListener('click', onDocClick)
  } else {
    openMenuId.value = id
    document.addEventListener('click', onDocClick)
  }
}
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
function onMenu(row, action) {
  openMenuId.value = null
  if (action === 'delete') handleDelete(row)
  else if (action === 'dataScope') handleDataScope(row)
  else if (action === 'authUser') handleAuthUser(row)
}

/** 菜单树勾选变化：同步落地页候选 */
function handleMenuCheck() {
  // 含半选父节点：带 F 子权限的 C 菜单处于半选态，仍可作为落地页候选
  checkedMenuIds.value = [...menuRef.value.getCheckedKeys(), ...menuRef.value.getHalfCheckedKeys()]
}

/** 查询全量菜单平铺数据 */
function getMenuList() {
  return roleMenuFlatList().then(response => {
    menuAllList.value = response.data
  })
}

/** 沿父链拼菜单完整路由（与后端校验逻辑一致） */
function buildMenuFullPath(menu) {
  const parts = []
  let current = menu
  const guard = new Set()
  while (current && !guard.has(current.menuId)) {
    guard.add(current.menuId)
    if (current.path) parts.unshift(current.path)
    current = menuAllList.value.find(item => item.menuId === current.parentId)
  }
  return '/' + parts.join('/')
}

/** 落地页候选：当前已勾选的C型菜单 */
const homePathOptions = computed(() => {
  const idSet = new Set(checkedMenuIds.value)
  return menuAllList.value
    .filter(menu => menu.menuType === 'C' && idSet.has(menu.menuId))
    .map(menu => ({ menuId: menu.menuId, fullPath: buildMenuFullPath(menu) }))
})

/** 查询角色列表 */
function getList() {
  loading.value = true
  listRole(proxy.addDateRange(queryParams.value, dateRange.value)).then(response => {
    roleList.value = response.rows
    total.value = response.total
    loading.value = false
    // 当前页删除后可能落在空页，自动回退一页
    if (!response.rows.length && queryParams.value.pageNum > 1) {
      queryParams.value.pageNum -= 1
      getList()
    }
  }).catch(() => {
    loading.value = false
  })
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/* 筛选条件变化（名称/权限字符/状态/创建时间）自动防抖查询 */
let filterTimer = null
watch(
  () => [queryParams.value.roleName, queryParams.value.roleKey, queryParams.value.status, dateRange.value && dateRange.value.join(',')],
  () => {
    clearTimeout(filterTimer)
    filterTimer = setTimeout(handleQuery, 300)
  }
)

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = []
  queryParams.value.roleName = undefined
  queryParams.value.roleKey = undefined
  queryParams.value.status = undefined
  queryParams.value.pageNum = 1
  getList()
}

/** 删除按钮操作 */
function handleDelete(row) {
  const roleIds = row.roleId || ids.value
  proxy.$modal.confirm('是否确认删除角色编号为"' + roleIds + '"的数据项?').then(function () {
    return delRole(roleIds)
  }).then(() => {
    ids.value = []
    syncSelectionFlags()
    getList()
    proxy.$modal.msgSuccess("删除成功")
  }).catch(() => {})
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download("system/role/export", {
    ...queryParams.value,
  }, `role_${new Date().getTime()}.xlsx`)
}

/** 状态徽章点击：先翻转，沿用原 el-switch 的确认/回滚口径 */
function toggleStatus(row) {
  if (isReadonlyRole(row)) return
  row.status = row.status === "0" ? "1" : "0"
  handleStatusChange(row)
}

/** 角色状态修改 */
function handleStatusChange(row) {
  let text = row.status === "0" ? "启用" : "停用"
  proxy.$modal.confirm('确认要"' + text + '""' + row.roleName + '"角色吗?').then(function () {
    return changeRoleStatus(row.roleId, row.status)
  }).then(() => {
    proxy.$modal.msgSuccess(text + "成功")
  }).catch(function () {
    row.status = row.status === "0" ? "1" : "0"
  })
}

/** 分配用户 */
function handleAuthUser(row) {
  router.push("/system/role-auth/user/" + row.roleId)
}

/** 查询菜单树结构 */
function getMenuTreeselect() {
  menuTreeselect().then(response => {
    menuOptions.value = response.data
  })
}

/** 所有部门节点数据 */
function getDeptAllCheckedKeys() {
  // 目前被选中的部门节点
  let checkedKeys = deptRef.value.getCheckedKeys()
  // 半选中的部门节点
  let halfCheckedKeys = deptRef.value.getHalfCheckedKeys()
  checkedKeys.unshift.apply(checkedKeys, halfCheckedKeys)
  return checkedKeys
}

/** 重置新增的表单以及其他数据  */
function reset() {
  if (menuRef.value != undefined) {
    menuRef.value.setCheckedKeys([])
  }
  menuExpand.value = false
  menuNodeAll.value = false
  deptExpand.value = true
  deptNodeAll.value = false
  checkedMenuIds.value = []
  form.value = {
    roleId: undefined,
    roleName: undefined,
    roleKey: undefined,
    roleSort: 0,
    status: "0",
    portalMode: "0",
    homePath: undefined,
    menuIds: [],
    deptIds: [],
    menuCheckStrictly: true,
    deptCheckStrictly: true,
    remark: undefined
  }
  proxy.resetForm("roleRef")
}

/** 添加角色 */
function handleAdd() {
  reset()
  getMenuTreeselect()
  getMenuList()
  open.value = true
  title.value = "添加角色"
}

/** 修改角色 */
function handleUpdate(row) {
  reset()
  const roleId = row && row.roleId ? row.roleId : ids.value
  const roleMenu = getRoleMenuTreeselect(roleId)
  getMenuList()
  getRole(roleId).then(response => {
    form.value = response.data
    form.value.roleSort = Number(form.value.roleSort)
    open.value = true
    nextTick(() => {
      roleMenu.then((res) => {
        menuRef.value.setCheckedKeys(res.checkedKeys)
        checkedMenuIds.value = [...menuRef.value.getCheckedKeys(), ...menuRef.value.getHalfCheckedKeys()]
      })
    })
  })
  title.value = "修改角色"
}

/** 根据角色ID查询菜单树结构 */
function getRoleMenuTreeselect(roleId) {
  return roleMenuTreeselect(roleId).then(response => {
    menuOptions.value = response.menus
    return response
  })
}

/** 根据角色ID查询部门树结构 */
function getDeptTree(roleId) {
  return deptTreeSelect(roleId).then(response => {
    deptOptions.value = response.depts
    return response
  })
}

/** 树权限（展开/折叠）*/
function handleCheckedTreeExpand(value, type) {
  if (type == "menu") {
    let treeList = menuOptions.value
    for (let i = 0; i < treeList.length; i++) {
      menuRef.value.store.nodesMap[treeList[i].id].expanded = value
    }
  } else if (type == "dept") {
    let treeList = deptOptions.value
    for (let i = 0; i < treeList.length; i++) {
      deptRef.value.store.nodesMap[treeList[i].id].expanded = value
    }
  }
}

/** 树权限（全选/全不选） */
function handleCheckedTreeNodeAll(value, type) {
  if (type == "menu") {
    menuRef.value.setCheckedNodes(value ? menuOptions.value : [])
  } else if (type == "dept") {
    deptRef.value.setCheckedNodes(value ? deptOptions.value : [])
  }
}

/** 树权限（父子联动） */
function handleCheckedTreeConnect(value, type) {
  if (type == "menu") {
    form.value.menuCheckStrictly = value ? true : false
  } else if (type == "dept") {
    form.value.deptCheckStrictly = value ? true : false
  }
}

/** 所有菜单节点数据 */
function getMenuAllCheckedKeys() {
  // 目前被选中的菜单节点
  let checkedKeys = menuRef.value.getCheckedKeys()
  // 半选中的菜单节点
  let halfCheckedKeys = menuRef.value.getHalfCheckedKeys()
  checkedKeys.unshift.apply(checkedKeys, halfCheckedKeys)
  return checkedKeys
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["roleRef"].validate(valid => {
    if (valid) {
      if (form.value.roleId != undefined) {
        form.value.menuIds = getMenuAllCheckedKeys()
        updateRole(form.value).then(() => {
          proxy.$modal.msgSuccess("修改成功")
          open.value = false
          getList()
        })
      } else {
        form.value.menuIds = getMenuAllCheckedKeys()
        addRole(form.value).then(() => {
          proxy.$modal.msgSuccess("新增成功")
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}

/** 选择角色权限范围触发 */
function dataScopeSelectChange(value) {
  if (value !== "2") {
    deptRef.value.setCheckedKeys([])
  }
}

/** 分配数据权限操作 */
function handleDataScope(row) {
  reset()
  const deptTreeSelect = getDeptTree(row.roleId)
  getRole(row.roleId).then(response => {
    form.value = response.data
    openDataScope.value = true
    nextTick(() => {
      deptTreeSelect.then(res => {
        nextTick(() => {
          if (deptRef.value) {
            deptRef.value.setCheckedKeys(res.checkedKeys)
          }
        })
      })
    })
  })
  title.value = "分配数据权限"
}

/** 提交按钮（数据权限） */
function submitDataScope() {
  if (form.value.roleId != undefined) {
    form.value.deptIds = getDeptAllCheckedKeys()
    dataScope(form.value).then(() => {
      proxy.$modal.msgSuccess("修改成功")
      openDataScope.value = false
      getList()
    })
  }
}

/** 取消按钮（数据权限）*/
function cancelDataScope() {
  openDataScope.value = false
  reset()
}

getList()
</script>

<style lang="scss" scoped>
@use "../../../assets/styles/roster-kit.scss" as *;

/* 全宽页面铺满 canvas 底色：
   侧栏 fixed（宽 200）+ 固定头部在文档流之外，负 margin 仅用于底色外扩，
   左右对称 40px 内边距，避免内容贴住视口右缘导致按钮被裁切 */
.rm-page {
  min-height: calc(100vh - 84px);
  margin: -20px;
  padding: 32px 40px 36px;
  background: $rk-canvas;
  overflow-x: hidden;
}

/* 子模块 Tab：紧贴总页头 */
.rm-tabs { margin-top: 4px; }

/* 角色权限面板内的次级工具行（计数 + 操作按钮）；
   左缘与 Tab 标签文字对齐（Tab 按钮自身有 16px 内边距），右侧仍贴卡片右缘 */
.rm-sub-header {
  margin: 18px 0 14px;
  padding-left: 16px;
  align-items: center;
}
.rk-sub-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: $rk-text-2;
}

.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 筛选条内 Element 组件收敛到 32px/10px 圆角 */
.rm-date-field {
  gap: 6px;
}
:deep(.rm-date-picker) {
  width: 260px;

  .el-range-editor.el-input__wrapper,
  .el-input__wrapper {
    height: 32px;
    border-radius: 10px;
    box-shadow: 0 0 0 1px $rk-line inset;
  }
  .el-range-input {
    font-size: 13px;
  }
}
.rm-filter :deep(.el-input__wrapper) {
  border-radius: 10px;
}
.rm-input-key {
  width: 160px;
}

/* 角色单元格 */
.rm-avatar {
  width: 32px;
  height: 32px;
  font-size: 13px;
}
.rk-person-meta { min-width: 0; }
.rm-name-text {
  display: block;
  max-width: 180px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.rm-key-chip {
  max-width: 180px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: $rk-text-2;
}
.rm-builtin {
  font-size: 12px;
}
.rm-cell-time { white-space: nowrap; }

/* 列宽 */
.rm-table .col-id { width: 60px; }
.rm-table .col-sort { width: 64px; }
.rm-table .col-time { width: 108px; }
.rm-table :is(thead th, tbody td) { padding-left: 12px; padding-right: 12px; }
@media (max-width: 1280px) {
  .rm-table .col-time { display: none; }
}
@media (max-width: 1080px) {
  .rm-table .col-id { display: none; }
}

/* 右上角工具按钮收敛为描边小按钮 */
.rm-col-toolbar {
  margin-right: 2px;
}
.rm-col-toolbar :deep(.el-button) {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid $rk-line;
  border-radius: 10px;
  background: #fff;
  color: $rk-text-2;
  &:hover {
    background: $rk-canvas;
    color: $rk-brand-600;
    border-color: $rk-brand-500;
  }
}
</style>
