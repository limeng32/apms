import request from '@/utils/request'

// ============ Test Task ============
export function listTestTask(query) {
  return request({ url: '/apms/test-task/list', method: 'get', params: query })
}
export function getTestTask(id) {
  return request({ url: '/apms/test-task/' + id, method: 'get' })
}
export function addTestTask(data) {
  return request({ url: '/apms/test-task', method: 'post', data: data })
}
export function updateTestTask(data) {
  return request({ url: '/apms/test-task', method: 'put', data: data })
}
export function delTestTask(ids) {
  return request({ url: '/apms/test-task/' + ids, method: 'delete' })
}

// ============ Task Item ============
export function listTaskItem(taskId) {
  return request({ url: '/apms/test-task/item/list/' + taskId, method: 'get' })
}
export function addTaskItem(data) {
  return request({ url: '/apms/test-task/item', method: 'post', data: data })
}
export function updateTaskItem(data) {
  return request({ url: '/apms/test-task/item', method: 'put', data: data })
}
export function delTaskItem(itemId) {
  return request({ url: '/apms/test-task/item/' + itemId, method: 'delete' })
}

// ============ Task Member ============
export function listTaskMember(taskId) {
  return request({ url: '/apms/test-task/member/list/' + taskId, method: 'get' })
}
export function enrollMember(data) {
  return request({ url: '/apms/test-task/member/enroll', method: 'post', data: data })
}
export function batchEnroll(taskId, athleteIds) {
  return request({ url: '/apms/test-task/member/batch-enroll', method: 'post', params: { taskId }, data: athleteIds })
}
export function updateMemberStatus(data) {
  return request({ url: '/apms/test-task/member/status', method: 'put', data: data })
}
export function removeMember(taskId, athleteId) {
  return request({ url: '/apms/test-task/member', method: 'delete', params: { taskId, athleteId } })
}
