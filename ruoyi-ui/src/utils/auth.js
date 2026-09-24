import Cookies from 'js-cookie'

const TokenKey = 'Admin-Token'

// 与后端 token.expireTime 对齐：30 天持久 Cookie，
// 否则浏览器完全退出后会话 Cookie 丢失，即使后端会话仍有效也会被要求重新登录
const TOKEN_COOKIE_DAYS = 30

export function getToken() {
  return Cookies.get(TokenKey)
}
export function setToken(token) {
  return Cookies.set(TokenKey, token, { expires: TOKEN_COOKIE_DAYS })
}

export function removeToken() {
  return Cookies.remove(TokenKey)
}
