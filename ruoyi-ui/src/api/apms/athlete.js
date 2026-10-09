import request from '@/utils/request'

// 查询队员档案列表
export function listAthlete(query) {
  return request({
    url: '/apms/athlete/list',
    method: 'get',
    params: query
  })
}

// RTP 状态人数汇总（花名册筛选条 chip 计数）
export function rtpSummaryAthlete(query) {
  return request({
    url: '/apms/athlete/rtpSummary',
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

// 赛季晋升：预览名单（不落库）
export function previewPromotion(data) {
  return request({
    url: '/apms/athlete/promotion/preview',
    method: 'post',
    data: data
  })
}

// 赛季晋升：执行批处理
export function executePromotion(data) {
  return request({
    url: '/apms/athlete/promotion/execute',
    method: 'post',
    data: data
  })
}
