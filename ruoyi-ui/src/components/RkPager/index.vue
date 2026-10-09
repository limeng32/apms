<template>
  <div class="rk-pager2" :class="{ 'is-mini': mini }">
    <span v-if="!mini" class="rk-pager2-info">
      共 <b>{{ total }}</b> {{ unit }} · 每页 <span>{{ pageSize }}</span> 条
    </span>
    <div class="rk-pager2-btns">
      <button type="button" class="rk-pg2" :disabled="page <= 1" @click="go(page - 1)" aria-label="上一页">
        <el-icon><ArrowLeft/></el-icon>
      </button>

      <!-- mini（列内窄空间）：只显示 当前/总页 -->
      <template v-if="mini">
        <span class="rk-pg2 rk-pg2-state rk-mono">{{ page }} / {{ totalPages }}</span>
      </template>

      <!-- 常规：页码窗口（首页 … 当前±1 … 末页） -->
      <template v-else>
        <button
          v-for="(p, i) in pageNumbers"
          :key="i"
          type="button"
          class="rk-pg2 rk-mono"
          :class="{ 'is-active': p === page, 'is-ellipsis': p === ELLIPSIS }"
          :disabled="p === ELLIPSIS"
          @click="typeof p === 'number' && go(p)"
        >{{ p === ELLIPSIS ? '…' : p }}</button>
      </template>

      <button type="button" class="rk-pg2" :disabled="page >= totalPages" @click="go(page + 1)" aria-label="下一页">
        <el-icon><ArrowRight/></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup name="RkPager">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const ELLIPSIS = '…'

const props = defineProps({
  // 当前页（1 起）
  page: { type: Number, default: 1 },
  // 总条数
  total: { type: Number, default: 0 },
  // 固定每页条数
  pageSize: { type: Number, default: 10 },
  // 总数单位文案
  unit: { type: String, default: '条' },
  // 窄空间形态（看板列内）：隐藏总数与页码窗口，仅 ‹ 当前/总页 ›
  mini: { type: Boolean, default: false }
})
const emit = defineEmits(['update:page', 'change'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

// 页码窗口：首页 … 当前±1 … 末页
const pageNumbers = computed(() => {
  const cur = props.page
  const tp = totalPages.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const nums = [1]
  const start = Math.max(2, cur - 1)
  const end = Math.min(tp - 1, cur + 1)
  if (start > 2) nums.push(ELLIPSIS)
  for (let p = start; p <= end; p++) nums.push(p)
  if (end < tp - 1) nums.push(ELLIPSIS)
  nums.push(tp)
  return nums
})

function go(p) {
  const target = Math.min(Math.max(1, p), totalPages.value)
  if (target === props.page) return
  emit('update:page', target)
  emit('change', target)
}
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.rk-pager2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid $rk-line;
}
.rk-pager2.is-mini {
  justify-content: center;
  padding: 10px 8px;
  border-top: 0;
}
.rk-pager2-info {
  font-size: 12px;
  color: $rk-text-3;
  white-space: nowrap;
  b, span { color: $rk-text-2; font-weight: 600; }
}
.rk-pager2-btns {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 胶囊分页钮（图二风格：大圆角、浅描边、选中蓝实底） */
.rk-pg2 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  height: 46px;
  padding: 0 14px;
  font-size: 16px;
  font-weight: 500;
  color: $rk-text-2;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s, transform .1s;
  &:hover:not(:disabled):not(.is-active) {
    border-color: $rk-brand-600;
    color: $rk-brand-600;
  }
  &:active:not(:disabled):not(.is-active) { transform: scale(.96); }
  &:disabled { opacity: .45; cursor: not-allowed; }
  &.is-active {
    color: #fff;
    font-weight: 700;
    background: $rk-brand-600;
    border-color: $rk-brand-600;
  }
  .el-icon { font-size: 18px; }
}
.rk-pg2.is-ellipsis {
  min-width: 36px;
  padding: 0 6px;
  border-color: transparent;
  background: transparent;
  cursor: default;
  &:hover { border-color: transparent; color: $rk-text-2; }
}
.rk-pg2-state {
  min-width: 46px;
  letter-spacing: .5px;
}

/* 列内 mini：缩小到适配看板列宽 */
.is-mini .rk-pager2-btns { gap: 8px; }
.is-mini .rk-pg2 {
  min-width: 34px;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  border-radius: 11px;
  .el-icon { font-size: 14px; }
}
</style>
