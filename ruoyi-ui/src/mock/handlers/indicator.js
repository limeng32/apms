/**
 * 演示模式 · 指标库 handler：指标主表 + 参考标准(ref) + 等级(level)
 * 校验口径与正式后端 ApmsIndicatorServiceImpl / IndicatorRefLevelValidator 保持一致，
 * 避免演示环境比正式环境宽松而掩盖配置错误。
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, stampCreate, stampUpdate, splitIds
} from '../handle'

const fail = msg => ({ code: 601, msg })
const trimToNull = s => (s == null || String(s).trim() === '') ? null : String(s).trim()
const num = v => (v == null || v === '' ? null : Number(v))

/** 评级组校验：名称非空≤32、大小写不敏感去重、填齐时 min<max、相邻区间不重叠 */
function validateLevels(levels) {
  const seen = new Set()
  for (const lv of levels) {
    const name = trimToNull(lv.level)
    if (!name) return fail('存在评级名称为空的条目')
    if (name.length > 32) return fail(`评级名称 [${name}] 超过 32 个字符`)
    const key = name.toUpperCase()
    if (seen.has(key)) return fail(`评级枚举值重复：${name}（大小写不敏感）`)
    seen.add(key)
    const min = num(lv.minValue), max = num(lv.maxValue)
    if (min != null && max != null && min >= max) {
      return fail(`评级 [${name}] 的下限(${min}) 必须小于上限(${max})`)
    }
  }
  const sorted = [...levels].sort((a, b) => {
    const ma = num(a.minValue), mb = num(b.minValue)
    if (ma == null) return -1
    if (mb == null) return 1
    return ma - mb
  })
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    const amax = num(a.maxValue), bmin = num(b.minValue)
    if (amax == null || bmin == null) continue
    if (amax > bmin) return fail(`评级 [${a.level}] 与 [${b.level}] 区间重叠`)
  }
  return null
}

export const indicatorHandlers = [
  /* ---------------- 参考标准 ---------------- */
  route('get', '/apms/indicator/ref/list/:indicatorId', (ctx) => {
    const rows = getDb().indicatorRefs
      .filter(r => String(r.indicatorId) === ctx.params.indicatorId)
      .map(r => ({ ...r, levels: null }))
    return listData(rows)
  }),

  route('post', '/apms/indicator/ref', (ctx) => {
    const body = ctx.body || {}
    if (body.indicatorId == null) return fail('参考范围必须归属一个指标')
    body.gender = trimToNull(body.gender)?.toUpperCase() ?? null
    body.ageGroup = trimToNull(body.ageGroup)?.toUpperCase() ?? null
    body.modelVersion = trimToNull(body.modelVersion)
    const min = num(body.refMin), max = num(body.refMax)
    body.refMin = min; body.refMax = max
    if (min != null && max != null && min > max) return fail('参考下限不能大于参考上限')
    const dup = getDb().indicatorRefs.some(r =>
      String(r.indicatorId) === String(body.indicatorId)
      && trimToNull(r.gender) === body.gender
      && trimToNull(r.ageGroup) === body.ageGroup)
    if (dup) return fail('该指标下已存在相同性别/年龄组口径的参考范围')
    const row = { ...body, id: nextId(), levels: null }
    stampCreate(row)
    getDb().indicatorRefs.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/indicator/ref', (ctx) => {
    const row = getDb().indicatorRefs.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return fail('参考范围不存在')
    const body = ctx.body || {}
    body.gender = trimToNull(body.gender)?.toUpperCase() ?? null
    body.ageGroup = trimToNull(body.ageGroup)?.toUpperCase() ?? null
    body.modelVersion = trimToNull(body.modelVersion)
    const min = num(body.refMin), max = num(body.refMax)
    body.refMin = min; body.refMax = max
    if (min != null && max != null && min > max) return fail('参考下限不能大于参考上限')
    const dup = getDb().indicatorRefs.some(r =>
      String(r.id) !== String(row.id)
      && String(r.indicatorId) === String(row.indicatorId)
      && trimToNull(r.gender) === body.gender
      && trimToNull(r.ageGroup) === body.ageGroup)
    if (dup) return fail('该指标下已存在相同性别/年龄组口径的参考范围')
    Object.assign(row, body)
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
      .sort((a, b) => (num(a.minValue) ?? -Infinity) - (num(b.minValue) ?? -Infinity))
    return listData(rows)
  }),

  route('post', '/apms/indicator/level', (ctx) => {
    const body = ctx.body || {}
    if (body.refId == null) return fail('评级必须归属一个参考范围')
    const name = trimToNull(body.level)
    if (!name) return fail('评级名称不能为空')
    body.level = name.toUpperCase()
    body.minValue = num(body.minValue)
    body.maxValue = num(body.maxValue)
    const all = getDb().indicatorLevels.filter(r => String(r.refId) === String(body.refId))
    const err = validateLevels([...all, body])
    if (err) return err
    const row = { ...body, id: nextId() }
    stampCreate(row)
    getDb().indicatorLevels.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/indicator/level', (ctx) => {
    const row = getDb().indicatorLevels.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return fail('评级条目不存在或已被删除')
    const body = ctx.body || {}
    const name = trimToNull(body.level)
    if (!name) return fail('评级名称不能为空')
    body.level = name.toUpperCase()
    body.minValue = num(body.minValue)
    body.maxValue = num(body.maxValue)
    const others = getDb().indicatorLevels
      .filter(r => String(r.refId) === String(row.refId) && String(r.id) !== String(row.id))
    const err = validateLevels([...others, body])
    if (err) return err
    Object.assign(row, body)
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
    const body = ctx.body || {}
    if (!trimToNull(body.code)) return fail('指标编码不能为空')
    if (!trimToNull(body.name)) return fail('指标名称不能为空')
    if (!trimToNull(body.evaluationDirection)) return fail('评价方向不能为空')
    body.code = body.code.trim().toUpperCase()
    if (getDb().indicators.some(r => String(r.code).toUpperCase() === body.code)) {
      return fail(`指标编码 [${body.code}] 已存在`)
    }
    const row = { ...body, name: body.name.trim(), status: body.status ?? '0', id: nextId(), refs: [] }
    stampCreate(row)
    getDb().indicators.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/indicator', (ctx) => {
    const row = getDb().indicators.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return fail('指标不存在或已被删除')
    const body = ctx.body || {}
    if (!trimToNull(body.name)) return fail('指标名称不能为空')
    if (!trimToNull(body.evaluationDirection)) return fail('评价方向不能为空')
    Object.assign(row, body, { code: row.code, name: body.name.trim() })
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
    if (!row) return fail('指标不存在')
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
