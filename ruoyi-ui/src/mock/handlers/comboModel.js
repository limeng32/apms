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
    const db = getDb()
    const body = { ...ctx.body }
    let modelId = body.modelId
    let testModelCode = body.testModelCode || null
    let testModelName = body.testModelName || null

    // 方案名称必填（与后端 normalizeLabel 对齐）
    const versionLabel = String(body.versionLabel || '').trim()
    if (!versionLabel) return { code: 601, msg: '请输入方案名称' }

    // 新建组合体系模式：先在 testModels 内创建 is_combo=1 载体（与后端事务语义对齐，mock 单线程无回滚需求）
    if (body.newModelCode || body.newModelName) {
      const code = String(body.newModelCode || '').trim()
      const name = String(body.newModelName || '').trim()
      if (!code || !name) return { code: 601, msg: '组合体系的编码和名称均不能为空' }
      if (db.testModels.some(m => m.code === code)) {
        return { code: 601, msg: '模型编码已存在：' + code }
      }
      const carrier = {
        id: nextId(), category: '组合', code, name, protocol: '',
        isCombo: '1', algoVersion: body.algoVersion || null, algoId: null,
        status: '0', fields: null
      }
      stampCreate(carrier)
      db.testModels.push(carrier)
      modelId = carrier.id
      testModelCode = carrier.code
      testModelName = carrier.name
      delete body.newModelCode
      delete body.newModelName
    } else {
      // 关联模式：从 testModels 反查 code/name，保证列表（mock 无 JOIN）显示完整
      const linked = db.testModels.find(m => String(m.id) === String(modelId))
      if (!linked) return { code: 601, msg: '关联的测试模型不存在' }
      if (linked.isCombo !== '1') return { code: 601, msg: '所选测试模型不是组合类模型（is_combo=1），无法关联' }
      testModelCode = linked.code
      testModelName = linked.name
    }

    // 默认互斥：显式要求或该载体尚无默认时置默认，并清同载体其他行
    const hasDefault = db.comboModels.some(m => String(m.modelId) === String(modelId) && m.isDefault === '1')
    const isDefault = (body.isDefault === '1' || !hasDefault) ? '1' : '0'
    if (isDefault === '1') {
      db.comboModels.forEach(m => {
        if (String(m.modelId) === String(modelId)) m.isDefault = '0'
      })
    }

    const row = {
      ...body, id: nextId(), modelId, testModelCode, testModelName,
      versionLabel, status: body.status === '1' ? '1' : '0', isDefault, components: []
    }
    stampCreate(row)
    db.comboModels.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/combo-model', (ctx) => {
    const db = getDb()
    const row = db.comboModels.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '组合模型不存在' }
    const body = { ...ctx.body }
    const label = String(body.versionLabel || '').trim()
    if (!label) return { code: 601, msg: '请输入方案名称' }
    // 停用保护：默认方案不能直接停用
    if (body.status === '1' && row.isDefault === '1') {
      return { code: 601, msg: '默认方案不能停用，请先将同体系下其他方案设为默认' }
    }
    // 默认互斥 + 末位默认保护
    if (body.isDefault === '1') {
      db.comboModels.forEach(m => {
        if (String(m.modelId) === String(row.modelId) && String(m.id) !== String(row.id)) {
          m.isDefault = '0'
        }
      })
      body.isDefault = '1'
    } else if (row.isDefault === '1') {
      return { code: 601, msg: '该体系下必须保留一个默认方案，请先将其他方案设为默认' }
    } else {
      body.isDefault = '0'
    }
    Object.assign(row, body, { status: body.status === '1' ? '1' : '0', versionLabel: label })
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/combo-model/:ids', (ctx) => {
    const ids = splitIds(ctx.params.ids)
    const db = getDb()
    // 历史评分引用校验（与后端 ApmsComboModelServiceImpl 对齐）：有评分的方案拒绝物理删除
    for (const id of ids) {
      const scoreCnt = db.comboScores.filter(s => Number(s.comboModelId) === Number(id)).length
      if (scoreCnt) {
        const m = db.comboModels.find(r => Number(r.id) === Number(id))
        const label = m && m.versionLabel ? m.versionLabel : String(id)
        return {
          code: 601,
          msg: `评分方案「${label}」已产生 ${scoreCnt} 条历史评分记录，不能删除；如不再使用请改为「停用」，历史评分将保留可追溯`
        }
      }
    }
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
