/**
 * 演示模式 · 总览看板 handler
 * GET /apms/dashboard/overview —— 单接口聚合，全部从内存表实时计算，
 * 因此任意模块的假增删改后回到首页，卡片/图表能即时反映。
 */
import { getDb, route, detail } from '../handle'

function buildOverview() {
  const db = getDb()

  // KPI 汇总
  const activeAthletes = db.athletes.filter(a => String(a.status) === '0')
  const scores = db.comboScores.map(s => Number(s.comboScore)).filter(Number.isFinite)
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const summary = {
    totalAthletes: activeAthletes.length,
    totalComboScores: db.comboScores.length,
    avgComboScore: Number(avg.toFixed(3)),
    highPerformer: scores.filter(v => v >= 0.5).length,
    needAttention: scores.filter(v => v <= -0.5).length,
    phvRecords: db.phvs.length,
    testTasks: db.testTasks.length
  }

  // 组合分排名（降序）
  const comboScoreRanking = db.comboScores
    .map(s => ({
      athleteId: s.athleteId,
      athleteName: s.athleteName,
      athleteTeam: s.athleteTeam,
      comboScore: Number(s.comboScore)
    }))
    .sort((a, b) => b.comboScore - a.comboScore)

  // 指标雷达：优先解析评分时固化的 refSnapshot
  const indicatorRadar = db.comboScores.map((s) => {
    let dimensions = []
    try {
      const snap = typeof s.refSnapshot === 'string' ? JSON.parse(s.refSnapshot) : s.refSnapshot
      dimensions = (snap?.components || []).map(c => ({
        indicatorId: c.indicatorId,
        weight: c.weight,
        direction: c.direction,
        normalized: c.normalized,
        weightedScore: c.weightedScore,
        valid: c.valid !== false
      }))
    } catch (e) { dimensions = [] }
    return {
      athleteId: s.athleteId,
      athleteName: s.athleteName,
      athleteTeam: s.athleteTeam,
      dimensions
    }
  }).filter(r => r.dimensions.length > 0)

  // PHV 散点
  const phvScatter = db.phvs.map(p => ({
    athleteId: p.athleteId,
    athleteName: p.athleteName,
    athleteTeam: p.athleteTeam,
    decimalAge: p.decimalAge,
    predictedPhvAge: p.predictedPhvAge,
    maturityOffset: p.maturityOffset
  }))

  // 任务完成度
  const taskCompletion = db.testTasks.map(t => {
    const resultRows = db.testResults.filter(r => r.taskId === t.id)
    return {
      taskId: t.id,
      taskName: t.taskName,
      startDate: t.startDate,
      status: t.status,
      resultCount: resultRows.filter(r => String(r.isValid) === '1').length,
      athleteCount: db.taskMembers.filter(m => m.taskId === t.id).length,
      selectedCount: resultRows.filter(r => String(r.isSelected) === '1').length
    }
  })

  // 队伍分布（按在队队员的 teamName 归组）
  const teamDistribution = {}
  for (const a of activeAthletes) {
    const key = a.teamName || '未分队'
    teamDistribution[key] = (teamDistribution[key] || 0) + 1
  }

  return { summary, comboScoreRanking, indicatorRadar, phvScatter, taskCompletion, teamDistribution }
}

export const dashboardHandlers = [
  route('get', '/apms/dashboard/overview', () => detail(buildOverview()))
]
