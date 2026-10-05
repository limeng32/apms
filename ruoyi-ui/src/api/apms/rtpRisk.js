import request from '@/utils/request'

// 预警待办/已处理列表（分页）
export function listRisk(query) {
  return request({
    url: '/apms/rtp-risk/list',
    method: 'get',
    params: query
  })
}

// KPI 统计（total/warning/attention/infoHealth/processOnly）
export function statRisk(query) {
  return request({
    url: '/apms/rtp-risk/stat',
    method: 'get',
    params: query
  })
}

// 因子明细
export function getRisk(id) {
  return request({
    url: '/apms/rtp-risk/' + id,
    method: 'get'
  })
}

// 运动员详情页当前系统建议（无 ACTIVE 建议时 data=null）
export function latestByAthlete(athleteId) {
  return request({
    url: '/apms/rtp-risk/athlete/' + athleteId + '/latest',
    method: 'get'
  })
}

// 规则配置（一期只读）
export function listRules() {
  return request({
    url: '/apms/rtp-risk/rules',
    method: 'get'
  })
}

// 已知悉（仅 INFO）
export function ackRisk(id, remark) {
  return request({
    url: '/apms/rtp-risk/' + id + '/ack',
    method: 'post',
    data: { remark }
  })
}

// 忽略（理由必填）
export function dismissRisk(id, remark) {
  return request({
    url: '/apms/rtp-risk/' + id + '/dismiss',
    method: 'post',
    data: { remark }
  })
}

// 采纳并更新 RTP（单接口单事务；body={status,reason,trainingLimit,nextReviewDate}）
export function acceptRisk(id, data) {
  return request({
    url: '/apms/rtp-risk/' + id + '/accept',
    method: 'post',
    data
  })
}

// 手动全量扫描
export function scanAll() {
  return request({
    url: '/apms/rtp-risk/scan',
    method: 'post'
  })
}
