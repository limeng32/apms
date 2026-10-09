<template>
  <DashCard title="健康预警" subtitle="RTP 规则引擎 · 当日待处理 ACTIVE"
            :big="big" :enter-delay="enterDelay" body-class="ha-body">
    <template #actions>
      <button type="button" class="dbx-link" @click="goWarning">预警中心<el-icon><ArrowRight /></el-icon></button>
    </template>

    <div class="ha-stats">
      <div class="ha-stat">
        <p class="ha-num rk-mono is-risk">{{ warnText }}</p>
        <p class="ha-label"><i class="ha-dot is-red"></i>建议停训</p>
      </div>
      <div class="ha-stat">
        <p class="ha-num rk-mono is-warn">{{ attnText }}</p>
        <p class="ha-label"><i class="ha-dot is-amber"></i>建议限制</p>
      </div>
      <div class="ha-stat">
        <p class="ha-num rk-mono is-brand">{{ infoText }}</p>
        <p class="ha-label"><i class="ha-dot is-brand"></i>健康关注</p>
      </div>
    </div>

    <!-- 三色占比条 -->
    <div class="ha-bar" v-if="hasAny">
      <i v-for="seg in segments" :key="seg.key"
         class="ha-seg" :class="seg.key"
         :style="{ width: (play ? seg.pct : 0) + '%', transitionDelay: seg.delay + 'ms' }"></i>
    </div>
    <div v-if="rows.length" class="ha-list">
      <button v-for="r in rows" :key="r.snapshotId" type="button" class="ha-row"
              @click="goWarning">
        <span class="ha-pulse" :class="{ 'is-red-pulse': r.level === 'WARNING' }">
          <i class="ha-dot" :class="dotClass(r.level)"></i>
        </span>
        <span class="ha-who">
          <b>{{ r.athleteName || '#' + r.athleteId }}</b>
          <em>{{ r.reason || levelLabel(r.level) }}</em>
        </span>
        <span class="ha-score rk-mono" :class="dotClass(r.level)">
          {{ r.processOnly === '1' ? '—' : Number(r.riskScore).toFixed(1) }}
        </span>
      </button>
    </div>
    <div v-else class="ha-empty">今日暂无待处理预警</div>
  </DashCard>
</template>

<script setup name="DashHealthAlert">
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import DashCard from './DashCard.vue'
import { useCountUp } from './useCountUp'

const { proxy } = getCurrentInstance()

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  big: { type: Boolean, default: false },
  enterDelay: { type: Number, default: 0 }
})

const warnText = useCountUp(computed(() => Number(props.data.warning || 0)))
const attnText = useCountUp(computed(() => Number(props.data.attention || 0)))
const infoText = useCountUp(computed(() => Number(props.data.infoHealth || 0)))

const rows = computed(() => props.data.list || [])
const hasAny = computed(() =>
  (Number(props.data.warning) + Number(props.data.attention) + Number(props.data.infoHealth)) > 0)

// 占比条（按非流程待办总数归一）
const segments = computed(() => {
  const total = Number(props.data.warning || 0) + Number(props.data.attention || 0) + Number(props.data.infoHealth || 0)
  const defs = [
    { key: 'is-red', val: Number(props.data.warning || 0), delay: 100 },
    { key: 'is-amber', val: Number(props.data.attention || 0), delay: 220 },
    { key: 'is-brand', val: Number(props.data.infoHealth || 0), delay: 340 }
  ]
  return defs.map(d => ({ ...d, pct: total ? d.val / total * 100 : 0 }))
})

const play = ref(false)
onMounted(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => { play.value = true }))
})

function goWarning() {
  proxy.$router.push('/apms/rtpWarning').catch(() => {})
}
function levelLabel(l) {
  return { WARNING: '建议停训', ATTENTION: '建议限制', INFO: '健康关注' }[l] || '预警'
}
function dotClass(l) {
  return l === 'WARNING' ? 'is-red' : l === 'ATTENTION' ? 'is-amber' : 'is-brand'
}
</script>

<style lang="scss" scoped>
.ha-body { display: flex; flex-direction: column; }
.ha-stats {
  flex: none;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.ha-stat {
  text-align: center;
  padding: 8px 4px 9px;
  background: var(--dbx-bg-soft);
  border-radius: 10px;
}
.ha-num { font-size: 22px; font-weight: 700; line-height: 1.15; }
.ha-num.is-risk { color: #dc2626; }
.ha-num.is-warn { color: #d97706; }
.ha-num.is-brand { color: #2563eb; }
.ha-label {
  margin-top: 2px; font-size: 11px; color: var(--dbx-sub);
  display: inline-flex; align-items: center; gap: 4px;
}

.ha-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #94a3b8;
  &.is-red { background: #dc2626; }
  &.is-amber { background: #d97706; }
  &.is-brand { background: #2563eb; }
}

/* 占比条 */
.ha-bar {
  display: flex;
  height: 8px;
  margin: 12px 2px 4px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--dbx-bg-soft);
  box-shadow: inset 0 0 0 1px var(--dbx-line);
}
.ha-seg {
  display: block; height: 100%;
  width: 0;
  transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  &.is-red { background: linear-gradient(90deg, #f87171, #dc2626); }
  &.is-amber { background: linear-gradient(90deg, #fbbf24, #d97706); }
  &.is-brand { background: linear-gradient(90deg, #60a5fa, #2563eb); }
}
.is-big .ha-seg.is-brand { background: linear-gradient(90deg, #22d3ee, #2563eb); }

.ha-list {
  flex: 1;
  margin: 8px -18px -14px;
  padding: 6px 18px 8px;
  border-top: 1px solid var(--dbx-line);
  display: flex; flex-direction: column; gap: 2px;
}
.ha-row {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 7px 8px;
  background: none; border: none; border-radius: 8px;
  cursor: pointer; text-align: left;
  &:hover { background: var(--dbx-bg-soft); }
}
.ha-pulse { position: relative; flex: none; display: inline-flex; }
.ha-pulse.is-red-pulse::before,
.ha-pulse.is-red-pulse::after {
  content: ''; position: absolute; inset: 0;
  border-radius: 50%; background: rgba(220, 38, 38, 0.5);
  animation: ha-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes ha-ping {
  0% { transform: scale(1); opacity: 0.55; }
  75%, 100% { transform: scale(2.6); opacity: 0; }
}
.ha-who {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  b { font-size: 12px; font-weight: 700; color: var(--dbx-text); }
  em {
    font-style: normal; font-size: 11px; color: var(--dbx-sub);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
}
.ha-score {
  flex: none; font-size: 15px; font-weight: 700;
  &.is-red { color: #dc2626; }
  &.is-amber { color: #d97706; }
  &.is-brand { color: #2563eb; }
}
.ha-empty {
  flex: 1; min-height: 120px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--dbx-sub);
}
.dbx-link {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12px; color: var(--dbx-brand);
  background: none; border: none; cursor: pointer;
  .el-icon { font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .ha-pulse.is-red-pulse::before,
  .ha-pulse.is-red-pulse::after { animation: none; }
}
</style>
