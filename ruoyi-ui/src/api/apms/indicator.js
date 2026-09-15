import request from '@/utils/request'

// ============ Indicator ============
export function listIndicator(query) {
  return request({ url: '/apms/indicator/list', method: 'get', params: query })
}
export function getIndicator(id) {
  return request({ url: '/apms/indicator/' + id, method: 'get' })
}
export function addIndicator(data) {
  return request({ url: '/apms/indicator', method: 'post', data: data })
}
export function updateIndicator(data) {
  return request({ url: '/apms/indicator', method: 'put', data: data })
}
export function delIndicator(ids) {
  return request({ url: '/apms/indicator/' + ids, method: 'delete' })
}

// ============ Indicator Ref ============
export function listRef(indicatorId) {
  return request({ url: '/apms/indicator/ref/list/' + indicatorId, method: 'get' })
}
export function addRef(data) {
  return request({ url: '/apms/indicator/ref', method: 'post', data: data })
}
export function updateRef(data) {
  return request({ url: '/apms/indicator/ref', method: 'put', data: data })
}
export function delRef(refId) {
  return request({ url: '/apms/indicator/ref/' + refId, method: 'delete' })
}

// ============ Indicator Ref Level ============
export function listLevel(refId) {
  return request({ url: '/apms/indicator/level/list/' + refId, method: 'get' })
}
export function addLevel(data) {
  return request({ url: '/apms/indicator/level', method: 'post', data: data })
}
export function updateLevel(data) {
  return request({ url: '/apms/indicator/level', method: 'put', data: data })
}
export function delLevel(levelId) {
  return request({ url: '/apms/indicator/level/' + levelId, method: 'delete' })
}
