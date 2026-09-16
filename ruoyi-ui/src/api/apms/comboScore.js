import request from '@/utils/request'

// 全局列表
export function list(query) {
  return request({ url: '/apms/combo-score/list', method: 'get', params: query })
}
// 按 ID
export function getById(id) {
  return request({ url: '/apms/combo-score/' + id, method: 'get' })
}
// 批量计算
export function calculate(comboModelId, taskId) {
  return request({
    url: '/apms/combo-score/calculate',
    method: 'post',
    data: { comboModelId, taskId }
  })
}
// 删除
export function delScore(id) {
  return request({ url: '/apms/combo-score/' + id, method: 'delete' })
}
