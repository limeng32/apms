import Cookies from 'js-cookie'
import { cookieName } from '@/utils/ruoyi'

// Token Cookie 名：本机多实例（dev 5173 / UAT 8088）按端口隔离，生产保持 Admin-Token
const TokenKey = cookieName('Admin-Token')
// 环境隔离改造前的旧名：仅在新名缺失时兜底读取一次，避免升级后本机各环境被迫重新登录
const LegacyTokenKey = 'Admin-Token'

// 与后端 token.expireTime 对齐：30 天持久 Cookie，
// 否则浏览器完全退出后会话 Cookie 丢失，即使后端会话仍有效也会被要求重新登录
const TOKEN_COOKIE_DAYS = 30

export function getToken() {
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
