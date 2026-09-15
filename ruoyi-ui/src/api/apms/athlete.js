import request from '@/utils/request'

// 查询队员档案列表
export function listAthlete(query) {
  return request({
    url: '/apms/athlete/list',
    method: 'get',
    params: query
  })
}

// 查询队员档案详情
export function getAthlete(athleteId) {
  return request({
    url: '/apms/athlete/' + athleteId,
    method: 'get'
  })
}

// 新增队员档案
export function addAthlete(data) {
  return request({
    url: '/apms/athlete',
    method: 'post',
    data: data
  })
}

// 修改队员档案
export function updateAthlete(data) {
  return request({
    url: '/apms/athlete',
    method: 'put',
    data: data
  })
}

// 删除队员档案（逻辑删除：改 status=1 离队）
export function delAthlete(athleteIds) {
  return request({
    url: '/apms/athlete/' + athleteIds,
    method: 'delete'
  })
}

// 校验球衣号码同队唯一性
export function checkJerseyNoUnique(query) {
  return request({
    url: '/apms/athlete/check_jersey_no',
    method: 'get',
    params: query
  })
}
