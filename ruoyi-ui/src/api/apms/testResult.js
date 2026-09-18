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
