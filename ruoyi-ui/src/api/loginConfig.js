import axios from 'axios'

/**
 * 登录页配置（匿名公开接口）
 *
 * 刻意使用独立 axios 实例而非 @/utils/request：
 * 1. 不带 token（isToken:false）；
 * 2. 短超时 3s；
 * 3. 不走全局响应拦截器——后端不可达/超时时静默回退默认配置，不弹任何错误提示。
 */
const publicHttp = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 3000,
  headers: { isToken: false }
})

/**
 * 获取登录页公开配置
 * @returns {Promise<object>} 配置对象（无配置行时后端返回 {}）
 */
export function getPublicLoginConfig() {
  return publicHttp
    .get('/login/config')
    .then((res) => {
      const body = res && res.data
      // 后端按 AjaxResult 包裹：{ code:200, data:{...} }
      return body && typeof body.data === 'object' && body.data !== null ? body.data : {}
    })
}
