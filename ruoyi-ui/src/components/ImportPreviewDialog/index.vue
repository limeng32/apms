<template>
  <el-dialog :model-value="visible" :title="title"
             :width="dialogWidth" :fullscreen="isFullscreen" :top="isFullscreen ? '0' : '4vh'"
             append-to-body class="ip-dialog" :close-on-click-modal="false" @close="handleClose">
    <!-- ===== 步骤 1：下载模板 + 选择文件 ===== -->
    <div v-if="step === 1">
      <!-- 关联任务：成绩导入可在散录/任务间选择；任务抽屉入口为锁定态；体态导入不显示 -->
      <div v-if="showTaskSelect || lockedTaskId" class="ip-task-row">
        <span class="ip-tpl-label">关联任务：</span>
        <el-select v-if="showTaskSelect" v-model="selectedTaskId" filterable clearable
                   placeholder="不选 = 散录（不计入任务进度）" style="width:340px">
          <el-option v-for="t in taskOptions" :key="t.id"
                     :label="`#${t.id} ${t.taskName}`" :value="t.id"/>
        </el-select>
        <span v-else class="ip-task-locked">
          已绑定任务 #{{ lockedTaskId }}（由任务详情进入，自动按该任务的成员/指标校验）
        </span>
        <span class="ip-task-hint">
          {{ showTaskSelect
            ? (selectedTaskId ? '将按所选任务校验成员/指标，成绩计入该任务进度' : '未选任务：本次为散录，不计入任务进度')
            : '' }}
        </span>
      </div>
      <div class="ip-tpl-row">
        <span class="ip-tpl-label">导入模板：</span>
        <el-button link type="primary" :icon="Download" @click="downloadTpl('xlsx')">下载 Excel 模板 (.xlsx)</el-button>
        <el-button link type="primary" @click="downloadTpl('csv')">下载 CSV 模板 (.csv)</el-button>
      </div>
      <el-upload
        ref="uploadRef"
        drag
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls,.csv"
        :on-change="onFileChange"
        :on-exceed="onExceed"
        :on-remove="onRemove"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将 xlsx / xls / csv 文件拖到此处，或<em>点击选择</em></div>
        <template #tip>
          <div class="el-upload__tip ip-tip">
            单个文件不超过 10MB、最多 1000 行；{{ defaultTip }}
          </div>
        </template>
      </el-upload>
      <ul class="ip-rules">
        <li v-for="(t, i) in tips" :key="i">· {{ t }}</li>
      </ul>
    </div>

    <!-- ===== 步骤 2：预览校验 ===== -->
    <div v-else-if="step === 2 && preview">
      <!-- 致命错误：禁止提交 -->
      <el-alert v-if="preview.errors && preview.errors.length" type="error" :closable="false" show-icon
                title="文件存在致命错误，无法导入，请修正后重新上传" class="ip-fatal">
        <div v-for="(e, i) in preview.errors" :key="i">{{ e }}</div>
      </el-alert>

      <!-- 统计条 -->
      <div class="ip-stats">
        <span class="ip-stat ip-stat-ok">可导入 {{ preview.summary.valid }}</span>
        <span class="ip-stat ip-stat-warn" v-if="preview.summary.warn">超合理区间 {{ preview.summary.warn }}</span>
        <span class="ip-stat ip-stat-conflict" v-if="preview.summary.importConflict">
          导入冲突 {{ preview.summary.importConflict }}
        </span>
        <span class="ip-stat ip-stat-err" v-if="preview.summary.error">错误将跳过 {{ preview.summary.error }}</span>
        <span class="ip-stat ip-stat-total">共 {{ preview.summary.total }} 行</span>
      </div>

      <!-- 警告（忽略列等） -->
      <el-alert v-if="preview.warnings && preview.warnings.length" type="warning" :closable="false"
                class="ip-warn">
        <div v-for="(w, i) in preview.warnings.slice(0, 6)" :key="i">{{ w }}</div>
        <div v-if="preview.warnings.length > 6">……等 {{ preview.warnings.length }} 条提示</div>
      </el-alert>

      <!-- 覆盖导入数据勾选 -->
      <div v-if="allowOverwrite && preview.allowOverwriteOption" class="ip-overwrite">
        <el-checkbox v-model="overwriteImport">
          允许覆盖此前【批量导入】的数据（{{ preview.summary.importConflict }} 行当天已有导入记录；
          手工/任务/周期数据任何情况下都不会被覆盖）
        </el-checkbox>
      </div>

      <!-- 预览表 -->
      <div class="ip-table-wrap">
        <table class="ip-table">
          <thead>
            <tr>
              <th class="col-line">行号</th>
              <th class="col-name">运动员</th>
              <th class="col-date">日期</th>
              <th v-for="h in preview.headers" :key="h.key">{{ h.label }}<i v-if="h.unit"> ({{ h.unit }})</i></th>
              <th class="col-state">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in preview.rows" :key="row.lineNo"
                :class="{ 'row-error': row.rowError, 'row-conflict': row.conflict }">
              <td class="col-line">{{ row.lineNo }}</td>
              <td class="col-name">
                <span v-if="row.matched">{{ row.athleteName }}<i class="ip-athlete-id">#{{ row.athleteId }}</i></span>
                <span v-else class="ip-unmatched">未匹配</span>
              </td>
              <td class="col-date">{{ row.date || '—' }}</td>
              <td v-for="h in preview.headers" :key="h.key"
                  :class="cellClass(row, h.key)">
                {{ cellText(row, h.key) }}
              </td>
              <td class="col-state">
                <span v-if="row.rowError" class="ip-state-err">{{ row.rowError }}</span>
                <span v-else-if="row.conflict" class="ip-state-conflict">当天已有导入数据</span>
                <span v-else class="ip-state-ok">正常</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== 步骤 3：提交结果 ===== -->
    <div v-else-if="step === 3 && result" class="ip-result">
      <el-result :icon="result.failed ? 'warning' : 'success'"
                 :title="result.failed ? '导入完成（存在失败/跳过）' : '导入完成'">
        <template #sub-title>
          <div class="ip-result-stats">
            <span class="ip-stat ip-stat-ok">成功 {{ result.committed }} 行</span>
            <span class="ip-stat ip-stat-conflict" v-if="result.skipped">跳过 {{ result.skipped }} 行</span>
            <span class="ip-stat ip-stat-err" v-if="result.failed">失败 {{ result.failed }} 行</span>
          </div>
        </template>
      </el-result>
      <div v-if="result.skippedDetails && result.skippedDetails.length" class="ip-detail-block">
        <p class="ip-detail-title">跳过明细</p>
        <ul><li v-for="(d, i) in result.skippedDetails.slice(0, 50)" :key="'s'+i">{{ d }}</li></ul>
      </div>
      <div v-if="result.failedDetails && result.failedDetails.length" class="ip-detail-block">
        <p class="ip-detail-title">失败明细</p>
        <ul><li v-for="(d, i) in result.failedDetails.slice(0, 50)" :key="'f'+i">{{ d }}</li></ul>
      </div>
    </div>

    <template #footer>
      <template v-if="step === 1">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="parsing" :disabled="!file" @click="doPreview">解析预览</el-button>
      </template>
      <template v-else-if="step === 2">
        <el-button @click="backToStep1">上一步（重选文件）</el-button>
        <el-button type="primary" :loading="committing"
                   :disabled="!canCommit"
                   @click="doCommit">
          确认导入 {{ importableCount }} 条有效数据
          <span v-if="skipOnCommit">（跳过 {{ skipOnCommit }} 条）</span>
        </el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="finish">完成</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Download, UploadFilled } from '@element-plus/icons-vue'
import { previewImport, commitImport } from '@/api/apms/batchImport'
import { listTestTask } from '@/api/apms/testTask'

const props = defineProps({
  title: { type: String, default: '批量导入' },
  previewUrl: { type: String, required: true },
  commitUrl: { type: String, required: true },
  templateUrl: { type: String, required: true },
  /** 提交/解析时附加的表单字段，如 { taskId } */
  extraForm: { type: Object, default: () => ({}) },
  /** 是否允许在弹窗内选择关联任务（成绩导入开启；体态导入不显示） */
  showTaskSelect: { type: Boolean, default: false },
  /** 是否展示「允许覆盖此前导入数据」勾选（体态 true，成绩 false） */
  allowOverwrite: { type: Boolean, default: false },
  /** 步骤①格式说明（默认值之外的补充） */
  tips: { type: Array, default: () => [] }
})
const emit = defineEmits(['success'])

const { proxy } = getCurrentInstance()

const visible = ref(false)
const step = ref(1)
const uploadRef = ref(null)

// 响应式：≤768px 全屏弹窗；≤1200px 占 96%；更宽 92%（避免窄屏大弹窗溢出）
const winWidth = ref(window.innerWidth)
const isFullscreen = computed(() => winWidth.value <= 768)
const dialogWidth = computed(() => {
  if (isFullscreen.value) return '100%'
  return winWidth.value <= 1200 ? '96%' : '92%'
})
function onWinResize() { winWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onWinResize))
onBeforeUnmount(() => window.removeEventListener('resize', onWinResize))
const file = ref(null)
const parsing = ref(false)
const committing = ref(false)
const preview = ref(null)
const overwriteImport = ref(false)
const result = ref(null)
const defaultTip = '一格一个数值；同一队员多次测试请分多行填写；运动员优先填写编号，姓名须与系统完全一致，重名必须填编号'

// 关联任务选择（仅 showTaskSelect 时可改；任务抽屉入口通过 extraForm.taskId 锁定）
const taskOptions = ref([])
const selectedTaskId = ref(null)
const lockedTaskId = computed(() =>
  props.showTaskSelect ? null : (props.extraForm?.taskId ?? null))
// 模板下载/预览/提交统一使用的附加参数
const effectiveForm = computed(() => {
  if (props.showTaskSelect) {
    return { ...props.extraForm, taskId: selectedTaskId.value || null }
  }
  return props.extraForm
})

function open() {
  visible.value = true
  step.value = 1
  resetState()
  if (props.showTaskSelect) {
    selectedTaskId.value = props.extraForm?.taskId ?? null
    if (!taskOptions.value.length) {
      listTestTask({ pageNum: 1, pageSize: 999 })
        .then(res => { taskOptions.value = res.rows || [] })
        .catch(() => {})
    }
  }
}
function resetState() {
  file.value = null
  preview.value = null
  overwriteImport.value = false
  result.value = null
  uploadRef.value?.clearFiles()
}

function onFileChange(uploadFile) {
  file.value = uploadFile.raw
}
function onExceed(files) {
  uploadRef.value?.clearFiles()
  const f = files[0]
  uploadRef.value?.handleStart(f)
  file.value = f
}
function onRemove() {
  file.value = null
}

function downloadTpl(format) {
  const params = { format, ...effectiveForm.value }
  const prefix = props.previewUrl.includes('body-measure') ? 'body-measure-template' : 'test-result-template'
  proxy.download(props.templateUrl, params, `${prefix}.${format}`, { method: 'get' })
}

async function doPreview() {
  if (!file.value) return
  parsing.value = true
  try {
    const res = await previewImport(props.previewUrl, file.value, effectiveForm.value)
    preview.value = res.data
    step.value = 2
  } finally {
    parsing.value = false
  }
}

function backToStep1() {
  step.value = 1
  preview.value = null
  overwriteImport.value = false
}

const importableCount = computed(() => {
  if (!preview.value || (preview.value.errors && preview.value.errors.length)) return 0
  return preview.value.summary.valid + preview.value.summary.warn
    + (props.allowOverwrite && overwriteImport.value ? preview.value.summary.importConflict : 0)
})
const skipOnCommit = computed(() => {
  if (!preview.value) return 0
  return preview.value.summary.error
    + (props.allowOverwrite && !overwriteImport.value ? preview.value.summary.importConflict : 0)
})
const canCommit = computed(() => importableCount.value > 0)

async function doCommit() {
  committing.value = true
  try {
    const res = await commitImport(props.commitUrl, {
      token: preview.value.token,
      overwriteImport: props.allowOverwrite ? overwriteImport.value : false
    })
    result.value = res.data
    step.value = 3
  } finally {
    committing.value = false
  }
}

function finish() {
  visible.value = false
  emit('success')
}
function handleClose() {
  visible.value = false
  if (step.value === 3) emit('success')
}

// ===== 预览表单元格 =====
function cellOf(row, key) {
  return row.cells.find(c => c.key === key)
}
function cellText(row, key) {
  const c = cellOf(row, key)
  return c && c.raw != null ? c.raw : '—'
}
function cellClass(row, key) {
  const c = cellOf(row, key)
  if (!c || c.raw == null) return 'ip-cell-empty'
  if (c.status === 'error') return 'ip-cell-error'
  if (c.status === 'warn') return 'ip-cell-warn'
  return ''
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.ip-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
  /* 窄屏下弹窗限高，内部滚动，避免整体超高 */
  max-height: calc(100vh - 14vh - 60px);
  overflow-y: auto;
  overflow-x: hidden;
}
.ip-dialog:deep(.el-dialog) { max-width: calc(100vw - 16px); }
.ip-dialog:deep(.el-dialog.is-fullscreen) { max-width: none; }

.ip-tpl-row {
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
}
.ip-tpl-label { font-size: 13px; color: #475569; white-space: nowrap; }
.ip-task-row {
  margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 12px; border: 1px solid #e5e9f0; border-radius: 10px; background: #f8faff;
}
.ip-task-locked { font-size: 13px; font-weight: 500; color: #2563eb; }
.ip-task-hint { font-size: 12px; color: #94a3b8; }
.ip-tip { font-size: 12px; color: #94a3b8; }
.ip-rules { margin: 10px 0 0; padding-left: 4px; font-size: 12px; color: #64748b; line-height: 19px; }

/* 上传拖拽区在窄屏下压缩，避免占用过高 */
:deep(.el-upload-dragger) { padding: 20px; }
:deep(.el-upload-dragger .el-icon--upload) { margin-bottom: 8px; }
:deep(.el-upload-dragger .el-icon--upload .el-icon) {
  width: 44px; height: 44px;
}
:deep(.el-upload-dragger .el-upload__text) { font-size: 13px; }

@media (max-width: 768px) {
  /* 全屏态：为头部/底部按钮留出空间，body 内部滚动 */
  .ip-dialog :deep(.el-dialog__body) { max-height: calc(100vh - 118px); }
  .ip-stats { gap: 6px; }
  .ip-stat { padding: 2px 9px; font-size: 12px; }
  :deep(.el-upload-dragger) { padding: 14px 10px; }
  :deep(.el-upload-dragger .el-icon--upload .el-icon) { width: 36px; height: 36px; }
  .ip-table-wrap { max-height: 56vh; }
}

.ip-fatal { margin-bottom: 10px; }
.ip-stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 12px; }
.ip-stat {
  display: inline-flex; align-items: center; padding: 3px 12px;
  border-radius: 999px; font-size: 13px; font-weight: 600;
}
.ip-stat-ok { background: #dcfce7; color: #15803d; }
.ip-stat-warn { background: #fef3c7; color: #b45309; }
.ip-stat-conflict { background: #dbeafe; color: #1d4ed8; }
.ip-stat-err { background: #fee2e2; color: #b91c1c; }
.ip-stat-total { background: #f1f5f9; color: #475569; }
.ip-warn { margin-bottom: 10px; }
.ip-overwrite { margin-bottom: 10px; font-size: 13px; color: #475569; }

.ip-table-wrap {
  max-height: 52vh; overflow: auto;
  border: 1px solid #e2e8f0; border-radius: 10px;
}
.ip-table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
.ip-table th {
  position: sticky; top: 0; z-index: 2;
  background: #f8fafc; color: #475569; font-weight: 600;
  padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left;
}
.ip-table th i { font-style: normal; font-weight: 400; color: #94a3b8; }
.ip-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.ip-table tbody tr:hover { background: #f8fafc; }
.col-line { width: 52px; color: #94a3b8; text-align: center; }
.col-name { min-width: 130px; }
.col-date { min-width: 104px; }
.col-state { min-width: 200px; white-space: normal; }
.ip-athlete-id { color: #94a3b8; font-size: 11px; margin-left: 4px; }
.ip-unmatched { color: #b91c1c; }
.ip-cell-empty { color: #cbd5e1; text-align: center; }
.ip-cell-error { background: #fef2f2; color: #dc2626; font-weight: 600; }
.ip-cell-warn { background: #fffbeb; color: #d97706; font-weight: 600; }
tr.row-error td { background: #fef2f2; }
tr.row-error:hover td { background: #fee2e2; }
tr.row-conflict td { background: #eff6ff; }
.ip-state-err { color: #b91c1c; }
.ip-state-conflict { color: #1d4ed8; }
.ip-state-ok { color: #15803d; }

.ip-result-stats { display: flex; gap: 12px; justify-content: center; margin-top: 6px; }
.ip-detail-block {
  margin: 8px 24px; text-align: left;
  border: 1px solid #f1f5f9; border-radius: 8px; padding: 8px 14px;
  max-height: 180px; overflow: auto;
}
.ip-detail-title { font-weight: 600; margin: 4px 0; color: #475569; }
.ip-detail-block ul { margin: 4px 0; padding-left: 18px; font-size: 12.5px; color: #64748b; line-height: 20px; }
</style>
