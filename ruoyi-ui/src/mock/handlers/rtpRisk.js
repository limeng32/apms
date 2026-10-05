/**
 * 演示模式 · RTP 风险预警 handler
 * 行为对齐后端：HEALTH/PROCESS 隔离呈现、单接口采纳（快照 ACCEPTED + RTP upsert + 日志），
 * 采纳仅允许 ATTENTION→y / WARNING→r 且不降级。
 */
import {
  getDb, route, ok, detail, paginate,
  nextId, now, like
} from '../handle'

const TODAY = '2026-10-05'

const RULES = [
  { id: 1, ruleCode: 'REVIEW_OVERDUE', ruleName: 'RTP复检已逾期', enabled: '1', kind: 'PROCESS', severity: 0, urgency: 3, forceWarning: '0', weight: 1.00, params: '{}' },
  { id: 2, ruleCode: 'REVIEW_SOON', ruleName: 'RTP复检临近', enabled: '1', kind: 'PROCESS', severity: 0, urgency: 2, forceWarning: '0', weight: 1.00, params: '{"reviewSoonDays":14}' },
  { id: 3, ruleCode: 'INJURY_OPEN', ruleName: '伤病/手术未闭环', enabled: '1', kind: 'HEALTH', severity: 2, urgency: 2, forceWarning: '0', weight: 1.00, params: '{"injuryWindowDays":45,"closureWindowDays":90}' },
  { id: 4, ruleCode: 'PHV_PEAK', ruleName: '身高突增峰期', enabled: '1', kind: 'HEALTH', severity: 1, urgency: 1, forceWarning: '0', weight: 1.00, params: '{"phvPeakBand":0.5,"phvFreshDays":180}' }
]

function filterRows(query) {
  const statuses = query.status ? String(query.status).split(',') : ['ACTIVE']
  const levels = query.suggestedLevel ? String(query.suggestedLevel).split(',') : null
  const rows = getDb().rtpRiskSnapshots.filter(r => {
    if (r.snapshotDate !== TODAY) return false
    if (!statuses.includes(r.status)) return false
    if (levels && !levels.includes(r.suggestedLevel)) return false
    if (query.processOnly !== undefined && query.processOnly !== ''
        && String(r.processOnly) !== String(query.processOnly)) return false
    if (query.processFlag && !(r.processFlagList || []).includes(String(query.processFlag))) return false
    if (query.deptId !== undefined && query.deptId !== '' && query.deptId != null
        && String(r.deptId) !== String(query.deptId)) return false
    if (query.keyword && !like(r.athleteName, query.keyword)) return false
    return true
  })
  // 排序与后端一致：todoPriority DESC → 级别 → 日期 → id
  const lvRank = { WARNING: 3, ATTENTION: 2, INFO: 1 }
  return rows.sort((a, b) =>
    (b.todoPriority - a.todoPriority)
    || ((lvRank[b.suggestedLevel] || 0) - (lvRank[a.suggestedLevel] || 0))
    || String(a.snapshotDate).localeCompare(String(b.snapshotDate))
    || (a.id - b.id))
}

function statOf(query) {
  const rows = filterRows(query)
  return {
    total: rows.length,
    warning: rows.filter(r => r.suggestedLevel === 'WARNING').length,
    attention: rows.filter(r => r.suggestedLevel === 'ATTENTION').length,
    infoHealth: rows.filter(r => r.suggestedLevel === 'INFO' && r.processOnly !== '1').length,
    processOnly: rows.filter(r => r.processOnly === '1').length
  }
}

function statusRank(s) { return { r: 3, y: 2, g: 1 }[s] || 0 }
function rtpLabel(s) { return { g: '正常参训', y: '限制参训', r: '不建议训练' }[s] || '未评估' }

/** 采纳：快照置 ACCEPTED + upsert RTP 状态 + 追加日志（同一调用内完成，对齐单事务语义） */
function applyAccept(snapshot, body) {
  const db = getDb()
  const level = snapshot.suggestedLevel
  const target = body.status
  if (level === 'ATTENTION' && target !== 'y') return { code: 601, msg: 'ATTENTION 采纳仅允许写入 yellow（限制参训）' }
  if (level === 'WARNING' && target !== 'r') return { code: 601, msg: 'WARNING 采纳仅允许写入 red（不建议训练）' }
  if (level === 'INFO') return { code: 601, msg: '仅 ATTENTION/WARNING 提示可采纳并更新 RTP，INFO 请知悉或忽略' }

  const prev = db.rtpStatuses.find(s => String(s.athleteId) === String(snapshot.athleteId))
  if (prev && statusRank(prev.status) > statusRank(target)) {
    return { code: 601, msg: `当前为更严格的 RTP 状态（${rtpLabel(prev.status)}），无需下调` }
  }

  const ts = now()
  if (prev) {
    Object.assign(prev, {
      status: target, reason: body.reason ?? prev.reason,
      trainingLimit: body.trainingLimit ?? prev.trainingLimit,
      nextReviewDate: body.nextReviewDate ?? prev.nextReviewDate,
      updatedBy: 'super', updatedTime: ts
    })
  } else {
    db.rtpStatuses.push({
      id: nextId(), athleteId: Number(snapshot.athleteId),
      athleteName: snapshot.athleteName, athleteTeam: snapshot.athleteTeam,
      status: target, reason: body.reason ?? null,
      trainingLimit: body.trainingLimit ?? null,
      nextReviewDate: body.nextReviewDate ?? null,
      updatedBy: 'super', updatedTime: ts
    })
  }
  db.rtpLogs.push({
    id: nextId(), athleteId: Number(snapshot.athleteId), athleteName: snapshot.athleteName,
    fromStatus: prev?.status ?? null, toStatus: target,
    reason: body.reason ?? null, trainingLimit: body.trainingLimit ?? null,
    nextReviewDate: body.nextReviewDate ?? null,
    operatorId: -1, operatorName: 'super', operateTime: ts
  })
  const athlete = db.athletes.find(a => String(a.athleteId) === String(snapshot.athleteId))
  if (athlete) athlete.rtpStatus = target

  Object.assign(snapshot, {
    status: 'ACCEPTED', acceptedStatus: target,
    handledBy: 'super', handledTime: ts,
    handleRemark: body.remark ?? null
  })
  return detail(snapshot, '已采纳：RTP 状态、日志与预警处置已一起完成')
}

export const rtpRiskHandlers = [
  // 注意：精确路由需先于 /:id 注册
  route('get', '/apms/rtp-risk/list', (ctx) => paginate(filterRows(ctx.query), ctx.query)),
  route('get', '/apms/rtp-risk/stat', (ctx) => detail(statOf(ctx.query))),
  route('get', '/apms/rtp-risk/rules', () => detail(RULES)),
  route('get', '/apms/rtp-risk/athlete/:athleteId/latest', (ctx) => {
    const row = getDb().rtpRiskSnapshots
      .filter(r => String(r.athleteId) === String(ctx.params.athleteId)
        && r.status === 'ACTIVE' && r.suggestedLevel !== 'NONE')
      .sort((a, b) => String(b.snapshotDate).localeCompare(String(a.snapshotDate)) || b.id - a.id)[0]
    return detail(row || null)
  }),

  route('get', '/apms/rtp-risk/:id', (ctx) => {
    const row = getDb().rtpRiskSnapshots.find(r => String(r.id) === String(ctx.params.id))
    return row ? detail(row) : { code: 601, msg: '风险提示不存在' }
  }),

  route('post', '/apms/rtp-risk/:id/ack', (ctx) => {
    const row = getDb().rtpRiskSnapshots.find(r => String(r.id) === String(ctx.params.id))
    if (!row) return { code: 601, msg: '风险提示不存在' }
    if (row.status !== 'ACTIVE') return detail(row) // 幂等
    if (row.suggestedLevel !== 'INFO') {
      return { code: 601, msg: '仅 INFO 提示可标记已知悉，ATTENTION/WARNING 请采纳或忽略' }
    }
    Object.assign(row, { status: 'ACKED', handledBy: 'super', handledTime: now(), handleRemark: ctx.body?.remark ?? null })
    return detail(row, '已标记知悉')
  }),

  route('post', '/apms/rtp-risk/:id/dismiss', (ctx) => {
    const remark = ctx.body?.remark
    if (!remark || !String(remark).trim()) return { code: 601, msg: '忽略时必须填写理由' }
    const row = getDb().rtpRiskSnapshots.find(r => String(r.id) === String(ctx.params.id))
    if (!row) return { code: 601, msg: '风险提示不存在' }
    if (row.status !== 'ACTIVE') return detail(row)
    Object.assign(row, { status: 'DISMISSED', handledBy: 'super', handledTime: now(), handleRemark: String(remark).trim() })
    return detail(row, '已忽略')
  }),

  route('post', '/apms/rtp-risk/:id/accept', (ctx) => {
    const row = getDb().rtpRiskSnapshots.find(r => String(r.id) === String(ctx.params.id))
    if (!row) return { code: 601, msg: '风险提示不存在' }
    if (row.status !== 'ACTIVE') return detail(row)
    return applyAccept(row, ctx.body || {})
  }),

  route('post', '/apms/rtp-risk/scan', () => {
    // 演示态：种子即当日扫描结果，返回统计即可
    const rows = getDb().rtpRiskSnapshots.filter(r => r.snapshotDate === TODAY)
    return detail({
      total: getDb().athletes.filter(a => a.status === '0').length,
      withRisk: rows.filter(r => r.status === 'ACTIVE').length,
      byLevel: {
        WARNING: rows.filter(r => r.suggestedLevel === 'WARNING' && r.status === 'ACTIVE').length,
        ATTENTION: rows.filter(r => r.suggestedLevel === 'ATTENTION' && r.status === 'ACTIVE').length,
        INFO: rows.filter(r => r.suggestedLevel === 'INFO' && r.status === 'ACTIVE').length
      }
    }, '扫描完成')
  })
]
