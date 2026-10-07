<template>
  <div class="navbar" :class="'nav' + settingsStore.navType">
    <hamburger v-if="!userStore.portalMode" id="hamburger-container" :is-active="appStore.sidebar.opened" class="hamburger-container" @toggleClick="toggleSideBar" />
    <breadcrumb v-if="settingsStore.navType == 1 && !userStore.portalMode" id="breadcrumb-container" class="breadcrumb-container" />
    <top-nav v-if="settingsStore.navType == 2 && !userStore.portalMode" id="topmenu-container" class="topmenu-container" />
    <template v-if="settingsStore.navType == 3 && !userStore.portalMode">
      <logo v-show="settingsStore.sidebarLogo" :collapse="false"></logo>
      <top-bar id="topbar-container" class="topbar-container" />
    </template>

    <!-- Portal模式：品牌Logo + 品牌名 -->
    <div v-if="userStore.portalMode" class="portal-brand">
      <img v-if="portalLogoImg" :src="portalLogoImg" class="portal-logo" alt="brand logo" />
      <svg v-else-if="portalBuiltin === 'shield'" viewBox="0 0 40 46" fill="none" class="portal-logo">
        <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
          fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
        <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
        <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
        <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
      </svg>
      <el-icon v-else class="portal-logo portal-logo-ep">
        <component :is="portalBuiltin" />
      </el-icon>
      <span class="portal-brand-name">{{ brandName }}</span>
    </div>

    <div class="right-menu">
      <template v-if="appStore.device !== 'mobile' && !userStore.portalMode">
        <screenfull id="screenfull" class="right-menu-item hover-effect" />

        <el-tooltip content="消息通知" effect="dark" placement="bottom">
          <header-notice id="header-notice" class="right-menu-item hover-effect" />
        </el-tooltip>
      </template>

      <el-dropdown @command="handleCommand" class="avatar-container" trigger="hover">
        <div class="avatar-wrapper">
          <span class="user-initial">{{ avatarInitial }}</span>
          <span class="user-nickname">{{ userStore.nickName }}</span>
          <el-icon class="user-caret"><ArrowDown /></el-icon>
          <span v-if="isDemoMode()" class="demo-tag">演示</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <router-link to="/user/profile">
              <el-dropdown-item>个人中心</el-dropdown-item>
            </router-link>
            <el-dropdown-item command="setLayout" v-if="isAdmin && settingsStore.showSettings && !userStore.portalMode">
                <span>布局设置</span>
            </el-dropdown-item>
            <el-dropdown-item command="lockScreen" v-if="!userStore.portalMode">
                <span>锁定屏幕</span>
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <span>退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import Breadcrumb from '@/components/Breadcrumb'
import TopNav from './TopNav'
import TopBar from './TopBar'
import Logo from './Sidebar/Logo'
import Hamburger from '@/components/Hamburger'
import Screenfull from '@/components/Screenfull'
import useAppStore from '@/store/modules/app'
import useUserStore from '@/store/modules/user'
import useLockStore from '@/store/modules/lock'
import useSettingsStore from '@/store/modules/settings'
import useLoginThemeStore from '@/store/modules/loginTheme'
import HeaderNotice from './HeaderNotice'
import { mediaUrl, BUILTIN_LOGO_VALUES } from '@/views/login/login.utils'
import { isDemoMode } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const lockStore = useLockStore()
const settingsStore = useSettingsStore()
// 仅平台超级管理员（admin）可见布局设置；布局本身对所有用户已统一固定
const isAdmin = computed(() => userStore.roles.includes('admin'))
const loginThemeStore = useLoginThemeStore()
const brandName = computed(() => loginThemeStore.config.brand.name || import.meta.env.VITE_APP_TITLE)
// 仿 demo：用昵称首字代替头像图片（中文名取首字，英文名取首字母）
const avatarInitial = computed(() => {
  const name = (userStore.nickName || '').trim()
  return name ? name.charAt(0).toUpperCase() : 'U'
})
// Portal 品牌Logo：与侧栏Logo同源（首页设计器配置），支持图片/内置盾牌/图标
const portalLogo = computed(() => loginThemeStore.config.brand.logo || {})
const portalLogoImg = computed(() =>
  portalLogo.value.type === 'image' && portalLogo.value.value ? mediaUrl(portalLogo.value.value) : '')
const portalBuiltin = computed(() =>
  BUILTIN_LOGO_VALUES.includes(portalLogo.value.value) ? portalLogo.value.value : 'shield')

function toggleSideBar() {
  appStore.toggleSideBar()
}

function handleCommand(command) {
  switch (command) {
    case "setLayout":
      setLayout()
      break
    case "lockScreen":
      lockScreen()
      break
    case "logout":
      logout()
      break
    default:
      break
  }
}

function logout() {
  ElMessageBox.confirm('确定注销并退出系统吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    userStore.logOut().then(() => {
      location.href = '/index'
    })
  }).catch(() => { })
}

const emits = defineEmits(['setLayout'])
function setLayout() {
  emits('setLayout')
}

function lockScreen() {
  const currentPath = route.fullPath
  lockStore.lockScreen(currentPath)
  router.push('/lock')
}
</script>

<style lang='scss' scoped>
.navbar.nav3 {
  .hamburger-container {
    display: none !important;
  }
}

.portal-brand {
  display: flex;
  align-items: center;
  margin-left: 12px;
  min-width: 0;

  .portal-logo {
    height: 28px;
    width: auto;
    flex: none;
    margin-right: 8px;
  }

  .portal-logo-ep {
    height: auto;
    font-size: 26px;
  }

  .portal-brand-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.navbar {
  height: 50px;
  overflow: hidden;
  position: relative;
  background: var(--navbar-bg);
  // demo 风格毛玻璃：半透明表面 + 背景模糊，滚动内容从顶部栏下方透出
  backdrop-filter: var(--header-backdrop);
  -webkit-backdrop-filter: var(--header-backdrop);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  // padding: 0 8px;
  box-sizing: border-box;

  .hamburger-container {
    line-height: 46px;
    height: 100%;
    cursor: pointer;
    transition: background 0.3s;
    -webkit-tap-highlight-color: transparent;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: 8px;

    &:hover {
      background: rgba(0, 0, 0, 0.025);
    }
  }

  .breadcrumb-container {
    flex-shrink: 0;
  }

  .topmenu-container {
    position: absolute;
    left: 50px;
  }

  .topbar-container {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    overflow: hidden;
    margin-left: 8px;
  }

  .right-menu {
    height: 100%;
    line-height: 50px;
    display: flex;
    align-items: center;
    margin-left: auto;

    &:focus {
      outline: none;
    }

    .right-menu-item {
      display: inline-block;
      padding: 0 8px;
      height: 100%;
      font-size: 18px;
      color: #5a5e66;
      vertical-align: text-bottom;

      &.hover-effect {
        cursor: pointer;
        transition: background 0.3s;

        &:hover {
          background: rgba(0, 0, 0, 0.025);
        }
      }
    }

    // demo 风格：品牌色圆底「名称首字」+ 昵称 + 下拉箭头，整体胶囊描边
    .avatar-container {
      margin-right: 12px;
      line-height: normal;

      .avatar-wrapper {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 36px;
        padding: 0 12px 0 4px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--current-color) 35%, transparent);
        background: color-mix(in srgb, var(--current-color) 8%, transparent);
        cursor: pointer;
        white-space: nowrap;
        transition: background-color 0.2s;

        &:hover {
          background: color-mix(in srgb, var(--current-color) 16%, transparent);
        }

        .user-initial {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          flex: none;
          border-radius: 50%;
          background: var(--current-color);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
        }

        .user-nickname {
          font-size: 13px;
          font-weight: 500;
          color: var(--navbar-text);
        }

        .user-caret {
          font-size: 12px;
          color: var(--navbar-text);
          opacity: .55;
        }

        .demo-tag {
          padding: 1px 7px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.6;
          color: #b45309;
          background: #fde68a;
          border: 1px solid #f59e0b;
        }
      }
    }
  }
}
</style>
