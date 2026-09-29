/**
 * 演示模式 · 框架级 handler（getInfo/getRouters/字典/公告/部门/锁屏/个人信息）
 * 业务模块 handler 见同目录其他文件，由 index.js 汇总。
 */
import { getInfoBody, apmsRouters, dictMap } from '../fixtures/system'
import { getDb, route, ok, detail, listData } from '../handle'

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
      roleGroup: '业务管理员',
      postGroup: '',
      admin: false
    },
    roleGroup: '业务管理员',
    postGroup: ''
  })),

  // 锁屏解锁（演示态不校验密码，直接放行）
  route('post', '/unlockscreen', () => ok())
]
