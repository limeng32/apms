import request from '@/utils/request'

export function listMedical(query) {
  return request({ url: '/apms/medical-record/list', method: 'get', params: query })
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
