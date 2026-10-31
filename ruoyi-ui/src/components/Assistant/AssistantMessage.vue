<template>
  <div class="as-msg" :class="message.role === 'user' ? 'is-user' : 'is-assistant'">
    <div class="as-bubble">
      <div class="as-text">{{ visibleText }}<span v-if="typing" class="as-caret">▍</span></div>
      <div v-if="message.error" class="as-error">{{ message.error }}</div>
      <div v-if="showAction" class="as-action">
        <button type="button" class="as-action-btn" :disabled="message.actionState === 'running'"
                @click="$emit('action', message)">
          <span>{{ message.action.label || '打开页面' }}</span>
          <span v-if="message.actionState === 'running'" class="as-action-state">执行中…</span>
          <span v-else-if="message.actionState === 'highlighted'" class="as-action-state">已定位</span>
          <span v-else-if="message.actionState === 'navigated'" class="as-action-state">已打开</span>
          <el-icon v-else><ArrowRight /></el-icon>
        </button>
      </div>
      <div v-if="message.stopped" class="as-meta">已停止展示</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'

const props = defineProps({
  message: { type: Object, required: true }
})
defineEmits(['action'])

const visibleText = computed(() => {
  const m = props.message
  if (!m) return ''
  if (m.role === 'user') return m.text || ''
  return (m.fullText || '').slice(0, m.visibleLength || 0)
})

const typing = computed(() => {
  const m = props.message
  return m && m.role === 'assistant' && m.pending && (m.visibleLength || 0) < (m.fullText || '').length
})

const showAction = computed(() => {
  const m = props.message
  return m && m.role === 'assistant' && m.action && !m.pending
})
</script>

<style scoped>
.as-msg {
  display: flex;
  margin-bottom: 12px;
}
.as-msg.is-user {
  justify-content: flex-end;
}
.as-msg.is-assistant {
  justify-content: flex-start;
}
.as-bubble {
  max-width: 86%;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.65;
}
.is-user .as-bubble {
  background: var(--el-color-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.is-assistant .as-bubble {
  background: #f1f5f9;
  color: #1f2937;
  border-bottom-left-radius: 4px;
}
.as-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.as-caret {
  color: var(--el-color-primary);
  animation: as-blink 1s steps(1) infinite;
}
@keyframes as-blink {
  50% { opacity: 0; }
}
.as-error {
  margin-top: 6px;
  color: #dc2626;
  font-size: 12px;
}
.as-action {
  margin-top: 8px;
}
.as-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(37, 99, 235, 0.25);
  background: #fff;
  color: var(--el-color-primary);
  border-radius: 8px;
  font-size: 12.5px;
  cursor: pointer;
}
.as-action-btn:hover {
  background: rgba(37, 99, 235, 0.06);
}
.as-action-btn:disabled {
  opacity: 0.7;
  cursor: default;
}
.as-action-state {
  color: #64748b;
  font-size: 11.5px;
}
.as-meta {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 11px;
}
</style>
