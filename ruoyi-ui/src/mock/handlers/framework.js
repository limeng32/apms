/**
 * 演示模式 · 框架级 handler（getInfo/getRouters/字典/公告/部门/锁屏/个人信息）
 * 业务模块 handler 见同目录其他文件，由 index.js 汇总。
 */
import { getInfoBody, apmsRouters, dictMap } from '../fixtures/system'
import { getDb, route, ok, detail, listData, paginate } from '../handle'

export const frameworkHandlers = [
  // 身份与菜单（进入演示后守卫首先拉取）
  route('get', '/getInfo', () => getInfoBody),
  route('get', '/getRouters', () => ({ code: 200, msg: '操作成功', data: apmsRouters })),

  // 字典（useDict → dict store；未配置的类型返回空数组，与真实后端无数据时一致）
  route('get', '/system/dict/data/type/:dictType', (ctx) => ({
    code: 200,
    msg: '操作成功',
    data: dictMap[ctx.params.dictType] || []
  })),

  // 顶部公告（Navbar 铃铛 onMounted 即拉取）
  route('get', '/system/notice/listTop', () => {
    const notices = getDb().notices
    return {
      code: 200,
      msg: '操作成功',
      data: notices,
      unreadCount: notices.filter(n => !n.isRead).length
    }
  }),
  route('get', '/system/notice/:id', (ctx) => {
    const row = getDb().notices.find(n => n.noticeId === Number(ctx.params.id))
    return detail(row || null)
  }),
  route('post', '/system/notice/markRead', (ctx) => {
    // 真实接口 ids 走 query（notice.js params）；兼容 body
    const id = Number(ctx.query.noticeId ?? ctx.body?.noticeId)
    const row = getDb().notices.find(n => n.noticeId === id)
    if (row) row.isRead = true
    return ok()
  }),
  route('post', '/system/notice/markReadAll', () => {
    getDb().notices.forEach(n => { n.isRead = true })
    return ok()
  }),
  route('get', '/system/notice/readUsers/list/:id', () => listData([])),

  // 部门树（花名册筛选/归属使用）
  route('get', '/system/dept/list', () => ({ code: 200, msg: '操作成功', data: getDb().depts })),

  // 个人中心（头像下拉可进入；演示给只读静态数据）
  route('get', '/system/user/profile', () => ({
    code: 200,
    msg: '操作成功',
    data: {
      userId: -1,
      userName: 'super',
      nickName: '体验账号（super）',
      deptId: null,
      dept: null,
      phonenumber: '',
      email: '',
      sex: '0',
      avatar: '',
      roleGroup: '超级用户',
      postGroup: '',
      admin: false
    },
    roleGroup: '超级用户',
    postGroup: ''
  })),

  // 系统 → 角色权限管理（分页列表；演示只读，写操作由引擎 601 拦截）
  route('get', '/system/role/list', (ctx) => {
    const rows = getDb().roles
    const kw = (ctx.query.roleName || ctx.query.roleKey || '').toString().
      trim().toLowerCase()
    const filtered = kw
      ? rows.filter(r =>
        String(r.roleName).toLowerCase().includes(kw)
        || String(r.roleKey).toLowerCase().includes(kw))
      : rows
    return paginate(filtered, ctx.query)
  }),
  route('get', '/system/role/:roleId', (ctx) => {
    const row = getDb().roles.find(r => String(r.roleId) === String(ctx.params.roleId))
    return detail(row || null)
  }),
  // 数据权限弹窗的部门树（演示无勾选数据，返回空树即可正常打开）
  route('get', '/system/role/deptTree/:roleId', () => ({
    code: 200,
    msg: '操作成功',
    data: { checkedKeys: [], depts: [] }
  })),

  // 登录手机号绑定（短信登录功能；演示站仅只读展示，bind/unbind 写操作由引擎 601 拦截）
  route('get', '/system/user/profile/phone/list', () => ({
    code: 200,
    msg: '操作成功',
    maxCount: 3,
    data: [
      { id: -9001, userId: -1, phonenumber: '13800138000', createTime: '2026-10-01 09:30:00' }
    ]
  })),
  // 管理员侧查看任意账号的绑定（演示无真实绑定，返回空列表）
  route('get', '/system/user/phone/list/:userId', () => ({
    code: 200,
    msg: '操作成功',
    maxCount: 3,
    data: []
  }))
]
