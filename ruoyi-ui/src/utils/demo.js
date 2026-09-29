/**
 * 一键体验（演示模式）生命周期
 *
 * 四态会话原语全部在 auth.js（叶子模块），本文件只做组合：
 * 口令校验 → 原子写单键会话 → 重置内存 DB → 清空身份态，随后由调用方跳转，
 * permission.js 守卫按真实链路拉 mock 的 getInfo/getRouters 完成初始化。
 */
import {
  DEMO_TOKEN_PREFIX,
  isDemoMode,
  setDemoSession,
  clearDemoSession,
  getToken
} from '@/utils/auth'
import { resetDb } from '@/mock/db'
import useUserStore from '@/store/modules/user'

/* 纯前端口令，F12 可见，仅防普通访客；env 可覆盖 */
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}

/** 演示入口是否启用（默认启用；VITE_DEMO_ENABLED=false 一键关闭） */
export function isDemoEnabled() {
  return ENV.VITE_DEMO_ENABLED !== 'false'
}

/** 演示口令（默认 8888，VITE_DEMO_PASSCODE 可覆盖） */
export const PASSCODE = ENV.VITE_DEMO_PASSCODE || '8888'

export { isDemoMode }

/**
 * 进入演示。口令错误抛 Error（由弹窗呈现）；存储不可用抛 Error（由调用方提示，不进入）。
 * 成功后由调用方执行 router.replace('/apms/dashboard')。
 */
export function enterDemo(passcode) {
  if (String(passcode ?? '').trim() !== PASSCODE) {
    throw new Error('口令不正确')
  }
  // 原子写入单键会话；setItem 在 Web Storage 被禁时抛错——此时不重置 db/store、不跳转
  setDemoSession(DEMO_TOKEN_PREFIX + Date.now())

  // 显式取一份全新数据（防御：db 模块在登录页就已随 request.js 被 import，
  // 模块级那份虽无人动过，仍换新）
  resetDb()

  // 关键：roles/permissions 必须清空，permission.js 守卫 roles.length===0 闸门才成立，
  // 随后真实链路执行 getInfo()/generateRoutes() 填充 mock 身份与 APMS 菜单
  const userStore = useUserStore()
  userStore.roles = []
  userStore.permissions = []
  userStore.token = getToken()
  userStore.portalMode = false
  userStore.homePath = ''
}

/**
 * 退出演示：只清单键会话 + 重置内存 store，不调 /logout、不 removeToken
 * （保护同 host 其他标签可能存在的真实登录 Cookie）。
 */
export function exitDemo() {
  clearDemoSession()
  const userStore = useUserStore()
  userStore.token = ''
  userStore.roles = []
  userStore.permissions = []
  userStore.portalMode = false
  userStore.homePath = ''
}
