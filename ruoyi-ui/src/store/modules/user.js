import router from '@/router'
import cache from '@/plugins/cache'
import { ElMessageBox, } from 'element-plus'
import { login, smsLogin, smsLoginSelect, logout, getInfo } from '@/api/login'
import { getToken, setToken, removeToken, isDemoMode, clearDemoSession } from '@/utils/auth'
import { clearAssistantSession } from '@/utils/assistantSession'
import useLockStore from '@/store/modules/lock'

const useUserStore = defineStore(
  'user',
  {
    state: () => ({
      token: getToken(),
      id: '',
      deptId: null,
      name: '',
      nickName: '',
      roles: [],
      permissions: [],
      portalMode: false,
      homePath: ''
    }),
    actions: {
      // 登录
      login(userInfo) {
        const username = userInfo.username.trim()
        const password = userInfo.password
        const code = userInfo.code
        const uuid = userInfo.uuid
        const sliderUuid = userInfo.sliderUuid
        return new Promise((resolve, reject) => {
          login(username, password, code, uuid, sliderUuid).then(res => {
            setToken(res.token)
            this.token = res.token
            useLockStore().unlockScreen()
            resolve()
          }).catch(error => {
            reject(error)
          })
        })
      },
      // 短信验证码登录：单账号后端直接发 token；多账号返回 selectToken+accounts，
      // 由调用方弹出账号选择后再走 selectSmsAccount
      loginBySms(userInfo) {
        const phonenumber = userInfo.phonenumber.trim()
        const code = userInfo.code.trim()
        return new Promise((resolve, reject) => {
          smsLogin(phonenumber, code).then(res => {
            if (res.token) {
              setToken(res.token)
              this.token = res.token
              useLockStore().unlockScreen()
            }
            resolve(res)
          }).catch(error => {
            reject(error)
          })
        })
      },
      // 多账号短信登录：凭一次性选择令牌兑换所选账号的 token
      selectSmsAccount(payload) {
        return new Promise((resolve, reject) => {
          smsLoginSelect(payload.selectToken, payload.userId).then(res => {
            setToken(res.token)
            this.token = res.token
            useLockStore().unlockScreen()
            resolve()
          }).catch(error => {
            reject(error)
          })
        })
      },
      // 获取用户信息
      getInfo() {
        return new Promise((resolve, reject) => {
          getInfo().then(res => {
            const user = res.user
            if (res.roles && res.roles.length > 0) { // 验证返回的roles是否是一个非空数组
              this.roles = res.roles
              this.permissions = res.permissions
            } else {
              this.roles = ['ROLE_DEFAULT']
            }
            this.id = user.userId
            this.deptId = user.deptId ?? null
            this.name = user.userName
            this.nickName = user.nickName
            this.portalMode = res.portalMode === true
            this.homePath = res.homePath || ''
            cache.session.set('pwrChrtype', res.pwdChrtype)
            /* 初始密码提示 */
            if(res.isDefaultModifyPwd) {
              ElMessageBox.confirm('您的密码还是初始密码，请修改密码！',  '安全提示', {  confirmButtonText: '确定',  cancelButtonText: '取消',  type: 'warning' }).then(() => {
                router.push({ name: 'Profile', params: { activeTab: 'resetPwd' } })
              }).catch(() => {})
            }
            /* 过期密码提示 */
            if(!res.isDefaultModifyPwd && res.isPasswordExpired) {
              ElMessageBox.confirm('您的密码已过期，请尽快修改密码！',  '安全提示', {  confirmButtonText: '确定',  cancelButtonText: '取消',  type: 'warning' }).then(() => {
                router.push({ name: 'Profile', params: { activeTab: 'resetPwd' } })
              }).catch(() => {})
            }
            resolve(res)
          }).catch(error => {
            reject(error)
          })
        })
      },
      // 退出系统
      logOut() {
        return new Promise((resolve, reject) => {
          // 演示退出：不调 /logout、不 removeToken()，保护同 host 其他标签可能存在的真实登录 Cookie。
          // broken/storage-error 同样走进来（401/菜单退出），clearDemoSession 对异常存储安全。
          if (isDemoMode()) {
            clearDemoSession()
            clearAssistantSession()
            this.token = ''
            this.roles = []
            this.permissions = []
            this.portalMode = false
            this.homePath = ''
            resolve()
            return
          }
          logout(this.token).then(() => {
            clearAssistantSession()
            this.token = ''
            this.roles = []
            this.permissions = []
            this.portalMode = false
            this.homePath = ''
            removeToken()
            resolve()
          }).catch(error => {
            reject(error)
          })
        })
      }
    }
  })

export default useUserStore
