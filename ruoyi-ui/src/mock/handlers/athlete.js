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

// 与后端列表同口径：年龄段 13~18 = age+1 收敛（纯数字，展示层再拼「岁」）
function ageGroupOf(row) {
  const age = effectiveAge(row)
  if (age == null) return null
  return Math.min(18, Math.max(13, age + 1))
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
      if (g == null || !groups.map(String).includes(String(g))) return false
    }
    return true
  })
}

/**
 * 赛季晋升方案（与后端 ApmsSeasonPromotionServiceImpl 同口径的演示版）
 * U 档识别 / 仅超龄晋升 / 同上级找最小可容纳档 / 超龄留队 / 生日缺失
 */
const U_BRACKET_RE = /(?<![A-Za-z0-9])U(\d{1,2})(?![0-9])/i

function ageAtCutoff(birthday, cutoff) {
  if (!birthday) return null
  const b = new Date(String(birthday) + 'T00:00:00')
  const c = new Date(cutoff + 'T00:00:00')
  if (isNaN(b.getTime()) || isNaN(c.getTime())) return null
  let age = c.getFullYear() - b.getFullYear()
  const m = c.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && c.getDate() < b.getDate())) age--
  return age < 0 ? 0 : age
}

function nextJanFirstStr() {
  const now = new Date()
  const y = (now.getMonth() > 0 || (now.getMonth() === 0 && now.getDate() > 1))
    ? now.getFullYear() + 1 : now.getFullYear()
  return y + '-01-01'
}

function buildPromotionPlan(ctx) {
  const cutoff = (ctx.body && ctx.body.cutoffDate) || nextJanFirstStr()
  const db = getDb()
  // parentId -> Map(bracket -> dept)
  const byParent = new Map()
  const configErrors = []
  db.depts.forEach(d => {
    const m = String(d.deptName || '').match(U_BRACKET_RE)
    if (!m) return
    const parentId = d.parentId == null ? 0 : d.parentId
    const bracket = Number(m[1])
    if (!byParent.has(parentId)) byParent.set(parentId, new Map())
    const map = byParent.get(parentId)
    if (map.has(bracket)) {
      configErrors.push(`同一上级下存在两个 U${bracket} 梯队`)
    }
    map.set(bracket, d)
  })
  if (!byParent.size) {
    configErrors.push('未识别到任何 U 档梯队（部门名需含 U+数字，如 U16 梯队）')
  }

  const teams = []
  const teamIndex = new Map()
  byParent.forEach((map, parentId) => {
    map.forEach((d, bracket) => {
      teams.push({ deptId: d.deptId, deptName: d.deptName, parentId, bracket,
        memberCount: db.athletes.filter(a => String(a.primaryTeamId) === String(d.deptId) && String(a.status) === '0').length })
      teamIndex.set(Number(d.deptId), { dept: d, bracket, parentId })
    })
  })

  const items = []
  let promoteCount = 0, stayYoungCount = 0, stayOverAgeCount = 0, noBirthdayCount = 0, invalidTeamCount = 0
  db.athletes.filter(a => String(a.status) === '0').forEach(a => {
    const item = {
      athleteId: a.athleteId, name: a.name, gender: a.gender, birthday: a.birthday,
      jerseyNo: a.jerseyNo, fromTeamId: a.primaryTeamId, fromTeamName: a.teamName
    }
    const idx = teamIndex.get(Number(a.primaryTeamId))
    if (!idx) {
      // 非 U 档部门或部门已失效：单列，不参与晋升
      item.action = 'INVALID_TEAM'
      const label = a.teamName || ('部门#' + a.primaryTeamId)
      item.reason = `所属「${label}」不是 U 档梯队或已停用/删除，不参与晋升，请先调整归属`
      invalidTeamCount++
      items.push(item)
      return
    }
    const { dept: from, bracket: fromBracket, parentId } = idx
    Object.assign(item, { fromTeamName: from.deptName, fromBracket })
    const age = ageAtCutoff(a.birthday, cutoff)
    if (age == null) {
      item.action = 'NO_BIRTHDAY'; item.reason = '出生日期缺失，无法判定年龄段'; noBirthdayCount++
    } else if (age < fromBracket) {
        item.ageAtCutoff = age
        item.action = 'STAY_YOUNG'
        item.reason = `cut-off 日 ${age} 岁，未达到 U${fromBracket} 出档年龄`
        stayYoungCount++
      } else {
        item.ageAtCutoff = age
        const chain = [...byParent.get(parentId).entries()].sort((x, y) => x[0] - y[0])
        const hit = chain.find(([n]) => n > fromBracket && age < n)
        if (!hit) {
          item.action = 'STAY_OVERAGE'
          item.reason = `cut-off 日 ${age} 岁已超 U${fromBracket}，但没有更高档梯队`
          stayOverAgeCount++
        } else {
          const [toBracket, to] = hit
          item.action = 'PROMOTE'
          item.toTeamId = to.deptId; item.toTeamName = to.deptName; item.toBracket = toBracket
          item.reason = `cut-off 日 ${age} 岁，超出 U${fromBracket}，晋升至 U${toBracket}`
          promoteCount++
        }
      }
      items.push(item)
    })

  return {
    cutoffDate: cutoff, teams, items, configErrors,
    promoteCount, stayYoungCount, stayOverAgeCount, noBirthdayCount, invalidTeamCount
  }
}

export const athleteHandlers = [
  // —— 具体字面路径必须排在 /:athleteId 之前（精确表天然优先，这里仅列分组说明）——
  route('post', '/apms/athlete/promotion/preview', (ctx) => detail(buildPromotionPlan(ctx))),

  route('post', '/apms/athlete/promotion/execute', (ctx) => {
    const plan = buildPromotionPlan(ctx)
    if (plan.configErrors.length) return { code: 601, msg: '梯队配置存在问题：' + plan.configErrors.join('；') }
    const promotes = plan.items.filter(i => i.action === 'PROMOTE')
    if (!promotes.length) return { code: 601, msg: '没有需要晋升的队员（当前 cut-off 日无人超龄）' }
    const db = getDb()
    const batchNo = 'P' + plan.cutoffDate.replaceAll('-', '') + '-' + String(Date.now()).slice(-6)
    promotes.forEach(p => {
      const row = db.athletes.find(a => String(a.athleteId) === String(p.athleteId))
      if (row) {
        row.primaryTeamId = p.toTeamId
        row.teamName = p.toTeamName
        stampUpdate(row)
      }
    })
    return detail({ ...plan, batchNo })
  }),

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
