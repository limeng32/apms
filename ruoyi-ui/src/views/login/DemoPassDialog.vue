<template>
  <el-dialog
    :model-value="modelValue"
    width="380px"
    align-center
    :show-close="true"
    :close-on-click-modal="false"
    append-to-body
    class="demo-pass-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @close="reset"
  >
    <template #header>
      <div class="dpd-title">一键体验演示环境</div>
    </template>

    <div class="dpd-body" :class="{ 'dpd-shake': shaking }">
      <el-input
        ref="inputRef"
        v-model="passcode"
        type="password"
        size="large"
        show-password
        maxlength="32"
        autocomplete="off"
        placeholder="请输入演示口令"
        @keyup.enter="onSubmit"
      >
        <template #prefix>
          <el-icon><Key/></el-icon>
        </template>
      </el-input>
      <div v-if="errorMsg" class="dpd-error">
        <el-icon><CircleCloseFilled/></el-icon>
        <span>{{ errorMsg }}</span>
      </div>
      <p class="dpd-tip">
        静态演示：数据均为样本，仅当前标签页有效，刷新后还原；<br/>
        所有操作不会影响真实系统。
      </p>
    </div>

    <template #footer>
      <el-button size="default" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" size="default" :loading="submitting" @click="onSubmit">
        进入演示
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { Key, CircleCloseFilled } from '@element-plus/icons-vue'
import { enterDemo } from '@/utils/demo'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'success'])

const passcode = ref('')
const errorMsg = ref('')
const shaking = ref(false)
const submitting = ref(false)
const inputRef = ref(null)

watch(() => props.modelValue, (visible) => {
  if (visible) {
    passcode.value = ''
    errorMsg.value = ''
    nextTick(() => inputRef.value?.focus?.())
  }
})

function reset() {
  passcode.value = ''
  errorMsg.value = ''
  shaking.value = false
  submitting.value = false
}

function shake() {
  shaking.value = false
  nextTick(() => { shaking.value = true })
}

async function onSubmit() {
  if (submitting.value) return
  if (!String(passcode.value || '').trim()) {
    errorMsg.value = '请输入演示口令'
    shake()
    return
  }
  submitting.value = true
  errorMsg.value = ''
  try {
    enterDemo(passcode.value)
    emit('update:modelValue', false)
    emit('success')
  } catch (err) {
    // enterDemo 只在口令错误时抛业务文案；其余（sessionStorage 被禁/配额异常）统一存储文案
    errorMsg.value = err?.message === '口令不正确'
      ? '口令不正确，请重新输入'
      : '当前浏览器环境无法开启演示模式（本地存储不可用）'
    shake()
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.dpd-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}
.dpd-body {
  padding: 4px 2px 0;
}
.dpd-error {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  color: #f56c6c;
}
.dpd-tip {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: #94a3b8;
}

/* 口令错误抖动（0.4s，水平 6px） */
.dpd-shake {
  animation: dpd-shake .4s ease;
}
@keyframes dpd-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
</style>
