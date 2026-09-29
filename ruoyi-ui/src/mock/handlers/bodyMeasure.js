/**
 * 演示模式 · 体态测量 handler（列表返回 data 数组，非分页）
 */
import {
  getDb, route, ok, detail, listData,
  nextId, stampCreate, stampUpdate
} from '../handle'

function athleteMeta(id) {
  const a = getDb().athletes.find(x => String(x.athleteId) === String(id))
  return a ? { athleteName: a.name, athleteTeam: a.teamName } : {}
}

function listFilter(query) {
  return getDb().bodyMeasures.filter(r => {
    if (query.athleteId !== undefined && query.athleteId !== ''
      && String(r.athleteId) !== String(query.athleteId)) return false
    return true
  })
}

export const bodyMeasureHandlers = [
  route('get', '/apms/body-measure/athlete/:athleteId/latest', (ctx) => {
    const rows = getDb().bodyMeasures
      .filter(r => String(r.athleteId) === ctx.params.athleteId)
      .sort((a, b) => (b.measureDate || '').localeCompare(a.measureDate || ''))
    return detail(rows[0] || null)
  }),

  route('get', '/apms/body-measure/list', (ctx) => listData(listFilter(ctx.query))),

  route('get', '/apms/body-measure/athlete/:athleteId', (ctx) => {
    return listData(listFilter({ athleteId: ctx.params.athleteId })
      .sort((a, b) => (b.measureDate || '').localeCompare(a.measureDate || '')))
  }),

  // upsert：同队员同日期视为更新（与后端唯一约束一致）
  route('post', '/apms/body-measure/upsert', (ctx) => {
    const b = ctx.body || {}
    const db = getDb()
    let row = db.bodyMeasures.find(r =>
      String(r.athleteId) === String(b.athleteId) && String(r.measureDate) === String(b.measureDate))
    if (row) {
      Object.assign(row, b)
      stampUpdate(row)
      return detail(row)
    }
    row = {
      dataSource: 'manual', sourceTaskId: null, sourceSessionKey: null,
      legLength: b.legLength ?? (b.height != null && b.sitHeight != null
        ? Number((b.height - b.sitHeight).toFixed(1)) : null),
      ...athleteMeta(b.athleteId),
      ...b,
      id: nextId()
    }
    stampCreate(row)
    db.bodyMeasures.unshift(row)
    return detail(row)
  }),

  route('delete', '/apms/body-measure/:id', (ctx) => {
    const id = Number(ctx.params.id)
    getDb().bodyMeasures = getDb().bodyMeasures.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  route('get', '/apms/body-measure/:id', (ctx) => {
    const row = getDb().bodyMeasures.find(r => String(r.id) === ctx.params.id)
    return row ? detail(row) : { code: 601, msg: '记录不存在' }
  })
]
