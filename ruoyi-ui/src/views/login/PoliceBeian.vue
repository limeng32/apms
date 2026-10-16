<template>
  <!-- 公安联网备案标识：警徽 + 备案号；有链接时整行可点、新标签打开 -->
  <component
    :is="info.url ? 'a' : 'span'"
    class="police-beian"
    :href="info.url || undefined"
    :target="info.url ? '_blank' : undefined"
    :rel="info.url ? 'noopener noreferrer' : undefined"
  >
    <img :src="badge" class="police-beian-badge" alt="" draggable="false" />
    <span>{{ info.number }}</span>
  </component>
</template>

<script setup>
/**
 * 公安备案徽标（登录/锁屏/品牌展示页脚共用）
 * info: { show, number, url }，url 为空时退化为不可点击展示
 */
import badge from '@/assets/images/police-beian.png'

defineProps({
  info: { type: Object, required: true }
})
</script>

<style scoped lang="scss">
.police-beian {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  /* 字号/颜色完全继承所在页脚，与版权各行保持统一 */
  font-size: inherit;
  line-height: inherit;
  white-space: nowrap;
  color: inherit;
  text-decoration: none;
}
.police-beian-badge {
  width: 15px;
  height: 15px;
  flex: none;
  object-fit: contain;
}
</style>
