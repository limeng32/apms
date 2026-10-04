/**
 * 演示模式 · 体态测量周期 handler
 * （list 为分页 rows；progress 返回完成情况 data 对象；批量录入复用队员+日期 upsert 语义）
 */
import {
  getDb, route, ok, detail, paginate,
  nextId, stampCreate, stampUpdate
} from '../handle'

function targetMembers(cycle) {
  return getDb().athletes.filter(a => a.status === '0'
    && (cycle.targetDeptId == null || Number(a.primaryTeamId) === Number(cycle.targetDeptId)))
}

function cycleRows(cycleId) {
  return getDb().bodyMeasures.filter(m => m.cycleId != null && String(m.cycleId) === String(cycleId))
}

function deptName(deptId) {
  if (deptId == null) return null
  const d = getDb().depts.find(x => Number(x.deptId) === Number(deptId))
  return d ? d.deptName : null
}

/** 每队员保留最新一条（与后端 selectMeasuredByCycle + Map 去重口径一致） */
function measuredMap(cycleId) {
  const map = new Map()
  for (const m of cycleRows(cycleId)) {
    const old = map.get(m.athleteId)
    if (!old || String(m.measureDate) > String(old.measureDate)) map.set(m.athleteId, m)
  }
  return map
}

function decorate(c) {
  const members = targetMembers(c)
  return {
    ...c,
    targetDeptName: deptName(c.targetDeptId),
    memberTotal: members.length,
    measuredCount: measuredMap(c.id).size
  }
}

function buildProgress(cycleId) {
  const cycle = getDb().measureCycles.find(c => String(c.id) === String(cycleId))
  const members = targetMembers(cycle)
  const done = measuredMap(cycleId)

  const measured = []
  const pending = []
  for (const a of members) {
    const m = done.get(a.athleteId)
    if (m) {
      measured.push({
        athleteId: a.athleteId,
        athleteName: a.name,
        athleteGender: a.gender,
        teamName: a.teamName,
        measureId: m.id,
        measureDate: m.measureDate,
        height: m.height,
        weight: m.weight,
        sitHeight: m.sitHeight,
        bodyFatRate: m.bodyFatRate,
        waist: m.waist
      })
    } else {
      pending.push({ athleteId: a.athleteId, athleteName: a.name, athleteGender: a.gender, teamName: a.teamName })
    }
  }
  const byTeam = (x, y) => (x.teamName || '').localeCompare(y.teamName || '') || x.athleteId - y.athleteId
  measured.sort(byTeam)
  pending.sort(byTeam)

  const total = members.length
  const count = measured.length
  return {
    cycle: decorate(cycle),
    memberTotal: total,
    measuredCount: count,
    pendingCount: pending.length,
    percent: total === 0 ? 0 : Math.round(count * 1000 / total) / 10,
    measured,
    pending
  }
}

const isBlank = (m) =>
  m.height == null && m.weight == null && m.sitHeight == null && m.bodyFatRate == null && m.waist == null

export const measureCycleHandlers = [
  // 列表（分页 rows；带目标人数/已测人数装饰字段）
  route('get', '/apms/measure-cycle/list', (ctx) => {
    let rows = getDb().measureCycles.slice()
    const { status, name } = ctx.query
    if (status) rows = rows.filter(c => c.status === status)
    if (name) rows = rows.filter(c => (c.name || '').includes(name))
    rows.sort((a, b) => String(b.planStartDate || '').localeCompare(String(a.planStartDate || ''))
      || b.id - a.id)
    return paginate(rows.map(decorate), ctx.query)
  }),

  // 完成情况（必须注册在 /:id 之前）
  route('get', '/apms/measure-cycle/:id/progress', (ctx) => {
    const cycle = getDb().measureCycles.find(c => String(c.id) === ctx.params.id)
    return cycle ? detail(buildProgress(ctx.params.id)) : { code: 601, msg: '测量周期不存在' }
  }),

  route('get', '/apms/measure-cycle/:id', (ctx) => {
    const cycle = getDb().measureCycles.find(c => String(c.id) === ctx.params.id)
    return cycle ? detail(decorate(cycle)) : { code: 601, msg: '测量周期不存在' }
  }),

  route('post', '/apms/measure-cycle', (ctx) => {
    const b = ctx.body || {}
    if (!b.name || !b.name.trim()) return { code: 500, msg: '周期名称不能为空' }
    const row = {
      id: nextId(),
      name: b.name,
      targetDeptId: b.targetDeptId ?? null,
      planStartDate: b.planStartDate ?? null,
      planEndDate: b.planEndDate ?? null,
      status: b.status || '0',
      remark: b.remark ?? null,
      updateBy: null, updateTime: null
    }
    stampCreate(row)
    getDb().measureCycles.unshift(row)
    return detail(row)
  }),

  route('put', '/apms/measure-cycle', (ctx) => {
    const b = ctx.body || {}
    const row = getDb().measureCycles.find(c => String(c.id) === String(b.id))
    if (!row) return { code: 601, msg: '测量周期不存在' }
    if (b.name !== undefined) row.name = b.name
    if (b.targetDeptId !== undefined) row.targetDeptId = b.targetDeptId
    if (b.planStartDate !== undefined) row.planStartDate = b.planStartDate
    if (b.planEndDate !== undefined) row.planEndDate = b.planEndDate
    if (b.status !== undefined) row.status = b.status
    if (b.remark !== undefined) row.remark = b.remark
    stampUpdate(row)
    return ok()
  }),

  // 删除周期：测量记录解链保留
  route('delete', '/apms/measure-cycle/:id', (ctx) => {
    const db = getDb()
    db.measureCycles = db.measureCycles.filter(c => String(c.id) !== ctx.params.id)
    db.bodyMeasures.forEach(m => {
      if (m.cycleId != null && String(m.cycleId) === ctx.params.id) m.cycleId = null
    })
    return ok('删除成功')
  }),

  // 周期批量录入：同队员同日 upsert，已测行改日期时先处理旧行，避免重复
  route('post', '/apms/measure-cycle/:id/batch', (ctx) => {
    const db = getDb()
    const cycle = db.measureCycles.find(c => String(c.id) === ctx.params.id)
    if (!cycle) return { code: 601, msg: '测量周期不存在' }
    const list = Array.isArray(ctx.body) ? ctx.body : []

    let saved = 0
    for (const b of list) {
      if (b.athleteId == null || isBlank(b)) continue
      const fields = {
        athleteId: b.athleteId,
        measureDate: b.measureDate || cycle.planStartDate || new Date().toISOString().slice(0, 10),
        height: b.height ?? null,
        weight: b.weight ?? null,
        sitHeight: b.sitHeight ?? null,
        bodyFatRate: b.bodyFatRate ?? null,
        waist: b.waist ?? null,
        dataSource: 'cycle',
        cycleId: cycle.id
      }

      const carryId = b.id != null ? Number(b.id) : null
      const findOnDate = () => db.bodyMeasures.find(r =>
        String(r.athleteId) === String(fields.athleteId)
        && String(r.measureDate) === String(fields.measureDate))

      if (carryId != null) {
        const onDate = findOnDate()
        if (onDate && Number(onDate.id) !== carryId) {
          db.bodyMeasures = db.bodyMeasures.filter(r => Number(r.id) !== carryId)
        } else if (!onDate) {
          const old = db.bodyMeasures.find(r => Number(r.id) === carryId)
          if (old) Object.assign(old, fields)
        }
      }

      const row = findOnDate()
      if (row) {
        Object.assign(row, fields)
        stampUpdate(row)
      } else {
        const a = db.athletes.find(x => String(x.athleteId) === String(fields.athleteId))
        db.bodyMeasures.unshift({
          ...fields,
          id: nextId(),
          legLength: fields.height != null && fields.sitHeight != null
            ? Number((fields.height - fields.sitHeight).toFixed(1)) : null,
          sourceTaskId: null,
          sourceSessionKey: null,
          remark: null,
          athleteName: a ? a.name : null,
          athleteGender: a ? a.gender : null,
          athleteAge: a ? (a.age ?? null) : null,
          athleteTeam: a ? a.teamName : null
        })
        stampCreate(db.bodyMeasures[0])
      }
      saved++
    }
    if (!saved) return { code: 500, msg: '未检测到任何已填写的测量项' }
    return { code: 200, msg: `已保存 ${saved} 条测量记录`, data: saved }
  })
]
