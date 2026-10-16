<template>
  <!-- 白名单渲染：仅文本分段 + 安全链接 + 公安备案占位符，禁止 v-html -->
  <span class="footer-rich">
    <template v-for="(seg, i) in segments" :key="i">
      <a
        v-if="seg.type === 'link'"
        :href="seg.url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ seg.label }}</a>
      <span
        v-else-if="seg.type === 'police'"
        class="footer-police-slot"
      ><PoliceBeian v-if="police.show" :info="police" /></span>
      <template v-else>{{ seg.value }}</template>
    </template>
  </span>
</template>

<script setup>
/**
 * 登录页版权富文本（品牌区/表单区共用）
 * 只渲染 parseRichText 的白名单分段，链接一律新标签打开并带 noopener。
 *
 * 支持 {police} 占位符：在文本中内联渲染公安备案（警徽+编号，取自下方「公安备案」配置）。
 * 文本框中的换行（\n）同样生效（white-space: pre-line），便于控制备案信息排在哪一行。
 */
import { computed } from 'vue'
import { parseRichText } from './login.utils'
import PoliceBeian from './PoliceBeian.vue'

const props = defineProps({
  /** 原始模板，可含 {year} {title} {footerContent} {police} 与 <a> 链接；换行生效 */
  content: { type: String, default: '' },
  /** 占位符上下文 */
  ctx: { type: Object, default: () => ({}) },
  /** 公安备案信息 { show, number, url }；{police} 占位符仅在 show=true 时渲染 */
  police: { type: Object, default: () => ({ show: false, number: '', url: '' }) }
})

const segments = computed(() => parseRichText(props.content, props.ctx))
</script>

<style scoped lang="scss">
/* 文本框内换行原样生效（仍禁止 HTML，无 XSS 面）；历史配置不含换行，视觉无变化 */
.footer-rich {
  white-space: pre-line;
}
/* 备案链接视觉上与周围版权文字完全统一：继承字号/颜色、无下划线，
   hover 也不变色（仍可点击新开页），避免页脚内出现突兀的链接色 */
.footer-rich a {
  color: inherit;
  font-size: inherit;
  text-decoration: none;
}
.footer-rich a:hover {
  color: inherit;
  text-decoration: none;
}
/* 公安备案内联在文本流中：清除组件自带的独立成行 margin，与前文留 8px 间距，
   警徽与备案号由 PoliceBeian 自身 nowrap 保证成组不拆 */
.footer-police-slot {
  white-space: nowrap;
  :deep(.police-beian) {
    margin-top: 0;
    margin-left: 8px;
    vertical-align: -2px;
  }
}
</style>
