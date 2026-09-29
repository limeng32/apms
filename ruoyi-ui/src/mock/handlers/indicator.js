/**
 * 演示模式 · 指标库 handler：指标主表 + 参考标准(ref) + 等级(level)
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, stampCreate, stampUpdate, splitIds
} from '../handle'

export const indicatorHandlers = [
  /* ---------------- 参考标准 ---------------- */
  route('get', '/apms/indicator/ref/list/:indicatorId', (ctx) => {
    const rows = getDb().indicatorRefs
      .filter(r => String(r.indicatorId) === ctx.params.indicatorId)
      .map(r => ({ ...r, levels: null }))
    return listData(rows)
  }),

  route('post', '/apms/indicator/ref', (ctx) => {
    const row = { ...ctx.body, id: nextId(), levels: null }
    stampCreate(row)
    getDb().indicatorRefs.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/indicator/ref', (ctx) => {
    const row = getDb().indicatorRefs.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '参考标准不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/indicator/ref/:refId', (ctx) => {
    const db = getDb()
    const id = Number(ctx.params.refId)
    db.indicatorRefs = db.indicatorRefs.filter(r => Number(r.id) !== id)
    db.indicatorLevels = db.indicatorLevels.filter(l => Number(l.refId) !== id)
    return ok('删除成功')
  }),

  /* ---------------- 等级 ---------------- */
  route('get', '/apms/indicator/level/list/:refId', (ctx) => {
    const rows = getDb().indicatorLevels
      .filter(r => String(r.refId) === ctx.params.refId)
      .sort((a, b) => Number(a.minValue) - Number(b.minValue))
    return listData(rows)
  }),

  route('post', '/apms/indicator/level', (ctx) => {
    const row = { ...ctx.body, id: nextId() }
    stampCreate(row)
    getDb().indicatorLevels.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/indicator/level', (ctx) => {
    const row = getDb().indicatorLevels.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '等级不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/indicator/level/:levelId', (ctx) => {
    const id = Number(ctx.params.levelId)
    getDb().indicatorLevels = getDb().indicatorLevels.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  /* ---------------- 指标主表 ---------------- */
  route('get', '/apms/indicator/list', (ctx) => {
    const q = ctx.query
    // 列表行内 refs 较大，分页列表去掉内联 refs（详情接口仍返回）
    const rows = getDb().indicators.map(({ refs, ...rest }) => rest)
    return pageRows(rows, q, [
      { key: 'code', mode: 'like', value: q.code },
      { key: 'name', mode: 'like', value: q.name },
      { key: 'category', value: q.category },
      { key: 'evaluationDirection', value: q.evaluationDirection }
    ])
  }),

  route('post', '/apms/indicator', (ctx) => {
    const row = { ...ctx.body, id: nextId(), refs: [] }
    stampCreate(row)
    getDb().indicators.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/indicator', (ctx) => {
    const row = getDb().indicators.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '指标不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/indicator/:ids', (ctx) => {
    const ids = splitIds(ctx.params.ids)
    const db = getDb()
    db.indicators = db.indicators.filter(r => !ids.includes(Number(r.id)))
    // 连带参考标准/等级一并清掉，避免脏引用
    const refIds = db.indicatorRefs
      .filter(r => ids.includes(Number(r.indicatorId))).map(r => Number(r.id))
    db.indicatorRefs = db.indicatorRefs.filter(r => !ids.includes(Number(r.indicatorId)))
    if (refIds.length) {
      db.indicatorLevels = db.indicatorLevels.filter(l => !refIds.includes(Number(l.refId)))
    }
    return ok('删除成功')
  }),

  route('get', '/apms/indicator/:id', (ctx) => {
    const row = getDb().indicators.find(r => String(r.id) === ctx.params.id)
    if (!row) return { code: 601, msg: '指标不存在' }
    // 详情组装 refs（含 levels），与真实 GET /:id 形状一致
    const refs = getDb().indicatorRefs
      .filter(x => Number(x.indicatorId) === Number(row.id))
      .map(x => ({
        ...x,
        levels: getDb().indicatorLevels.filter(l => Number(l.refId) === Number(x.id))
      }))
    return detail({ ...row, refs })
  })
]
