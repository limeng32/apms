/**
 * 演示模式 · 组合体能评分 handler
 * calculate 按组合模型权重 + 任务已选最佳结果现算（确定性简化归一化），
 * 输出形状与真实批量接口一致：{totalAthletes, successCount, skipCount, items}
 */
import {
  getDb, route, ok, detail, listData,
  nextId, stampCreate, now
} from '../handle'

function normalize(value, refMin, refMax, direction) {
  const min = Number(refMin), max = Number(refMax)
  if (!Number.isFinite(Number(value)) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return null
  }
  let n = (Number(value) - min) / (max - min)
  if (direction === 'LOWER_BETTER') n = 1 - n
  // 收敛到 [-1, 2] 附近，配合权重后与真实现测量级（-0.5~0.9）接近
  n = n * 1.6 - 0.8
  return Number(n.toFixed(4))
}

export const comboScoreHandlers = [
  route('post', '/apms/combo-score/calculate', (ctx) => {
    const b = ctx.body || {}
    const { comboModelId, taskId } = b
    const db = getDb()
    const model = db.comboModels.find(m => String(m.id) === String(comboModelId))
    if (!model) return { code: 601, msg: '组合模型不存在' }
    const components = db.comboComponents
      .filter(c => String(c.comboModelId) === String(comboModelId))
      .sort((a, c2) => Number(a.sortOrder) - Number(c2.sortOrder))
    if (!components.length) return { code: 601, msg: '组合模型未配置成分' }

    const members = db.taskMembers.filter(m => String(m.taskId) === String(taskId))
    const targets = members.length
      ? members
      : db.athletes.filter(a => String(a.status) === '0').map(a => ({ athleteId: a.athleteId }))

    const items = []
    let successCount = 0, skipCount = 0
    targets.forEach((m, idx) => {
      const athleteId = m.athleteId
      const athlete = db.athletes.find(a => String(a.athleteId) === String(athleteId))
      const existed = db.comboScores.find(s =>
        String(s.comboModelId) === String(comboModelId)
        && String(s.athleteId) === String(athleteId))
      if (existed) {
        skipCount++
        items.push({ athleteId, athleteName: athlete?.name, status: 'SKIP', reason: '已有评分（演示不重复计算）' })
        return
      }
      // 每个成分取该队员在该任务中的最佳结果
      const compSnapshot = components.map(comp => {
        const result = db.testResults
          .filter(r => String(r.athleteId) === String(athleteId)
            && String(r.taskId) === String(taskId)
            && r.indicatorId != null
            && String(r.indicatorId) === String(comp.indicatorId)
            && String(r.isSelected) === '1')
          .sort((a, b2) => String(b2.measureDate || '').localeCompare(String(a.measureDate || '')))[0]
        const vals = Array.isArray(result?.values) ? result.values : []
        const primary = vals.find(v => v.isDerived === '0' && v.fieldKey === 'result') || vals[0]
        const value = primary ? Number(primary.numericValue) : NaN
        // 无真实参考区间时用成分自身的宽放区间做演示归一化
        const n = Number.isFinite(value)
          ? normalize(value,
            comp.refMin ?? (value * 0.7),
            comp.refMax ?? (value * 1.3),
            comp.directionOverride || comp.indicatorDirection)
          : null
        return {
          indicatorId: comp.indicatorId, indicatorCode: comp.indicatorCode,
          weight: comp.weight, direction: comp.directionOverride || comp.indicatorDirection,
          normalized: n, weightedScore: n != null ? Number((n * comp.weight).toFixed(4)) : 0,
          valid: n != null, value: Number.isFinite(value) ? value : null,
          refMin: comp.refMin ?? null, refMax: comp.refMax ?? null,
          mu: null, sigma: null
        }
      })
      const validComps = compSnapshot.filter(c => c.valid)
      if (!validComps.length) {
        skipCount++
        items.push({ athleteId, athleteName: athlete?.name, status: 'SKIP', reason: '该任务缺少已选最佳结果' })
        return
      }
      const weightSum = validComps.reduce((s, c) => s + Number(c.weight || 0), 0) || 1
      const comboScore = Number((validComps.reduce((s, c) => s + c.weightedScore, 0) / weightSum).toFixed(4))
      const ts = now()
      const row = {
        id: nextId(),
        comboModelId: Number(comboModelId), comboModelName: model.name,
        athleteId: Number(athleteId), athleteName: athlete?.name ?? null,
        athleteGender: athlete?.gender ?? null,
        athleteTeam: athlete?.teamName ?? null,
        comboScore, calculatedAt: ts,
        algoVersion: model.algoVersion || 'combo-demo-v1',
        triggerResultId: null,
        params: { taskId: Number(taskId), seq: idx },
        refSnapshot: JSON.stringify({ components: compSnapshot })
      }
      stampCreate(row)
      db.comboScores.unshift(row)
      successCount++
      items.push({ athleteId, athleteName: athlete?.name, status: 'OK', comboScore })
    })

    return detail({ totalAthletes: targets.length, successCount, skipCount, items })
  }),

  route('get', '/apms/combo-score/list', (ctx) => {
    const q = ctx.query
    const rows = getDb().comboScores.filter(r =>
      (q.comboModelId === undefined || q.comboModelId === ''
        || String(r.comboModelId) === String(q.comboModelId))
      && (q.athleteId === undefined || q.athleteId === ''
        || String(r.athleteId) === String(q.athleteId)))
      .sort((a, b) => (b.calculatedAt || '').localeCompare(a.calculatedAt || ''))
      .map(r => {
        const a = getDb().athletes.find(x => String(x.athleteId) === String(r.athleteId))
        return {
          ...r,
          athleteGender: r.athleteGender ?? a?.gender ?? null,
          athleteAge: r.athleteAge ?? a?.age ?? null,
          athleteTeam: r.athleteTeam ?? a?.teamName ?? null
        }
      })
    return listData(rows)
  }),

  route('delete', '/apms/combo-score/:id', (ctx) => {
    const id = Number(ctx.params.id)
    getDb().comboScores = getDb().comboScores.filter(r => Number(r.id) !== id)
    return ok('删除成功')
  }),

  route('get', '/apms/combo-score/:id', (ctx) => {
    const row = getDb().comboScores.find(r => String(r.id) === ctx.params.id)
    return row ? detail(row) : { code: 601, msg: '评分不存在' }
  })
]
