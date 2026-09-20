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

/* ============================ 设计器管理端（需鉴权，走全局 request） ============================ */

import request from '@/utils/request'

/**
 * 设计器回显：获取库中原始配置（无配置行时为 {}，前端再与默认值合并填表）
 * @returns {Promise<object>}
 */
export function getManagedLoginConfig() {
  // request 拦截器返回完整 AjaxResult { code, msg, data }，这里解包出 data
  return request({
    url: '/system/login/config',
    method: 'get'
  }).then((res) => (res && typeof res.data === 'object' && res.data !== null ? res.data : {}))
}

/**
 * 保存登录页配置（JSON 导入也复用本接口，后端同一套校验）
 * @param {object} data 完整配置对象
 */
export function updateLoginConfig(data) {
  return request({
    url: '/system/login/config',
    method: 'put',
    data
  })
}
