import axios from 'axios'

/**
 * 登录页配置（匿名公开接口）
 *
 * 刻意使用独立 axios 实例而非 @/utils/request：
 * 1. 不带 token（isToken:false）；
 * 2. 10s 超时（与全局实例一致；生产冷启动/弱网下过短的超时会触发 xhr.abort，
 *    在控制台留下 net::ERR_ABORTED 噪音）；
 * 3. 不走全局响应拦截器——后端不可达/超时时静默回退默认配置，不弹任何错误提示。
 */
const publicHttp = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 10000,
  headers: { isToken: false }
})

/**
 * 获取登录页公开配置
 * @param {string} [entry] 入口：'portal'（业务站，默认）| 'showcase'（展示站）
 * @returns {Promise<{config: object, smsEnabled: boolean}>}
 *   config 视觉配置（无配置行时为 {}）；smsEnabled 短信登录开关（与 data 平级，默认 false）
 */
export function getPublicLoginConfig(entry) {
  return publicHttp
    .get('/login/config', { params: entry ? { entry } : {} })
    .then((res) => {
      const body = res && res.data
      // 后端按 AjaxResult 包裹：{ code:200, data:{...}, smsEnabled:false }
      const data = body && typeof body.data === 'object' && body.data !== null ? body.data : {}
      return { config: data, smsEnabled: body && body.smsEnabled === true }
    })
}

/* ============================ 设计器管理端（需鉴权，走全局 request） ============================ */

import request from '@/utils/request'

/**
 * 设计器回显：获取库中原始配置（无配置行时为 {}，前端再与默认值合并填表）
 * @param {string} [entry] 入口：'portal'（业务站，默认）| 'showcase'（展示站）
 * @returns {Promise<object>}
 */
export function getManagedLoginConfig(entry) {
  // request 拦截器返回完整 AjaxResult { code, msg, data }，这里解包出 data
  return request({
    url: '/system/login/config',
    method: 'get',
    params: entry ? { entry } : {}
  }).then((res) => (res && typeof res.data === 'object' && res.data !== null ? res.data : {}))
}

/**
 * 保存登录页配置（JSON 导入也复用本接口，后端同一套校验）
 * @param {object} data 完整配置对象
 * @param {string} [entry] 入口：'portal'（业务站，默认）| 'showcase'（展示站）
 */
export function updateLoginConfig(data, entry) {
  return request({
    url: '/system/login/config',
    method: 'put',
    params: entry ? { entry } : {},
    data
  })
}
