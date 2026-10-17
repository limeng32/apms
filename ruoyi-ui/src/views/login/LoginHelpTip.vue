<template>
  <el-tooltip :content="content" placement="top" effect="dark" :show-after="150">
    <i class="ld-help-icon" aria-hidden="true">?</i>
  </el-tooltip>
</template>

<script setup>
/**
 * 表单字段旁的问号帮助标记：纯 CSS 问号（无额外图标依赖），
 * hover/focus 弹出一句话解释，用于降低设计器专业字段（偏移/分栏/遮罩等）的理解成本。
 */
defineProps({
  content: { type: String, required: true }
})
</script>

<style scoped>
.ld-help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-left: 5px;
  border-radius: 50%;
  background: #94a3b8;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-style: normal;
  line-height: 1;
  vertical-align: middle;
  cursor: help;
  user-select: none;
}
.ld-help-icon:hover {
  background: #2563eb;
}
</style>
