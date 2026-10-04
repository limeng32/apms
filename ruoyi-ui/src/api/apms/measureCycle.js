import request from '@/utils/request'

export function listCycle(query) {
  return request({ url: '/apms/measure-cycle/list', method: 'get', params: query })
}
export function getCycle(id) {
  return request({ url: '/apms/measure-cycle/' + id, method: 'get' })
}
export function cycleProgress(id) {
  return request({ url: `/apms/measure-cycle/${id}/progress`, method: 'get' })
}
export function addCycle(data) {
  return request({ url: '/apms/measure-cycle', method: 'post', data })
}
export function updateCycle(data) {
  return request({ url: '/apms/measure-cycle', method: 'put', data })
}
export function delCycle(id) {
  return request({ url: '/apms/measure-cycle/' + id, method: 'delete' })
}
export function batchSaveCycle(id, measures) {
  return request({ url: `/apms/measure-cycle/${id}/batch`, method: 'post', data: measures })
}
