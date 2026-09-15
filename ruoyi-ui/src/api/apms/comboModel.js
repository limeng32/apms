import request from '@/utils/request'

// ============ Combo Model ============
export function listComboModel(query) {
  return request({ url: '/apms/combo-model/list', method: 'get', params: query })
}
export function getComboModel(id) {
  return request({ url: '/apms/combo-model/' + id, method: 'get' })
}
export function addComboModel(data) {
  return request({ url: '/apms/combo-model', method: 'post', data: data })
}
export function updateComboModel(data) {
  return request({ url: '/apms/combo-model', method: 'put', data: data })
}
export function delComboModel(ids) {
  return request({ url: '/apms/combo-model/' + ids, method: 'delete' })
}

// ============ Component ============
export function listComponent(comboModelId) {
  return request({ url: '/apms/combo-model/component/list/' + comboModelId, method: 'get' })
}
export function addComponent(data) {
  return request({ url: '/apms/combo-model/component', method: 'post', data: data })
}
export function updateComponent(data) {
  return request({ url: '/apms/combo-model/component', method: 'put', data: data })
}
export function delComponent(componentId) {
  return request({ url: '/apms/combo-model/component/' + componentId, method: 'delete' })
}
