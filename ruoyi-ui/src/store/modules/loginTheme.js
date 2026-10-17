import { getPublicLoginConfig } from '@/api/loginConfig'
import { cloneDefaults, mergeWithDefaults, resolveBrowserTitle } from '@/views/login/login.utils'
import { isShowcaseHost } from '@/utils/entry'

/**
 * 登录页主题配置 Store
 *
 * - state.config 初始即完整默认值，LoginRenderer 首帧可用默认值渲染；
 * - 同入口并发的 loadConfig 复用同一个 in-flight Promise（App.vue 启动预加载
 *   与登录页/展示页挂载加载可能同时发生），不做 SPA 生命周期永久 loaded 标记——
 *   每次重新挂载仍会重新请求，保证管理员在设计器保存后退出重进能立即拿到新配置；
 * - 双入口：自动按当前 hostname 选择 portal（业务站）/ showcase（展示站）配置，
 *   也可显式传入 entry 强制指定（如本机预览）；
 * - 浏览器标题整站生效：getter siteTitle 为「当前入口设计器配置标题，留空回退
 *   构建标题 VITE_APP_TITLE」，加载/保存成功后写入 localStorage 供 index.html 下次首屏同步读取；
 * - 任何异常静默，保持当前 config 不变。
 */

/** 同入口并发请求合并（模块级、非响应式）；请求结束即清除，不影响后续重新拉取 */
let inflight = null

const TITLE_STORAGE_PREFIX = 'apms_login_title_'

const useLoginThemeStore = defineStore(
  'loginTheme',
  {
    state: () => ({
      config: cloneDefaults(),
      /** 当前已加载配置对应的入口：'portal' | 'showcase' */
      entry: 'portal',
      /** 手机短信登录开关（后端 sys_config；无后端的演示站恒为 false，自动隐藏 tab） */
      smsEnabled: false,
      loading: false
    }),
    getters: {
      /**
       * 当前入口生效中的浏览器标签页标题：
       * brand.browserTitle 优先，留空回退构建标题 VITE_APP_TITLE（entry.js#getSiteTitle）。
       * 登录页/展示页/后台路由标题（dynamicTitle）统一以此为唯一真相源。
       */
      siteTitle: (state) => resolveBrowserTitle(state.config)
    },
    actions: {
      /**
       * 把当前入口标题写入 localStorage（供下次整页加载时 index.html 引导脚本
       * 在 bundle 到达前同步设置，防首屏闪烁）。不直接改 document.title——
       * 标题显隐/菜单前缀由调用方经 utils/dynamicTitle 统一处理。
       * @param {string} [entry]
       */
      cacheHeadTitle(entry = this.entry) {
        try {
          localStorage.setItem(
            TITLE_STORAGE_PREFIX + (entry === 'showcase' ? 'showcase' : 'portal'),
            String(this.siteTitle).slice(0, 100)
          )
        } catch (e) { /* 隐私模式等场景静默 */ }
      },

      /**
       * @param {string} [entry] 不传则按 hostname 自动判定；'portal' 业务站 / 'showcase' 展示站
       */
      loadConfig(entry) {
        const target = entry || (isShowcaseHost() ? 'showcase' : 'portal')
        // 同入口并发（App 启动预加载 + 页面挂载加载）复用同一 Promise，
        // 保证所有调用方 .then 时配置都已就绪，不会被 this.loading 提前吞掉
        if (inflight && inflight.target === target) return inflight.promise
        const promise = this.fetchConfig(target)
        inflight = { target, promise }
        promise.finally(() => { if (inflight && inflight.promise === promise) inflight = null })
        return promise
      },

      async fetchConfig(target) {
        this.loading = true
        try {
          const res = await getPublicLoginConfig(target)
          this.config = mergeWithDefaults(res.config)
          this.entry = target
          this.smsEnabled = res.smsEnabled === true
          // 标题随配置缓存：下次整页加载 index.html 零闪烁；本次 document.title
          // 由 App.vue 的 config watcher / 登录页 applyHead 立即应用
          this.cacheHeadTitle(target)
        } catch (e) {
          // 静默：首帧已是默认配置，不弹错误、不抛出；smsEnabled 保持 false
        } finally {
          this.loading = false
        }
      }
    }
  }
)

export default useLoginThemeStore
