/**
 * 演示模式 · 总览看板 handler
 * GET /apms/dashboard/overview —— 单接口聚合，全部从内存表实时计算，
 * 因此任意模块的假增删改后回到首页，卡片/图表能即时反映。
 */
import { getDb, route, detail } from '../handle'
import { TODAY, daysAgo, monthStart } from '../clock'

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

  // ========= 门面区 5 个数据块（口径对齐 ApmsDashboardController，
  // 时间锚点 ANCHOR='2026-10-05'，与 rtpRisk.js 的 TODAY 一致：静态蓝本不随真实日期过期） =========
  const rtpDistribution = buildRtpDistribution(activeAthletes, db.rtpStatuses)
  const activeTasksBlock = buildActiveTasks(taskCompletion, db.testTasks)
  const injurySummaryBlock = buildInjurySummary(activeAthletes, db.medicals)
  const phvBandsBlock = buildPhvBands(db.phvs)
  const healthAlertsBlock = buildHealthAlerts(db.rtpRiskSnapshots)

  return {
    summary, comboScoreRanking, indicatorRadar, phvScatter, taskCompletion, teamDistribution,
    rtpDistribution, activeTasks: activeTasksBlock,
    injurySummary: injurySummaryBlock, phvBands: phvBandsBlock, healthAlerts: healthAlertsBlock
  }
}

/* 所有相对窗口统一从演示时钟锚点推导（clock.js），静态蓝本永不随真实日期过期 */
const ANCHOR = TODAY

/** 参训风险分布：在队队员按 RTP 当前状态 g/y/r/none 归组，并按队伍分桶 */
function buildRtpDistribution(athletes, statuses) {
  const levelMap = new Map()
  for (const s of statuses) {
    if (s.athleteId != null) levelMap.set(String(s.athleteId), String(s.status))
  }
  let green = 0, yellow = 0, red = 0, none = 0
  const teamBuckets = new Map()
  for (const a of athletes) {
    const team = a.teamName || '未分组'
    const b = teamBuckets.get(team) || { team, green: 0, yellow: 0, red: 0, none: 0 }
    switch (levelMap.get(String(a.athleteId))) {
      case 'g': green++; b.green++; break
      case 'y': yellow++; b.yellow++; break
      case 'r': red++; b.red++; break
      default: none++; b.none++
    }
    teamBuckets.set(team, b)
  }
  return { green, yellow, red, none, total: athletes.length, byTeam: [...teamBuckets.values()] }
}

/** 本周活跃任务：未完成且任务窗口覆盖锚点日（日期缺失视为进行中），含平均完成率 */
function buildActiveTasks(taskRows, tasks) {
  const byId = new Map(taskRows.map(r => [r.taskId, r]))
  const list = []
  let progressSum = 0
  for (const t of tasks) {
    if (String(t.status) === 'completed') continue
    const s = t.startDate, e = t.endDate
    const windowActive = (!s || s <= ANCHOR) && (!e || e >= ANCHOR)
    if (!windowActive) continue
    const row = byId.get(t.id) || {}
    const target = Number(row.athleteCount) || 0
    const tested = Number(row.selectedCount) || 0
    const progress = target > 0 ? Math.round(tested * 100 / target) : 0
    list.push({
      taskId: t.id,
      taskName: t.taskName,
      testerName: t.testerName || null,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      athleteCount: target,
      selectedCount: tested,
      progress
    })
    progressSum += progress
  }
  // 最近开始在前，最多 6 项
  list.sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')))
  const top = list.slice(0, 6)
  return { list: top, avgProgress: top.length ? Math.round(progressSum / list.length) : 0 }
}

/** injury/surgery 后存在同日或更晚 rehabilitation/checkup 记录即视为闭环（同 medical.js 口径） */
function isInjuryClosed(rec, all) {
  return all.some(r =>
    r.athleteId === rec.athleteId
    && ['rehabilitation', 'checkup'].includes(r.recordType)
    && String(r.recordDate) >= String(rec.recordDate))
}

/** 伤病台账摘要：近 12 个月 injury/surgery，活跃/本月新发/已康复 + 部位桶 + 最近活跃 3 条 */
function buildInjurySummary(athletes, records) {
  const nameMap = new Map(athletes.map(a => [a.athleteId, a.name]))
  const since = daysAgo(365) // 锚点前 12 个月
  const mStart = monthStart()
  let active = 0, newThisMonth = 0, recovered = 0
  const siteMap = new Map()
  const recent = []
  for (const r of records) {
    if (!['injury', 'surgery'].includes(r.recordType)) continue
    if (!r.recordDate || String(r.recordDate) < since) continue
    if (isInjuryClosed(r, records)) { recovered++; continue }
    active++
    if (String(r.recordDate) >= mStart) newThisMonth++
    if (r.bodySite) {
      const b = siteMap.get(r.bodySite) || { site: r.bodySite, active: 0, total: 0 }
      b.active++
      b.total++
      siteMap.set(r.bodySite, b)
    }
    recent.push({
      athleteId: r.athleteId,
      athleteName: r.athleteName || nameMap.get(r.athleteId) || null,
      title: r.title,
      bodySite: r.bodySite,
      recordType: r.recordType,
      recordDate: r.recordDate
    })
  }
  const sites = [...siteMap.values()].sort((a, b) => b.active - a.active).slice(0, 5)
  recent.sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate)))
  return { active, newThisMonth, recovered, sites, recent: recent.slice(0, 3) }
}

/** PHV 发育阶段 4 档（每人取最新一条）+ ±1 年窗口人数，口径同后端 buildPhvBands */
function buildPhvBands(phvs) {
  const latest = new Map()
  for (const p of phvs) {
    if (p.athleteId == null || !p.measureDate) continue
    const cur = latest.get(p.athleteId)
    if (!cur || String(p.measureDate) > String(cur.measureDate)) latest.set(p.athleteId, p)
  }
  const defs = [
    { key: 'pre', label: 'PHV 前期' },
    { key: 'near', label: '接近期' },
    { key: 'post', label: '高峰后' },
    { key: 'beyond', label: '已越过' }
  ]
  const counts = [0, 0, 0, 0]
  let window = 0
  for (const p of latest.values()) {
    const v = Number(p.maturityOffset)
    if (!Number.isFinite(v)) continue
    if (v < -1) counts[0]++
    else if (v < 0.5) counts[1]++
    else if (v <= 1.5) counts[2]++
    else counts[3]++
    if (v >= -1 && v <= 1) window++
  }
  return {
    bands: defs.map((d, i) => ({ ...d, count: counts[i] })),
    windowCount: window,
    total: latest.size
  }
}

/** 健康预警：锚点日 ACTIVE 快照分级统计 + 红黄优先 TOP3（口径同后端 buildHealthAlerts/stat） */
function buildHealthAlerts(snapshots) {
  const rows = snapshots
    .filter(s => String(s.status) === 'ACTIVE' && String(s.snapshotDate) === ANCHOR)
  let warning = 0, attention = 0, infoHealth = 0, processOnly = 0
  for (const s of rows) {
    if (s.suggestedLevel === 'WARNING') warning++
    else if (s.suggestedLevel === 'ATTENTION') attention++
    else if (String(s.processOnly) === '1') processOnly++
    else infoHealth++
  }
  const rank = { WARNING: 0, ATTENTION: 1, INFO: 2 }
  const list = [...rows]
    .sort((a, b) =>
      (rank[a.suggestedLevel] ?? 3) - (rank[b.suggestedLevel] ?? 3)
      || (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0))
    .slice(0, 3)
    .map(s => {
      const factors = Array.isArray(s.factorList) ? s.factorList : []
      const flags = Array.isArray(s.processFlagList) ? s.processFlagList : []
      const reason = factors[0]?.title || flags[0] || ''
      return {
        snapshotId: s.id,
        athleteId: s.athleteId,
        athleteName: s.athleteName,
        athleteTeam: s.athleteTeam,
        level: s.suggestedLevel,
        processOnly: s.processOnly,
        riskScore: s.riskScore,
        reason
      }
    })
  return { total: rows.length, warning, attention, infoHealth, processOnly, list }
}

export const dashboardHandlers = [
  route('get', '/apms/dashboard/overview', () => detail(buildOverview()))
]
