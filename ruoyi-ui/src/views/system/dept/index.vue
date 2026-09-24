<template>
  <div class="app-container dm-page">
    <!-- ===== 页头（花名册风格） ===== -->
    <div class="rk-header">
      <div>
        <h1 class="rk-title">部门管理</h1>
        <p class="rk-subtitle">{{ totalDepts }} 个部门</p>
      </div>
      <div class="rk-header-actions">
        <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" class="dm-col-toolbar" />
        <el-button plain class="rk-btn" @click="handleSaveSort" v-hasPermi="['system:dept:edit']">
          <el-icon><Check /></el-icon>保存排序
        </el-button>
        <el-button plain class="rk-btn" @click="toggleExpandAll">
          <el-icon><Sort /></el-icon>展开/折叠
        </el-button>
        <el-button type="primary" class="rk-btn rk-btn-primary" :icon="Plus" @click="handleAdd()" v-hasPermi="['system:dept:add']">新增部门</el-button>
      </div>
    </div>

    <!-- ===== 筛选条卡片 ===== -->
    <div class="rk-filter dm-filter" v-show="showSearch">
      <label class="rk-group">
        <span class="rk-label">部门名称</span>
        <input v-model="queryParams.deptName" class="rk-input" type="text" placeholder="部门名称" @keyup.enter="handleQuery" />
      </label>

      <label class="rk-group">
        <span class="rk-label">状态</span>
        <select v-model="queryParams.status" class="rk-select">
          <option value="">全部</option>
          <option v-for="dict in sys_normal_disable" :key="dict.value" :value="dict.value">{{ dict.label }}</option>
        </select>
      </label>

      <div class="rk-filter-right">
        <button type="button" class="rk-btn-reset" @click="resetQuery">
          <el-icon><RefreshLeft /></el-icon>重置
        </button>
      </div>
    </div>

    <!-- ===== 部门树表卡片（保留 el-table 树能力，收敛为花名册视觉） ===== -->
    <div v-loading="loading" class="rk-table-card">
      <el-table
        v-if="refreshTable"
        :data="deptList"
        row-key="deptId"
        :default-expand-all="isExpandAll"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        class="dm-tree-table"
      >
        <el-table-column label="部门名称" width="300">
          <template #default="scope">
            <div class="dm-dept-cell">
              <span class="dm-avatar" :style="{ background: avatarColor(scope.row.deptName) }">{{ (scope.row.deptName || '?').charAt(0) }}</span>
              <span class="dm-dept-name" :title="scope.row.deptName">{{ scope.row.deptName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="120">
          <template #default="scope">
            <el-input-number v-model="scope.row.orderNum" controls-position="right" :min="0" class="dm-order-input" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="scope">
            <span class="rk-status-badge" :class="scope.row.status === '0' ? 'tone-green' : 'tone-gray'">
              <span class="rk-status-dot-wrap"><span class="rk-status-dot"></span></span>
              {{ scope.row.status === '0' ? '正常' : '停用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="180" class-name="col-time">
          <template #default="scope">
            <span class="rk-mono rk-num dm-cell-time" :title="parseTime(scope.row.createTime)">{{ fmtDate(scope.row.createTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200">
          <template #default="scope">
            <div class="rk-actions dm-row-actions">
              <button type="button" class="rk-link" @click="handleUpdate(scope.row)" v-hasPermi="['system:dept:edit']">修改</button>
              <button type="button" class="rk-link" @click="handleAdd(scope.row)" v-hasPermi="['system:dept:add']">新增下级</button>
              <button
                v-if="scope.row.parentId != 0"
                type="button"
                class="rk-link is-danger"
                @click="handleDelete(scope.row)"
                v-hasPermi="['system:dept:remove']"
              >删除</button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="rk-empty">
            <p class="rk-empty-title">没有匹配的部门</p>
            <p class="rk-empty-desc">请调整筛选条件后重试</p>
          </div>
        </template>
      </el-table>
    </div>

    <!-- 添加或修改部门对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="deptRef" :model="form" :rules="rules" label-width="80px">
        <el-row>
          <el-col :span="24" v-if="form.parentId !== 0">
            <el-form-item label="上级部门" prop="parentId">
              <el-tree-select
                v-model="form.parentId"
                :data="deptOptions"
                :props="{ value: 'deptId', label: 'deptName', children: 'children' }"
                value-key="deptId"
                placeholder="选择上级部门"
                check-strictly
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门名称" prop="deptName">
              <el-input v-model="form.deptName" placeholder="请输入部门名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="显示排序" prop="orderNum">
              <el-input-number v-model="form.orderNum" controls-position="right" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责人" prop="leader">
              <el-input v-model="form.leader" placeholder="请输入负责人" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入联系电话" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门状态">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in sys_normal_disable"
                  :key="dict.value"
                  :value="dict.value"
                >{{ dict.label }}</el-radio>
              </el-radio-group>
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
  </div>
</template>

<script setup name="Dept">
import { listDept, getDept, delDept, addDept, updateDept, updateDeptSort, listDeptExcludeChild } from "@/api/system/dept"
import { Plus, RefreshLeft, Check, Sort } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()
const { sys_normal_disable } = useDict("sys_normal_disable")

const deptList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const title = ref("")
const deptOptions = ref([])
const isExpandAll = ref(true)
const refreshTable = ref(true)
const originalOrders = ref({})

const data = reactive({
  form: {},
  queryParams: {
    deptName: undefined,
    status: undefined
  },
  rules: {
    parentId: [{ required: true, message: "上级部门不能为空", trigger: "blur" }],
    deptName: [{ required: true, message: "部门名称不能为空", trigger: "blur" }],
    orderNum: [{ required: true, message: "显示排序不能为空", trigger: "blur" }],
    email: [{ type: "email", message: "请输入正确的邮箱地址", trigger: ["blur", "change"] }],
    phone: [{ pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: "请输入正确的手机号码", trigger: "blur" }]
  },
})

const { queryParams, form, rules } = toRefs(data)

/* ===== 花名册风格展示辅助 ===== */
const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6']
function avatarColor(name) {
  const s = name || ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
function fmtDate(t) {
  return t ? proxy.parseTime(t, '{y}-{m}-{d}') : '—'
}

/* 部门总数（含所有层级） */
const totalDepts = computed(() => {
  let n = 0
  const walk = list => {
    list.forEach(item => {
      n += 1
      if (item.children && item.children.length) walk(item.children)
    })
  }
  walk(deptList.value)
  return n
})

/** 查询部门列表 */
function getList() {
  loading.value = true
  listDept(queryParams.value).then(response => {
    deptList.value = proxy.handleTree(response.data, "deptId")
    recordOriginalOrders(deptList.value)
    loading.value = false
  })
}

/* 筛选条件变化（部门名称/状态）自动防抖查询 */
let filterTimer = null
watch(
  () => [queryParams.value.deptName, queryParams.value.status],
  () => {
    clearTimeout(filterTimer)
    filterTimer = setTimeout(handleQuery, 300)
  }
)

/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}

/** 表单重置 */
function reset() {
  form.value = {
    deptId: undefined,
    parentId: undefined,
    deptName: undefined,
    orderNum: 0,
    leader: undefined,
    phone: undefined,
    email: undefined,
    status: "0"
  }
  proxy.resetForm("deptRef")
}

/** 搜索按钮操作 */
function handleQuery() {
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  queryParams.value.deptName = undefined
  queryParams.value.status = undefined
  handleQuery()
}

/** 新增按钮操作 */
function handleAdd(row) {
  reset()
  listDept().then(response => {
    deptOptions.value = proxy.handleTree(response.data, "deptId")
  })
  if (row != undefined) {
    form.value.parentId = row.deptId
  }
  open.value = true
  title.value = "添加部门"
}

/** 展开/折叠操作 */
function toggleExpandAll() {
  refreshTable.value = false
  isExpandAll.value = !isExpandAll.value
  nextTick(() => {
    refreshTable.value = true
  })
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  listDeptExcludeChild(row.deptId).then(response => {
    deptOptions.value = proxy.handleTree(response.data, "deptId")
  })
  getDept(row.deptId).then(response => {
    form.value = response.data
    open.value = true
    title.value = "修改部门"
  })
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["deptRef"].validate(valid => {
    if (valid) {
      if (form.value.deptId != undefined) {
        updateDept(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功")
          open.value = false
          getList()
        })
      } else {
        addDept(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功")
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 递归记录原始排序 */
function recordOriginalOrders(list) {
  list.forEach(item => {
    originalOrders.value[item.deptId] = item.orderNum
    if (item.children && item.children.length) {
      recordOriginalOrders(item.children)
    }
  })
}

/** 保存排序 */
function handleSaveSort() {
  const changedDeptIds = []
  const changedOrderNums = []
  const collectChanged = (list) => {
    list.forEach(item => {
      if (String(originalOrders.value[item.deptId]) !== String(item.orderNum)) {
        changedDeptIds.push(item.deptId)
        changedOrderNums.push(item.orderNum)
      }
      if (item.children && item.children.length) {
        collectChanged(item.children)
      }
    })
  }
  collectChanged(deptList.value)
  if (changedDeptIds.length === 0) {
   proxy.$modal.msgWarning("未检测到排序修改")
    return
  }
  updateDeptSort({ deptIds: changedDeptIds.join(","), orderNums: changedOrderNums.join(",") }).then(() => {
   proxy.$modal.msgSuccess("排序保存成功")
    recordOriginalOrders(deptList.value)
  })
}

/** 删除按钮操作 */
function handleDelete(row) {
  proxy.$modal.confirm('是否确认删除名称为"' + row.deptName + '"的数据项?').then(function() {
    return delDept(row.deptId)
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess("删除成功")
  }).catch(() => {})
}

getList()
</script>

<style lang="scss" scoped>
@use "../../../assets/styles/roster-kit.scss" as *;

/* 全宽页面铺满 canvas 底色 */
.dm-page {
  min-height: calc(100vh - 84px);
  margin: -20px;
  padding: 16px;
  background: $rk-canvas;
}

/* ===== el-table 树表收敛为花名册视觉 ===== */
.dm-tree-table {
  --el-table-border-color: #{$rk-line};
  --el-table-header-bg-color: #fff;
  --el-table-header-text-color: #{$rk-text-3};
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-row-hover-bg-color: #{$rk-canvas};
  font-size: 14px;

  :deep(.el-table__cell) {
    padding: 7px 0;
  }
  :deep(th.el-table__cell) {
    font-size: 12px;
    font-weight: 500;
    background: #fff;
  }
  :deep(.cell) {
    padding-left: 14px;
    padding-right: 14px;
  }
  /* 展开箭头 */
  :deep(.el-table__expand-icon) {
    color: $rk-text-3;
    &:hover { color: $rk-brand-600; }
  }
  :deep(.el-table__indent) {
    display: inline-flex;
  }
}

/* 部门名称单元 */
.dm-dept-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dm-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}
.dm-dept-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
  color: $rk-text-1;
}

/* 行操作 */
.dm-row-actions {
  justify-content: flex-start;
  gap: 10px;
}
.rk-link.is-danger {
  color: $rk-risk;
  &:hover { color: #b91c1c; }
}

/* 排序输入框收敛 */
.dm-order-input {
  width: 88px;
}
.dm-order-input :deep(.el-input__wrapper) {
  height: 30px;
  border-radius: 8px;
  padding: 0 4px;
}
.dm-order-input :deep(.el-input__inner) {
  height: 30px;
}

.dm-cell-time {
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .dm-tree-table :deep(.col-time) {
    display: none;
  }
}

/* 右上角工具按钮收敛为描边小按钮 */
.dm-col-toolbar {
  margin-right: 2px;
}
.dm-col-toolbar :deep(.el-button) {
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
