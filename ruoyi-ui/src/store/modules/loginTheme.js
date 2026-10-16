import { getPublicLoginConfig } from '@/api/loginConfig'
import { cloneDefaults, mergeWithDefaults } from '@/views/login/login.utils'
import { isShowcaseHost } from '@/utils/entry'

/**
 * 登录页主题配置 Store
 *
 * - state.config 初始即完整默认值，LoginRenderer 首帧可用默认值渲染；
 * - loadConfig() 仅防同一次挂载内的并发重复请求（瞬时 loading），
 *   不做 SPA 生命周期永久 loaded 标记——login.vue 每次挂载请求一次，
 *   保证管理员在设计器保存后退出重进登录页能立即拿到新配置；
 * - 双入口：自动按当前 hostname 选择 portal（业务站）/ showcase（展示站）配置，
 *   也可显式传入 entry 强制指定（如本机预览）；
 * - 任何异常静默，保持当前 config 不变。
 */
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
    actions: {
      /**
       * @param {string} [entry] 不传则按 hostname 自动判定；'portal' 业务站 / 'showcase' 展示站
       */
      async loadConfig(entry) {
        if (this.loading) return
        const target = entry || (isShowcaseHost() ? 'showcase' : 'portal')
        this.loading = true
        try {
          const res = await getPublicLoginConfig(target)
          this.config = mergeWithDefaults(res.config)
          this.entry = target
          this.smsEnabled = res.smsEnabled === true
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
