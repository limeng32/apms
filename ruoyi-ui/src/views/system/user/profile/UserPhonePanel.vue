<template>
  <div class="upp-panel">
    <div class="upp-head">
      <span class="upp-count">已绑定 <b>{{ phones.length }}</b> / {{ maxCount }} 个手机号，任一号码均可用于短信登录</span>
      <el-button type="primary" size="small" plain
                 :disabled="phones.length >= maxCount"
                 @click="openBind">
        <el-icon><Plus/></el-icon>绑定新手机号
      </el-button>
    </div>

    <el-table :data="phones" v-loading="loading" size="small" class="upp-table">
      <el-table-column label="登录手机号" prop="phonenumber" min-width="150">
        <template #default="{ row }">
          <span class="upp-phone">{{ maskPhone(row.phonenumber) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="绑定时间" prop="createTime" width="180">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="right">
        <template #default="{ row }">
          <el-button type="danger" link size="small" @click="onUnbind(row)">解绑</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <span class="upp-empty">尚未绑定登录手机号，绑定后可使用手机号 + 短信验证码登录</span>
      </template>
    </el-table>

    <!-- 绑定弹窗：新号收码验证所有权 -->
    <el-dialog v-model="bindVisible" title="绑定登录手机号" width="420px" append-to-body>
      <el-form label-width="88px" @submit.prevent>
        <el-form-item label="手机号">
          <el-input v-model="form.phonenumber" maxlength="11" placeholder="本人正在使用的手机号"
                    @input="form.phonenumber = form.phonenumber.replace(/\D/g, '')">
            <template #prefix><el-icon><Iphone/></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="验证码">
          <div class="upp-code-row">
            <el-input v-model="form.code" maxlength="6" placeholder="6 位短信验证码"
                      @input="form.code = form.code.replace(/\D/g, '')"
                      @keyup.enter="submitBind">
              <template #prefix><el-icon><Key/></el-icon></template>
            </el-input>
            <el-button :disabled="countdown > 0 || sending" @click="sendCode">
              {{ sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <div class="upp-dialog-tip">验证码将发送至新手机号，用于确认号码归您本人使用；绑定后可直接用于短信登录。</div>
      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitBind">确认绑定</el-button>
      </template>
    </el-dialog>

    <!-- 图形点选验证（与登录页同一组件：常驻挂载、open 时自动拉新挑战；关闭时 open 返回 false 直接放行） -->
    <ClickCaptcha ref="sliderRef" @verified="onSliderVerified" />
  </div>
</template>

<script setup name="UserPhonePanel">
import { Iphone, Key, Plus } from '@element-plus/icons-vue'
import { listMyPhones, bindMyPhone, unbindMyPhone } from '@/api/apms/userPhone'
import { sendSmsCode } from '@/api/login'
import ClickCaptcha from '@/views/login/ClickCaptcha.vue'

const { proxy } = getCurrentInstance()

const MAX_COUNT = 3
const maxCount = ref(MAX_COUNT)
const phones = ref([])
const loading = ref(false)

const bindVisible = ref(false)
const form = ref({ phonenumber: '', code: '' })
const countdown = ref(0)
const sending = ref(false)
const submitting = ref(false)
let timer = null

// 滑块通过标记（仅用于下一次发码，一次性）
const sliderRef = ref(null)
const sliderUuid = ref('')

const PHONE_RE = /^1[3-9]\d{9}$/

function maskPhone(p) {
  if (!p || p.length !== 11) return p || '—'
  return p.slice(0, 3) + ' **** ' + p.slice(7)
}
function formatTime(t) {
  return t ? String(t).replace('T', ' ').substring(0, 19) : '—'
}

function loadList() {
  loading.value = true
  listMyPhones().then(res => {
    phones.value = res.data || []
    if (typeof res.maxCount === 'number') maxCount.value = res.maxCount
  }).finally(() => { loading.value = false })
}

function openBind() {
  form.value = { phonenumber: '', code: '' }
  sliderUuid.value = ''
  bindVisible.value = true
}

/** 点获取验证码：滑块开启→弹模态，通过后 onSliderVerified 调 doSend；关闭→open 返回 false 直接发 */
function sendCode() {
  if (!PHONE_RE.test(form.value.phonenumber)) {
    proxy.$modal.msgWarning('请输入正确的手机号')
    return
  }
  if (countdown.value > 0 || sending.value) return
  // ClickCaptcha.open()：开关关闭时返回 false；开启时弹模态并由 @verified 异步回调
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
    await sendSmsCode(form.value.phonenumber, 'bind', uuid)
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
  if (!PHONE_RE.test(form.value.phonenumber)) {
    proxy.$modal.msgWarning('请输入正确的手机号')
    return
  }
  if (!/^\d{6}$/.test(form.value.code)) {
    proxy.$modal.msgWarning('请输入 6 位数字验证码')
    return
  }
  submitting.value = true
  bindMyPhone(form.value.phonenumber, form.value.code).then(res => {
    proxy.$modal.msgSuccess('绑定成功')
    bindVisible.value = false
    phones.value = res.data || phones.value
    if (typeof res.maxCount === 'number') maxCount.value = res.maxCount
  }).finally(() => { submitting.value = false })
}

function onUnbind(row) {
  proxy.$modal
    .confirm(`确认解绑手机号 ${maskPhone(row.phonenumber)}？解绑后该号码将无法再登录本账号。`)
    .then(() => unbindMyPhone(row.id))
    .then(() => {
      proxy.$modal.msgSuccess('已解绑')
      loadList()
    })
    .catch(() => {})
}

onMounted(loadList)
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<style lang='scss' scoped>
.upp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.upp-count { font-size: 13px; color: #606266; b { color: var(--el-color-primary); } }
.upp-phone { font-family: var(--app-font-mono, ui-monospace, monospace); letter-spacing: .5px; }
.upp-empty { color: #94a3b8; font-size: 12.5px; }
.upp-code-row { display: flex; gap: 10px; width: 100%; }
.upp-dialog-tip { font-size: 12px; color: #94a3b8; line-height: 1.7; margin: -4px 0 4px; }
</style>
