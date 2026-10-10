<template>
  <DashCard title="本周测试任务进度"
            :subtitle="`活跃任务 ${rows.length} 项 · 平均完成率 ${block.avgProgress || 0}%`"
            :big="big" :enter-delay="enterDelay" body-class="tp-body">
    <div v-if="rows.length" class="tp-list">
      <div v-for="(t, i) in rows" :key="t.taskId"
           class="tp-row" :style="{ animationDelay: 120 + i * 70 + 'ms' }">
        <div class="tp-main">
          <div class="tp-line1">
            <span class="tp-name">{{ t.taskName }}</span>
            <span v-if="t.testerName" class="tp-owner">{{ t.testerName }}</span>
            <span class="tp-status" :class="'s-' + t.status">{{ statusLabel(t.status) }}</span>
          </div>
          <div class="tp-line2">
            <span class="tp-track">
              <i class="tp-bar" :class="'tone-' + tone(t.progress)"
               :style="{ width: (play ? t.progress : 0) + '%', transitionDelay: 150 + i * 80 + 'ms' }"></i>
            </span>
            <span class="tp-window rk-mono">{{ fmtDate(t.startDate) }} ~ {{ fmtDate(t.endDate) }}</span>
          </div>
        </div>
        <div class="tp-right">
          <span class="tp-count rk-mono">{{ t.selectedCount || 0 }}/{{ t.athleteCount || 0 }}</span>
          <span class="tp-pct rk-mono" :class="'tone-' + tone(t.progress)">{{ t.progress }}%</span>
        </div>
      </div>
    </div>
    <div v-else class="dbx-empty">当前时间窗内没有进行中的任务</div>
  </DashCard>
</template>

<script setup name="DashTaskProgress">
import { ref, computed, watch } from 'vue'
import DashCard from './DashCard.vue'

const props = defineProps({
  block: { type: Object, default: () => ({ list: [], avgProgress: 0 }) },
  big: { type: Boolean, default: false },
  enterDelay: { type: Number, default: 0 }
})

const rows = computed(() => props.block.list || [])

// 行渲染到下一帧后再播放进度条生长（兼容数据异步晚于挂载到达）
const play = ref(false)
function kickPlay() {
  requestAnimationFrame(() => requestAnimationFrame(() => { play.value = true }))
}
watch(() => rows.value.length, (n) => { if (n > 0) kickPlay() }, { immediate: true })

function fmtDate(d) { return d ? String(d).slice(5, 10) : '—' }
function statusLabel(s) {
  return { pending: '未开始', in_progress: '进行中', completed: '已完成' }[s] || '进行中'
}
function tone(p) {
  if (p >= 80) return 'ok'
  if (p >= 50) return 'brand'
  if (p >= 20) return 'warn'
  return 'risk'
}
</script>

<style lang="scss" scoped>
.tp-body { display: flex; flex-direction: column; }
.tp-list { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.tp-row {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  text-align: left;
  opacity: 0;
  animation: tp-row-in 0.4s ease-out forwards;
}
@keyframes tp-row-in {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
.tp-main { flex: 1; min-width: 0; }
.tp-line1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
.tp-name {
  font-size: 13px; font-weight: 600; color: var(--dbx-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 280px;
}
.tp-owner {
  flex: none;
  font-size: 11px; color: var(--dbx-sub);
  border: 1px solid var(--dbx-line); border-radius: 999px;
  padding: 0 7px; line-height: 17px;
}
.tp-status {
  flex: none; font-size: 10px; line-height: 16px; padding: 0 7px;
  border-radius: 999px; font-weight: 600;
  &.s-pending { background: rgba(148,163,191,.16); color: var(--dbx-sub); }
  &.s-in_progress { background: rgba(217,119,6,.14); color: #d97706; }
  &.s-completed { background: rgba(22,163,74,.14); color: #16a34a; }
}
.tp-line2 { display: flex; align-items: center; gap: 12px; margin-top: 5px; }
.tp-track {
  flex: 1; min-width: 80px;
  height: 6px; border-radius: 999px;
  background: var(--dbx-bg-soft);
  box-shadow: inset 0 0 0 1px var(--dbx-line);
  overflow: hidden;
}
.tp-bar {
  display: block; height: 100%; border-radius: 999px;
  width: 0;
  transition: width 0.75s cubic-bezier(0.22, 1, 0.36, 1);
  &.tone-ok { background: linear-gradient(90deg, #4ade80, #16a34a); }
  &.tone-brand { background: linear-gradient(90deg, #60a5fa, #2563eb); }
  &.tone-warn { background: linear-gradient(90deg, #fbbf24, #d97706); }
  &.tone-risk { background: linear-gradient(90deg, #f87171, #dc2626); }
}
.is-big .tp-bar { box-shadow: 0 0 10px rgba(34, 211, 238, 0.25); }
.is-big .tp-bar.tone-brand { background: linear-gradient(90deg, #22d3ee, #2563eb); }
.tp-window { flex: none; font-size: 11px; color: var(--dbx-sub); }
.tp-right { flex: none; display: flex; align-items: baseline; gap: 8px; min-width: 92px; justify-content: flex-end; }
.tp-count { font-size: 13px; font-weight: 700; color: var(--dbx-text); }
.tp-pct { font-size: 13px; font-weight: 700; }
.tp-pct.tone-ok { color: #16a34a; }
.tp-pct.tone-brand { color: #2563eb; }
.tp-pct.tone-warn { color: #d97706; }
.tp-pct.tone-risk { color: #dc2626; }

.dbx-empty {
  flex: 1; min-height: 160px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--dbx-sub);
}
@media (prefers-reduced-motion: reduce) {
  .tp-row { opacity: 1; animation: none; }
}
</style>
