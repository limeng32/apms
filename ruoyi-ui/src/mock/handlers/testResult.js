/**
 * 演示模式 · 测试结果 handler（尝试/最佳选择/按任务清理）
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, stampCreate, stampUpdate
} from '../handle'

function primaryValue(row) {
  const vals = Array.isArray(row.values) ? row.values : []
  const pick = vals.find(v => v.isDerived === '0' && v.fieldKey === 'result') || vals[0]
  const n = Number(pick?.numericValue)
  return Number.isFinite(n) ? n : null
}

/** 同组判定（与后端一致）：任务内按 taskItem+队员；散录按 队员+指标/模型 且 taskItemId 为空 */
function sameGroup(r, ref) {
  if (String(r.athleteId) !== String(ref.athleteId)) return false
  if (ref.taskItemId != null) return String(r.taskItemId) === String(ref.taskItemId)
  return r.taskItemId == null
    && String(r.indicatorId ?? '') === String(ref.indicatorId ?? '')
    && String(r.modelId ?? '') === String(ref.modelId ?? '')
}

/**
 * 同组归一代表记录（与后端 pickRepresentative 一致）：
 * 有方向按方向取极值；无方向（模型）取最新有效测量（日期大、同日 id 大为新）。
 * 返回应被选中的行，并就地更新 isSelected。
 */
function normalizeGroupSelection(all, ref) {
  const group = all.filter(r => sameGroup(r, ref))
  if (!group.length) return null
  const direction = group.find(g => g.indicatorDirection)?.indicatorDirection
  let chosen
  if (direction) {
    const scored = group
      .filter(r => String(r.isValid) !== '0')
      .map(r => ({ r, v: primaryValue(r) }))
      .filter(x => x.v !== null)
    if (!scored.length) return null
    scored.sort((a, b) => direction === 'LOWER_BETTER' ? a.v - b.v : b.v - a.v)
    chosen = scored[0].r
  } else {
    chosen = group
      .filter(r => String(r.isValid) !== '0')
      .sort((a, b) => {
        const da = String(a.measureDate ?? ''), db2 = String(b.measureDate ?? '')
        if (da !== db2) return da < db2 ? 1 : -1
        return a.id < b.id ? 1 : -1 // id 更小=更晚插入（nextId 为负且递减）
      })[0]
  }
  if (chosen) group.forEach(r => { r.isSelected = String(r.id) === String(chosen.id) ? '1' : '0' })
  return chosen || null
}

export const testResultHandlers = [
  route('get', '/apms/test-result/by-task-member', (ctx) => {
    const { taskId, athleteId } = ctx.query
    const rows = getDb().testResults.filter(r =>
      String(r.taskId) === String(taskId) && String(r.athleteId) === String(athleteId))
    return listData(rows)
  }),

  // 散录（不绑任务）同组尝试：同队员 + 同指标/模型
  route('get', '/apms/test-result/by-free-group', (ctx) => {
    const { athleteId, indicatorId, modelId } = ctx.query
    const ref = { athleteId, taskItemId: null, indicatorId: indicatorId ?? null, modelId: modelId ?? null }
    const rows = getDb().testResults.filter(r => sameGroup(r, ref))
    return listData(rows)
  }),

  // 自动选最佳：同任务项+同队员的全部尝试里按方向取极值
  route('post', '/apms/test-result/auto-select', (ctx) => {
    const { taskItemId, athleteId } = ctx.query
    const db = getDb()
    const group = db.testResults.filter(r =>
      String(r.taskItemId) === String(taskItemId) && String(r.athleteId) === String(athleteId))
    if (!group.length) return { code: 601, msg: '没有可选择的尝试' }
    const direction = group[0].indicatorDirection === 'LOWER_BETTER' ? 'LOWER_BETTER' : 'HIGHER_BETTER'
    const scored = group.map(r => ({ r, v: primaryValue(r) })).filter(x => x.v !== null)
    if (!scored.length) return { code: 601, msg: '尝试缺少可比较的数值' }
    scored.sort((a, b) => direction === 'HIGHER_BETTER' ? b.v - a.v : a.v - b.v)
    const bestId = scored[0].r.id
    group.forEach(r => { r.isSelected = String(r.id) === String(bestId) ? '1' : '0' })
    return ok('已自动选择最佳尝试')
  }),

  route('post', '/apms/test-result/select-attempt/:resultId', (ctx) => {
    const db = getDb()
    const target = db.testResults.find(r => String(r.id) === ctx.params.resultId)
    if (!target) return { code: 601, msg: '结果不存在' }
    // 与后端一致：无任务散录按 同队员+同指标/模型（taskItemId 为空）分组；任务内按 taskItemId 分组
    db.testResults.forEach(r => {
      const sameAthlete = String(r.athleteId) === String(target.athleteId)
      const inScope = target.taskItemId == null
        ? sameAthlete && r.taskItemId == null
          && String(r.indicatorId ?? '') === String(target.indicatorId ?? '')
          && String(r.modelId ?? '') === String(target.modelId ?? '')
        : sameAthlete && String(r.taskItemId) === String(target.taskItemId)
      if (inScope) {
        r.isSelected = String(r.id) === String(target.id) ? '1' : '0'
      }
    })
    return ok('已选为最佳')
  }),

  route('delete', '/apms/test-result/task/:taskId', (ctx) => {
    const id = ctx.params.taskId
    getDb().testResults = getDb().testResults.filter(r => String(r.taskId) !== String(id))
    return ok('已清空任务结果')
  }),

  route('get', '/apms/test-result/list', (ctx) => {
    const q = ctx.query
    return pageRows(getDb().testResults, q, [
      { key: 'taskId', value: q.taskId },
      { key: 'athleteId', value: q.athleteId },
      { key: 'itemType', value: q.itemType },
      { key: 'isSelected', value: q.isSelected ?? '1' }
    ])
  }),

  route('post', '/apms/test-result', (ctx) => {
    const payload = ctx.body || {}
    // 契约为 AddBody { result, values }；兼容旧的扁平 body
    const b = payload.result || payload
    const vals = payload.values || []
    const db = getDb()
    const item = db.taskItems.find(i => String(i.id) === String(b.taskItemId))
    const athlete = db.athletes.find(a => String(a.athleteId) === String(b.athleteId))
    const indicator = db.indicators?.find(i => String(i.id) === String(b.indicatorId))
    const model = db.testModels?.find(m => String(m.id) === String(b.modelId))
    const row = {
      ...item ? {
        taskId: item.taskId, taskName: db.testTasks.find(t => t.id === item.taskId)?.taskName,
        itemType: item.itemType, itemSortOrder: item.sortOrder,
        indicatorId: item.indicatorId, indicatorCode: item.indicatorCode,
        indicatorName: item.indicatorName, indicatorDirection: item.indicatorDirection,
        modelId: item.modelId, modelCode: item.modelCode, modelName: item.modelName
      } : {},
      ...indicator ? {
        itemType: 'INDICATOR', indicatorCode: indicator.code, indicatorName: indicator.name,
        indicatorDirection: indicator.evaluationDirection, indicatorUnit: indicator.unit
      } : {},
      ...model ? { itemType: 'MODEL', modelCode: model.code, modelName: model.name } : {},
      ...athlete ? {
        athleteName: athlete.name, athleteGender: athlete.gender, athleteTeam: athlete.teamName
      } : {},
      ...b,
      values: vals.length ? vals : b.values,
      id: nextId(),
      isSelected: b.isSelected ?? '1',
      isValid: b.isValid ?? '1'
    }
    // 同组尝试序号（任务项组 或 散录同队员+同指标/模型组）
    const groupBefore = db.testResults.filter(r => sameGroup(r, row))
    row.attemptNo = b.attemptNo ?? (groupBefore.reduce((m, r) => Math.max(m, Number(r.attemptNo) || 0), 0) + 1)
    stampCreate(row)
    db.testResults.push(row)
    // 默认选中时归一代表：指标按方向判优；模型（无方向）最新一次当选
    if (String(row.isSelected) === '1') normalizeGroupSelection(db.testResults, row)
    return ok('录入成功')
  }),

  route('put', '/apms/test-result', (ctx) => {
    const row = getDb().testResults.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '结果不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/test-result/:id', (ctx) => {
    const id = Number(ctx.params.id)
    getDb().testResults = getDb().testResults.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  route('get', '/apms/test-result/:id', (ctx) => {
    const row = getDb().testResults.find(r => String(r.id) === ctx.params.id)
    return row ? detail(row) : { code: 601, msg: '结果不存在' }
  })
]
