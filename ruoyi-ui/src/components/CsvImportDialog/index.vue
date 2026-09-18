<template>
  <el-dialog title="CSV 批量导入测试结果" v-model="visible" width="480px" append-to-body @close="handleClose">
    <el-upload
      ref="uploadRef"
      :limit="1"
      accept=".csv"
      :headers="headers"
      :action="uploadUrl"
      :disabled="isUploading"
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
          <b>CSV 格式要求：</b>
          <ul style="margin: 4px 0 0 18px; padding: 0; color: #606266; font-size: 12px;">
            <li>UTF-8 编码，首行为表头</li>
            <li>必须列：<code>athlete_id</code>（数字ID或姓名）、<code>measure_date</code>（YYYY-MM-DD）</li>
            <li>可选列：<code>session_key</code>（如 S1）</li>
            <li>数据列名 = 指标/模型的 <code>code</code>（大小写不敏感）</li>
          </ul>
          <div style="margin-top: 6px;">
            <el-link type="primary" :underline="false" style="font-size: 12px;" @click="showTemplate">查看 CSV 格式示例</el-link>
          </div>
        </div>
      </template>
    </el-upload>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="handleSubmit" :loading="isUploading">确 定</el-button>
        <el-button @click="visible = false">取 消</el-button>
      </div>
    </template>

    <!-- 格式示例弹窗 -->
    <el-dialog title="CSV 格式示例" v-model="templateVisible" width="520px" append-to-body>
      <pre style="background:#f5f7fa; padding:12px; border-radius:6px; font-size:13px; line-height:1.6; margin:0;">athlete_id,measure_date,session_key,HEIGHT,WEIGHT,SPRINT_30M,VJUMP,50M_SPRINT
1001,2026-09-18,S1,178.5,72.3,4.85,55.2,5.21
1006,2026-09-18,S1,182.0,78.5,4.60,60.5,5.08
张志远,2026-09-19,S2,175.0,68.0,4.92,58.0,5.15</pre>
      <div style="margin-top: 10px; color:#606266; font-size:12px;">
        <p><b>说明：</b></p>
        <ul style="margin: 4px 0 0 18px; padding: 0;">
          <li><code>athlete_id</code> 可以是运动员的数字 ID（如 1001），也可以是完整姓名</li>
          <li>数据列名需匹配系统中已注册的 <b>指标 code</b> 或 <b>测试模型 code</b>（大小写不敏感）</li>
          <li>值自动识别数字 / 文本；多趟测试的原始数值逐趟列出</li>
        </ul>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { getToken } from '@/utils/auth'

const props = defineProps({
  action: { type: String, required: true }
})

const emit = defineEmits(['success'])

const uploadRef = ref(null)
const visible = ref(false)
const templateVisible = ref(false)
const selectedFile = ref(null)
const isUploading = ref(false)
const headers = { Authorization: 'Bearer ' + getToken() }
const uploadUrl = computed(() => import.meta.env.VITE_APP_BASE_API + props.action)

function open() {
  isUploading.value = false
  visible.value = true
  nextTick(() => {
    selectedFile.value = null
    uploadRef.value?.clearFiles()
  })
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
