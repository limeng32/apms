import defaultSettings from '@/settings'
import useSettingsStore from '@/store/modules/settings'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { getSiteTitle } from '@/utils/entry'

/**
 * 动态修改标题
 *
 * 站点标题（后缀/基础标题）唯一真相源是登录页设计器配置
 * loginThemeStore.siteTitle（brand.browserTitle，业务站/展示站各自独立）；
 * 未配置时回退构建标题 VITE_APP_TITLE，不内置域名中文默认。
 */
export function useDynamicTitle() {
  const settingsStore = useSettingsStore()
  const loginThemeStore = useLoginThemeStore()
  const siteTitle = (loginThemeStore.siteTitle || '').trim()
    || getSiteTitle()
    || defaultSettings.title
  if (settingsStore.dynamicTitle) {
    document.title = settingsStore.title + ' - ' + siteTitle
  } else {
    document.title = siteTitle
  }
}
