import request from '@/utils/request'

// 看板总览（单 API 返回全部聚合数据）
export function getOverview() {
  return request({ url: '/apms/dashboard/overview', method: 'get' })
}
