<template>
  <div class="dbx-card" :class="{ 'is-big': big }" :style="enterStyle">
    <div class="dbx-head">
      <div class="dbx-titles">
        <span class="dbx-title">{{ title }}</span>
        <span v-if="subtitle" class="dbx-sub">{{ subtitle }}</span>
      </div>
      <div v-if="$slots.actions" class="dbx-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="dbx-body" :class="bodyClass">
      <slot />
    </div>
  </div>
</template>

<script setup name="DashCard">
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  big: { type: Boolean, default: false },
  // 入场错峰（毫秒），由父级按栅格顺序传入
  enterDelay: { type: Number, default: 0 },
  bodyClass: { type: String, default: '' }
})

const enterStyle = computed(() => ({ animationDelay: props.enterDelay + 'ms' }))
</script>

<style lang="scss" scoped>
.dbx-card {
  /* 主题变量：浅色（默认）/大屏深色（is-big） */
  --dbx-bg: #fff;
  --dbx-bg-soft: #f8fafc;
  --dbx-text: #0f172a;
  --dbx-sub: #94a3b8;
  --dbx-line: #e7ecf3;
  --dbx-brand: #2563eb;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: var(--dbx-bg);
  border: 1px solid var(--dbx-line);
  border-radius: 16px;
  overflow: hidden;
  opacity: 0;
  animation: dbx-fade-up 0.5s ease-out forwards;

  &.is-big {
    --dbx-bg: #111b31;
    --dbx-bg-soft: rgba(255, 255, 255, 0.04);
    --dbx-text: rgba(255, 255, 255, 0.92);
    --dbx-sub: rgba(255, 255, 255, 0.48);
    --dbx-line: rgba(148, 163, 191, 0.18);
    --dbx-brand: #22d3ee;
    border-color: rgba(34, 211, 238, 0.22);
    box-shadow: 0 0 28px rgba(37, 99, 235, 0.08), inset 0 0 0 1px rgba(34, 211, 238, 0.05);
  }
}
.dbx-head {
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px 10px;
}
.dbx-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--dbx-text);
  line-height: 20px;
}
.dbx-sub {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--dbx-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dbx-actions {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dbx-body {
  flex: 1;
  min-height: 0;
  padding: 4px 18px 14px;
}

@keyframes dbx-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .dbx-card { animation: none; opacity: 1; }
}
</style>
