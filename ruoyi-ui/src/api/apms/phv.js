import request from '@/utils/request'

// 全局列表（DataScope 队伍隔离）
export function list(query) {
  return request({
    url: '/apms/phv/list',
    method: 'get',
    params: query
  })
}

// 按运动员查询所有PHV记录
export function listByAthlete(athleteId) {
  return request({
    url: '/apms/phv/athlete/' + athleteId,
    method: 'get'
  })
}

// 按运动员查询最新PHV记录
export function getLatest(athleteId) {
  return request({
    url: '/apms/phv/athlete/' + athleteId + '/latest',
    method: 'get'
  })
}

// 按ID查询
export function getById(id) {
  return request({
    url: '/apms/phv/' + id,
    method: 'get'
  })
}

// 根据体态测量记录计算并保存PHV
export function calculate(data) {
  return request({
    url: '/apms/phv/calculate',
    method: 'post',
    params: data  // 用 query 参数（@RequestParam）
  })
}

// 直接用给定参数计算并保存PHV（手动录入）
export function calculateDirect(data) {
  return request({
    url: '/apms/phv/calculate-direct',
    method: 'post',
    data: data
  })
}

// 删除PHV记录
export function delPhv(id) {
  return request({
    url: '/apms/phv/' + id,
    method: 'delete'
  })
}
