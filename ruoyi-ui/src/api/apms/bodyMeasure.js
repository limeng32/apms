import request from '@/utils/request'

// 按运动员查询所有测量记录
export function listByAthlete(athleteId) {
  return request({
    url: '/apms/body-measure/athlete/' + athleteId,
    method: 'get'
  })
}

// 按运动员查询最新一条
export function getLatest(athleteId) {
  return request({
    url: '/apms/body-measure/athlete/' + athleteId + '/latest',
    method: 'get'
  })
}

// 按ID查询
export function getById(id) {
  return request({
    url: '/apms/body-measure/' + id,
    method: 'get'
  })
}

// 新增或更新（upsert）
export function upsert(data) {
  return request({
    url: '/apms/body-measure/upsert',
    method: 'post',
    data: data
  })
}

// 删除
export function delMeasure(id) {
  return request({
    url: '/apms/body-measure/' + id,
    method: 'delete'
  })
}
