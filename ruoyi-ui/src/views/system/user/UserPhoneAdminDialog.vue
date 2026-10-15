<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :title="`登录手机号管理 · ${user?.userName || ''}`"
    width="480px"
    append-to-body
    @closed="onClosed"
  >
    <div v-loading="loading">
      <div class="upa-hint">
        该账号已绑定 <b>{{ phones.length }}</b> / {{ maxCount }} 个登录手机号，任一号码均可用于短信登录。
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

      <!-- 代绑区：未达上限时展示；admin 免码直绑，其他管理员需新手机号短信验证码 -->
      <div v-if="phones.length < maxCount" class="upa-bind">
        <div class="upa-bind-title">
          {{ isPlatformAdmin ? '绑定登录手机号（平台管理员免短信验证）' : '绑定登录手机号（需新手机号短信验证）' }}
        </div>
        <el-form label-width="84px" @submit.prevent>
          <el-form-item label="手机号">
            <el-input v-model="bindForm.phonenumber" maxlength="11" placeholder="请输入要绑定的手机号"
                      @input="bindForm.phonenumber = bindForm.phonenumber.replace(/\D/g, '')">
              <template #prefix><el-icon><Iphone /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item v-if="!isPlatformAdmin" label="验证码">
            <div class="upa-code-row">
              <el-input v-model="bindForm.code" maxlength="6" placeholder="6 位短信验证码"
                        @input="bindForm.code = bindForm.code.replace(/\D/g, '')"
                        @keyup.enter="submitBind">
                <template #prefix><el-icon><Key /></el-icon></template>
              </el-input>
              <el-button :disabled="countdown > 0 || sending" @click="sendCode">
                {{ sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </el-button>
            </div>
          </el-form-item>
        </el-form>
        <div class="upa-bind-tip">
          <template v-if="isPlatformAdmin">
            直接绑定无需验证码，操作将记录审计日志；该号码跨账号一号多绑时不影响其他账号。
          </template>
          <template v-else>
            验证码将发送至新手机号；仅可为本部门数据范围内的专岗（portal_*）账号代绑，解绑无需验证码。
          </template>
        </div>
        <div class="upa-bind-actions">
          <el-button type="primary" :loading="submitting" @click="submitBind">
            {{ isPlatformAdmin ? '确认绑定' : '验证并绑定' }}
          </el-button>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>

    <!-- 真人滑块（与登录页/个人中心同一组件；开关关闭时 open 直接返回 false 放行） -->
    <SliderCaptcha ref="sliderRef" @verified="onSliderVerified" />
  </el-dialog>
</template>

<script setup name="UserPhoneAdminDialog">
import { Iphone, Key } from '@element-plus/icons-vue'
import { listUserPhones, adminUnbindPhone, adminBindPhone } from '@/api/apms/userPhone'
import { sendSmsCode } from '@/api/login'
import SliderCaptcha from '@/views/login/SliderCaptcha.vue'
import useUserStore from '@/store/modules/user'

const { proxy } = getCurrentInstance()

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue'])

// 平台管理员身份只认 userId=1（与后端 SecurityUtils.isAdmin 同口径）
const isPlatformAdmin = computed(() => useUserStore().id === 1)

const phones = ref([])
const loading = ref(false)
const maxCount = ref(3)

const bindForm = ref({ phonenumber: '', code: '' })
const countdown = ref(0)
const sending = ref(false)
const submitting = ref(false)
let timer = null

const sliderRef = ref(null)
const sliderUuid = ref('')

const PHONE_RE = /^1[3-9]\d{9}$/

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

function resetBindForm() {
  bindForm.value = { phonenumber: '', code: '' }
  countdown.value = 0
  sending.value = false
  submitting.value = false
  sliderUuid.value = ''
  if (timer) { clearInterval(timer); timer = null }
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

/** 部门管理员发码：滑块开启先弹模态，通过后 doSend；admin 不走发码链路 */
function sendCode() {
  if (!PHONE_RE.test(bindForm.value.phonenumber)) {
    proxy.$modal.msgWarning('请输入正确的手机号')
    return
  }
  if (countdown.value > 0 || sending.value) return
  const opened = sliderRef.value && sliderRef.value.open()
  if (!opened) doSend(undefined)
}

function onSliderVerified(uuid) {
  sliderUuid.value = uuid
  doSend(uuid)
}

async function doSend(uuid) {
  try {
    sending.value = true
    await sendSmsCode(bindForm.value.phonenumber, 'adminbind', uuid, props.user.userId)
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) { clearInterval(timer); timer = null }
    }, 1000)
    proxy.$modal.msgSuccess('验证码已发送')
  } finally {
    sending.value = false
    sliderUuid.value = ''
  }
}

function submitBind() {
  if (!PHONE_RE.test(bindForm.value.phonenumber)) {
    proxy.$modal.msgWarning('请输入正确的手机号')
    return
  }
  if (!isPlatformAdmin.value && !/^\d{6}$/.test(bindForm.value.code)) {
    proxy.$modal.msgWarning('请输入 6 位数字验证码')
    return
  }
  submitting.value = true
  const code = isPlatformAdmin.value ? undefined : bindForm.value.code.trim()
  adminBindPhone(props.user.userId, bindForm.value.phonenumber, code).then(res => {
    proxy.$modal.msgSuccess('绑定成功')
    phones.value = res.data || phones.value
    if (typeof res.maxCount === 'number') maxCount.value = res.maxCount
    resetBindForm()
  }).finally(() => { submitting.value = false })
}

function onClosed() {
  resetBindForm()
}

// 每次打开刷新号码列表并复位代绑表单
watch(() => props.modelValue, (v) => {
  if (v && props.user?.userId) {
    resetBindForm()
    loadList()
  }
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style lang='scss' scoped>
.upa-hint { font-size: 12.5px; color: #606266; line-height: 1.7; margin-bottom: 12px; b { color: var(--el-color-primary); } }
.upa-phone { font-family: var(--app-font-mono, ui-monospace, monospace); letter-spacing: .5px; }
.upa-empty { color: #94a3b8; font-size: 12.5px; }
.upa-bind {
  margin-top: 16px;
  padding: 14px 14px 6px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.upa-bind-title { font-size: 13px; font-weight: 600; color: var(--el-text-color-primary); margin-bottom: 10px; }
.upa-code-row { display: flex; gap: 10px; width: 100%; }
.upa-bind-tip { font-size: 12px; color: #94a3b8; line-height: 1.7; margin: -4px 0 10px; }
.upa-bind-actions { text-align: right; margin-bottom: 8px; }
</style>
