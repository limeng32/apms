/**
 * 演示模式 · 医疗记录 handler（主表 + 附件元数据）
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

export const medicalHandlers = [
  // 附件删除（3 段路径，先于 /:id 匹配：与 /:id 段数不同，天然不冲突）
  route('delete', '/apms/medical-record/file/:fileId', (ctx) => {
    const id = Number(ctx.params.fileId)
    getDb().medicalFiles = getDb().medicalFiles.filter(f => Number(f.id) !== id)
    return ok('附件已删除')
  }),

  route('get', '/apms/medical-record/list', (ctx) => {
    const q = ctx.query
    return pageRows(getDb().medicals, q, [
      { key: 'athleteId', value: q.athleteId },
      { key: 'recordType', value: q.recordType },
      { key: 'title', mode: 'like', value: q.title }
    ])
  }),

  route('post', '/apms/medical-record', (ctx) => {
    const b = ctx.body || {}
    const row = { ...athleteMeta(b.athleteId), ...b, id: nextId() }
    stampCreate(row)
    getDb().medicals.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/medical-record', (ctx) => {
    const row = getDb().medicals.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '记录不存在' }
    Object.assign(row, athleteMeta(ctx.body.athleteId), ctx.body)
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
