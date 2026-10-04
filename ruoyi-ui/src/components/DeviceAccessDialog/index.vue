<template>
  <el-dialog title="测试设备接入" v-model="visible" width="760px" append-to-body @close="reset">

    <!-- 注册新设备 -->
    <div class="dv-register">
      <el-input v-model="reg.deviceCode" placeholder="设备编码（必填，如 GATE-01）" style="width:190px"/>
      <el-input v-model="reg.deviceName" placeholder="设备名称（如 计时门）" style="width:170px"/>
      <el-input v-model="reg.deviceType" placeholder="类型（如 TIMING_GATE）" style="width:170px"/>
      <el-input v-model="reg.vendor" placeholder="厂商" style="width:130px"/>
      <el-button type="primary" :loading="regLoading" @click="doRegister">注册设备</el-button>
    </div>

    <!-- 设备列表 -->
    <el-table :data="devices" v-loading="loading" size="small" border style="margin-top:10px"
              highlight-current-row @current-change="onSelect" height="210">
      <el-table-column label="编码" prop="deviceCode" width="110"/>
      <el-table-column label="名称" prop="deviceName" width="120"/>
      <el-table-column label="类型" prop="deviceType" width="120"/>
      <el-table-column label="API Key" min-width="200">
        <template #default="{ row }">
          <span class="dv-key">{{ row.apiKey }}</span>
          <el-button link type="primary" size="small" @click.stop="copy(row.apiKey)">复制</el-button>
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="70"/>
    </el-table>

    <!-- 推送测试 -->
    <div v-if="current" class="dv-push">
      <h4>用「{{ current.deviceCode }}」模拟推送一条成绩</h4>
      <el-form label-width="82px" inline>
        <el-form-item label="运动员">
          <el-select v-model="push.athleteId" filterable placeholder="选择运动员" style="width:200px">
            <el-option v-for="a in athletes" :key="a.athleteId" :label="a.name" :value="a.athleteId"/>
          </el-select>
        </el-form-item>
        <el-form-item label="指标 code">
          <el-input v-model="push.indicatorCode" placeholder="如 50M_SPRINT" style="width:150px"/>
        </el-form-item>
        <el-form-item label="数值">
          <el-input v-model="push.value" placeholder="如 5.21" style="width:110px"/>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="pushLoading" @click="doPush">推送成绩</el-button>
        </el-form-item>
      </el-form>
      <div class="dv-curl">
        <div class="dv-curl-head">
          <span>设备/网关对接示例（HTTP）</span>
          <el-button link type="primary" size="small" @click="copy(curlExample)">复制</el-button>
        </div>
        <pre>{{ curlExample }}</pre>
      </div>
    </div>
    <div v-else class="dv-empty">选择上方一台设备，查看推送密钥与对接示例</div>

    <template #footer>
      <el-button @click="visible = false">关 闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { listAthlete } from '@/api/apms/athlete'
import { listDevices, registerDevice, pushDeviceData } from '@/api/apms/testResult'

const { proxy } = getCurrentInstance()
const emit = defineEmits(['pushed'])

const visible = ref(false)
const loading = ref(false)
const regLoading = ref(false)
const pushLoading = ref(false)
const devices = ref([])
const athletes = ref([])
const current = ref(null)
const reg = reactive({ deviceCode: '', deviceName: '', deviceType: '', vendor: '' })
const push = reactive({ athleteId: null, indicatorCode: '', value: '' })

const curlExample = computed(() => {
  const key = current.value?.apiKey || 'dk-xxxx'
  const code = current.value?.deviceCode || 'GATE-01'
  return `POST /dev-api/apms/device/push
Header:
  Authorization: Bearer <登录token>
  X-Device-Key: ${key}
  Content-Type: application/json
Body:
{
  "athleteId": 1001,
  "indicatorCode": "50M_SPRINT",
  "value": "5.21",
  "measureDate": "2026-09-30",
  "sessionKey": "S1"
}

# 注册：POST /dev-api/apms/device/register
# { "deviceCode": "${code}", "deviceName": "计时门", "deviceType": "TIMING_GATE", "vendor": "XX" }`
})

async function open() {
  visible.value = true
  await loadDevices()
  if (!athletes.value.length) {
    const a = await listAthlete({ pageSize: 999, status: '0' })
    athletes.value = a.rows || []
  }
}

async function loadDevices() {
  loading.value = true
  try {
    const res = await listDevices()
    devices.value = res.data || []
  } finally {
    loading.value = false
  }
}

async function doRegister() {
  if (!reg.deviceCode.trim()) return proxy.$modal.msgWarning('请填写设备编码')
  regLoading.value = true
  try {
    const res = await registerDevice({ ...reg })
    proxy.$modal.msgSuccess(`注册成功，API Key：${res.data.apiKey}`)
    Object.assign(reg, { deviceCode: '', deviceName: '', deviceType: '', vendor: '' })
    await loadDevices()
  } finally {
    regLoading.value = false
  }
}

function onSelect(row) {
  current.value = row
}

async function doPush() {
  if (!push.athleteId) return proxy.$modal.msgWarning('请选择运动员')
  if (!push.indicatorCode.trim()) return proxy.$modal.msgWarning('请填写指标 code')
  if (push.value === '') return proxy.$modal.msgWarning('请填写数值')
  pushLoading.value = true
  try {
    const res = await pushDeviceData({
      apiKey: current.value.apiKey,
      athleteId: push.athleteId,
      indicatorCode: push.indicatorCode.trim(),
      value: push.value,
      measureDate: new Date().toISOString().slice(0, 10)
    })
    proxy.$modal.msgSuccess(`推送成功，resultId=${res.data.resultId}`)
    emit('pushed', res.data)
  } finally {
    pushLoading.value = false
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    proxy.$modal.msgSuccess('已复制')
  } catch {
    proxy.$modal.msgWarning('复制失败，请手动选择文本复制')
  }
}

function reset() {
  current.value = null
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.dv-register { display: flex; gap: 8px; flex-wrap: wrap; }
.dv-key { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #475569; }
.dv-push { margin-top: 14px; border-top: 1px dashed var(--el-border-color); padding-top: 10px; }
.dv-push h4 { margin: 0 0 8px; font-size: 14px; color: #303133; }
.dv-curl { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; margin-top: 4px; }
.dv-curl-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: #f7f8fa; font-size: 12px; color: #606266; }
.dv-curl pre { margin: 0; padding: 10px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
.dv-empty { margin-top: 16px; text-align: center; color: #909399; font-size: 13px; }
</style>
