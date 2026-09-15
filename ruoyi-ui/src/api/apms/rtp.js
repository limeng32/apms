import request from '@/utils/request'

// 查询运动员当前RTP状态
export function getStatus(athleteId) {
  return request({
    url: '/apms/rtp/status/' + athleteId,
    method: 'get'
  })
}

// 列表查询（统计/批量查看）
export function listStatus() {
  return request({
    url: '/apms/rtp/status/list',
    method: 'get'
  })
}

// 查询RTP变更历史
export function getLog(athleteId) {
  return request({
    url: '/apms/rtp/log/' + athleteId,
    method: 'get'
  })
}

// 更新RTP状态（自动写入变更日志）
export function updateStatus(data) {
  return request({
    url: '/apms/rtp/update',
    method: 'post',
    data: data
  })
}

// 清除RTP状态（回到未评估）
export function clearStatus(athleteId, data) {
  return request({
    url: '/apms/rtp/clear/' + athleteId,
    method: 'post',
    data: data || {}
  })
}
