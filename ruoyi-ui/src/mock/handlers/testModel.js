/**
 * 演示模式 · 测试模型库 handler：模型主表 + 字段(field)
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, stampCreate, stampUpdate, splitIds
} from '../handle'

export const testModelHandlers = [
  /* ---------------- 字段 ---------------- */
  route('get', '/apms/test-model/field/list/:modelId', (ctx) => {
    const rows = getDb().testFields
      .filter(r => String(r.modelId) === ctx.params.modelId)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    return listData(rows)
  }),

  route('post', '/apms/test-model/field', (ctx) => {
    const row = { ...ctx.body, id: nextId() }
    stampCreate(row)
    getDb().testFields.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/test-model/field', (ctx) => {
    const row = getDb().testFields.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '字段不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/test-model/field/:fieldId', (ctx) => {
    const id = Number(ctx.params.fieldId)
    getDb().testFields = getDb().testFields.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  /* ---------------- 派生算法注册表 ---------------- */
  route('get', '/apms/test-model/algorithms', () => {
    return listData([
      { algoId: 'rsa-sdec', displayName: 'RSA 重复冲刺衰减率（Sdec/最佳/平均）' }
    ])
  }),

  /* ---------------- 模型主表 ---------------- */
  route('get', '/apms/test-model/list', (ctx) => {
    const q = ctx.query
    const rows = getDb().testModels.map(({ fields, ...rest }) => rest)
    return pageRows(rows, q, [
      { key: 'code', mode: 'like', value: q.code },
      { key: 'name', mode: 'like', value: q.name },
      { key: 'category', value: q.category }
    ])
  }),

  route('post', '/apms/test-model', (ctx) => {
    const row = { ...ctx.body, id: nextId(), fields: [] }
    stampCreate(row)
    getDb().testModels.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/test-model', (ctx) => {
    const row = getDb().testModels.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '模型不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/test-model/:ids', (ctx) => {
    const ids = splitIds(ctx.params.ids)
    const db = getDb()
    // 引用完整性校验（与后端 ApmsTestModelServiceImpl 对齐）：任一模型被引用即整批拒绝
    for (const id of ids) {
      const refs = []
      const comboCnt = db.comboModels.filter(m => Number(m.modelId) === Number(id)).length
      if (comboCnt) refs.push(comboCnt + ' 个组合评分方案')
      const itemCnt = db.taskItems.filter(i => Number(i.modelId) === Number(id)).length
      if (itemCnt) refs.push(itemCnt + ' 个测试任务测试项')
      const resultCnt = db.testResults.filter(r => Number(r.modelId) === Number(id)).length
      if (resultCnt) refs.push(resultCnt + ' 条历史测试成绩')
      if (refs.length) {
        const m = db.testModels.find(r => Number(r.id) === Number(id))
        const label = m ? `${m.code}（${m.name}）` : String(id)
        return { code: 601, msg: `测试模型「${label}」正被 ${refs.join('、')} 引用，请先移除引用后再删除` }
      }
    }
    db.testModels = db.testModels.filter(r => !ids.includes(Number(r.id)))
    db.testFields = db.testFields.filter(f => !ids.includes(Number(f.modelId)))
    return ok('删除成功')
  }),

  route('get', '/apms/test-model/:id', (ctx) => {
    const row = getDb().testModels.find(r => String(r.id) === ctx.params.id)
    if (!row) return { code: 601, msg: '模型不存在' }
    const fields = getDb().testFields
      .filter(f => Number(f.modelId) === Number(row.id))
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    return detail({ ...row, fields })
  })
]
