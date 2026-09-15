import request from '@/utils/request'

// ============ Test Model ============
export function listTestModel(query) {
  return request({ url: '/apms/test-model/list', method: 'get', params: query })
}
export function getTestModel(id) {
  return request({ url: '/apms/test-model/' + id, method: 'get' })
}
export function addTestModel(data) {
  return request({ url: '/apms/test-model', method: 'post', data: data })
}
export function updateTestModel(data) {
  return request({ url: '/apms/test-model', method: 'put', data: data })
}
export function delTestModel(ids) {
  return request({ url: '/apms/test-model/' + ids, method: 'delete' })
}

// ============ Field ============
export function listField(modelId) {
  return request({ url: '/apms/test-model/field/list/' + modelId, method: 'get' })
}
export function addField(data) {
  return request({ url: '/apms/test-model/field', method: 'post', data: data })
}
export function updateField(data) {
  return request({ url: '/apms/test-model/field', method: 'put', data: data })
}
export function delField(fieldId) {
  return request({ url: '/apms/test-model/field/' + fieldId, method: 'delete' })
}
