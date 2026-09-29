/**
 * 演示模式 · 花名册（athlete）+ 归属历史（athlete-group）handler
 */
import {
  getDb, route, ok, detail, pageRows, listData,
  nextId, nextPositiveId, stampCreate, stampUpdate, splitIds, eq, like
} from '../handle'

/* ============================== Athlete ============================== */

/**
 * 周岁：与后端 SQL TIMESTAMPDIFF(YEAR, birthday, CURDATE()) 同口径。
 * 表单只提交 birthday，age 不落库、由查询端实时计算，因此新增队员的年龄/年龄组
 * 也必须在 mock 读取时派生，否则列表年龄组显示「—」。
 */
function calcAge(birthday) {
  if (!birthday) return null
  const b = new Date(String(birthday) + 'T00:00:00')
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

function effectiveAge(row) {
  // birthday 是年龄的唯一事实源（后端 SQL TIMESTAMPDIFF 实时算）。
  // 必须优先按生日算：否则蓝本行里的 age 旧快照会在「编辑出生日期」后压过新值，
  // 导致年龄段不重算。仅在缺失生日时才回退到行内 age。
  const byBirthday = calcAge(row.birthday)
  if (byBirthday != null) return byBirthday
  if (row.age != null && row.age !== '') return Number(row.age)
  return null
}

/** 读取时装饰：按 birthday 回填实时年龄（蓝本行已有 age，同值覆盖无副作用） */
function decorate(row) {
  if (!row) return row
  return { ...row, age: effectiveAge(row) }
}

// 与后端列表同口径：年龄组 U13~U18 = age+1 收敛
function ageGroupOf(row) {
  const age = effectiveAge(row)
  if (age == null) return null
  return 'U' + Math.min(18, Math.max(13, age + 1))
}

function deptName(deptId) {
  const d = getDb().depts.find(x => x.deptId === Number(deptId))
  return d ? d.deptName : null
}

/**
 * 花名册通用筛选（列表与 rtpSummary 同口径）。
 * 注意 ageGroups 经 tansParams 序列化为 ageGroups[0]=14&ageGroups[1]=16，
 * 引擎 normalize 后还原为数组 ['14','16']。
 * @param includeRtpStatus rtpSummary 统计各灯人数时不应再按灯色过滤
 */
function filterAthletes(query, { includeRtpStatus = true } = {}) {
  const groups = Array.isArray(query.ageGroups)
    ? query.ageGroups
    : (query.ageGroups ? [query.ageGroups] : [])
  return getDb().athletes.filter(r => {
    // 花名册默认只看在队；显式 status 参数时尊重参数
    const statusParam = query.status === undefined || query.status === '' ? '0' : query.status
    if (!eq(r.status, statusParam)) return false
    if (!like(r.name, query.name)) return false
    if (query.primaryTeamId !== undefined && query.primaryTeamId !== ''
      && String(r.primaryTeamId ?? '') !== String(query.primaryTeamId)) return false
    if (query.gender !== undefined && query.gender !== ''
      && String(r.gender ?? '') !== String(query.gender)) return false
    if (query.position !== undefined && query.position !== ''
      && String(r.position ?? '') !== String(query.position)) return false
    if (includeRtpStatus && query.rtpStatus !== undefined && query.rtpStatus !== ''
      && String(r.rtpStatus ?? '') !== String(query.rtpStatus)) return false
    if (groups.length) {
      const g = ageGroupOf(r)
      if (!g || !groups.map(String).includes(String(g.slice(1)))) return false
    }
    return true
  })
}

export const athleteHandlers = [
  // —— 具体字面路径必须排在 /:athleteId 之前（精确表天然优先，这里仅列分组说明）——
  route('get', '/apms/athlete/rtpSummary', (ctx) => {
    // 花名册筛选条 chip 计数：g/y/r + 未评估（最后一项无 status 字段，与真实接口一致）；
    // 与列表共用姓名/队伍/性别/位置/年龄组筛选，但不按 rtpStatus 自身过滤
    const rows = filterAthletes(ctx.query, { includeRtpStatus: false })
    const counts = { g: 0, y: 0, r: 0, none: 0 }
    rows.forEach(a => { counts['gyr'.includes(a.rtpStatus) ? a.rtpStatus : 'none']++ })
    const data = []
    for (const status of ['g', 'y', 'r']) {
      if (counts[status] > 0) data.push({ cnt: counts[status], status })
    }
    if (counts.none > 0) data.push({ cnt: counts.none })
    return listData(data)
  }),

  route('get', '/apms/athlete/check_jersey_no', (ctx) => {
    const { jerseyNo, primaryTeamId, athleteId } = ctx.query
    const dup = getDb().athletes.find(a =>
      String(a.jerseyNo) === String(jerseyNo)
      && String(a.primaryTeamId) === String(primaryTeamId)
      && String(a.athleteId) !== String(athleteId)
    )
    return dup
      ? { code: 601, msg: `球衣号 ${jerseyNo} 在该队伍已存在` }
      : ok()
  }),

  route('get', '/apms/athlete/list', (ctx) => {
    // decorate 在分页切片前统一回填实时年龄
    return pageRows(filterAthletes(ctx.query).map(decorate), ctx.query)
  }),

  route('post', '/apms/athlete', (ctx) => {
    const db = getDb()
    // 正整数 ID：静态路由 athlete/detail/:athleteId(\d+) 不接受负数
    const athleteId = nextPositiveId(db.athletes, 'athleteId')
    const body = { ...ctx.body }
    delete body.age // age 由 birthday 实时派生，不持久化
    const row = { ...body, athleteId, status: body.status ?? '0' }
    if (row.primaryTeamId != null) row.teamName = deptName(row.primaryTeamId)
    stampCreate(row)
    db.athletes.unshift(row)
    return ok('新增成功')
  }),

  route('put', '/apms/athlete', (ctx) => {
    const db = getDb()
    const row = db.athletes.find(a => String(a.athleteId) === String(ctx.body.athleteId))
    if (!row) return { code: 601, msg: '队员不存在' }
    const body = { ...ctx.body }
    delete body.age // age 由 birthday 实时派生，编辑保存后立即按新生日重算
    Object.assign(row, body)
    if (row.primaryTeamId != null) row.teamName = deptName(row.primaryTeamId)
    stampUpdate(row)
    return ok('修改成功')
  }),

  route('delete', '/apms/athlete/:athleteIds', (ctx) => {
    const ids = splitIds(ctx.params.athleteIds)
    getDb().athletes.forEach(a => {
      if (ids.includes(Number(a.athleteId))) {
        a.status = '1' // 逻辑删除：离队
        stampUpdate(a)
      }
    })
    return ok('删除成功')
  }),

  route('get', '/apms/athlete/:athleteId', (ctx) => {
    const row = getDb().athletes.find(a => String(a.athleteId) === ctx.params.athleteId)
    return row ? detail(decorate(row)) : { code: 601, msg: '队员不存在' }
  })
]

/* ============================ Athlete Group ============================ */

export const athleteGroupHandlers = [
  route('get', '/apms/athlete-group/athlete/:athleteId/current', (ctx) => {
    const row = getDb().athleteGroups.find(g =>
      String(g.athleteId) === ctx.params.athleteId && String(g.status) === '0')
    return detail(row || null)
  }),

  route('get', '/apms/athlete-group/dept/:deptId', (ctx) => {
    const rows = getDb().athleteGroups.filter(g =>
      String(g.deptId) === ctx.params.deptId && String(g.status) === '0')
    return listData(rows)
  }),

  route('post', '/apms/athlete-group/join', (ctx) => {
    const db = getDb()
    const b = ctx.body || {}
    // 同队已有在组记录则幂等返回
    const exists = db.athleteGroups.find(g =>
      String(g.athleteId) === String(b.athleteId)
      && String(g.deptId) === String(b.deptId)
      && String(g.status) === '0')
    if (exists) return ok('已在该小组')
    // 转组：先关闭该队员其它在组关系（一人仅一个当前归属）
    const today = b.joinDate || new Date().toISOString().slice(0, 10)
    db.athleteGroups.forEach(g => {
      if (String(g.athleteId) === String(b.athleteId) && String(g.status) === '0') {
        g.status = '1'
        g.leaveDate = today
        stampUpdate(g)
      }
    })
    const dept = db.depts.find(d => String(d.deptId) === String(b.deptId))
    const athlete = db.athletes.find(a => String(a.athleteId) === String(b.athleteId))
    const row = {
      id: nextId(),
      athleteId: Number(b.athleteId),
      deptId: Number(b.deptId),
      deptName: dept?.deptName || null,
      deptTypeName: dept?.deptType === '20' ? '梯队' : '训练小组',
      joinDate: today,
      leaveDate: null,
      status: '0',
      remark: b.remark ?? null
    }
    stampCreate(row)
    db.athleteGroups.push(row)
    if (athlete && dept) {
      athlete.primaryTeamId = dept.deptId
      athlete.teamName = dept.deptName
    }
    return ok('加入成功')
  }),

  route('post', '/apms/athlete-group/leave/:athleteId', (ctx) => {
    const current = getDb().athleteGroups.find(g =>
      String(g.athleteId) === ctx.params.athleteId && String(g.status) === '0')
    if (current) {
      current.status = '1'
      current.leaveDate = ctx.body?.leaveDate || new Date().toISOString().slice(0, 10)
      stampUpdate(current)
    }
    return ok('已离开')
  }),

  route('get', '/apms/athlete-group/athlete/:athleteId', (ctx) => {
    const rows = getDb().athleteGroups
      .filter(g => String(g.athleteId) === ctx.params.athleteId)
      .sort((a, b) => (b.joinDate || '').localeCompare(a.joinDate || ''))
    return listData(rows)
  })
]
