<template>
  <el-breadcrumb class="app-breadcrumb" separator="/">
    <transition-group name="breadcrumb">
      <el-breadcrumb-item :key="currentPath">
        <span class="no-redirect">{{ currentTitle }}</span>
      </el-breadcrumb-item>
    </transition-group>
  </el-breadcrumb>
</template>

<script setup>
const route = useRoute()
const currentTitle = ref('')
const currentPath = ref('')

// 仅展示当前菜单名（取路由链最后一个带 title 的节点），不可点击、不再渲染父级层级
function getBreadcrumb() {
  const matched = route.matched.filter(item => item.meta && item.meta.title)
  const current = matched.length ? matched[matched.length - 1] : null
  // 兼容显式标记 meta.breadcrumb=false 的路由：不展示面包屑文案
  currentTitle.value = current && current.meta.breadcrumb !== false ? current.meta.title : ''
  currentPath.value = route.path
}

watchEffect(() => {
  // 跳转 redirect 中转页时不更新面包屑
  if (route.path.startsWith('/redirect/')) {
    return
  }
  getBreadcrumb()
})
getBreadcrumb()
</script>

<style lang='scss' scoped>
.app-breadcrumb.el-breadcrumb {
  display: inline-block;
  font-size: 14px;
  line-height: 50px;

  .no-redirect {
    color: #97a8be;
    cursor: text;
  }
}
</style>
