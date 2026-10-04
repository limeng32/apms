<template>
  <span v-if="meta" class="gender-badge" :class="meta.cls" :style="badgeStyle" :title="meta.label">
    {{ meta.symbol }}
  </span>
</template>

<script setup>
/**
 * 性别符号角标（统一用于一切运动员/队员展示处）
 * 男：蓝色 ♂；女：粉色 ♀。兼容 M/F、0/1、男/女。
 */
import { computed } from 'vue'

const props = defineProps({
  gender: { type: [String, Number], default: '' },
  size: { type: Number, default: 16 }
})

const MAP = {
  M: { cls: 'is-male', symbol: '♂', label: '男' },
  F: { cls: 'is-female', symbol: '♀', label: '女' }
}

const meta = computed(() => {
  const g = String(props.gender ?? '').trim().toUpperCase()
  if (g === 'M' || g === '0' || g === '男') return MAP.M
  if (g === 'F' || g === '1' || g === '女') return MAP.F
  return null
})

const badgeStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  fontSize: Math.round(props.size * 0.66) + 'px'
}))
</script>

<style lang="scss" scoped>
.gender-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  line-height: 1;
  flex: none;
  user-select: none;
}
.gender-badge.is-male { background: #3b82f6; }
.gender-badge.is-female { background: #ec4899; }
</style>
