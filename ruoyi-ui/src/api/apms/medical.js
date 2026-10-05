import request from '@/utils/request'

export function listMedical(query) {
  return request({ url: '/apms/medical-record/list', method: 'get', params: query })
}
// 伤病部位分布（人体热力图）：range=12m（近12个月，默认）/ all
export function medicalSiteStats(query) {
  return request({ url: '/apms/medical-record/site-stats', method: 'get', params: query })
}
export function getMedical(id) {
  return request({ url: '/apms/medical-record/' + id, method: 'get' })
}
export function addMedical(data) {
  return request({ url: '/apms/medical-record', method: 'post', data })
}
export function updateMedical(data) {
  return request({ url: '/apms/medical-record', method: 'put', data })
}
export function delMedical(id) {
  return request({ url: '/apms/medical-record/' + id, method: 'delete' })
}
export function delMedicalFile(fileId) {
  return request({ url: '/apms/medical-record/file/' + fileId, method: 'delete' })
}
// 私有下载端点（不走公共 /common/download）
export function downloadMedicalFile(fileId) {
  return '/apms/medical-record/file/download/' + fileId
}
