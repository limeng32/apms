<template>
  <teleport to="body">
    <div v-if="store.open" class="as-mask" @click.self="store.closePanel()">
      <aside class="as-panel" role="dialog" aria-label="APMS 助手" @click.stop>
        <header class="as-head">
          <div class="as-head-main">
            <span class="as-logo">AI</span>
            <div>
              <div class="as-title">APMS 助手</div>
              <div class="as-sub">页面导航 · 操作指引</div>
            </div>
          </div>
          <div class="as-head-actions">
            <button type="button" class="as-icon-btn" title="清空会话" @click="store.clear()">
              <el-icon><Delete /></el-icon>
            </button>
            <button type="button" class="as-icon-btn" title="关闭" @click="store.closePanel()">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </header>

        <main ref="bodyRef" class="as-body">
          <div v-if="!store.messages.length" class="as-empty">
            <div class="as-empty-title">可以帮你找到功能入口</div>
            <div class="as-empty-desc">回答会逐字显示；可点击动作直接跳转，不会自动提交表单。</div>
            <div class="as-suggest">
              <button v-for="s in store.suggestions" :key="s" type="button" class="as-chip"
                      @click="sendSuggestion(s)">{{ s }}</button>
            </div>
          </div>
          <AssistantMessage v-for="m in store.messages" :key="m.id" :message="m" @action="onAction" />
        </main>

        <footer class="as-foot">
          <textarea ref="inputRef" v-model="draft" class="as-input" rows="2"
                    placeholder="问页面、功能或操作步骤…（Alt+A 呼出，Esc 关闭）"
                    @keydown.enter.exact="onEnterKey" />
          <div class="as-foot-actions">
            <span class="as-hint">Enter 发送 · Shift+Enter 换行</span>
            <button v-if="store.loading" type="button" class="as-stop" @click="store.stop()">停止</button>
            <button type="button" class="as-send" :disabled="!draft.trim() || store.loading" @click="send">
              发送
            </button>
          </div>
        </footer>
      </aside>
    </div>
  </teleport>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { Close, Delete } from '@element-plus/icons-vue'
import useAssistantStore from './assistantStore'
import AssistantMessage from './AssistantMessage.vue'

const store = useAssistantStore()
const draft = ref('')
const inputRef = ref(null)
const bodyRef = ref(null)

function scrollBottom() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

watch(() => store.open, (open) => {
  if (open) {
    scrollBottom()
    nextTick(() => inputRef.value && inputRef.value.focus())
  }
})

watch(() => store.messages, scrollBottom, { deep: true })

function send() {
  const text = draft.value.trim()
  if (!text || store.loading) return
  draft.value = ''
  store.send(text)
}

function onEnterKey(e) {
  if (e.isComposing) return
  e.preventDefault()
  send()
}

function sendSuggestion(text) {
  draft.value = ''
  store.send(text)
}

function onAction(message) {
  store.executeAction(message)
}
</script>

<style scoped>
.as-mask {
  position: fixed;
  inset: 0;
  z-index: 2200;
  background: rgba(15, 23, 42, 0.18);
  display: flex;
  justify-content: flex-end;
}
.as-panel {
  width: 420px;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.18);
  animation: as-slide-in 0.18s ease-out;
}
@keyframes as-slide-in {
  from { transform: translateX(16px); opacity: 0.6; }
  to { transform: translateX(0); opacity: 1; }
}
.as-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #eef2f7;
}
.as-head-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.as-logo {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--el-color-primary), #06b6d4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
.as-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.as-sub {
  font-size: 11.5px;
  color: #94a3b8;
}
.as-head-actions {
  display: flex;
  gap: 4px;
}
.as-icon-btn {
  border: 0;
  background: transparent;
  color: #64748b;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.as-icon-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.as-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fbfcfe;
}
.as-empty {
  padding: 20px 4px;
}
.as-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.as-empty-desc {
  margin-top: 6px;
  font-size: 12.5px;
  color: #64748b;
  line-height: 1.6;
}
.as-suggest {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.as-chip {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #334155;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}
.as-chip:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.as-foot {
  padding: 12px 16px 14px;
  border-top: 1px solid #eef2f7;
  background: #fff;
}
.as-input {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 13px;
  line-height: 1.5;
  color: #1f2937;
  outline: none;
  font-family: inherit;
}
.as-input:focus {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}
.as-foot-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.as-hint {
  margin-right: auto;
  font-size: 11px;
  color: #94a3b8;
}
.as-stop {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}
.as-send {
  border: 0;
  border-radius: 8px;
  padding: 7px 16px;
  color: #fff;
  background: linear-gradient(90deg, var(--el-color-primary), #06b6d4);
  font-size: 12.5px;
  cursor: pointer;
}
.as-send:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 768px) {
  .as-mask {
    align-items: flex-end;
  }
  .as-panel {
    width: 100%;
    height: 85vh;
    border-radius: 16px 16px 0 0;
    animation: as-sheet-in 0.18s ease-out;
  }
  @keyframes as-sheet-in {
    from { transform: translateY(16px); opacity: 0.7; }
    to { transform: translateY(0); opacity: 1; }
  }
}
</style>
