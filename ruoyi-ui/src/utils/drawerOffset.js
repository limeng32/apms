import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'

/**
 * 全屏右侧抽屉的顶栏偏移。
 *
 * 背景：el-drawer 默认 top:0、高 100vh，而 navbar(50px)/tagsView(34px) 是 fixed 浮层、
 * 不在文档流中，抽屉头部会被顶栏遮挡。Portal 专岗无 tagsView。
 *
 * 注意：必须用「内联 style」把 top/height 写到 el-drawer 面板——抽屉 teleport 到 body，
 * scoped :deep([data-v]) 选择器在面板祖先链上无匹配、规则不生效；
 * el-drawer 的 $attrs.style 会合并到 .el-drawer 面板自身，内联样式必定命中。
 *
 * 用法：
 *   const { drawerPanelStyle } = useDrawerOffset()
 *   <el-drawer :with-header="false" :style="drawerPanelStyle">
 *   另需在「非 scoped」样式块写 .el-drawer.<自定义class> .el-drawer__body { padding:0 }
 */
export function useDrawerOffset() {
  const userStore = useUserStore()
  const settingsStore = useSettingsStore()

  const headerOffset = computed(() =>
    (!userStore.portalMode && settingsStore.tagsView) ? 84 : 50)

  const drawerPanelStyle = computed(() => ({
    top: headerOffset.value + 'px',
    height: 'calc(100vh - ' + headerOffset.value + 'px)',
    maxWidth: '100vw'
  }))

  return { headerOffset, drawerPanelStyle }
}

/**
 * 响应式抽屉宽度：窄屏全宽，桌面固定宽度（默认 760px，与花名册运动员档案抽屉一致）。
 * 表格在 .rk-table-scroll 内横向滚动，不会撑破抽屉。
 */
export function useDrawerSize(desktopSize = '760px', mobileBreakpoint = 800) {
  const viewportWidth = ref(window.innerWidth)
  function onResize() { viewportWidth.value = window.innerWidth }
  onMounted(() => window.addEventListener('resize', onResize))
  onBeforeUnmount(() => window.removeEventListener('resize', onResize))

  const drawerSize = computed(() => (viewportWidth.value <= mobileBreakpoint ? '100%' : desktopSize))
  return { drawerSize, viewportWidth }
}
