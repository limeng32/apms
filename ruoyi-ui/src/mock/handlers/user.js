/**
 * 演示模式 · 系统 → 用户管理 handler（对齐真实 SysUserController 契约）
 *
 * 数据：db.users / db.roles / db.posts / db.depts（fixtures/system.js 蓝本）。
 * 边界与真实后端一致：
 * - super（userId=100，userName='super'）为受保护账号，禁删/禁停用/禁改角色，
 *   与页面 isProtectedUser 的前端收敛双向对齐，直调 mock 同样拦截；
 * - 专岗账号角色只允许 portal_*（roleId 201-203），不发 admin/business_admin；
 * - 写操作仅当前标签页生效，刷新随 resetDb 还原。
 */
import { getDb, route, ok, paginate, like, eq, splitIds, nextPositiveId, stampCreate, stampUpdate, now } from '../handle'

/** 部门扁平列表 → {id,label,children} 树（GET /system/user/deptTree 契约） */
function buildDeptTree(depts) {
  const nodes = depts.map(d => ({
    id: d.deptId,
    label: d.deptName,
    parentId: d.parentId,
    disabled: d.status === '1',
    children: []
  }))
  const map = new Map(nodes.map(n => [n.id, n]))
  const roots = []
  for (const n of nodes) {
    const parent = n.parentId ? map.get(n.parentId) : null
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  return roots
}

/** 收集某部门及其全部后代部门 id（列表按部门筛选时与真实后端「含子部门」口径一致） */
function deptIdWithChildren(depts, rootId) {
  const ids = new Set([Number(rootId)])
  let changed = true
  while (changed) {
    changed = false
    for (const d of depts) {
      if (ids.has(Number(d.parentId)) && !ids.has(Number(d.deptId))) {
        ids.add(Number(d.deptId))
        changed = true
      }
    }
  }
  return ids
}

/** 按 roleIds 组装角色显示对象（与真实 sys_user 行内 roles 结构对齐） */
function joinRoles(roleIds) {
  const db = getDb()
  return (roleIds || [])
    .map(id => db.roles.find(r => Number(r.roleId) === Number(id)))
    .filter(Boolean)
    .map(r => ({ roleId: r.roleId, roleName: r.roleName }))
}

/** 按 deptId 组装部门显示对象 */
function joinDept(deptId) {
  const d = getDb().depts.find(x => Number(x.deptId) === Number(deptId))
  return d ? { deptId: d.deptId, deptName: d.deptName } : null
}

/** 受保护账号拦截（super 账号不允许删/停用/改角色） */
function assertNotProtected(user, action) {
  if (user && user.userName === 'super') {
    return { code: 601, msg: `受保护账号「super」不允许${action}，如需调整请联系平台管理员` }
  }
  return null
}

export const userHandlers = [
  // 用户分页列表（用户名称/手机号模糊、状态/部门等值、创建时间区间）
  route('get', '/system/user/list', (ctx) => {
    const db = getDb()
    const q = ctx.query
    let rows = db.users.slice()
    if (q.userName) rows = rows.filter(u => like(u.userName, q.userName))
    if (q.phonenumber) rows = rows.filter(u => like(u.phonenumber, q.phonenumber))
    if (q.status !== undefined && q.status !== '') rows = rows.filter(u => eq(u.status, q.status))
    if (q.deptId) {
      const scope = deptIdWithChildren(db.depts, q.deptId)
      rows = rows.filter(u => scope.has(Number(u.deptId)))
    }
    if (q.params && q.params.beginTime) {
      rows = rows.filter(u => (u.createTime || '') >= q.params.beginTime)
    }
    if (q.params && q.params.endTime) {
      rows = rows.filter(u => (u.createTime || '') <= `${q.params.endTime} 23:59:59`)
    }
    return paginate(rows, q)
  }),

  // 用户页左侧部门树
  route('get', '/system/user/deptTree', () => ({
    code: 200,
    msg: '操作成功',
    data: buildDeptTree(getDb().depts)
  })),

  // 新增弹窗的角色/岗位选项（getUser() 无参 → URL 末尾带斜杠，见 api/system/user.js parseStrEmpty）
  route('get', '/system/user/', () => {
    const db = getDb()
    return { code: 200, msg: '操作成功', roles: db.roles, posts: db.posts }
  }),

  // 用户详情（编辑弹窗：data + roles/posts + 回显 id 数组）
  route('get', '/system/user/:userId', (ctx) => {
    const db = getDb()
    const user = db.users.find(u => String(u.userId) === String(ctx.params.userId))
    if (!user) return { code: 601, msg: '用户不存在或已被删除' }
    return {
      code: 200,
      msg: '操作成功',
      data: { ...user },
      roles: db.roles,
      posts: db.posts,
      roleIds: user.roleIds || [],
      postIds: user.postIds || []
    }
  }),

  // 新增用户（专岗账号：无密码字段，loginPhonenumber 作为短信登录手机号）
  route('post', '/system/user', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    if (!body.userName || !body.userName.trim()) {
      return { code: 601, msg: '用户名称不能为空' }
    }
    if (db.users.some(u => u.userName === body.userName.trim())) {
      return { code: 601, msg: `登录账号「${body.userName}」已存在` }
    }
    const userId = nextPositiveId(db.users, 'userId', 1000)
    const row = {
      userId,
      deptId: body.deptId ?? null,
      userName: body.userName.trim(),
      nickName: body.nickName || body.userName.trim(),
      userType: 'sys_user',
      email: body.email || '',
      phonenumber: body.phonenumber || body.loginPhonenumber || '',
      sex: body.sex || '0',
      avatar: '',
      status: body.status || '0',
      delFlag: '0',
      loginIp: '',
      loginDate: null,
      remark: body.remark || '',
      roleIds: body.roleIds || [],
      postIds: body.postIds || [],
      createTime: now()
    }
    row.dept = joinDept(row.deptId)
    row.roles = joinRoles(row.roleIds)
    stampCreate(row)
    db.users.push(row)
    return ok('新增成功')
  }),

  // 修改用户
  route('put', '/system/user', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    const user = db.users.find(u => Number(u.userId) === Number(body.userId))
    if (!user) return { code: 601, msg: '用户不存在或已被删除' }
    const blocked = assertNotProtected(user, '修改核心信息')
    if (blocked && (body.roleIds || body.status === '1')) return blocked
    Object.assign(user, {
      deptId: body.deptId ?? user.deptId,
      nickName: body.nickName ?? user.nickName,
      phonenumber: body.phonenumber ?? user.phonenumber,
      email: body.email ?? user.email,
      sex: body.sex ?? user.sex,
      status: body.status ?? user.status,
      remark: body.remark ?? user.remark,
      roleIds: body.roleIds ?? user.roleIds,
      postIds: body.postIds ?? user.postIds
    })
    user.dept = joinDept(user.deptId)
    user.roles = joinRoles(user.roleIds)
    stampUpdate(user)
    return ok('修改成功')
  }),

  // 删除用户（支持批量逗号 id；受保护账号整批拒绝）
  route('delete', '/system/user/:ids', (ctx) => {
    const db = getDb()
    const ids = splitIds(ctx.params.ids)
    for (const id of ids) {
      const user = db.users.find(u => Number(u.userId) === id)
      const blocked = assertNotProtected(user, '删除')
      if (blocked) return blocked
    }
    db.users = db.users.filter(u => !ids.includes(Number(u.userId)))
    return ok('删除成功')
  }),

  // 重置密码（演示不存明文密码，仅回成功）
  route('put', '/system/user/resetPwd', (ctx) => {
    const db = getDb()
    const user = db.users.find(u => Number(u.userId) === Number(ctx.body?.userId))
    if (!user) return { code: 601, msg: '用户不存在或已被删除' }
    return ok('密码重置成功')
  }),

  // 状态切换
  route('put', '/system/user/changeStatus', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    const user = db.users.find(u => Number(u.userId) === Number(body.userId))
    if (!user) return { code: 601, msg: '用户不存在或已被删除' }
    const blocked = assertNotProtected(user, '停用')
    if (blocked) return blocked
    user.status = String(body.status)
    stampUpdate(user)
    return ok('状态修改成功')
  }),

  // 授权角色页（真实菜单不在演示路由内，给最小可用响应，避免直连 MISS）
  route('get', '/system/user/authRole/:userId', (ctx) => {
    const db = getDb()
    const user = db.users.find(u => String(u.userId) === String(ctx.params.userId))
    if (!user) return { code: 601, msg: '用户不存在或已被删除' }
    return {
      code: 200,
      msg: '操作成功',
      data: { ...user },
      roles: db.roles,
      roleIds: user.roleIds || []
    }
  }),
  route('put', '/system/user/authRole', (ctx) => {
    const db = getDb()
    const userId = Number(ctx.query.userId)
    const user = db.users.find(u => Number(u.userId) === userId)
    if (!user) return { code: 601, msg: '用户不存在或已被删除' }
    const blocked = assertNotProtected(user, '改授角色')
    if (blocked) return blocked
    user.roleIds = ctx.query.roleIds ? String(ctx.query.roleIds).split(',').map(Number) : []
    user.roles = joinRoles(user.roleIds)
    stampUpdate(user)
    return ok('授权成功')
  }),

  // 个人中心资料修改（演示身份 userId=-1 不在 users 表，宽容返回成功）
  route('put', '/system/user/profile', (ctx) => {
    const db = getDb()
    const body = ctx.body || {}
    const user = db.users.find(u => Number(u.userId) === Number(body.userId))
    if (user) Object.assign(user, { nickName: body.nickName, phonenumber: body.phonenumber, email: body.email, sex: body.sex })
    return ok()
  }),
  route('put', '/system/user/profile/updatePwd', () => ok())
]
