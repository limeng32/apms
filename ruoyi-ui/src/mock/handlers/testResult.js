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

export const testResultHandlers = [
  route('get', '/apms/test-result/by-task-member', (ctx) => {
    const { taskId, athleteId } = ctx.query
    const rows = getDb().testResults.filter(r =>
      String(r.taskId) === String(taskId) && String(r.athleteId) === String(athleteId))
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
    db.testResults.forEach(r => {
      if (String(r.taskItemId) === String(target.taskItemId)
        && String(r.athleteId) === String(target.athleteId)) {
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
    const b = ctx.body || {}
    const db = getDb()
    const siblings = db.testResults.filter(r =>
      String(r.taskItemId) === String(b.taskItemId) && String(r.athleteId) === String(b.athleteId))
    const item = db.taskItems.find(i => String(i.id) === String(b.taskItemId))
    const athlete = db.athletes.find(a => String(a.athleteId) === String(b.athleteId))
    const row = {
      ...item ? {
        taskId: item.taskId, taskName: db.testTasks.find(t => t.id === item.taskId)?.taskName,
        itemType: item.itemType, itemSortOrder: item.sortOrder,
        indicatorId: item.indicatorId, indicatorCode: item.indicatorCode,
        indicatorName: item.indicatorName, indicatorDirection: item.indicatorDirection,
        modelId: item.modelId, modelCode: item.modelCode, modelName: item.modelName
      } : {},
      ...athlete ? {
        athleteName: athlete.name, athleteGender: athlete.gender, athleteTeam: athlete.teamName
      } : {},
      ...b,
      id: nextId(),
      attemptNo: b.attemptNo ?? (siblings.length + 1),
      isSelected: b.isSelected ?? '0',
      isValid: b.isValid ?? '1'
    }
    stampCreate(row)
    db.testResults.push(row)
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
