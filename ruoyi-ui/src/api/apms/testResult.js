import request from '@/utils/request'

export function listTestResult(query) {
  return request({ url: '/apms/test-result/list', method: 'get', params: query })
}
export function getTestResult(id) {
  return request({ url: '/apms/test-result/' + id, method: 'get' })
}
export function listByTaskMember(taskId, athleteId) {
  return request({ url: '/apms/test-result/by-task-member', method: 'get', params: { taskId, athleteId } })
}
export function listFreeGroup(athleteId, indicatorId, modelId) {
  return request({ url: '/apms/test-result/by-free-group', method: 'get', params: { athleteId, indicatorId, modelId } })
}
export function addTestResult(data) {
  return request({ url: '/apms/test-result', method: 'post', data })
}
export function updateTestResult(data) {
  return request({ url: '/apms/test-result', method: 'put', data })
}
export function delTestResult(id) {
  return request({ url: '/apms/test-result/' + id, method: 'delete' })
}
export function delByTask(taskId) {
  return request({ url: '/apms/test-result/task/' + taskId, method: 'delete' })
}
export function autoSelectBest(taskItemId, athleteId) {
  return request({ url: '/apms/test-result/auto-select', method: 'post', params: { taskItemId, athleteId } })
}
export function selectAttempt(resultId) {
  return request({ url: '/apms/test-result/select-attempt/' + resultId, method: 'post' })
}

// ============ 测试设备接入（一期：内存注册 + 推送真实落库） ============
export function listDevices() {
  return request({ url: '/apms/device/list', method: 'get' })
}
export function registerDevice(data) {
  return request({ url: '/apms/device/register', method: 'post', data })
}
export function pushDeviceData(data) {
  // 优先走设备密钥请求头 X-Device-Key；body 里保留 apiKey 作为兼容通道
  return request({
    url: '/apms/device/push',
    method: 'post',
    data,
    headers: data.apiKey ? { 'X-Device-Key': data.apiKey } : undefined
  })
}
// 模型结构化数据设备推送（二期接入前为假门禁：任何密钥均返回失效）
export function pushDeviceModel(data) {
  return request({
    url: '/apms/device/model-push',
    method: 'post',
    data,
    headers: data.apiKey ? { 'X-Device-Key': data.apiKey } : undefined
  })
}
