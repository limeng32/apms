/**
 * 演示模式 · 测试报告 handler
 * generate 仅在内存中补一条报告行；文件下载在视图层已禁用。
 */
import {
  getDb, route, ok, detail, pageRows,
  nextId, now
} from '../handle'

const TYPE_NAME = {
  INDIVIDUAL: '个人测试报告', TEAM: '队伍测试报告',
  PHASE: '阶段总结报告', COMPREHENSIVE: '综合分析报告'
}

export const reportHandlers = [
  // /generate 为精确 POST，先于 /:id
  route('post', '/apms/report/generate', (ctx) => {
    const q = ctx.query
    if (!q.reportType) return { code: 601, msg: '报告类型必填' }
    const db = getDb()
    const task = q.taskId != null
      ? db.testTasks.find(t => String(t.id) === String(q.taskId)) : null
    const athlete = q.athleteId != null
      ? db.athletes.find(a => String(a.athleteId) === String(q.athleteId)) : null
    const dept = q.deptId != null
      ? db.depts.find(d => String(d.deptId) === String(q.deptId))
      : (task ? db.depts.find(d => String(d.deptId) === String(task.targetDeptId)) : null)
    const ts = now()
    const row = {
      id: nextId(),
      reportType: q.reportType,
      taskId: task ? task.id : null,
      taskName: task?.taskName ?? null,
      athleteId: athlete ? athlete.athleteId : null,
      athleteName: athlete?.name ?? null,
      athleteGender: athlete?.gender ?? null,
      athleteTeam: athlete?.teamName ?? task?.targetDeptName ?? null,
      deptId: dept?.deptId ?? task?.targetDeptId ?? null,
      deptName: dept?.deptName ?? task?.targetDeptName ?? null,
      templateVersion: 'demo-v1',
      contentSnapshot: JSON.stringify({
        note: '演示报告：静态样本环境生成，无真实文件。',
        comboScores: db.comboScores.length,
        results: db.testResults.length
      }),
      filePath: null,
      remark: q.remark ?? null,
      generateBy: 'super',
      generateTime: ts,
      createBy: 'super', createTime: ts
    }
    db.reports.unshift(row)
    return ok(`${TYPE_NAME[q.reportType] || '报告'}生成成功`)
  }),

  // /regenerate/:id 覆盖式重新生成：ID 不变，刷新快照与生成时间（演示环境无真实 PDF，下载由视图层拦截）
  route('post', '/apms/report/regenerate/:id', (ctx) => {
    const row = getDb().reports.find(r => String(r.id) === ctx.params.id)
    if (!row) return { code: 601, msg: '报告不存在' }
    const ts = now()
    row.contentSnapshot = JSON.stringify({
      note: '演示报告：静态样本环境重新生成，无真实文件。',
      regenerated: true,
      comboScores: getDb().comboScores.length,
      results: getDb().testResults.length
    })
    row.filePath = null
    row.generateTime = ts
    row.updateBy = 'super'
    row.updateTime = ts
    return detail(row)
  }),

  route('get', '/apms/report/list', (ctx) => {
    const q = ctx.query
    const specs = [
      { key: 'reportType', value: q.reportType },
      { key: 'taskId', value: q.taskId },
      { key: 'athleteId', value: q.athleteId }
    ]
    return pageRows(getDb().reports, q, specs)
  }),

  route('delete', '/apms/report/:ids', (ctx) => {
    const ids = String(ctx.params.ids).split(',').map(s => Number(s.trim())).filter(Boolean)
    getDb().reports = getDb().reports.filter(r => !ids.includes(Number(r.id)))
    return ok('删除成功')
  }),

  route('get', '/apms/report/:id', (ctx) => {
    const row = getDb().reports.find(r => String(r.id) === ctx.params.id)
    return row ? detail(row) : { code: 601, msg: '报告不存在' }
  })
]
