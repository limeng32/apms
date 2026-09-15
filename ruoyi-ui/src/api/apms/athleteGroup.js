import request from '@/utils/request'

// 查询运动员归属历史
export function listByAthlete(athleteId) {
  return request({
    url: '/apms/athlete-group/athlete/' + athleteId,
    method: 'get'
  })
}

// 查询运动员当前在组记录
export function getCurrent(athleteId) {
  return request({
    url: '/apms/athlete-group/athlete/' + athleteId + '/current',
    method: 'get'
  })
}

// 查询小组当前在组成员
export function listByDept(deptId) {
  return request({
    url: '/apms/athlete-group/dept/' + deptId,
    method: 'get'
  })
}

// 加入小组
export function joinGroup(data) {
  return request({
    url: '/apms/athlete-group/join',
    method: 'post',
    data: data
  })
}

// 离开小组
export function leaveGroup(athleteId, data) {
  return request({
    url: '/apms/athlete-group/leave/' + athleteId,
    method: 'post',
    data: data || {}
  })
}
