<template>
  <!-- 白名单渲染：仅文本分段 + 安全链接，禁止 v-html -->
  <span class="footer-rich">
    <template v-for="(seg, i) in segments" :key="i">
      <a
        v-if="seg.type === 'link'"
        :href="seg.url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ seg.label }}</a>
      <template v-else>{{ seg.value }}</template>
    </template>
  </span>
</template>

<script setup>
/**
 * 登录页版权富文本（品牌区/表单区共用）
 * 只渲染 parseRichText 的白名单分段，链接一律新标签打开并带 noopener。
 */
import { computed } from 'vue'
import { parseRichText } from './login.utils'

const props = defineProps({
  /** 原始模板，可含 {year} {title} {footerContent} 与 <a> 链接 */
  content: { type: String, default: '' },
  /** 占位符上下文 */
  ctx: { type: Object, default: () => ({}) }
})

const segments = computed(() => parseRichText(props.content, props.ctx))
</script>
