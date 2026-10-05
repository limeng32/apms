<template>
  <div class="bm-wrap" :class="{ 'is-selectable': selectable }">
    <div class="bm-stage">
      <img :src="bodyMapUrl" class="bm-svg" alt="人体伤病部位分布图"/>

      <!-- ===== 展示模式：按例数聚合的热点（红=有活跃 / 绿=全康复） ===== -->
      <template v-if="!selectable">
        <button v-for="h in locatedHotspots" :key="h.site"
                class="bm-hotspot"
                :class="{ 'is-active': h.active > 0 }"
                :style="hotspotStyle(h)"
                :title="`${siteLabel(h.site)} · ${h.total} 例${h.active ? ' · ' + h.active + ' 活跃' : ''}`"
                @click="$emit('select', h.site)">
          <span v-if="h.active > 0" class="bm-hotspot-ping"></span>
        </button>
      </template>

      <!-- ===== 点选模式：19 个具体点位可点击 ===== -->
      <template v-else>
        <button v-for="s in locatedSites" :key="s.code"
                class="bm-pickpoint"
                :class="{ 'is-selected': modelValue === s.code }"
                :style="pointStyle(s)"
                :title="s.label"
                @click="togglePick(s.code)"></button>
      </template>
    </div>

    <!-- ===== 「其它」：无具体坐标，两种模式都在图下方提供入口 ===== -->
    <div class="bm-other-row">
      <template v-if="!selectable">
        <button v-if="otherHotspot"
                class="bm-other-chip"
                :class="{ 'is-active': otherHotspot.active > 0 }"
                :title="`${siteLabel(otherHotspot.site)} · ${otherHotspot.total} 例${otherHotspot.active ? ' · ' + otherHotspot.active + ' 活跃' : ''}`"
                @click="$emit('select', otherHotspot.site)">
          其它 · {{ otherHotspot.total }} 例
          <i v-if="otherHotspot.active > 0" class="bm-other-dot"></i>
        </button>
      </template>
      <template v-else>
        <button class="bm-other-chip bm-other-pick"
                :class="{ 'is-selected': modelValue === 'OTHER' }"
                @click="togglePick('OTHER')">
          其它
        </button>
      </template>
    </div>
  </div>
</template>

<script setup name="BodyMap">
import bodyMapUrl from '@/assets/images/body-map.svg'
import { computed } from 'vue'
import { BODY_SITES, siteLabel } from '../bodySites'

/**
 * 双模式人体部位图（viewBox 400×800，坐标常量见 bodySites.js）
 * - 展示模式：hotspots=[{site,total,active}]，点大小=例数，红=有活跃/绿=全康复，点击向上抛 select；
 *            OTHER 无坐标，渲染在图下方胶囊入口
 * - 点选模式：selectable + v-model:modelValue，19 点位图上点选 + 图下方「其它」，再点一次取消
 */
const props = defineProps({
  hotspots: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'select'])

const locatedSites = BODY_SITES.filter(s => s.x != null)
const locatedHotspots = computed(() =>
  props.hotspots.filter(h => {
    const s = BODY_SITES.find(x => x.code === h.site)
    return s && s.x != null
  }))
const otherHotspot = computed(() => props.hotspots.find(h => h.site === 'OTHER'))

const pctX = (x) => (x / 400) * 100 + '%'
const pctY = (y) => (y / 588) * 100 + '%'

function hotspotStyle(h) {
  const s = BODY_SITES.find(x => x.code === h.site)
  if (!s) return { display: 'none' }
  const size = 14 + Math.min(h.total, 5) * 6
  return { left: pctX(s.x), top: pctY(s.y), width: size + 'px', height: size + 'px' }
}
function pointStyle(s) {
  return { left: pctX(s.x), top: pctY(s.y) }
}
function togglePick(code) {
  emit('update:modelValue', props.modelValue === code ? '' : code)
}
</script>

<style lang="scss" scoped>
.bm-stage {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
}
.bm-svg { display: block; width: 100%; height: auto; }

/* 展示热点 */
.bm-hotspot {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.22);
  background: rgba(22, 163, 74, 0.82);
  transition: transform .12s ease;
  &:hover { transform: translate(-50%, -50%) scale(1.12); z-index: 2; }
  &.is-active { background: rgba(220, 38, 38, 0.88); }
}
.bm-hotspot-ping {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.35);
  animation: bm-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes bm-ping {
  0% { transform: scale(1); opacity: 0.7; }
  80%, 100% { transform: scale(1.9); opacity: 0; }
}

/* 点选点位 */
.bm-pickpoint {
  position: absolute;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(71, 85, 105, 0.55);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  padding: 0;
  cursor: pointer;
  transition: transform .1s ease, background .1s ease, border-color .1s ease;
  &:hover {
    transform: translate(-50%, -50%) scale(1.25);
    border-color: #2563EB;
    background: rgba(37, 99, 235, 0.25);
  }
  &.is-selected {
    background: #2563EB;
    border-color: #1d4ed8;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.22);
  }
}

/* 图下方「其它」入口 */
.bm-other-row {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.bm-other-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1.5px solid rgba(22, 163, 74, 0.55);
  background: rgba(22, 163, 74, 0.1);
  color: #15803d;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all .12s ease;
  &:hover { transform: translateY(-1px); }
  &.is-active {
    border-color: rgba(220, 38, 38, 0.7);
    background: rgba(220, 38, 38, 0.1);
    color: #b91c1c;
  }
}
.bm-other-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #dc2626;
}
.bm-other-pick {
  border-color: rgba(71, 85, 105, 0.45);
  background: rgba(255, 255, 255, 0.8);
  color: #475569;
  &:hover {
    border-color: #2563EB;
    background: rgba(37, 99, 235, 0.1);
    color: #1d4ed8;
  }
  &.is-selected {
    border-color: #1d4ed8;
    background: #2563EB;
    color: #fff;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.22);
  }
}
</style>
