import request from '@/utils/request'

export function listReport(query) {
  return request({ url: '/apms/report/list', method: 'get', params: query })
}
export function getReport(id) {
  return request({ url: '/apms/report/' + id, method: 'get' })
}
export function generateReport(data) {
  return request({ url: '/apms/report/generate', method: 'post', params: data })
}
export function delReport(id) {
  return request({ url: '/apms/report/' + id, method: 'delete' })
}
// 私有下载端点（带权限）
export function downloadReportUrl(id) {
  return '/apms/report/download/' + id
}
