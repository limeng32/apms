<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="`登录手机号管理 · ${user?.userName || ''}`"
    width="460px"
    append-to-body
  >
    <div v-loading="loading">
      <div class="upa-hint">
        该账号已绑定 <b>{{ phones.length }}</b> / {{ maxCount }} 个登录手机号。
        管理员可强制解绑（无需短信验证），不可代为绑定。
      </div>
      <el-table :data="phones" size="small" class="upa-table">
        <el-table-column label="手机号" prop="phonenumber" min-width="140">
          <template #default="{ row }"><span class="upa-phone">{{ row.phonenumber }}</span></template>
        </el-table-column>
        <el-table-column label="绑定时间" min-width="150">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="84" align="right">
          <template #default="{ row }">
            <el-button type="danger" link size="small"
                       v-hasPermi="['system:user:edit']"
                       @click="onUnbind(row)">强制解绑</el-button>
          </template>
        </el-table-column>
        <template #empty><span class="upa-empty">该账号尚未绑定登录手机号</span></template>
      </el-table>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup name="UserPhoneAdminDialog">
import { listUserPhones, adminUnbindPhone } from '@/api/apms/userPhone'

const { proxy } = getCurrentInstance()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue'])

const phones = ref([])
const loading = ref(false)
const maxCount = ref(3)

function formatTime(t) {
  return t ? String(t).replace('T', ' ').substring(0, 19) : '—'
}

function loadList() {
  if (!props.user?.userId) return
  loading.value = true
  listUserPhones(props.user.userId).then(res => {
    phones.value = res.data || []
    if (typeof res.maxCount === 'number') maxCount.value = res.maxCount
  }).finally(() => { loading.value = false })
}

function onUnbind(row) {
  proxy.$modal
    .confirm(`确认强制解绑 ${row.phonenumber}？解绑后该号码将无法登录该账号，操作会记录审计日志。`)
    .then(() => adminUnbindPhone(row.id))
    .then(() => {
      proxy.$modal.msgSuccess('已强制解绑')
      loadList()
    })
    .catch(() => {})
}

// 每次打开刷新
watch(() => props.modelValue, (v) => {
  if (v && props.user?.userId) loadList()
})
</script>

<style lang='scss' scoped>
.upa-hint { font-size: 12.5px; color: #606266; line-height: 1.7; margin-bottom: 12px; b { color: var(--el-color-primary); } }
.upa-phone { font-family: var(--app-font-mono, ui-monospace, monospace); letter-spacing: .5px; }
.upa-empty { color: #94a3b8; font-size: 12.5px; }
</style>
