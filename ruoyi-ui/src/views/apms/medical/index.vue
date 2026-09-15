<template>
  <div class="app-container medical-page">
    <!-- 搜索 -->
    <el-form :model="queryParams" :inline="true" label-width="70px" class="filter-bar">
      <el-form-item label="运动员" prop="athleteId">
        <el-select v-model="queryParams.athleteId" placeholder="全部" clearable filterable style="width:150px">
          <el-option v-for="a in athleteOptions" :key="a.athleteId" :label="a.name" :value="a.athleteId"/>
        </el-select>
      </el-form-item>
      <el-form-item label="类型" prop="recordType">
        <el-select v-model="queryParams.recordType" placeholder="全部" clearable style="width:130px">
          <el-option v-for="t in typeOptions" :key="t.v" :label="t.label" :value="t.v"/>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd">新增记录</el-button>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：记录列表 -->
      <el-col :span="10">
        <div class="panel-title">
          <span>医疗记录</span>
          <span class="panel-sub">共 {{ total }} 条</span>
        </div>
        <el-table :data="recordList" border stripe highlight-current-row
                  v-loading="loading" max-height="600" row-key="id"
                  @row-click="handleRowClick">
          <el-table-column label="#" prop="id" width="50" align="center"/>
          <el-table-column label="运动员" width="100">
            <template #default="scope">
              <span class="ath-name">{{ scope.row.athleteName }}</span>
              <span :class="scope.row.athleteGender === 'F' ? 'female' : 'male'" class="gender">
                {{ scope.row.athleteGender === 'F' ? '♀' : '♂' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90" align="center">
            <template #default="scope">
              <el-tag :type="typeTag(scope.row.recordType)" size="small" effect="dark">
                {{ typeLabel(scope.row.recordType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="标题" min-width="160">
            <template #default="scope">
              <span class="title-cell" :title="scope.row.title">{{ scope.row.title }}</span>
            </template>
          </el-table-column>
          <el-table-column label="日期" width="100">
            <template #default="scope">{{ formatDate(scope.row.recordDate) }}</template>
          </el-table-column>
          <el-table-column label="附件" width="60" align="center">
            <template #default="scope">
              <el-badge v-if="scope.row.files?.length" :value="scope.row.files.length" class="file-badge"/>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Edit" @click.stop="handleEdit(scope.row)">改</el-button>
            </template>
          </el-table-column>
        </el-table>
        <pagination v-show="total>0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList"/>
      </el-col>

      <!-- 右：详情侧栏 -->
      <el-col :span="14">
        <div class="panel-title">
          <span>详情</span>
          <span v-if="current" class="panel-sub">
            {{ current.athleteName }} · {{ typeLabel(current.recordType) }}
          </span>
          <span v-else class="panel-sub muted">← 点击左侧记录查看</span>
        </div>

        <div v-if="current" class="detail-panel">
          <!-- 摘要卡 -->
          <div class="record-header" :class="'header-' + current.recordType">
            <div class="type-badge">{{ typeLabel(current.recordType) }}</div>
            <div class="header-info">
              <div class="header-title">{{ current.title }}</div>
              <div class="header-meta">
                <span>{{ formatDate(current.recordDate) }}</span>
                <span v-if="current.institution">· {{ current.institution }}</span>
                <span class="ath-badge">{{ current.athleteName }} ({{ current.athleteTeam }})</span>
              </div>
            </div>
          </div>

          <div v-if="current.remark" class="remark-block">
            <div class="section-title">诊疗说明</div>
            <p>{{ current.remark }}</p>
          </div>

          <!-- 附件列表 -->
          <div class="section-title">
            附件 ({{ current.files?.length || 0 }})
            <span class="privacy-tag">🔒 仅授权用户可下载</span>
          </div>
          <div v-if="current.files?.length" class="file-list">
            <div v-for="f in current.files" :key="f.id" class="file-card">
              <div class="file-icon" :class="'icon-' + f.fileExt?.toLowerCase()">{{ extIcon(f.fileExt) }}</div>
              <div class="file-info">
                <div class="file-name" :title="f.fileName">{{ f.fileName }}</div>
                <div class="file-meta">{{ formatSize(f.fileSize) }} · {{ formatDate(f.uploadTime) }}</div>
              </div>
              <div class="file-actions">
                <el-button type="primary" link icon="Download" @click="handleDownload(f)">下载</el-button>
                <el-button type="danger" link icon="Delete" @click="handleDeleteFile(f)">删</el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="无附件"/>
        </div>
        <div v-else class="detail-empty">
          <el-empty description="选择左侧记录查看详情"/>
        </div>
      </el-col>
    </el-row>

    <!-- ========== 新增/编辑 Dialog ========== -->
    <el-dialog :title="dialogTitle" v-model="showDialog" width="580px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="运动员" prop="athleteId">
              <el-select v-model="form.athleteId" placeholder="选运动员" style="width:100%" filterable>
                <el-option v-for="a in athleteOptions" :key="a.athleteId" :label="a.name + ' (' + a.primaryTeamId + ')'" :value="a.athleteId"/>
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
      <template #footer>
        <el-button @click="showDialog = false">取 消</el-button>
        <el-button type="primary" @click="submit">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ApmsMedical">
import { listMedical, getMedical, addMedical, updateMedical, delMedical, delMedicalFile, downloadMedicalFile } from '@/api/apms/medical'
import { listAthlete } from '@/api/apms/athlete'
import { getToken } from '@/utils/auth'
import { UploadFilled } from '@element-plus/icons-vue'

const { proxy } = getCurrentInstance()

// ========= 字典 =========
const typeOptions = [
  { v: 'injury',         label: '损伤' },
  { v: 'illness',        label: '疾病' },
  { v: 'surgery',        label: '手术' },
  { v: 'rehabilitation', label: '康复' },
  { v: 'checkup',        label: '体检' }
]
function typeLabel(t) { return typeOptions.find(x => x.v === t)?.label || t }
function typeTag(t) {
  return ({ injury: 'danger', illness: 'warning', surgery: 'success',
            rehabilitation: 'primary', checkup: 'info' })[t] || 'info'
}

// ========= 查询 =========
const loading = ref(false)
const recordList = ref([])
const total = ref(0)
const queryParams = reactive({ pageNum: 1, pageSize: 10, athleteId: null, recordType: null })

function getList() {
  loading.value = true
  listMedical(queryParams).then(r => { recordList.value = r.rows; total.value = r.total; loading.value = false })
}
function handleQuery() { queryParams.pageNum = 1; getList() }
function resetQuery() { proxy.resetForm('queryForm'); handleQuery() }

// ========= 辅助下拉 =========
const athleteOptions = ref([])
listAthlete({ pageNum: 1, pageSize: 300 }).then(r => { athleteOptions.value = r.rows || [] })

// ========= 主从 =========
const current = ref(null)
function handleRowClick(row) {
  current.value = row
  loadDetail(row.id)
}
function loadDetail(id) {
  getMedical(id).then(r => {
    current.value = r.data
  })
}

// ========= Dialog =========
const showDialog = ref(false)
const formRef = ref(null)
const dialogTitle = ref('')
const form = reactive({ id: null, athleteId: null, recordType: 'injury', recordDate: null, institution: '', title: '', remark: '', fileList: [], files: [] })
const rules = {
  athleteId: [{ required: true, message: '请选运动员', trigger: 'change' }],
  recordType: [{ required: true, message: '请选记录类型', trigger: 'change' }],
  recordDate: [{ required: true, message: '请选日期', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }]
}

const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + getToken() }))

function handleAdd() {
  dialogTitle.value = '新增医疗记录'
  Object.assign(form, { id: null, athleteId: null, recordType: 'injury', recordDate: null, institution: '', title: '', remark: '', fileList: [], files: [] })
  showDialog.value = true
}
function handleEdit(row) {
  dialogTitle.value = '编辑医疗记录'
  Object.assign(form, row)
  form.fileList = (row.files || []).map(f => ({
    uid: f.id, name: f.fileName, url: downloadMedicalFile(f.id),
    response: { url: f.filePath, name: f.fileName, path: f.filePath, size: f.fileSize }
  }))
  form.files = (row.files || []).map(f => ({ recordId: f.recordId, fileName: f.fileName, filePath: f.filePath, fileSize: f.fileSize, fileExt: f.fileExt }))
  showDialog.value = true
}

function beforeUpload(file) {
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
      proxy.$modal.msgSuccess('保存成功'); showDialog.value = false; getList()
      if (current.value?.id === form.id) loadDetail(current.value.id)
    })
  })
}

// ========= 附件操作 =========
function handleDownload(f) {
  // 私有下载端点（带权限）
  window.open(downloadMedicalFile(f.id), '_blank')
}
function handleDeleteFile(f) {
  proxy.$modal.confirm(`确认删除附件 "${f.fileName}"？`).then(() => {
    delMedicalFile(f.id).then(() => {
      proxy.$modal.msgSuccess('已删除')
      loadDetail(current.value.id)
      // 同步刷新列表的 badge
      getList()
    })
  }).catch(() => {})
}

function handleDelete(row) {
  proxy.$modal.confirm('确认删除该医疗记录？附件一并删除。').then(() => {
    delMedical(row.id).then(() => {
      proxy.$modal.msgSuccess('删除成功'); getList()
      if (current.value?.id === row.id) current.value = null
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
function extIcon(ext) {
  ext = (ext || '').toLowerCase()
  if (['pdf'].includes(ext)) return 'PDF'
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'IMG'
  if (['doc', 'docx'].includes(ext)) return 'DOC'
  if (['xls', 'xlsx'].includes(ext)) return 'XLS'
  return ext?.toUpperCase() || 'FILE'
}

getList()
</script>

<style scoped>
.medical-page { padding: 12px 16px; }
.panel-title {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; font-weight: 600; color: #1b4332;
  padding: 0 0 10px; border-bottom: 1px solid #ebeef5; margin-bottom: 12px;
}
.panel-sub { font-size: 12px; color: #909399; font-weight: 400; }
.panel-sub.muted { color: #c0c4cc; }

.ath-name { font-weight: 500; margin-right: 4px; }
.gender { font-weight: 700; }
.male { color: #409eff; }
.female { color: #f56c6c; }
.title-cell { color: #303133; font-size: 13px; }
.muted { color: #c0c4cc; font-size: 11px; }
.file-badge :deep(.el-badge__content) { background: #1b4332; }

/* 详情面板 */
.detail-panel { min-height: 400px; }
.detail-empty { min-height: 400px; display: flex; align-items: center; justify-content: center; }

.record-header {
  display: flex; gap: 14px; align-items: center;
  padding: 14px 18px; border-radius: 8px;
  margin-bottom: 14px;
}
.header-injury  { background: #fef0f0; border: 1px solid #f56c6c; }
.header-illness { background: #fdf6ec; border: 1px solid #e6a23c; }
.header-surgery { background: #f0f9eb; border: 1px solid #67c23a; }
.header-rehabilitation { background: #ecf5ff; border: 1px solid #409eff; }
.header-checkup { background: #f4f4f5; border: 1px solid #909399; }

.type-badge {
  padding: 6px 14px; border-radius: 6px;
  font-size: 14px; font-weight: 700;
  background: rgba(255,255,255,0.85);
}
.header-info { flex: 1; min-width: 0; }
.header-title { font-size: 16px; font-weight: 700; color: #303133; margin-bottom: 4px; }
.header-meta { font-size: 12px; color: #909399; }
.ath-badge { margin-left: 10px; padding: 2px 8px; background: rgba(255,255,255,0.8); border-radius: 4px; color: #606266; }

.section-title {
  font-size: 13px; font-weight: 600; color: #1b4332;
  margin: 14px 0 8px; padding-left: 8px; border-left: 3px solid #1b4332;
  display: flex; align-items: center; gap: 8px;
}
.privacy-tag { font-size: 11px; color: #f56c6c; font-weight: 400; margin-left: auto; }
.remark-block { margin-top: 4px; }
.remark-block p { background: #f6fbf7; padding: 10px 14px; border-radius: 5px; font-size: 13px; line-height: 1.7; color: #303133; }

/* 文件列表 */
.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-card {
  display: flex; gap: 12px; align-items: center;
  padding: 10px 14px; border: 1px solid #ebeef5; border-radius: 6px;
  transition: all .2s;
}
.file-card:hover { border-color: #1b4332; background: #f6fbf7; }
.file-icon {
  width: 44px; height: 44px; border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px; color: #fff;
}
.icon-pdf { background: #f56c6c; }
.icon-img { background: #409eff; }
.icon-doc { background: #1b4332; }
.icon-xls { background: #67c23a; }
.icon-file { background: #909399; }

.file-info { flex: 1; min-width: 0; }
.file-name { font-weight: 500; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-meta { font-size: 11px; color: #909399; margin-top: 2px; }
.file-actions { display: flex; gap: 4px; }

/* Upload drag 区域 */
.medical-upload :deep(.el-upload-dragger) { padding: 20px; }
</style>
