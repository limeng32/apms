<template>
  <div class="ro-wrap">
    <!-- inert：无写权限时内容整体不可交互（屏蔽点击/拖拽/聚焦/键盘输入），
         不仅是隐藏按钮；遮罩层同时拦截指针事件，双重锁定 -->
    <div class="ro-content" :inert="writable ? undefined : true">
      <slot />
    </div>
    <div v-if="!writable" class="ro-mask" title="当前角色对此模块仅有查看权限">
      <span class="ro-pill">
        <el-icon><Lock /></el-icon>{{ tip }}
      </span>
    </div>
  </div>
</template>

<script setup name="ReadOnlyBlock">
import { Lock } from '@element-plus/icons-vue'
import { checkPermi } from '@/utils/permission'

const props = defineProps({
  // 具备其中任意一个权限即视为可写（OR，与 v-hasPermi 一致）
  perms: { type: Array, default: () => [] },
  tip: { type: String, default: '只读模式 · 无操作权限' }
})

const writable = computed(() => checkPermi(props.perms))
</script>

<style lang="scss" scoped>
.ro-wrap {
  position: relative;
  // 建立独立层叠上下文：遮罩只覆盖本区块，不与页面其他浮层互相干扰
  isolation: isolate;
}

.ro-mask {
  position: absolute;
  inset: 0;
  // 高于页内常规浮层（roster-kit 内最高 z-index:20），低于抽屉/弹窗(2000+)
  z-index: 30;
  // 轻微磨砂：浅色雾化 + 一点模糊，明显可辨但不遮挡阅读
  background: rgba(241, 245, 249, 0.5);
  backdrop-filter: blur(1.5px) saturate(0.85);
  -webkit-backdrop-filter: blur(1.5px) saturate(0.85);
  border: 1px dashed rgba(100, 116, 139, 0.45);
  border-radius: 10px;
  // 拦截全部指针事件：点击/悬停/拖拽均不可穿透到下方内容
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ro-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #475569;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(100, 116, 139, 0.55);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.14);
  // 标签自身也不响应点击（事件由遮罩层统一吞掉）
  pointer-events: none;

  .el-icon {
    font-size: 14px;
  }
}

/* 深色主题下反色 */
html.dark .ro-mask {
  background: rgba(15, 23, 42, 0.45);
  border-color: rgba(100, 116, 139, 0.5);
}
html.dark .ro-pill {
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.94);
  border-color: rgba(100, 116, 139, 0.8);
}
</style>
