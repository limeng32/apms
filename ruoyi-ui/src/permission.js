import router from './router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import { isHttp, isPathMatch } from '@/utils/validate'
import { isRelogin } from '@/utils/request'
import useUserStore from '@/store/modules/user'
import useAppStore from '@/store/modules/app'
import useLockStore from '@/store/modules/lock'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'
import { isShowcaseHost } from '@/utils/entry'

NProgress.configure({ showSpinner: false })

const whiteList = ['/login', '/register', '/showcase']

const isWhiteList = (path) => {
  return whiteList.some(pattern => isPathMatch(pattern, path))
}

router.beforeEach(async (to, from) => {
  NProgress.start()
  // 品牌展示域（www.apms.top / 裸域 apms.top）：
  // 落地页占据根路径 /（地址栏保持裸域，不出现 /showcase）；
  // 其余任意路径（/login、/index、/apms/*、404 兜底）一律 replace 回 /，
  // 不做 token 判断、不加载用户路由，彻底不暴露登录入口与业务系统。
  if (isShowcaseHost()) {
    if (to.path === '/' || to.path === '/showcase') {
      return true
    }
    NProgress.done()
    return { path: '/', replace: true }
  }
  // 业务域（aoti/IP/localhost）：根路径 / 的 matcher 被展示页 alias 占用，
  // 这里改投 /index，行为与原根记录 redirect:'/index' 完全等价。
  if (to.path === '/' && to.meta && to.meta.showcaseRoot) {
    NProgress.done()
    return { path: '/index', replace: true }
  }
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title)
    const isLock = useLockStore().isLock
    if (to.path === '/login') {
      NProgress.done()
      return { path: '/' }
    }
    if (isWhiteList(to.path)) {
      return true
    }
    if (isLock && to.path !== '/lock') {
      NProgress.done()
      return { path: '/lock' }
    }
    if (!isLock && to.path === '/lock') {
      NProgress.done()
      return { path: '/' }
    }
    if (useUserStore().roles.length === 0) {
      isRelogin.show = true
      try {
        // 拉取user_info信息
        await useUserStore().getInfo()
        isRelogin.show = false
        // 根据roles权限生成可访问的路由
        const accessRoutes = await usePermissionStore().generateRoutes()
        accessRoutes.forEach(route => {
          if (!isHttp(route.path)) {
            router.addRoute(route)
          }
        })
        // 重新导航到目标路由，确保动态路由已注册
        return { ...to, replace: true }
      } catch (err) {
        await useUserStore().logOut()
        ElMessage.error(err)
        return { path: '/' }
      }
    }
    // Portal模式：隐藏侧栏，未注册路由一律回落地页；标准模式确保侧栏显示
    const userStore = useUserStore()
    if (userStore.portalMode)
    {
      useAppStore().toggleSideBarHide(true)
      const accessiblePaths = router.getRoutes().map(route => route.path)
      if (!accessiblePaths.includes(to.path) || to.path === '/' || to.path === '/index')
      {
        NProgress.done()
        return { path: userStore.homePath, replace: true }
      }
    }
    else
    {
      useAppStore().toggleSideBarHide(false)
    }
    return true
  } else {
    // 没有token
    if (isWhiteList(to.path)) {
      // 在免登录白名单，直接进入
      return true
    }
    NProgress.done()
    return `/login?redirect=${to.fullPath}` // 否则全部重定向到登录页
  }
})

router.afterEach(() => {
  NProgress.done()
})
