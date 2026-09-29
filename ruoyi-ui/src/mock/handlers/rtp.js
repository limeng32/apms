/**
 * 演示模式 · RTP 回归训练状态 handler（状态 + 变更日志）
 * 更新/清除时同步花名册行上的 rtpStatus 冗余字段。
 */
import {
  getDb, route, ok, detail, listData,
  nextId, now
} from '../handle'

function statusOf(athleteId) {
  return getDb().rtpStatuses.find(s => String(s.athleteId) === String(athleteId))
}

export const rtpHandlers = [
  // 注意：/status/list 为精确路由，需先于 /status/:athleteId 注册
  route('get', '/apms/rtp/status/list', () => listData(getDb().rtpStatuses)),

  route('get', '/apms/rtp/log/:athleteId', (ctx) => {
    const rows = getDb().rtpLogs
      .filter(l => String(l.athleteId) === ctx.params.athleteId)
      .sort((a, b) => (b.operateTime || '').localeCompare(a.operateTime || ''))
    return listData(rows)
  }),

  // 更新状态：upsert 状态行 + 追加日志 + 同步花名册
  route('post', '/apms/rtp/update', (ctx) => {
    const b = ctx.body || {}
    if (b.athleteId == null || !b.status) return { code: 601, msg: '运动员与状态必填' }
    const db = getDb()
    const athlete = db.athletes.find(a => String(a.athleteId) === String(b.athleteId))
    const ts = now()
    const prev = statusOf(b.athleteId)
    if (prev) {
      Object.assign(prev, {
        status: b.status, reason: b.reason ?? prev.reason,
        trainingLimit: b.trainingLimit ?? prev.trainingLimit,
        nextReviewDate: b.nextReviewDate ?? prev.nextReviewDate,
        updatedBy: 'super', updatedTime: ts
      })
    } else {
      db.rtpStatuses.push({
        id: nextId(),
        athleteId: Number(b.athleteId),
        athleteName: athlete?.name ?? b.athleteName ?? null,
        athleteTeam: athlete?.teamName ?? null,
        status: b.status,
        reason: b.reason ?? null,
        trainingLimit: b.trainingLimit ?? null,
        nextReviewDate: b.nextReviewDate ?? null,
        updatedBy: 'super', updatedTime: ts
      })
    }
    db.rtpLogs.push({
      id: nextId(),
      athleteId: Number(b.athleteId),
      athleteName: athlete?.name ?? b.athleteName ?? null,
      fromStatus: prev?.status ?? null,
      toStatus: b.status,
      reason: b.reason ?? null,
      trainingLimit: b.trainingLimit ?? null,
      nextReviewDate: b.nextReviewDate ?? null,
      operatorId: -1, operatorName: 'super', operateTime: ts
    })
    if (athlete) athlete.rtpStatus = b.status
    return ok('状态已更新')
  }),

  route('post', '/apms/rtp/clear/:athleteId', (ctx) => {
    const db = getDb()
    const id = ctx.params.athleteId
    const prev = statusOf(id)
    const athlete = db.athletes.find(a => String(a.athleteId) === String(id))
    if (prev) {
      const ts = now()
      db.rtpLogs.push({
        id: nextId(),
        athleteId: Number(id),
        athleteName: athlete?.name ?? prev.athleteName ?? null,
        fromStatus: prev.status, toStatus: null,
        reason: ctx.body?.reason ?? null,
        trainingLimit: null, nextReviewDate: null,
        operatorId: -1, operatorName: 'super', operateTime: ts
      })
      db.rtpStatuses = db.rtpStatuses.filter(s => String(s.athleteId) !== String(id))
    }
    if (athlete) athlete.rtpStatus = null
    return ok('已清除评估')
  }),

  route('get', '/apms/rtp/status/:athleteId', (ctx) => {
    const row = statusOf(ctx.params.athleteId)
    return row ? detail(row) : detail(null)
  })
]
