import { getPublicLoginConfig } from '@/api/loginConfig'
import { cloneDefaults, mergeWithDefaults } from '@/views/login/login.utils'

/**
 * 登录页主题配置 Store
 *
 * - state.config 初始即完整默认值，LoginRenderer 首帧可用默认值渲染；
 * - loadConfig() 仅防同一次挂载内的并发重复请求（瞬时 loading），
 *   不做 SPA 生命周期永久 loaded 标记——login.vue 每次挂载请求一次，
 *   保证管理员在设计器保存后退出重进登录页能立即拿到新配置；
 * - 任何异常静默，保持当前 config 不变。
 */
const useLoginThemeStore = defineStore(
  'loginTheme',
  {
    state: () => ({
      config: cloneDefaults(),
      loading: false
    }),
    actions: {
      async loadConfig() {
        if (this.loading) return
        this.loading = true
        try {
          const data = await getPublicLoginConfig()
          this.config = mergeWithDefaults(data)
        } catch (e) {
          // 静默：首帧已是默认配置，不弹错误、不抛出
        } finally {
          this.loading = false
        }
      }
    }
  }
)

export default useLoginThemeStore
