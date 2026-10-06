<template>
  <div :class="['sidebar-theme-wrapper', {'has-logo':showLogo}, sideTheme]" class="sidebar-container">
    <logo v-if="showLogo" :collapse="isCollapse" />
    <el-scrollbar wrap-class="scrollbar-wrapper">
      <el-menu
        ref="menuRef"
        :default-active="activeMenu"
        :collapse="isCollapse"
        :background-color="menuBgForProp"
        :text-color="getMenuTextColor"
        :unique-opened="false"
        :active-text-color="theme"
        :collapse-transition="false"
        mode="vertical"
        :class="sideTheme"
      >
        <sidebar-item
          v-for="(route, index) in sidebarRouters"
          :key="route.path + index"
          :item="route"
          :base-path="route.path"
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<script setup>
import Logo from './Logo'
import SidebarItem from './SidebarItem'
import variables from '@/assets/styles/variables.module.scss'
import useAppStore from '@/store/modules/app'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'

const route = useRoute()
const appStore = useAppStore()
const settingsStore = useSettingsStore()
const permissionStore = usePermissionStore()

const sidebarRouters = computed(() => permissionStore.sidebarRouters)
const showLogo = computed(() => settingsStore.sidebarLogo)
const sideTheme = computed(() => settingsStore.sideTheme)
const theme = computed(() => settingsStore.theme)
const isCollapse = computed(() => !appStore.sidebar.opened)

// 获取菜单背景色（容器/滚动条底色：渐变加载前的兜底色，避免白闪）
const getMenuBackground = computed(() => {
  if (settingsStore.isDark) {
    return 'var(--sidebar-bg)'
  }
  return sideTheme.value === 'theme-dark' ? variables.menuBg : variables.menuLightBg
})

// el-menu 背景色 prop：深色侧栏传 transparent，使菜单/菜单项透明、露出容器上的品牌渐变
const menuBgForProp = computed(() => {
  if (settingsStore.isDark) {
    return 'var(--sidebar-bg)'
  }
  return sideTheme.value === 'theme-dark' ? 'transparent' : variables.menuLightBg
})

// 获取菜单文字颜色
const getMenuTextColor = computed(() => {
  if (settingsStore.isDark) {
    return 'var(--sidebar-text)'
  }
  return sideTheme.value === 'theme-dark' ? variables.menuText : variables.menuLightText
})

const activeMenu = computed(() => {
  const { meta, path } = route
  if (meta.activeMenu) {
    return meta.activeMenu
  }
  return path
})

// ===== demo 风格：所有菜单分组默认全部展开；非手风琴，可同时展开多个 =====
const menuRef = ref(null)

function openAllSubMenus() {
  if (isCollapse.value) return
  // 等 SidebarItem 全部 mount 后再展开。
  // 关键：不能依赖 DOM 节点上的 __vueParentComponent 读取 sub-menu index——
  // 该内部属性只存在于 Vue 开发构建，生产构建（vite build）中被完全移除，
  // 会导致线上分组全部收起且无法自动展开。
  // 改为脚本派发 click：HTMLElement.click() 不受 CSS pointer-events:none 影响，
  // dev/生产行为完全一致；嵌套子菜单用 v-show 渲染，首轮即可全部命中。
  // 只点未展开的（:not(.is-opened)），避免重复点击把分组 toggle 回收起。
  nextTick(() => {
    let tries = 0
    const clicked = new WeakSet()
    const tick = () => {
      if (isCollapse.value || !menuRef.value?.$el) return
      menuRef.value.$el
        .querySelectorAll('.el-sub-menu:not(.is-opened) > .el-sub-menu__title')
        .forEach(title => {
          // WeakSet 防重复：class 更新有一帧延迟，避免对同一标题二次 click 被 toggle 回收起
          if (!clicked.has(title)) {
            clicked.add(title)
            title.click()
          }
        })
      // 多帧重试，覆盖动态路由/异步组件的菜单延迟渲染
      if (++tries < 6) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// 路由/权限异步加载后菜单才渲染，此时统一展开；挂载时再兜底一次
watch(() => permissionStore.sidebarRouters, openAllSubMenus, { deep: false })
onMounted(openAllSubMenus)
// 侧栏从图标轨恢复展开时重新打开全部分组
watch(isCollapse, (collapsed) => { if (!collapsed) openAllSubMenus() })
</script>

<style lang="scss" scoped>
.sidebar-container {
  background-color: v-bind(getMenuBackground);
  
  .scrollbar-wrapper {
    background-color: v-bind(getMenuBackground);
  }

  .el-menu {
    border: none;
    height: 100%;
    width: 100% !important;
    
    .el-menu-item, .el-sub-menu__title {
      &:hover {
        background-color: var(--menu-hover, rgba(0, 0, 0, 0.06)) !important;
      }
    }

    .el-menu-item {
      color: v-bind(getMenuTextColor);
      
      &.is-active {
        color: var(--menu-active-text, #2c8a57);
        background-color: var(--menu-hover, rgba(0, 0, 0, 0.06)) !important;
      }
    }

    .el-sub-menu__title {
      color: v-bind(getMenuTextColor);
    }
  }
}
</style>
