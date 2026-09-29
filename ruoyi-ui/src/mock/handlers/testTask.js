/**
 * 演示模式 · 测试任务 handler：任务主表 + 测试项(item) + 参赛成员(member)
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, stampCreate, stampUpdate, splitIds
} from '../handle'

function athleteRow(athleteId) {
  return getDb().athletes.find(a => Number(a.athleteId) === Number(athleteId))
}

function buildMemberRow(taskId, athleteId, status = 'enrolled') {
  const a = athleteRow(athleteId)
  return {
    taskId: Number(taskId),
    athleteId: Number(athleteId),
    athleteName: a?.name ?? null,
    athleteGender: a?.gender ?? null,
    athleteTeam: a?.teamName ?? null,
    status
  }
}

function refreshTaskStats(taskId) {
  const t = getDb().testTasks.find(x => Number(x.id) === Number(taskId))
  if (!t) return
  const members = getDb().taskMembers.filter(m => Number(m.taskId) === Number(taskId))
  let completed = 0, partial = 0, pending = 0
  members.forEach(m => {
    if (m.status === 'completed') completed++
    else if (m.status === 'partial') partial++
    else pending++
  })
  t.memberTotal = members.length
  t.memberCompleted = completed
  t.memberPartial = partial
  t.memberPending = pending
  t.progressPercent = members.length
    ? Math.round(((completed + partial * 0.5) / members.length) * 100)
    : 0
}

export const testTaskHandlers = [
  /* ---------------- 测试项 ---------------- */
  route('get', '/apms/test-task/item/list/:taskId', (ctx) => {
    const rows = getDb().taskItems
      .filter(r => String(r.taskId) === ctx.params.taskId)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    return listData(rows)
  }),

  route('post', '/apms/test-task/item', (ctx) => {
    const row = { ...ctx.body, id: nextId() }
    // 指标/模型名冗余回填，保证新增项在页面上立即有展示名
    if (row.itemType === 'INDICATOR' && row.indicatorId != null) {
      const ind = getDb().indicators.find(i => Number(i.id) === Number(row.indicatorId))
      if (ind) Object.assign(row, {
        indicatorCode: row.indicatorCode ?? ind.code,
        indicatorName: row.indicatorName ?? ind.name,
        indicatorDirection: row.indicatorDirection ?? ind.evaluationDirection
      })
    }
    if (row.itemType === 'MODEL' && row.modelId != null) {
      const m = getDb().testModels.find(x => Number(x.id) === Number(row.modelId))
      if (m) Object.assign(row, {
        modelCode: row.modelCode ?? m.code,
        modelName: row.modelName ?? m.name
      })
    }
    stampCreate(row)
    getDb().taskItems.push(row)
    return ok('新增成功')
  }),

  route('put', '/apms/test-task/item', (ctx) => {
    const row = getDb().taskItems.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '测试项不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/test-task/item/:itemId', (ctx) => {
    const id = Number(ctx.params.itemId)
    getDb().taskItems = getDb().taskItems.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  /* ---------------- 参赛成员 ---------------- */
  route('get', '/apms/test-task/member/list/:taskId', (ctx) => {
    return listData(getDb().taskMembers.filter(m => String(m.taskId) === ctx.params.taskId))
  }),

  route('post', '/apms/test-task/member/enroll', (ctx) => {
    const db = getDb()
    const b = ctx.body || {}
    const exists = db.taskMembers.find(m =>
      Number(m.taskId) === Number(b.taskId) && Number(m.athleteId) === Number(b.athleteId))
    if (exists) return { code: 601, msg: '该队员已在任务名单中' }
    db.taskMembers.push(buildMemberRow(b.taskId, b.athleteId, b.status || 'enrolled'))
    refreshTaskStats(b.taskId)
    return ok('登记成功')
  }),

  route('post', '/apms/test-task/member/batch-enroll', (ctx) => {
    const db = getDb()
    const taskId = ctx.query.taskId
    const ids = Array.isArray(ctx.body) ? ctx.body : []
    let added = 0
    ids.forEach(id => {
      const exists = db.taskMembers.find(m =>
        Number(m.taskId) === Number(taskId) && Number(m.athleteId) === Number(id))
      if (!exists) {
        db.taskMembers.push(buildMemberRow(taskId, id))
        added++
      }
    })
    refreshTaskStats(taskId)
    return ok(`已登记 ${added} 人`)
  }),

  route('put', '/apms/test-task/member/status', (ctx) => {
    const b = ctx.body || {}
    const m = getDb().taskMembers.find(x =>
      Number(x.taskId) === Number(b.taskId) && Number(x.athleteId) === Number(b.athleteId))
    if (!m) return { code: 601, msg: '成员不存在' }
    m.status = b.status
    stampUpdate(m)
    refreshTaskStats(b.taskId)
    return ok('状态已更新')
  }),

  route('delete', '/apms/test-task/member', (ctx) => {
    const { taskId, athleteId } = ctx.query
    getDb().taskMembers = getDb().taskMembers.filter(m =>
      !(Number(m.taskId) === Number(taskId) && Number(m.athleteId) === Number(athleteId)))
    refreshTaskStats(taskId)
    return ok('已移出')
  }),

  /* ---------------- 任务主表 ---------------- */
  route('get', '/apms/test-task/list', (ctx) => {
    const q = ctx.query
    const rows = getDb().testTasks.map(({ items, members, ...rest }) => rest)
    return pageRows(rows, q, [
      { key: 'taskName', mode: 'like', value: q.taskName },
      { key: 'status', value: q.status }
    ])
  }),

  route('post', '/apms/test-task', (ctx) => {
    const row = {
      ...ctx.body,
      id: nextId(),
      memberTotal: 0, memberCompleted: 0, memberPartial: 0, memberPending: 0,
      progressPercent: 0
    }
    stampCreate(row)
    getDb().testTasks.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/test-task', (ctx) => {
    const row = getDb().testTasks.find(r => String(r.id) === String(ctx.body.id))
    if (!row) return { code: 601, msg: '任务不存在' }
    Object.assign(row, ctx.body)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/test-task/:ids', (ctx) => {
    const ids = splitIds(ctx.params.ids)
    const db = getDb()
    db.testTasks = db.testTasks.filter(r => !ids.includes(Number(r.id)))
    db.taskItems = db.taskItems.filter(i => !ids.includes(Number(i.taskId)))
    db.taskMembers = db.taskMembers.filter(m => !ids.includes(Number(m.taskId)))
    return ok('删除成功')
  }),

  route('get', '/apms/test-task/:id', (ctx) => {
    const row = getDb().testTasks.find(r => String(r.id) === ctx.params.id)
    if (!row) return { code: 601, msg: '任务不存在' }
    refreshTaskStats(row.id)
    const items = getDb().taskItems
      .filter(i => Number(i.taskId) === Number(row.id))
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    const members = getDb().taskMembers.filter(m => Number(m.taskId) === Number(row.id))
    return detail({ ...row, items, members })
  })
]
