/**
 * 演示模式 · 医疗记录 handler（主表 + 附件元数据 + 伤病部位分布）
 * 附件下载/上传在视图与共享组件层已禁用，这里只维护元数据。
 */
import {
  getDb, route, ok, detail, pageRows,
  nextId, stampCreate, stampUpdate
} from '../handle'

function athleteMeta(id) {
  const a = getDb().athletes.find(x => String(x.athleteId) === String(id))
  return a
    ? { athleteName: a.name, athleteGender: a.gender, athleteTeam: a.teamName }
    : {}
}

/** 伤病闭环口径（与后端一致）：其后（含同日）存在康复/复查记录即已康复 */
function isClosed(rec, all) {
  return all.some(r =>
    r.athleteId === rec.athleteId
    && ['rehabilitation', 'checkup'].includes(r.recordType)
    && r.recordDate >= rec.recordDate)
}

/** 伤病部位分布统计：range=12m（默认）/ all */
function siteStats(range) {
  const rows = getDb().medicals
  const since = range === 'all' ? null
    : new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const map = new Map()
  for (const r of rows) {
    if (!['injury', 'surgery'].includes(r.recordType) || !r.bodySite) continue
    if (since && r.recordDate < since) continue
    const b = map.get(r.bodySite) || { site: r.bodySite, total: 0, active: 0 }
    b.total += 1
    if (!isClosed(r, rows)) b.active += 1
    map.set(r.bodySite, b)
  }
  return [...map.values()].sort((a, b) => b.active - a.active || b.total - a.total)
}

export const medicalHandlers = [
  // 附件删除（3 段路径，先于 /:id 匹配：与 /:id 段数不同，天然不冲突）
  route('delete', '/apms/medical-record/file/:fileId', (ctx) => {
    const id = Number(ctx.params.fileId)
    getDb().medicalFiles = getDb().medicalFiles.filter(f => Number(f.id) !== id)
    return ok('附件已删除')
  }),

  // 精确路由先于 /:id 注册
  route('get', '/apms/medical-record/site-stats', (ctx) => detail(siteStats(ctx.query.range))),

  route('get', '/apms/medical-record/list', (ctx) => {
    const q = ctx.query
    return pageRows(getDb().medicals, q, [
      { key: 'athleteId', value: q.athleteId },
      { key: 'recordType', value: q.recordType },
      { key: 'bodySite', value: q.bodySite },
      { key: 'title', mode: 'like', value: q.title }
    ])
  }),

  route('post', '/apms/medical-record', (ctx) => {
    // 契约体为 { record, files }；兼容扁平 body
    const b = ctx.body?.record || ctx.body || {}
    // 与后端同口径：损伤/手术必须有部位，其他类型部位清空
    if (['injury', 'surgery'].includes(b.recordType) && !b.bodySite) {
      return { code: 601, msg: '损伤/手术记录必须选择伤病部位' }
    }
    if (!['injury', 'surgery'].includes(b.recordType)) b.bodySite = null
    const row = { ...athleteMeta(b.athleteId), ...b, id: nextId() }
    stampCreate(row)
    getDb().medicals.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/medical-record', (ctx) => {
    const b = ctx.body?.record || ctx.body || {}
    const row = getDb().medicals.find(r => String(r.id) === String(b.id))
    if (!row) return { code: 601, msg: '记录不存在' }
    if (['injury', 'surgery'].includes(b.recordType) && !b.bodySite) {
      return { code: 601, msg: '损伤/手术记录必须选择伤病部位' }
    }
    if (!['injury', 'surgery'].includes(b.recordType)) b.bodySite = null
    Object.assign(row, athleteMeta(b.athleteId), b)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/medical-record/:ids', (ctx) => {
    const ids = String(ctx.params.ids).split(',').map(s => Number(s.trim())).filter(Boolean)
    const db = getDb()
    db.medicals = db.medicals.filter(r => !ids.includes(Number(r.id)))
    db.medicalFiles = db.medicalFiles.filter(f => !ids.includes(Number(f.recordId)))
    return ok('删除成功')
  }),

  route('get', '/apms/medical-record/:id', (ctx) => {
    const row = getDb().medicals.find(r => String(r.id) === ctx.params.id)
    if (!row) return { code: 601, msg: '记录不存在' }
    const files = getDb().medicalFiles.filter(f => String(f.recordId) === ctx.params.id)
    return detail({ ...row, files })
  })
]
