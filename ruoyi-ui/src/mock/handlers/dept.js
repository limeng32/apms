/**
 * 演示模式 · 系统 → 组织架构 handler（对齐真实 SysDeptController/ISysDeptService 契约）
 *
 * 数据：db.depts（扁平列表，ancestors 物化祖先链，前端 handleTree 建樹）。
 * 边界与真实后端一致：
 * - 演示身份 super 为非平台管理员：禁止建顶级部门、禁止创建机构(10)，
 *   类型层级 机构(10)→队伍(20)→小组(30/40/50) 强校验，提示文案对齐后端；
 * - 修改：上级不能是自己、同级重名拦截、停用时有正常子部门拒绝、移动部门时
 *   自身及后代 ancestors 前缀联动重写（对齐 updateDeptChildren）；
 * - 删除按后端顺序做三重引用校验：下级部门 → 用户 → 在队运动员/在组成员；
 * - 所有读接口出库给 structuredClone 副本：前端 handleTree 原地建树以及
 *   编辑弹窗 v-model 都不得污染内存库（曾出现「每切一次模块部门累加」事故）；
 * - 写操作仅当前标签页有效，刷新随 resetDb 还原。
 */
import { getDb, route, ok, detail, nextPositiveId, stampCreate, stampUpdate, splitIds } from '../handle'

const fail = (msg) => ({ code: 601, msg })

/** 同级（同 parentId）部门名称唯一校验，排除自身；与后端 checkDeptNameUnique 同口径 */
function siblingNameTaken(db, parentId, name, excludeId) {
  return db.depts.some(d =>
    Number(d.parentId) === Number(parentId)
    && d.deptName === name
    && Number(d.deptId) !== Number(excludeId ?? -1))
}

/**
 * 部门类型层级校验，返回错误消息（null=通过）。
 * 演示身份 super 对齐后端非 admin 分支：机构(10) 仅平台管理员可建。
 */
function typeHierarchyError(db, dept) {
  const type = String(dept.deptType ?? '')
  if (!type) return '请选择部门类型（队伍/训练小组/科研小组/恢复小组）'
  if (type === '10') return '仅平台管理员可创建机构'
  if (dept.parentId == null || Number(dept.parentId) === 0) {
    return '队伍或小组必须挂在上级部门下'
  }
  const parent = db.depts.find(d => Number(d.deptId) === Number(dept.parentId))
  if (!parent) return '上级部门不存在'
  if (type === '20' && String(parent.deptType) !== '10') {
    return '队伍（梯队）只能建在机构（APMS 总部）下'
  }
  if (['30', '40', '50'].includes(type) && String(parent.deptType) !== '20') {
    return '小组只能建在队伍（梯队）下'
  }
  if (!['20', '30', '40', '50'].includes(type)) return `未知的部门类型：${type}`
  return null
}

/** APMS 受管部门类型（与真实 sys_dept.dept_type 字典一致；平台根公司 dept_type 为 NULL） */
const APMS_DEPT_TYPES = ['10', '20', '30', '40', '50']

/** 新增挂载位置守卫（对齐后端 SysDeptController.add 的非 admin 分支意图）：
 *  1) 不能挂根(0)下创建顶级部门；
 *  2) 不能挂在平台根公司（dept_type 为空，真实库即「康耐特科技」）下与 APMS 总部平级。
 *  注意不能按 parent.parentId===0 判定——演示库裁剪了根公司层，APMS 总部自身
 *  parentId=0 但 deptType=10，是受管子树顶端，其下建队伍(20)必须放行。 */
function mountGuard(db, parentId) {
  if (parentId == null || Number(parentId) === 0) {
    return '新增部门失败：不支持创建顶级部门，请在「APMS 总部」下新增下级'
  }
  const parent = db.depts.find(d => Number(d.deptId) === Number(parentId))
  if (!parent) return '上级部门不存在'
  if (!APMS_DEPT_TYPES.includes(String(parent.deptType))) {
    return '新增部门失败：仅支持在「APMS 总部」及其下级部门下新增'
  }
  return null
}

export const deptHandlers = [
  // 部门详情（编辑回显；出库副本，弹窗 v-model 改动留在副本上，保存才落库）
  route('get', '/system/dept/:deptId', (ctx) => {
    const row = getDb().depts.find(d => String(d.deptId) === String(ctx.params.deptId))
    if (!row) return fail('部门不存在或已被删除')
    return detail(structuredClone(row))
  }),

  // 查询部门列表（排除节点）：剔除节点自身及其整棵子树（ancestors 含该 id），
  // 与后端 excludeChild 的 removeIf 口径完全一致
  route('get', '/system/dept/list/exclude/:deptId', (ctx) => {
    const id = String(ctx.params.deptId)
    const rows = getDb().depts.filter(d =>
      String(d.deptId) !== id
      && !String(d.ancestors || '').split(',').includes(id))
    return { code: 200, msg: '操作成功', data: structuredClone(rows) }
  }),

  // 新增部门
  route('post', '/system/dept', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    const name = String(body.deptName || '').trim()
    if (!name) return fail('部门名称不能为空')
    if (body.parentId == null) return fail('上级部门不能为空')
    const mountErr = mountGuard(db, body.parentId)
    if (mountErr) return fail(mountErr)
    const parent = db.depts.find(d => Number(d.deptId) === Number(body.parentId))
    if (String(parent.status) !== '0') return fail('部门停用，不允许新增')
    const typeErr = typeHierarchyError(db, body)
    if (typeErr) return fail(typeErr)
    if (siblingNameTaken(db, body.parentId, name, null)) {
      return fail(`新增部门'${name}'失败，部门名称已存在`)
    }
    const deptId = nextPositiveId(db.depts, 'deptId')
    const row = {
      deptId,
      parentId: Number(body.parentId),
      ancestors: `${parent.ancestors},${parent.deptId}`,
      deptName: name,
      deptType: String(body.deptType),
      orderNum: Number(body.orderNum ?? 0),
      leader: body.leader || '',
      phone: body.phone || '',
      email: body.email || '',
      status: String(body.status || '0'),
      parentName: parent.deptName,
      children: []
    }
    stampCreate(row)
    db.depts.push(row)
    return ok('新增成功')
  }),

  // 修改部门（含移动部门：自身与后代 ancestors 联动）
  route('put', '/system/dept', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    const row = db.depts.find(d => Number(d.deptId) === Number(body.deptId))
    if (!row) return fail('部门不存在或已被删除')
    if (body.parentId != null && Number(body.parentId) === Number(row.deptId)) {
      return fail(`修改部门'${row.deptName}'失败，上级部门不能是自己`)
    }
    const name = String(body.deptName || '').trim()
    if (name && body.parentId != null && siblingNameTaken(db, body.parentId, name, row.deptId)) {
      return fail(`修改部门'${name}'失败，部门名称已存在`)
    }
    // 停用前置校验：含正常状态子部门时拒绝（后端 selectNormalChildrenDeptById 口径）
    if (String(body.status) === '1') {
      const hasNormalChild = db.depts.some(d =>
        Number(d.parentId) === Number(row.deptId) && String(d.status) === '0')
      if (hasNormalChild) return fail('该部门包含未停用的子部门！')
    }
    // 传了部门类型才校验层级（兼容历史无类型数据，与后端 edit 一致）
    if (body.deptType != null && body.deptType !== '') {
      const typeErr = typeHierarchyError(db, body)
      if (typeErr) return fail(typeErr)
    }
    const newParent = db.depts.find(d => Number(d.deptId) === Number(body.parentId))
    if (!newParent) return fail('上级部门不存在')
    const oldAncestors = row.ancestors
    const newAncestors = `${newParent.ancestors},${newParent.deptId}`
    Object.assign(row, {
      parentId: Number(body.parentId),
      deptName: name || row.deptName,
      deptType: body.deptType != null && body.deptType !== '' ? String(body.deptType) : row.deptType,
      orderNum: body.orderNum != null ? Number(body.orderNum) : row.orderNum,
      leader: body.leader ?? row.leader,
      phone: body.phone ?? row.phone,
      email: body.email ?? row.email,
      status: String(body.status ?? row.status),
      parentName: newParent.deptName
    })
    // 父级变更：重写自身及全部后代的 ancestors 前缀（对齐 updateDeptChildren）
    if (oldAncestors !== newAncestors) {
      row.ancestors = newAncestors
      const oldPrefix = `${oldAncestors},${row.deptId}`
      const newPrefix = `${newAncestors},${row.deptId}`
      db.depts.forEach(d => {
        if (String(d.ancestors || '').startsWith(oldPrefix)) {
          d.ancestors = newPrefix + String(d.ancestors).slice(oldPrefix.length)
        }
      })
    }
    stampUpdate(row)
    return ok('修改成功')
  }),

  // 保存排序：body { deptIds: "200,201", orderNums: "10,1" } 按下标配对
  route('put', '/system/dept/updateSort', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    const ids = splitIds(body.deptIds)
    const nums = String(body.orderNums || '').split(',').map(s => Number(s.trim()))
    if (!ids.length || ids.length !== nums.length) return fail('排序参数不完整')
    ids.forEach((id, i) => {
      const row = db.depts.find(d => Number(d.deptId) === id)
      if (row && Number.isFinite(nums[i])) row.orderNum = nums[i]
    })
    return ok()
  }),

  // 删除部门：三重引用校验，顺序与提示文案对齐后端 remove()
  route('delete', '/system/dept/:deptId', (ctx) => {
    const db = getDb()
    const id = Number(ctx.params.deptId)
    const row = db.depts.find(d => Number(d.deptId) === id)
    if (!row) return fail('部门不存在或已被删除')
    if (db.depts.some(d => Number(d.parentId) === id)) {
      return fail('存在下级部门,不允许删除')
    }
    if (db.users.some(u => Number(u.deptId) === id)) {
      return fail('部门存在用户,不允许删除')
    }
    const hasActiveAthlete = db.athletes.some(a =>
      Number(a.primaryTeamId) === id && String(a.status) === '0')
    const hasActiveMember = db.athleteGroups.some(g =>
      Number(g.deptId) === id && String(g.status) === '0' && !g.leaveDate)
    if (hasActiveAthlete || hasActiveMember) {
      return fail('该部门下存在在队运动员或在组成员,不允许删除,请先调整人员归属')
    }
    db.depts = db.depts.filter(d => Number(d.deptId) !== id)
    return ok('删除成功')
  })
]
