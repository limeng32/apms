/**
 * 演示模式 · PHV 成熟度 handler
 * calculate/calculate-direct 用 Mirwald 2014 简化式现算并落内存行；
 * 演示数值仅用于图表渲染，不做临床依据。
 */
import {
  getDb, route, ok, detail, listData,
  nextId, stampCreate
} from '../handle'

function athleteOf(id) {
  return getDb().athletes.find(a => String(a.athleteId) === String(id))
}

function normGender(g) {
  if (g === '1') return 'F'
  if (g === '0') return 'M'
  return String(g || '').toUpperCase() === 'F' ? 'F' : 'M'
}

function decimalAge(birthday, measureDate) {
  if (!birthday) return null
  const b = new Date(birthday), m = new Date(measureDate)
  if (isNaN(b) || isNaN(m)) return null
  return Number(((m - b) / (365.2425 * 24 * 3600 * 1000)).toFixed(4))
}

/**
 * Mirwald (2002/2014) 成熟度偏移简化式
 * 返回距 PHV 的年数：负=尚未到身高速增高峰，正=已过
 */
function mirwald({ age, height, sitHeight, weight, gender }) {
  const legLength = height - sitHeight
  let phv
  if (gender === 'F') {
    phv = -12.636
      + 0.0001882 * (legLength * sitHeight)
      - 0.0022 * (age * legLength)
      + 0.005841 * (age * sitHeight)
      + 0.00265 * (age * weight)
      + 0.07693 * ((weight / height) * 100)
  } else {
    phv = -29.769
      + 0.0003007 * (legLength * sitHeight)
      - 0.01177 * (age * legLength)
      + 0.01639 * (age * sitHeight)
      + 0.445 * (legLength / height)
  }
  return Number(phv.toFixed(4))
}

function adultEstimate(height, maturityOffset) {
  // 演示用的粗略外推：距 PHV 越远，剩余生长空间越多
  const factor = maturityOffset >= 0
    ? 1.005
    : 1 + Math.min(0.12, 0.035 * Math.max(0, -maturityOffset))
  return Math.round(height * factor * 10) / 10
}

function enrich(p) {
  const a = athleteOf(p.athleteId)
  return { ...p, athleteName: a?.name ?? null, athleteTeam: a?.teamName ?? null }
}

function buildAndSave({ athleteId, height, sitHeight, weight, gender, measureDate,
  fatherHeight, motherHeight, sourceMeasureId, extra = {} }) {
  const db = getDb()
  const athlete = athleteOf(athleteId)
  const g = normGender(gender ?? athlete?.gender)
  const age = decimalAge(athlete?.birthday, measureDate)
    ?? (athlete?.age != null ? Number(athlete.age) : null)
  const offset = (age != null && height != null && sitHeight != null && weight != null)
    ? -mirwald({ age, height, sitHeight, weight, gender: g })
    : null
  const predictedPhvAge = offset != null && age != null ? Number((age - offset).toFixed(4)) : null
  const row = {
    id: nextId(),
    athleteId: Number(athleteId),
    deptId: athlete?.primaryTeamId ?? null,
    gender: g,
    measureDate,
    height: height != null ? Number(height) : null,
    sitHeight: sitHeight != null ? Number(sitHeight) : null,
    legLength: height != null && sitHeight != null
      ? Number((height - sitHeight).toFixed(1)) : null,
    weight: weight != null ? Number(weight) : null,
    decimalAge: age,
    maturityOffset: offset,
    predictedPhvAge,
    predictedAdultHeight: height != null && offset != null ? adultEstimate(Number(height), offset) : null,
    fatherHeight: fatherHeight ?? null,
    motherHeight: motherHeight ?? null,
    mirwaldVersion: '2014.1',
    khamisVersion: null,
    sourceMeasureId: sourceMeasureId ?? null,
    inputSnapshot: JSON.stringify({ height, sitHeight, weight, gender: g }),
    params: { method: sourceMeasureId != null ? 'measure' : 'direct' },
    ...extra
  }
  stampCreate(row)
  db.phvs.unshift(row)
  return enrich(row)
}

export const phvHandlers = [
  route('get', '/apms/phv/athlete/:athleteId/latest', (ctx) => {
    const row = getDb().phvs
      .filter(r => String(r.athleteId) === ctx.params.athleteId)
      .sort((a, b) => (b.measureDate || '').localeCompare(a.measureDate || ''))[0]
    return detail(row ? enrich(row) : null)
  }),

  route('get', '/apms/phv/list', (ctx) => {
    const q = ctx.query
    const rows = getDb().phvs
      .filter(r => q.athleteId === undefined || q.athleteId === ''
        || String(r.athleteId) === String(q.athleteId))
      .sort((a, b) => (b.measureDate || '').localeCompare(a.measureDate || ''))
      .map(enrich)
    return listData(rows)
  }),

  route('get', '/apms/phv/athlete/:athleteId', (ctx) => {
    const rows = getDb().phvs
      .filter(r => String(r.athleteId) === ctx.params.athleteId)
      .sort((a, b) => (b.measureDate || '').localeCompare(a.measureDate || ''))
      .map(enrich)
    return listData(rows)
  }),

  // 由体态测量记录计算（参数走 query）
  route('post', '/apms/phv/calculate', (ctx) => {
    const { athleteId, measureId } = ctx.query
    const m = getDb().bodyMeasures.find(x => String(x.id) === String(measureId))
    if (!m) return { code: 601, msg: '体态测量记录不存在' }
    const row = buildAndSave({
      athleteId: athleteId ?? m.athleteId,
      height: m.height, sitHeight: m.sitHeight, weight: m.weight,
      measureDate: m.measureDate, sourceMeasureId: m.id
    })
    return detail(row)
  }),

  // 手动直填计算
  route('post', '/apms/phv/calculate-direct', (ctx) => {
    const b = ctx.body || {}
    if (b.athleteId == null || b.height == null || b.sitHeight == null) {
      return { code: 601, msg: '运动员、身高、坐高必填' }
    }
    const row = buildAndSave({
      athleteId: b.athleteId,
      height: b.height, sitHeight: b.sitHeight, weight: b.weight,
      gender: b.gender, measureDate: b.measureDate || new Date().toISOString().slice(0, 10),
      fatherHeight: b.fatherHeight, motherHeight: b.motherHeight,
      extra: { remark: b.remark ?? null }
    })
    return detail(row)
  }),

  route('delete', '/apms/phv/:id', (ctx) => {
    const id = Number(ctx.params.id)
    getDb().phvs = getDb().phvs.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  route('get', '/apms/phv/:id', (ctx) => {
    const row = getDb().phvs.find(r => String(r.id) === ctx.params.id)
    return row ? detail(enrich(row)) : { code: 601, msg: 'PHV 记录不存在' }
  })
]
