/**
 * 演示模式 · 组合模型库 handler：组合模型主表 + 成分(component)
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, stampCreate, stampUpdate, splitIds
} from '../handle'

export const comboModelHandlers = [
  /* ---------------- 成分 ---------------- */
  route('get', '/apms/combo-model/component/list/:comboModelId', (ctx) => {
    const rows = getDb().comboComponents
      .filter(r => String(r.comboModelId) === ctx.params.comboModelId)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    return listData(rows)
  }),

  route('post', '/apms/combo-model/component', (ctx) => {
    const row = { ...ctx.body, id: nextId() }
    stampCreate(row)
    getDb().comboComponents.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/combo-model/component', (ctx) => {
    const row = getDb().comboComponents.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '成分不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/combo-model/component/:componentId', (ctx) => {
    const id = Number(ctx.params.componentId)
    getDb().comboComponents = getDb().comboComponents.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  /* ---------------- 组合模型主表 ---------------- */
  route('get', '/apms/combo-model/list', (ctx) => {
    // 列表不内联 components
    const rows = getDb().comboModels.map(({ components, ...rest }) => rest)
    return pageRows(rows, ctx.query)
  }),

  route('post', '/apms/combo-model', (ctx) => {
    const row = { ...ctx.body, id: nextId(), components: [] }
    stampCreate(row)
    getDb().comboModels.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/combo-model', (ctx) => {
    const row = getDb().comboModels.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '组合模型不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/combo-model/:ids', (ctx) => {
    const ids = splitIds(ctx.params.ids)
    const db = getDb()
    db.comboModels = db.comboModels.filter(r => !ids.includes(Number(r.id)))
    db.comboComponents = db.comboComponents.filter(c => !ids.includes(Number(c.comboModelId)))
    return ok('删除成功')
  }),

  route('get', '/apms/combo-model/:id', (ctx) => {
    const row = getDb().comboModels.find(r => String(r.id) === ctx.params.id)
    if (!row) return { code: 601, msg: '组合模型不存在' }
    const components = getDb().comboComponents
      .filter(c => Number(c.comboModelId) === Number(row.id))
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    return detail({ ...row, components })
  })
]
