<template>
  <el-dialog :title="effTaskId ? 'CSV 批量导入（本任务）' : 'CSV 批量导入测试结果'" v-model="visible" width="520px" append-to-body @close="handleClose">
    <el-upload
      ref="uploadRef"
      :limit="1"
      accept=".csv"
      :headers="headers"
      :action="uploadUrl"
      :disabled="isUploading || isDemoMode()"
      :on-progress="handleProgress"
      :on-change="handleFileChange"
      :on-remove="handleFileRemove"
      :on-success="handleSuccess"
      :on-error="handleError"
      :auto-upload="false"
      drag
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">将 CSV 文件拖到此处，或<em>点击上传</em></div>
      <template #tip>
        <div class="el-upload__tip" style="text-align: left;">
          <div style="margin-bottom: 6px;">
            <el-button type="primary" link size="small" :icon="Download" @click="downloadTemplate">
              下载 CSV 模板{{ effTaskId ? '（含本任务队员与测试项）' : '' }}
            </el-button>
          </div>
          <b>CSV 格式要求：</b>
          <ul style="margin: 4px 0 0 18px; padding: 0; color: #606266; font-size: 12px;">
            <li>UTF-8 编码；模板第 1 行为中文说明（<code>#</code> 开头，自动忽略），第 2 行为英文表头（请勿修改）</li>
            <li>必须列：<code>athlete_id</code>（数字ID或姓名）、<code>measure_date</code>（YYYY-MM-DD 或 YYYY/MM/DD；用 Excel/WPS 编辑后保存的斜杠日期可直接导入）</li>
            <li>可选列：<code>athlete_name</code>（核对用，ID 为空时按姓名匹配）、<code>session_key</code>（如 S1）<template v-if="effTaskId">、<code>task_id</code>（模板已预填）</template></li>
            <li>数据列名 = 指标/模型的 <code>code</code>（大小写不敏感）；中文名与单位见第 1 行说明</li>
            <li v-if="effTaskId">绑定任务后，导入成绩将自动计入该任务完成进度</li>
          </ul>
          <div style="margin-top: 6px;">
            <el-link type="primary" :underline="false" style="font-size: 12px;" @click="showTemplate">查看 CSV 格式示例</el-link>
          </div>
        </div>
      </template>
    </el-upload>
    <div v-if="isDemoMode()" class="el-upload__tip" style="color: #e6a23c;">演示环境暂不支持 CSV 导入</div>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="handleSubmit" :loading="isUploading">确 定</el-button>
        <el-button @click="visible = false">取 消</el-button>
      </div>
    </template>

    <!-- 格式示例弹窗 -->
    <el-dialog title="CSV 格式示例" v-model="templateVisible" width="600px" append-to-body>
      <pre style="background:#f5f7fa; padding:12px; border-radius:6px; font-size:13px; line-height:1.6; margin:0; max-width:100%; box-sizing:border-box; white-space:pre-wrap; word-break:break-word; overflow-wrap:anywhere;">#运动员ID（数字ID或姓名均可）,运动员姓名（仅用于核对）,测试日期(YYYY-MM-DD或YYYY/MM/DD),场次（选填，如S1）,身高(cm),体重(kg),30米冲刺(s),纵跳(cm)
athlete_id,athlete_name,measure_date,session_key,HEIGHT,WEIGHT,SPRINT_30M,VJUMP
1001,张志远,2026-09-18,S1,178.5,72.3,4.85,55.2
1006,李明轩,2026/09/18,S1,182.0,78.5,4.60,60.5
,王梓豪,2026/9/19,S2,175.0,68.0,4.92,58.0</pre>
      <div style="margin-top: 10px; color:#606266; font-size:12px;">
        <p><b>说明：</b></p>
        <ul style="margin: 4px 0 0 18px; padding: 0;">
          <li>第 1 行 <code>#</code> 开头是给人看的中文说明（含单位），导入时自动忽略，请勿删除</li>
          <li><code>athlete_id</code> 可填数字 ID，也可填完整姓名；ID 留空时会尝试用 <code>athlete_name</code> 匹配</li>
          <li><code>measure_date</code> 支持 <code>2026-09-18</code> 与 <code>2026/9/18</code>（Excel/WPS 保存的斜杠日期可直接导入）</li>
          <li>数据列名需匹配系统中已注册的 <b>指标 code</b> 或 <b>测试模型 code</b>（大小写不敏感）</li>
          <li>值自动识别数字 / 文本；多趟测试的原始数值可放在同一单元格内用英文逗号分隔并加引号，如 "5.21,5.19,5.28"</li>
        </ul>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { Download } from '@element-plus/icons-vue'
import { getToken, isDemoMode } from '@/utils/auth'

const { proxy } = getCurrentInstance()

const props = defineProps({
  action: { type: String, required: true },
  /** 任务上下文：导入时自动绑定该任务；模板预填该任务的队员与测试项 */
  taskId: { type: [Number, String], default: null }
})

const emit = defineEmits(['success'])

const uploadRef = ref(null)
const visible = ref(false)
const templateVisible = ref(false)
const selectedFile = ref(null)
const isUploading = ref(false)
const ctxTaskId = ref(null)
const headers = { Authorization: 'Bearer ' + getToken() }
// 优先用 open(taskId) 传入的上下文，否则用组件 prop
const effTaskId = computed(() => ctxTaskId.value != null ? ctxTaskId.value : props.taskId)
const uploadUrl = computed(() => {
  const base = import.meta.env.VITE_APP_BASE_API + props.action
  return effTaskId.value ? `${base}?taskId=${effTaskId.value}` : base
})

function open(taskId = null) {
  isUploading.value = false
  ctxTaskId.value = taskId
  visible.value = true
  nextTick(() => {
    selectedFile.value = null
    uploadRef.value?.clearFiles()
  })
}

function downloadTemplate() {
  if (isDemoMode()) {
    proxy.$modal.msgWarning('演示环境暂不支持模板下载')
    return
  }
  const params = effTaskId.value ? { taskId: effTaskId.value } : {}
  const name = effTaskId.value
    ? `test-result-task-${effTaskId.value}-template.csv`
    : 'test-result-template.csv'
  // 模板接口后端为 @GetMapping，需显式指定 GET（download 默认 POST）
  proxy.download('apms/test-result/import/template', params, name, { method: 'get' })
}

function handleClose() {
  isUploading.value = false
  selectedFile.value = null
  uploadRef.value?.clearFiles()
}

function showTemplate() { templateVisible.value = true }

function handleProgress() { isUploading.value = true }
const handleFileChange = (file) => { selectedFile.value = file }
const handleFileRemove = () => { selectedFile.value = null }

function handleSuccess(response) {
  visible.value = false
  isUploading.value = false
  selectedFile.value = null
  uploadRef.value?.clearFiles()

  if (response.code === 200) {
    const data = response
    const summary = [
      `✅ 写入 ${data.writtenResultCount || 0} 条测试结果`,
      `📊 处理 ${data.rowsProcessed || 0} 行数据`
    ]
    if (data.warnings && data.warnings.length) {
      summary.push(`\n⚠️  ${data.warnings.join('\n   ')}`)
    }
    if (data.errorRows && data.errorRows.length) {
      summary.push(`\n❌  ${data.errorRows.join('\n   ')}`)
    }
    proxy.$alert(summary.join('\n'), '导入结果', { type: 'info' })
    emit('success')
  } else {
    proxy.$modal.msgError(response.msg || '导入失败')
  }
}

function handleError() {
  isUploading.value = false
  proxy.$modal.msgError('上传失败，请检查网络或文件格式')
}

function handleSubmit() {
  // 演示模式：上传已禁用，确定键再兜一道
  if (isDemoMode()) {
    proxy.$modal.msgWarning('演示环境暂不支持 CSV 导入')
    return
  }
  const file = selectedFile.value
  if (!file || file.size === 0) {
    proxy.$modal.msgError('请选择 CSV 文件')
    return
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    proxy.$modal.msgError('只支持 .csv 文件')
    return
  }
  uploadRef.value.submit()
}

defineExpose({ open })
</script>
