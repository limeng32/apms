import Cookies from 'js-cookie'
import { cookieName } from '@/utils/ruoyi'

const useAppStore = defineStore(
  'app',
  {
    state: () => ({
      sidebar: {
        opened: Cookies.get(cookieName('sidebarStatus')) ? !!+Cookies.get(cookieName('sidebarStatus')) : true,
        withoutAnimation: false,
        hide: false
      },
      device: 'desktop',
      size: Cookies.get(cookieName('size')) || 'default'
    }),
    actions: {
      toggleSideBar(withoutAnimation) {
        if (this.sidebar.hide) {
          return false
        }
        this.sidebar.opened = !this.sidebar.opened
        this.sidebar.withoutAnimation = withoutAnimation
        if (this.sidebar.opened) {
          Cookies.set(cookieName('sidebarStatus'), 1)
        } else {
          Cookies.set(cookieName('sidebarStatus'), 0)
        }
      },
      closeSideBar({ withoutAnimation }) {
        Cookies.set(cookieName('sidebarStatus'), 0)
        this.sidebar.opened = false
        this.sidebar.withoutAnimation = withoutAnimation
      },
      toggleDevice(device) {
        this.device = device
      },
      setSize(size) {
        this.size = size
        Cookies.set(cookieName('size'), size)
      },
      toggleSideBarHide(status) {
        this.sidebar.hide = status
      }
    }
  })

export default useAppStore
