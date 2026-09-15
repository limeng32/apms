<template>
  <div class="app-container">
    <!-- 搜索栏 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="queryParams.name" placeholder="请输入姓名" clearable @keyup.enter="handleQuery" style="width: 180px"/>
      </el-form-item>
      <el-form-item label="队伍" prop="primaryTeamId">
        <el-select v-model="queryParams.primaryTeamId" placeholder="全部队伍" clearable style="width: 180px">
          <el-option v-for="t in teamOptions" :key="t.deptId" :label="t.deptName" :value="t.deptId"/>
        </el-select>
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-select v-model="queryParams.gender" placeholder="全部" clearable style="width: 100px">
          <el-option label="男" value="M"/>
          <el-option label="女" value="F"/>
        </el-select>
      </el-form-item>
      <el-form-item label="位置" prop="position">
        <el-select v-model="queryParams.position" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in positionOptions" :key="d.dictValue" :label="d.dictLabel" :value="d.dictValue"/>
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 100px">
          <el-option v-for="d in statusOptions" :key="d.dictValue" :label="d.dictLabel" :value="d.dictValue"/>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作栏 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['apms:athlete:add']">新增队员</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['apms:athlete:remove']">离队</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="athleteList" @selection-change="handleSelectionChange" stripe>
      <el-table-column type="selection" width="50" align="center"/>
      <el-table-column label="队员编号" prop="athleteId" width="100"/>
      <el-table-column label="姓名" prop="name" width="100"/>
      <el-table-column label="队伍" prop="teamName" width="120"/>
      <el-table-column label="球衣号" prop="jerseyNo" width="80" align="center"/>
      <el-table-column label="位置" prop="position" width="80" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.position" :type="positionTagType(scope.row.position)">{{ positionLabel(scope.row.position) }}</el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="性别" prop="gender" width="60" align="center">
        <template #default="scope">{{ scope.row.gender === 'M' ? '男' : '女' }}</template>
      </el-table-column>
      <el-table-column label="年龄" prop="age" width="60" align="center"/>
      <el-table-column label="出生日期" prop="birthday" width="110" align="center"/>
      <el-table-column label="联系电话" prop="phone" width="130"/>
      <el-table-column label="状态" prop="status" width="80" align="center">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding" width="220">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleDetail(scope.row)" v-hasPermi="['apms:athlete:query']">详情</el-button>
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['apms:athlete:edit']">修改</el-button>
          <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['apms:athlete:remove']">离队</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"/>

    <!-- 新增/修改对话框 -->
    <el-dialog :title="title" v-model="open" width="600px" append-to-body>
      <el-form ref="athleteRef" :model="form" :rules="rules" label-width="90px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="请输入姓名" maxlength="50"/>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="球衣号" prop="jerseyNo">
              <el-input v-model="form.jerseyNo" placeholder="如 10" maxlength="8"/>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="性别" prop="gender">
              <el-radio-group v-model="form.gender">
                <el-radio value="M">男</el-radio>
                <el-radio value="F">女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出生日期" prop="birthday">
              <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%"/>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="主属队伍" prop="primaryTeamId">
              <el-select v-model="form.primaryTeamId" placeholder="请选择队伍" style="width: 100%">
                <el-option v-for="t in teamOptions" :key="t.deptId" :label="t.deptName" :value="t.deptId"/>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="场上位置" prop="position">
              <el-select v-model="form.position" placeholder="请选择位置" clearable style="width: 100%">
                <el-option v-for="d in positionOptions" :key="d.dictValue" :label="d.dictLabel" :value="d.dictValue"/>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="可选" maxlength="20"/>
        </el-form-item>
        <el-form-item label="状态" prop="status" v-if="form.athleteId">
          <el-radio-group v-model="form.status">
            <el-radio v-for="d in statusOptions" :key="d.dictValue" :value="d.dictValue">{{ d.dictLabel }}</el-radio>
          </el-radio-group>
        </el-form-item>
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

<script setup name="Athlete">
import { listAthlete, getAthlete, addAthlete, updateAthlete, delAthlete } from '@/api/apms/athlete'
import { listDept } from '@/api/system/dept'
import { useDict } from '@/utils/dict'

const { proxy } = getCurrentInstance()
const { apms_position, apms_athlete_status } = useDict('apms_position', 'apms_athlete_status')

const athleteList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const open = ref(false)
const title = ref('')
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const teamOptions = ref([])

const positionOptions = computed(() => apms_position.value || [])
const statusOptions = computed(() => apms_athlete_status.value || [])

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    name: undefined,
    primaryTeamId: undefined,
    gender: undefined,
    position: undefined,
    status: undefined
  },
  form: {},
  rules: {
    name: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
    gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
    primaryTeamId: [{ required: true, message: '请选择主属队伍', trigger: 'change' }]
  }
})

const { queryParams, form, rules } = toRefs(data)

// 字典辅助
function positionLabel(val) {
  const opt = positionOptions.value.find(d => d.dictValue === val)
  return opt ? opt.dictLabel : val
}
function positionTagType(val) {
  const opt = positionOptions.value.find(d => d.dictValue === val)
  return opt ? opt.listClass : 'primary'
}
function statusLabel(val) {
  const opt = statusOptions.value.find(d => d.dictValue === val)
  return opt ? opt.dictLabel : val
}
function statusTagType(val) {
  const opt = statusOptions.value.find(d => d.dictValue === val)
  return opt ? opt.listClass : 'info'
}

// 查询队伍列表（仅 dept_type=20）
function getTeamOptions() {
  listDept({ status: '0' }).then(res => {
    teamOptions.value = (res.data || []).filter(d => d.deptType === '20' || d.deptType === 20)
  })
}

// 列表
function getList() {
  loading.value = true
  listAthlete(queryParams.value).then(res => {
    athleteList.value = res.rows
    total.value = res.total
  }).finally(() => {
    loading.value = false
  })
}

// 搜索
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

// 多选
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.athleteId)
  single.value = selection.length !== 1
  multiple.value = !selection.length
}

// 新增
function handleAdd() {
  reset()
  open.value = true
  title.value = '新增队员'
}
function handleUpdate(row) {
  reset()
  getAthlete(row.athleteId).then(res => {
    form.value = res.data
    open.value = true
    title.value = '修改队员'
  })
}
function submitForm() {
  proxy.$refs['athleteRef'].validate(valid => {
    if (valid) {
      if (form.value.athleteId) {
        updateAthlete(form.value).then(() => {
          proxy.$modal.msgSuccess('修改成功')
          open.value = false
          getList()
        })
      } else {
        addAthlete(form.value).then(() => {
          proxy.$modal.msgSuccess('新增成功')
          open.value = false
          getList()
        })
      }
    }
  })
}
function cancel() {
  open.value = false
  reset()
}
function reset() {
  form.value = {
    athleteId: undefined,
    name: undefined,
    gender: 'M',
    birthday: undefined,
    phone: undefined,
    primaryTeamId: undefined,
    jerseyNo: undefined,
    position: undefined,
    status: '0'
  }
  proxy.resetForm('athleteRef')
}

// 离队（逻辑删除）
function handleDelete(row) {
  const athleteIds = row.athleteId ? [row.athleteId] : ids.value
  proxy.$modal.confirm('确认将选中的 ' + athleteIds.length + ' 名队员设为离队状态？').then(() => {
    return delAthlete(athleteIds.join(','))
  }).then(() => {
    getList()
    proxy.$modal.msgSuccess('已设为离队')
  }).catch(() => {})
}

// 详情（路由跳转）
function handleDetail(row) {
  proxy.$router.push('/apms/athlete/detail/' + row.athleteId)
}

// 初始化
getTeamOptions()
getList()
</script>
