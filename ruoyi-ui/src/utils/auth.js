import Cookies from 'js-cookie'
import { cookieName } from '@/utils/ruoyi'

// Token Cookie 名：本机多实例（dev 5173 / UAT 8088）按端口隔离，生产保持 Admin-Token
const TokenKey = cookieName('Admin-Token')
// 环境隔离改造前的旧名：仅在新名缺失时兜底读取一次，避免升级后本机各环境被迫重新登录
const LegacyTokenKey = 'Admin-Token'

// 与后端 token.expireTime 对齐：2 年（730 天）持久 Cookie，
// 否则浏览器完全退出后会话 Cookie 丢失，即使后端会话仍有效也会被要求重新登录
const TOKEN_COOKIE_DAYS = 730

/* ============================================================================
 * 一键体验（演示模式）会话
 *
 * 设计不变量（详见 .trae/documents/demo_mode_plan.md §三）：
 * 1. 演示会话只存 sessionStorage 单键 JSON（mode+token 原子同存），绝不触碰正式
 *    Admin-Token Cookie——Cookie 按 host 共享不按标签页隔离；
 * 2. 会话读取严格区分四态：none / demo / broken / storage-error。
 *    后两种异常态下 isDemoMode() 恒为 true（demoAdapter 与全部守卫绝不卸载），
 *    getToken() 无条件返回 undefined（绝不回落正式 Cookie）。
 *    即：演示页面在任何存储损坏/禁用/刷新组合下，要么本地 mock，要么停在阻断页，
 *    永远不会携带真实凭证请求生产。
 * 3. 裁决过程无状态：不引入运行时标志/可变分支，同一存储状态任何调用序列结果一致。
 * ==========================================================================*/

export const DEMO_SESSION_KEY = 'apms_demo_session'
export const DEMO_TOKEN_PREFIX = 'demo-static-'

/**
 * 读取演示会话状态（四态）。
 * @returns {{state:'none'}} 键不存在（getItem 返回 null）
 * @returns {{state:'demo', token:string}} 键存在且 JSON/mode/token 前缀均合法
 * @returns {{state:'broken'}} 键存在，但 JSON 无法解析或内容非法
 * @returns {{state:'storage-error'}} sessionStorage 本身不可访问
 */
export function readDemoSessionState() {
  let raw
  try {
    raw = sessionStorage.getItem(DEMO_SESSION_KEY)
  } catch (e) {
    return { state: 'storage-error' }
  }
  // raw===null 表示键不存在，必须与"键在但内容坏"严格区分，禁止合并
  if (raw === null) return { state: 'none' }
  try {
    const value = JSON.parse(raw)
    if (
      value && typeof value === 'object'
      && value.mode === 'demo'
      && typeof value.token === 'string'
      && value.token.startsWith(DEMO_TOKEN_PREFIX)
    ) {
      return { state: 'demo', token: value.token }
    }
    return { state: 'broken' }
  } catch (e) {
    return { state: 'broken' }
  }
}

/**
 * 原子写入演示会话（单次 setItem，mode 与 token 同存同灭）。
 * Web Storage 不可用时抛错，由调用方 enterDemo 接住并中止进入。
 */
export function setDemoSession(token) {
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ mode: 'demo', token }))
}

/** 清除演示会话（storage 不可用时静默——本就要退出）。 */
export function clearDemoSession() {
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY)
  } catch (e) { /* 忽略 */ }
}

/**
 * 当前是否处于演示态。
 * broken / storage-error 也返回 true：adapter 安装闸口、下载/上传守卫全部据此保持拦截，
 * 异常态下不允许任何通道退化到真实后端。
 */
export function isDemoMode() {
  const s = readDemoSessionState()
  return s.state === 'demo' || s.state === 'broken' || s.state === 'storage-error'
}

export function getToken() {
  const s = readDemoSessionState()
  if (s.state === 'demo') return s.token
  // broken / storage-error：fail-closed，无条件 undefined，永不回落 Admin-Token
  if (s.state === 'broken' || s.state === 'storage-error') return undefined
  return Cookies.get(TokenKey) || (TokenKey !== LegacyTokenKey ? Cookies.get(LegacyTokenKey) : undefined)
}
export function setToken(token) {
  return Cookies.set(TokenKey, token, { expires: TOKEN_COOKIE_DAYS })
}

export function removeToken() {
  // 同时清理本环境新名与历史旧名（旧名可能正承载本次会话的 token）
  Cookies.remove(TokenKey)
  if (TokenKey !== LegacyTokenKey) Cookies.remove(LegacyTokenKey)
}
