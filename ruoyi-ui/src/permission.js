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
  // 这里改投 /index；/index 在下方按角色统一重定向到真实菜单落点。
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
    const userStore = useUserStore()
    // 统一首页落点：/ 与旧 /index 均重定向到角色对应的真实菜单路由，
    // 侧边栏不再保留与业务菜单重复的静态「数据驾驶舱」入口。
    // 标准角色（super/admin/business_admin）统一进入「总览 > 数据驾驶舱」；
    // 门户专岗进入各自 homePath。
    if (to.path === '/' || to.path === '/index')
    {
      const landing = userStore.portalMode
        ? (userStore.homePath || '/apms/dashboard')
        : '/overview/cockpit'
      NProgress.done()
      return { path: landing, replace: true }
    }
    // 门户专岗与标准角色统一显示侧边栏（门户仅写权限按角色隔离，菜单仍为分组树）；
    // 门户角色访问未注册路由时回各自落地页。
    // 注意：不能用 router.getRoutes() 的 path 与 to.path 做字符串比对——
    // 带参数的静态路由（如 /apms/athlete/detail/:athleteId(\\d+)）在表中是模式串，
    // 与真实路径永不相等，会把教练查看运动员详情这类合法访问误踢回落地页。
    // to.matched 是 vue-router 按参数模式解析后的命中结果，据此判断即可。
    useAppStore().toggleSideBarHide(false)
    if (userStore.portalMode)
    {
      const hasRealMatch = to.matched.length > 0
        && to.matched.some(record => !record.path.includes(':pathMatch'))
      if (!hasRealMatch)
      {
        NProgress.done()
        return { path: userStore.homePath, replace: true }
      }
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
