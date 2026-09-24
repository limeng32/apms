<template>
  <div class="app-container tree-sidebar-manage-wrap um-page">
    <tree-panel title="组织机构" :tree-data="deptOptions" search-placeholder="请输入部门名称" storage-key="dept-sidebar-width" :defaultExpandAll="true" @node-click="handleNodeClick" @refresh="getDeptTree" ref="deptTreeRef" />
    <div class="tree-sidebar-content">
      <div class="content-inner">
        <!-- ===== 页头（花名册风格） ===== -->
        <div class="rk-header">
          <div>
            <h1 class="rk-title">用户管理</h1>
            <p class="rk-subtitle">{{ total }} 个系统账户<template v-if="selectedDeptName"> · {{ selectedDeptName }}</template></p>
          </div>
          <div class="rk-header-actions">
            <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" :columns="columns" storageKey="xxxxxxxx" class="um-col-toolbar" />
            <el-button v-if="ids.length" plain class="rk-btn" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:user:edit']">
              <el-icon><Edit /></el-icon>修改选中
            </el-button>
            <el-button v-if="ids.length" plain class="rk-btn rk-btn-danger" @click="handleDelete()" v-hasPermi="['system:user:remove']">
              <el-icon><Delete /></el-icon>已选 {{ ids.length }} 人 · 删除
            </el-button>
            <el-button plain class="rk-btn" @click="handleImport" v-hasPermi="['system:user:import']">
              <el-icon><Upload /></el-icon>导入
            </el-button>
            <el-button plain class="rk-btn" @click="handleExport" v-hasPermi="['system:user:export']">
              <el-icon><Download /></el-icon>导出
            </el-button>
            <el-button type="primary" class="rk-btn rk-btn-primary" :icon="Plus" @click="handleAdd" v-hasPermi="['system:user:add']">新增用户</el-button>
          </div>
        </div>

        <!-- ===== 筛选条卡片 ===== -->
        <div class="rk-filter um-filter" v-show="showSearch">
          <span v-if="selectedDeptName" class="rk-chip-soft">
            部门：{{ selectedDeptName }}
            <button type="button" class="rk-chip-close" title="清除部门筛选" @click="clearDeptFilter">
              <el-icon><Close /></el-icon>
            </button>
          </span>

          <label class="rk-group">
            <span class="rk-label">用户名称</span>
            <input v-model="queryParams.userName" class="rk-input" type="text" placeholder="登录账号" @keyup.enter="handleQuery" />
          </label>

          <label class="rk-group">
            <span class="rk-label">手机号码</span>
            <input v-model="queryParams.phonenumber" class="rk-input" type="text" placeholder="手机号码" @keyup.enter="handleQuery" />
          </label>

          <label class="rk-group">
            <span class="rk-label">状态</span>
            <select v-model="queryParams.status" class="rk-select">
              <option value="">全部</option>
              <option v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</option>
            </select>
          </label>

          <label class="rk-group um-date-field">
            <span class="rk-label">创建时间</span>
            <el-date-picker
              v-model="dateRange"
              class="um-date-picker"
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

        <!-- ===== 用户表格卡片 ===== -->
        <div v-loading="loading" class="rk-table-card">
          <div class="rk-table-scroll">
            <table class="rk-table um-table">
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
                  <th class="text-left col-id" v-if="columns.userId.visible">编号</th>
                  <th class="text-left" v-if="columns.userName.visible">用户</th>
                  <th class="text-left" v-if="columns.deptName.visible">部门</th>
                  <th class="text-left" v-if="columns.phonenumber.visible">手机号码</th>
                  <th class="text-left" v-if="columns.status.visible">状态</th>
                  <th class="text-left col-time" v-if="columns.createTime.visible">创建时间</th>
                  <th class="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in userList"
                  :key="row.userId"
                  class="rk-row"
                  :class="{ 'is-zebra': idx % 2 === 1 }"
                >
                  <td class="col-check">
                    <input
                      type="checkbox"
                      class="rk-check"
                      :disabled="!checkRowSelectable(row)"
                      :checked="ids.includes(row.userId)"
                      @change="toggleRow(row)"
                    />
                  </td>
                  <td class="col-id" v-if="columns.userId.visible">
                    <span class="rk-mono rk-dash">#{{ row.userId }}</span>
                  </td>
                  <td v-if="columns.userName.visible">
                    <div class="rk-person">
                      <span class="rk-avatar" :style="{ background: avatarColor(row) }">{{ avatarChar(row) }}</span>
                      <div class="rk-person-meta">
                        <button type="button" class="rk-person-link um-name-text" :title="row.userName" @click="handleViewData(row)">{{ row.userName }}</button>
                        <p v-if="columns.nickName.visible" class="rk-person-sub um-ellipsis" :title="row.nickName">{{ row.nickName }}</p>
                      </div>
                    </div>
                  </td>
                  <td v-if="columns.deptName.visible">
                    <span v-if="row.dept && row.dept.deptName" class="rk-soft-chip um-ellipsis" :title="row.dept.deptName" style="max-width: 96px">{{ row.dept.deptName }}</span>
                    <span v-else class="rk-dash">—</span>
                  </td>
                  <td v-if="columns.phonenumber.visible">
                    <span v-if="row.phonenumber" class="rk-mono rk-num">{{ row.phonenumber }}</span>
                    <span v-else class="rk-dash">—</span>
                  </td>
                  <td v-if="columns.status.visible">
                    <button
                      type="button"
                      class="rk-status-badge"
                      :class="['tone-' + statusMeta(row).tone, { 'is-locked': statusLocked(row) }]"
                      :title="statusLocked(row) ? '内置/当前登录账户不可停用' : (row.status === '0' ? '点击停用' : '点击启用')"
                      :disabled="statusLocked(row)"
                      @click="toggleStatus(row)"
                    >
                      <span class="rk-status-dot-wrap"><span class="rk-status-dot"></span></span>
                      {{ statusMeta(row).label }}
                      <el-icon v-if="statusLocked(row)" class="um-lock-icon"><Lock /></el-icon>
                    </button>
                  </td>
                  <td class="col-time" v-if="columns.createTime.visible">
                    <span class="rk-mono rk-num um-cell-time" :title="fmtTime(row.createTime)">{{ fmtDate(row.createTime) }}</span>
                  </td>
                  <td>
                    <div class="rk-actions">
                      <template v-if="row.userId !== 1">
                        <button type="button" class="rk-link" @click="handleUpdate(row)" v-hasPermi="['system:user:edit']">编辑 →</button>
                        <div class="rk-menu" @click.stop>
                          <button type="button" class="rk-menu-btn" :aria-label="'更多操作'" @click="toggleMenu(row.userId)">
                            <el-icon><MoreFilled /></el-icon>
                          </button>
                          <div v-if="openMenuId === row.userId" class="rk-menu-pop">
                            <button
                              type="button"
                              class="rk-menu-item is-danger"
                              v-if="!isProtectedUser(row)"
                              @click="onMenu(row, 'delete')"
                              v-hasPermi="['system:user:remove']"
                            ><el-icon><Delete /></el-icon>删除</button>
                            <button
                              type="button"
                              class="rk-menu-item"
                              v-if="!isProtectedUser(row)"
                              @click="onMenu(row, 'resetPwd')"
                              v-hasPermi="['system:user:resetPwd']"
                            ><el-icon><Key /></el-icon>重置密码</button>
                            <button
                              type="button"
                              class="rk-menu-item"
                              v-if="!isProtectedUser(row)"
                              @click="onMenu(row, 'authRole')"
                              v-hasPermi="['system:user:edit']"
                            ><el-icon><CircleCheck /></el-icon>分配角色</button>
                          </div>
                        </div>
                      </template>
                      <span v-else class="rk-dash um-builtin">内置账户</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="!loading && userList.length === 0" class="rk-empty">
              <p class="rk-empty-title">没有匹配的用户</p>
              <p class="rk-empty-desc">请调整筛选条件，或清除左侧部门选择</p>
            </div>
          </div>

          <!-- ===== 分页（花名册风格，每页 12 条） ===== -->
          <div class="rk-pager">
            <span class="rk-pager-info">
              共 <b class="rk-mono">{{ total }}</b> 个账户 · 每页 <span class="rk-mono">{{ queryParams.pageSize }}</span> 条
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
      </div>
    </div>

    <!-- 添加或修改用户配置对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form :model="form" :rules="rules" ref="userRef" label-width="80px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户昵称" prop="nickName">
              <el-input v-model="form.nickName" placeholder="请输入用户昵称" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归属部门" prop="deptId">
              <el-tree-select v-model="form.deptId" :data="enabledDeptOptions" :props="{ value: 'id', label: 'label', children: 'children' }" value-key="id" placeholder="请选择归属部门" clearable check-strictly />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="phonenumber">
              <el-input v-model="form.phonenumber" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户名称" prop="userName">
              <el-input v-model="form.userName" placeholder="请输入用户名称" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户密码" prop="password" :rules="pwdValidator">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="20" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户性别">
              <el-select v-model="form.sex" placeholder="请选择">
                <el-option v-for="dict in sys_user_sex" :key="dict.value" :label="dict.label" :value="dict.value"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status" :disabled="isStatusProtected(form)">
                <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="岗位">
              <el-select v-model="form.postIds" multiple placeholder="请选择">
                <el-option v-for="item in postOptions" :key="item.postId" :label="item.postName" :value="item.postId" :disabled="item.status == 1"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色">
              <el-select v-model="roleSelectModel" :multiple="isPlatformAdmin" placeholder="请选择" :disabled="isProtectedFormUser">
                <el-option v-for="item in roleOptions" :key="item.roleId" :label="item.roleName" :value="item.roleId" :disabled="item.status == 1"></el-option>
              </el-select>
              <div v-if="!isPlatformAdmin" class="form-tip">专岗账号只能分配一个角色</div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入内容"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 用户详情抽屉 -->
    <user-view-drawer ref="userViewRef" />
    <!-- 用户导入对话框 -->
    <excel-import-dialog ref="importUserRef" title="用户导入" action="/system/user/importData" template-action="/system/user/importTemplate" template-file-name="user_template" update-support-label="是否更新已经存在的用户数据" @success="getList" />
  </div>
</template>

<script setup name="User">
import TreePanel from "@/components/TreePanel"
import ExcelImportDialog from "@/components/ExcelImportDialog"
import UserViewDrawer from "./view"
import { usePasswordRule } from "@/utils/passwordRule"
import { changeUserStatus, listUser, resetUserPwd, delUser, getUser, updateUser, addUser, deptTreeSelect } from "@/api/system/user"
import { Plus, RefreshLeft, MoreFilled, ArrowLeft, ArrowRight, Upload, Download, Edit, Delete, Key, CircleCheck, Lock, Close } from '@element-plus/icons-vue'

import useUserStore from "@/store/modules/user"

const router = useRouter()
const { proxy } = getCurrentInstance()
const { pwdValidator, pwdPromptValidator } = usePasswordRule()
const { sys_normal_disable, sys_user_sex } = useDict("sys_normal_disable", "sys_user_sex")

/** super为客户侧保留账号：不可删除/停用/改角色 */
function isProtectedUser(row) {
  // admin 可管理一切；仅非 admin 操作者视角下保护 super 自身
  return !isPlatformAdmin.value && row && row.userName === 'super'
}
function checkRowSelectable(row) {
  return !isProtectedUser(row)
}
const isPlatformAdmin = computed(() => useUserStore().roles.includes('admin'))
const currentUserId = computed(() => useUserStore().id)
/** 状态开关保护：超级管理员(userId=1)恒不可停用；任何人不可停用自己（与后端 checkUserAllowed/自停用口径一致） */
function isStatusProtected(row) {
  return !!row && (row.userId === 1 || row.userId === currentUserId.value)
}
const isProtectedFormUser = computed(() => isProtectedUser({ userName: form.value.userName }))
// 平台管理员保持多选；专岗账号强制单选（提交时仍转为roleIds数组）
const roleSelectModel = computed({
  get() {
    const ids = form.value.roleIds || []
    return isPlatformAdmin.value ? ids : ids[0]
  },
  set(val) {
    if (Array.isArray(val)) {
      form.value.roleIds = val
    } else {
      form.value.roleIds = val !== undefined && val !== null ? [val] : []
    }
  }
})

const PAGE_SIZE = 12
const userList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const total = ref(0)
const title = ref("")
const dateRange = ref([])
const deptOptions = ref(undefined)
const enabledDeptOptions = ref(undefined)
const initPassword = ref(undefined)
const postOptions = ref([])
const roleOptions = ref([])
const openMenuId = ref(null)
const headCheckRef = ref(null)
// 列显隐信息
const columns = ref({
  userId: { label: '用户编号', visible: true },
  userName: { label: '用户名称', visible: true },
  nickName: { label: '用户昵称', visible: true },
  deptName: { label: '部门', visible: true },
  phonenumber: { label: '手机号码', visible: true },
  status: { label: '状态', visible: true },
  createTime: { label: '创建时间', visible: true }
})

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: PAGE_SIZE,
    userName: undefined,
    phonenumber: undefined,
    status: undefined,
    deptId: undefined
  },
  rules: {
    userName: [{ required: true, message: "用户名称不能为空", trigger: "blur" }, { min: 2, max: 20, message: "用户名称长度必须介于 2 和 20 之间", trigger: "blur" }],
    nickName: [{ required: true, message: "用户昵称不能为空", trigger: "blur" }],
    email: [{ type: "email", message: "请输入正确的邮箱地址", trigger: ["blur", "change"] }],
    phonenumber: [{ pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: "请输入正确的手机号码", trigger: "blur" }]
  }
})

const { queryParams, form, rules } = toRefs(data)

/* ===== 花名册风格展示辅助 ===== */
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6']
function avatarChar(row) {
  const s = (row.nickName || row.userName || '?').trim()
  return s.charAt(0)
}
function avatarColor(row) {
  const s = row.userName || row.nickName || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function statusMeta(row) {
  return row.status === '0' ? { tone: 'green', label: '正常' } : { tone: 'gray', label: '停用' }
}
function statusLocked(row) {
  return isProtectedUser(row) || isStatusProtected(row)
}
function fmtTime(t) {
  return t ? proxy.parseTime(t) : '—'
}
function fmtDate(t) {
  return t ? proxy.parseTime(t, '{y}-{m}-{d}') : '—'
}

/* 左侧部门树选中的部门名（在树中递归查找） */
const selectedDeptName = computed(() => {
  const id = queryParams.value.deptId
  if (!id || !deptOptions.value) return ''
  const walk = list => {
    for (const d of list || []) {
      if (d.id === id) return d.label
      const hit = walk(d.children)
      if (hit) return hit
    }
    return ''
  }
  return walk(deptOptions.value)
})
function clearDeptFilter() {
  queryParams.value.deptId = undefined
  proxy.$refs.deptTreeRef && proxy.$refs.deptTreeRef.setCurrentKey(null)
  handleQuery()
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
const selectableRows = computed(() => (userList.value || []).filter(checkRowSelectable))
const allChecked = computed(() => selectableRows.value.length > 0 && selectableRows.value.every(r => ids.value.includes(r.userId)))
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
  const i = ids.value.indexOf(row.userId)
  if (i >= 0) ids.value.splice(i, 1)
  else ids.value.push(row.userId)
  syncSelectionFlags()
}
function toggleAll(ev) {
  const checked = ev.target.checked
  const pageIds = selectableRows.value.map(r => r.userId)
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
  else if (action === 'resetPwd') handleResetPwd(row)
  else if (action === 'authRole') handleAuthRole(row)
}

/** 查询用户列表 */
function getList() {
  loading.value = true
  listUser(proxy.addDateRange(queryParams.value, dateRange.value)).then(res => {
    loading.value = false
    userList.value = res.rows
    total.value = res.total
    // 当前页删除后可能落在空页，自动回退一页
    if (!res.rows.length && queryParams.value.pageNum > 1) {
      queryParams.value.pageNum -= 1
      getList()
    }
  }).catch(() => {
    loading.value = false
  })
}

/** 查询部门下拉树结构 */
function getDeptTree() {
  deptTreeSelect().then(response => {
    deptOptions.value = response.data
    enabledDeptOptions.value = filterDisabledDept(JSON.parse(JSON.stringify(response.data)))
  })
}

/** 过滤禁用的部门 */
function filterDisabledDept(deptList) {
  return deptList.filter(dept => {
    if (dept.disabled) {
      return false
    }
    if (dept.children && dept.children.length) {
      dept.children = filterDisabledDept(dept.children)
    }
    return true
  })
}

/** 节点单击事件 */
function handleNodeClick(data) {
  queryParams.value.deptId = data.id
  handleQuery()
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/* 筛选条件变化（姓名/手机号/状态/创建时间）自动防抖查询 */
let filterTimer = null
watch(
  () => [queryParams.value.userName, queryParams.value.phonenumber, queryParams.value.status, dateRange.value && dateRange.value.join(',')],
  () => {
    clearTimeout(filterTimer)
    filterTimer = setTimeout(handleQuery, 300)
  }
)

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = []
  queryParams.value.userName = undefined
  queryParams.value.phonenumber = undefined
  queryParams.value.status = undefined
  queryParams.value.deptId = undefined
  queryParams.value.pageNum = 1
  proxy.$refs.deptTreeRef && proxy.$refs.deptTreeRef.setCurrentKey(null)
  getList()
}

/** 删除按钮操作 */
function handleDelete(row) {
  const userIds = row.userId || ids.value
  proxy.$modal.confirm('是否确认删除用户编号为"' + userIds + '"的数据项？').then(function () {
    return delUser(userIds)
  }).then(() => {
    ids.value = []
    syncSelectionFlags()
    getList()
    proxy.$modal.msgSuccess("删除成功")
  }).catch(() => {})
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download("system/user/export", {
    ...queryParams.value,
  },`user_${new Date().getTime()}.xlsx`)
}

/** 状态徽章点击：先翻转，沿用原 el-switch 的确认/回滚口径 */
function toggleStatus(row) {
  if (statusLocked(row)) return
  row.status = row.status === "0" ? "1" : "0"
  handleStatusChange(row)
}

/** 用户状态修改  */
function handleStatusChange(row) {
  let text = row.status === "0" ? "启用" : "停用"
  proxy.$modal.confirm('确认要"' + text + '""' + row.userName + '"用户吗?').then(function () {
    return changeUserStatus(row.userId, row.status)
  }).then(() => {
    proxy.$modal.msgSuccess(text + "成功")
  }).catch(function () {
    row.status = row.status === "0" ? "1" : "0"
  })
}

/** 跳转角色分配 */
function handleAuthRole(row) {
  const userId = row.userId
  router.push("/system/user-auth/role/" + userId)
}

/** 重置密码按钮操作 */
function handleResetPwd(row) {
  proxy.$prompt(`请输入「${row.userName}」的新密码`, "重置密码", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    closeOnClickModal: false,
    inputValidator: pwdPromptValidator
  }).then(({ value }) => {
    resetUserPwd(row.userId, value).then(() => {
      proxy.$modal.msgSuccess("修改成功，新密码是：" + value)
    })
  }).catch(() => {})
}

/** 详情按钮操作 */
function handleViewData(row) {
  proxy.$refs["userViewRef"].open(row.userId)
}

/** 导入按钮操作 */
function handleImport() {
  proxy.$refs["importUserRef"].open()
}

/** 重置操作表单 */
function reset() {
  form.value = {
    userId: undefined,
    deptId: undefined,
    userName: undefined,
    nickName: undefined,
    password: undefined,
    phonenumber: undefined,
    email: undefined,
    sex: undefined,
    status: "0",
    remark: undefined,
    postIds: [],
    roleIds: []
  }
  proxy.resetForm("userRef")
}

/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}

/** 新增按钮操作 */
function handleAdd() {
  reset()
  getUser().then(response => {
    postOptions.value = response.posts
    roleOptions.value = response.roles
    open.value = true
    title.value = "新增用户"
    form.value.password = initPassword.value
  })
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const userId = row && row.userId ? row.userId : ids.value
  getUser(userId).then(response => {
    form.value = response.data
    postOptions.value = response.posts
    roleOptions.value = response.roles
    form.value.postIds = response.postIds
    form.value.roleIds = response.roleIds
    open.value = true
    title.value = "修改用户"
    form.value.password = ""
  })
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["userRef"].validate(valid => {
    if (valid) {
      if (form.value.userId != undefined) {
        updateUser(form.value).then(() => {
          proxy.$modal.msgSuccess("修改成功")
          open.value = false
          getList()
        })
      } else {
        addUser(form.value).then(() => {
          proxy.$modal.msgSuccess("新增成功")
          open.value = false
          getList()
        })
      }
    }
  })
}

onMounted(() => {
  getDeptTree()
  getList()
  proxy.getConfigKey("sys.user.initPassword").then(response => {
    initPassword.value = response.msg
  })
})
</script>

<style lang="scss" scoped>
@use "../../../assets/styles/roster-kit.scss" as *;

/* 内容区与花名册页面保持同一 canvas 底色 */
:deep(.tree-sidebar-manage-wrap) {
  background: $rk-canvas;
}
.tree-sidebar-content {
  background: $rk-canvas;

  .content-inner {
    padding: 16px;
  }
}

.form-tip {
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}

/* 筛选条内 Element 组件收敛到 32px/10px 圆角 */
.um-date-field {
  gap: 6px;
}
:deep(.um-date-picker) {
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
.um-filter :deep(.el-input__wrapper) {
  border-radius: 10px;
}

/* 锁定徽章里的小锁 */
.um-lock-icon {
  font-size: 11px;
  margin-left: 1px;
}
.um-builtin {
  font-size: 12px;
}

/* 表格列宽收敛（双栏布局下内容区较窄） */
.um-table .col-id { width: 54px; }
.um-table :is(thead th, tbody td) { padding-left: 10px; padding-right: 10px; }
.rk-person { gap: 10px; }
.rk-person-meta { min-width: 0; }
.um-name-text {
  display: block;
  max-width: 150px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.um-ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.um-cell-time { white-space: nowrap; }
@media (max-width: 1180px) {
  .um-table .col-id,
  .um-table .col-time { display: none; }
}

/* 右上角列设置工具按钮收敛为描边小按钮 */
.um-col-toolbar {
  margin-right: 2px;
}
.um-col-toolbar :deep(.el-button) {
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
