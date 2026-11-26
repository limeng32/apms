/**
 * 演示模式 Node 桩测（不依赖无头浏览器）
 *
 * 运行：node .trae/demo-tests/run.mjs
 * 覆盖：
 * A. auth 四态 × 三调用序列（无状态裁决、零 Cookie 写删、fail-closed）
 * B. enterDemo：口令错误/存储异常中止、成功后清身份
 * C. normalizeRequest 5 用例
 * D. mockDispatch：精确/参数段匹配、lenient 空态、写操作 601、strict 601
 * E. 真实 axios 1.13.2 实例走 demoAdapter + request.js 真实拦截器挂接点
 * F. download() 演示守卫
 * G. db 生命周期（加载即初始化 / reset / 与 fixtures 深隔离）
 * H. 业务 handler：13 模块路由/筛选/CRUD 内存语义/子资源错配/全序列零 MISS
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(new URL('./hooks.mjs', import.meta.url))

const { UI_SRC, STUBS } = await import('./hooks.mjs')
const src = (p) => pathToFileURL(`${UI_SRC}/${p}.js`).href

/* ------------------------------ 最小测试框架 ------------------------------ */
let passed = 0
const failures = []
const queue = []
function test(group, name, fn) {
  queue.push(async () => {
    try {
      await fn()
      passed++
    } catch (e) {
      failures.push(`[${group}] ${name}: ${e.stack || e}`)
    }
  })
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
function assertDeep(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'deepEq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

/* ------------------------------ 环境与存储模拟 ------------------------------ */
globalThis.__VITE_ENV__ = { DEV: false, VITE_APP_BASE_API: '/dev-api' }

const ss = {
  mem: new Map(),
  getThrow: false,
  setThrow: false,
  set(mode) {
    this.mem.clear()
    this.getThrow = false
    this.setThrow = false
    if (mode === 'demo') this.mem.set('apms_demo_session', JSON.stringify({ mode: 'demo', token: 'demo-static-1700000000000' }))
    if (mode === 'broken-json') this.mem.set('apms_demo_session', '{not-json')
    if (mode === 'broken-struct') this.mem.set('apms_demo_session', JSON.stringify({ mode: 'demo', token: 'real-looking-token' }))
    if (mode === 'broken-junk') this.mem.set('apms_demo_session', JSON.stringify({ hello: 1 }))
    if (mode === 'storage-error') this.getThrow = true
  }
}
globalThis.sessionStorage = {
  getItem: (k) => { if (ss.getThrow) throw new Error('SecurityError'); return ss.mem.has(k) ? ss.mem.get(k) : null },
  setItem: (k, v) => { if (ss.setThrow || ss.getThrow) throw new Error('SecurityError'); ss.mem.set(k, String(v)) },
  removeItem: (k) => { if (ss.getThrow) throw new Error('SecurityError'); ss.mem.delete(k) }
}

// 桩模块单例
const cookieStub = (await import(STUBS['js-cookie'])).default
const epStub = await import(STUBS['element-plus'])
const { __store: storeState } = await import(STUBS['@/store/modules/user'])

// console.error 探针（[DEMO MOCK MISS]）
const missLog = []
const origError = console.error
console.error = (...args) => { if (String(args[0]).includes('[DEMO MOCK MISS]')) missLog.push(args) }

const AUTH_URL = src('utils/auth')
const MOCK_URL = src('mock/index')
const fresh = (u) => import(`${u}?bust=${Math.random()}`)

/* ============================ A. 四态 × 三序列 ============================ */
// 序列：S1 直接调用 / S2 先 setDemoSession 再把存储切到异常 / F5 重新求值后调用
const EXPECT = {
  'none':            { demo: false, token: 'real-cookie-token' },
  'demo':            { demo: true,  tokenPrefix: 'demo-static-' },
  'broken-json':     { demo: true,  token: undefined },
  'broken-struct':   { demo: true,  token: undefined },
  'broken-junk':     { demo: true,  token: undefined },
  'storage-error':   { demo: true,  token: undefined }
}

for (const mode of Object.keys(EXPECT)) {
  // S1：直接调用（每次新模块实例，模拟独立页面加载）
  test('A1', `state=${mode} 直接调用裁决`, async () => {
    cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
    ss.set(mode)
    const auth = await fresh(AUTH_URL)
    assertEq(auth.isDemoMode(), EXPECT[mode].demo, 'isDemoMode')
    const token = auth.getToken()
    if ('tokenPrefix' in EXPECT[mode]) assert(String(token).startsWith(EXPECT[mode].tokenPrefix), `token 应带前缀，实际 ${token}`)
    else assertEq(token, EXPECT[mode].token, 'getToken')
    // 只读裁决：零 Cookie 写/删（get 回落允许读）
    const writes = cookieStub._log.filter(([op]) => op !== 'get')
    assertEq(writes.length, 0, `不得写删 Cookie，实际 ${JSON.stringify(writes)}`)
  })
}

test('A2', 'S2：先合法进入演示，随后 sessionStorage 抛错 → 仍 fail-closed', async () => {
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('none')
  const auth = await fresh(AUTH_URL)
  auth.setDemoSession('demo-static-123')
  assertEq(auth.isDemoMode(), true, '进入后应是演示态')
  // 运行中存储被禁用（与"是否进过演示"无关）
  ss.set('storage-error')
  assertEq(auth.isDemoMode(), true, 'storage-error 下 isDemoMode 恒 true')
  assertEq(auth.getToken(), undefined, 'storage-error 下 getToken 无条件 undefined，禁止回落 Cookie')
  const writes = cookieStub._log.filter(([op]) => op !== 'get')
  assertEq(writes.length, 0, '全程零 Cookie 写删')
})

test('A3', 'S3：F5 重新求值（模块缓存击穿）后异常存储，裁决一致', async () => {
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('broken-json')
  const auth = await fresh(AUTH_URL)
  assertEq(auth.isDemoMode(), true, 'F5 后 broken 仍判定演示态')
  assertEq(auth.getToken(), undefined, 'F5 后 broken 不回落 Cookie')
  // 同一存储状态反复调用结果必须一致（无状态）
  for (let i = 0; i < 5; i++) {
    assertEq(auth.isDemoMode(), true, `第 ${i + 1} 次 isDemoMode 一致`)
    assertEq(auth.getToken(), undefined, `第 ${i + 1} 次 getToken 一致`)
  }
})

test('A4', 'none → demo → clear 往返不碰 Cookie', async () => {
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('none')
  const auth = await fresh(AUTH_URL)
  assertEq(auth.getToken(), 'real-cookie-token', 'none 回落 Cookie')
  auth.setDemoSession('demo-static-abc')
  assert(auth.getToken().startsWith('demo-static-'), 'demo token')
  auth.clearDemoSession()
  assertEq(auth.isDemoMode(), false, '清除后非演示态')
  assertEq(auth.getToken(), 'real-cookie-token', '清除后回落 Cookie')
  assertEq(cookieStub._log.filter(([op]) => op !== 'get').length, 0, '零写删')
})

test('A5', 'storage-error 下 clearDemoSession 静默不抛', async () => {
  ss.set('storage-error')
  const auth = await fresh(AUTH_URL)
  auth.clearDemoSession() // 不得抛错
  assert(true)
})

/* ============================ B. enterDemo / exitDemo ============================ */
test('B1', '口令错误：抛错且不写会话、不动 store', async () => {
  ss.set('none')
  storeState.token = 'keep'; storeState.roles = ['keep']; storeState.permissions = ['keep']
  const demo = await import(src('utils/demo'))
  let threw = false
  try { demo.enterDemo('0000') } catch (e) { threw = true; assertEq(e.message, '口令不正确') }
  assert(threw, '错误口令必须抛错')
  assertEq(ss.mem.has('apms_demo_session'), false, '不得写会话键')
  assertEq(storeState.token, 'keep', 'store 不得被改')
})

test('B2', 'setItem 抛错：中止进入（不重置身份，等价于不会跳转）', async () => {
  ss.set('none'); ss.setThrow = true
  storeState.token = 'keep'; storeState.roles = ['keep']
  const demo = await import(src('utils/demo'))
  let threw = false
  try { demo.enterDemo('8888') } catch (e) { threw = true }
  assert(threw, '存储异常必须向上抛')
  assertEq(storeState.token, 'keep', 'store 不得被重置')
  assertEq(storeState.roles[0], 'keep', 'roles 不得被清空')
  ss.setThrow = false
})

test('B3', '正确口令：写会话 + resetDb + 清空身份', async () => {
  ss.set('none')
  const db = await import(src('mock/db'))
  db.getDb().notices.push({ noticeId: 999 }) // 制造脏数据
  storeState.token = 'old'; storeState.roles = ['x']; storeState.permissions = ['y']; storeState.portalMode = true
  const demo = await import(src('utils/demo'))
  demo.enterDemo('8888')
  const raw = JSON.parse(ss.mem.get('apms_demo_session'))
  assertEq(raw.mode, 'demo')
  assert(String(raw.token).startsWith('demo-static-'), 'token 前缀')
  assertEq(db.getDb().notices.length, 2, 'enterDemo 必须 resetDb（脏数据被清）')
  assertEq(storeState.roles.length, 0, 'roles 必须清空')
  assertEq(storeState.permissions.length, 0, 'permissions 必须清空')
  assert(String(storeState.token).startsWith('demo-static-'), 'store.token 取演示 token')
  assertEq(storeState.portalMode, false, 'portalMode 复位')
  demo.exitDemo()
  assertEq(ss.mem.has('apms_demo_session'), false, 'exit 清键')
  assertEq(storeState.token, '', 'exit 清 store')
  assertEq(cookieStub._log.filter(([op]) => op !== 'get').length, 0, 'exit 不得删 Cookie')
})

/* ============================ C. normalizeRequest ============================ */
test('C1', 'GET tansParams 改写后：path 干净 + query 正确（含 params[k] 键名）', async () => {
  const { normalizeRequest } = await import(MOCK_URL)
  const ctx = normalizeRequest({
    method: 'get',
    baseURL: '/dev-api',
    url: '/apms/athlete/list?pageNum=2&pageSize=5&params%5BbeginTime%5D=2026-01-01',
    params: {}
  })
  assertEq(ctx.path, '/apms/athlete/list', 'path')
  assertEq(ctx.query.pageNum, '2')
  assertEq(ctx.query.pageSize, '5')
  // 命名下标 params[beginTime] 归并为对象（RuoYi BaseEntity params Map 语义）
  assertEq(ctx.query.params && ctx.query.params.beginTime, '2026-01-01', '命名方括号键归并为对象')
})

test('C2', 'POST 残留 config.params 补拍进 query + 对象/字符串 body', async () => {
  const { normalizeRequest } = await import(MOCK_URL)
  const ctx = normalizeRequest({
    method: 'post',
    url: '/apms/test-task/enroll',
    params: { taskId: 7 },
    data: { athleteId: 1001 } // axios 场景下通常已被 stringify，这里同时测对象直用
  })
  assertEq(ctx.query.taskId, '7', 'POST params 补拍')
  assertEq(ctx.body.athleteId, 1001, '对象 body 直用')
  const ctx2 = normalizeRequest({ method: 'post', url: '/x', data: JSON.stringify({ a: 1 }) })
  assertEq(ctx2.body.a, 1, 'JSON 字符串解析')
  const ctx3 = normalizeRequest({ method: 'post', url: '/x', data: 'a=b&c=d' })
  assertEq(ctx3.body, 'a=b&c=d', '非 JSON 字符串保留原串')
})

test('C3', 'method 缺省 → get；无 body → {}；baseURL 剥除', async () => {
  const { normalizeRequest } = await import(MOCK_URL)
  const ctx = normalizeRequest({ baseURL: '/dev-api', url: '/dev-api/getInfo' })
  assertEq(ctx.method, 'get')
  assertEq(ctx.path, '/getInfo')
  assertDeep(ctx.body, {}, '空 body 归一为 {}')
})

/* ============================ D. mockDispatch ============================ */
test('D1', '框架接口：getInfo/getRouters/字典/公告/部门', async () => {
  const { mockDispatch } = await import(MOCK_URL)
  const info = mockDispatch({ method: 'get', path: '/getInfo', query: {}, body: {} })
  assertEq(info.code, 200)
  assertEq(info.roles[0], 'super')
  assertEq(info.permissions[0], '*:*:*')
  assertEq(info.user.userName, 'super')
  assert(info.user.userId < 0, '演示 userId 必须为负数，避免与真实账号撞 ID')

  // 与真实 super（role_id=200）2400 分组树一致：6 个顶级分组、11 个 C 页
  // （patch-0.0.9 在「系统」下新增用户管理后由 10 增至 11）
  const routers = mockDispatch({ method: 'get', path: '/getRouters', query: {}, body: {} })
  const groups = routers.data
  assertEq(groups.length, 6, '六个顶级分组：总览/运动员/测试/健康/分析/系统')
  assertEq(groups[0].path, '/overview')
  assertEq(groups.reduce((n, g) => n + g.children.length, 0), 11, '11 个 C 型页面')
  const flat = groups.flatMap(g => g.children.map(c => `${g.path}/${c.path}`))
  ;[
    '/overview/cockpit',
    '/athletes/roster', '/athletes/growth',
    '/testings/dispatch', '/testings/combo-dispatch',
    '/healthcare/alert-center', '/healthcare/medical-care',
    '/analytics/report-center',
    '/sysmgr/role-acl', '/sysmgr/org', '/sysmgr/user'
  ].forEach(p => assert(flat.includes(p), `菜单包含 ${p}`))
  // RTP 状态/风险预警已并入「健康预警中心」合并页，不再有独立 C 菜单
  assert(!flat.some(p => p.endsWith('/rtp') || p.endsWith('/rtpWarning')), '无独立 RTP C 菜单')

  const pos = mockDispatch({ method: 'get', path: '/system/dict/data/type/apms_position', query: {}, body: {} })
  assertEq(pos.data.length, 4)
  const unknown = mockDispatch({ method: 'get', path: '/system/dict/data/type/no_such_type', query: {}, body: {} })
  assertEq(unknown.data.length, 0, '未知字典空数组而非报错')

  const notices = mockDispatch({ method: 'get', path: '/system/notice/listTop', query: {}, body: {} })
  assert(notices.data.length >= 1 && typeof notices.unreadCount === 'number')
})

test('D2', '精确 + :param 模板匹配优先级', async () => {
  const { mockDispatch } = await import(MOCK_URL)
  const one = mockDispatch({ method: 'get', path: '/system/notice/1', query: {}, body: {} })
  assertEq(one.code, 200)
  assertEq(one.data.noticeId, 1)
  const mark = mockDispatch({ method: 'post', path: '/system/notice/markRead', query: { noticeId: '1' }, body: {} })
  assertEq(mark.code, 200)
})

test('D3', 'lenient（生产默认）：未匹配 GET 空态 200；写操作 601；均报 MISS', async () => {
  const { mockDispatch } = await import(MOCK_URL)
  missLog.length = 0
  const getMiss = mockDispatch({ method: 'get', path: '/apms/not-ready/list', query: {}, body: {} })
  assertEq(getMiss.code, 200, 'GET 不静默报错但空态')
  assertEq(getMiss.rows.length, 0)
  assertEq(getMiss.total, 0)
  const postMiss = mockDispatch({ method: 'post', path: '/apms/not-ready', query: {}, body: {} })
  assertEq(postMiss.code, 601, '写操作不允许假成功')
  assertEq(missLog.length, 2, '两种未匹配都必须 console.error')
})

test('D4', 'strict（dev 默认）：未匹配 GET 同样 601', async () => {
  globalThis.__VITE_ENV__.VITE_DEMO_MOCK_STRICT = 'true'
  const { mockDispatch } = await import(MOCK_URL)
  const r = mockDispatch({ method: 'get', path: '/apms/x/list', query: {}, body: {} })
  assertEq(r.code, 601)
  assert(r.msg.includes('/apms/x/list'), 'msg 含方法路径，便于补 handler')
  delete globalThis.__VITE_ENV__.VITE_DEMO_MOCK_STRICT
})

/* ============================ E. 真实 axios + adapter + 拦截器 ============================ */
test('E1', 'demoAdapter 经真实 axios 1.13.2：200 进响应拦截器、601 reject', async () => {
  const axios = (await import('axios')).default
  const { demoAdapter } = await import(MOCK_URL)
  const instance = axios.create({ baseURL: '/dev-api', adapter: demoAdapter })
  instance.interceptors.response.use(
    (res) => (res.data && res.data.code === 200 ? res.data : Promise.reject(res.data)),
    (e) => Promise.reject(e?.response?.data || e)
  )
  const info = await instance.get('/getInfo')
  assertEq(info.user.userName, 'super', '200 正常穿透响应拦截器')

  let rejected = null
  try { await instance.post('/apms/not-ready', { x: 1 }) } catch (e) { rejected = e }
  assertEq(rejected && rejected.code, 601, '写操作 601 被响应拦截器 reject')

  const empty = await instance.get('/apms/unknown/list')
  assertEq(empty.code, 200)
  assertEq(empty.rows.length, 0)
})

test('E2', 'request.js 真实请求拦截器：demo/broken 挂 adapter，none 不挂', async () => {
  ss.set('demo')
  const service = (await import(src('utils/request'))).default
  const before = service.interceptors.request.handlers[0]
  const cfg = await before.fulfilled({ method: 'get', url: '/getInfo', params: { a: 1 }, headers: {} })
  const { demoAdapter } = await import(MOCK_URL)
  assertEq(cfg.adapter, demoAdapter, 'demo 态必须挂 demoAdapter')
  assertEq(cfg.headers.Authorization, 'Bearer demo-static-1700000000000')
  // 真的通过该 adapter 拿到本地响应（零网络）
  const res = await cfg.adapter(cfg)
  assertEq(res.status, 200)
  assertEq(res.data.user.userName, 'super')

  ss.set('broken-json')
  const cfgBroken = await before.fulfilled({ method: 'get', url: '/getInfo', headers: {} })
  assertEq(cfgBroken.adapter, demoAdapter, 'broken 态 adapter 绝不卸载')

  ss.set('none')
  const cfgNone = await before.fulfilled({ method: 'get', url: '/getInfo', headers: {} })
  assert(cfgNone.adapter === undefined || cfgNone.adapter.toString().includes('xhr') === false, 'none 态不得挂 demoAdapter')
})

/* ============================ F. download 守卫 ============================ */
test('F1', 'download() 演示态前置拦截（blob 判断在 601 之前，不能靠 mock body）', async () => {
  ss.set('demo')
  epStub.__calls.length = 0
  const { download } = await import(src('utils/request'))
  const r = await download('/common/download', {}, 'demo.csv')
  assertEq(r, undefined, 'download 返回 resolve(undefined)')
  const warn = epStub.__calls.find(([tag]) => tag === 'ElMessage.warning')
  assert(warn && String(warn[1]).includes('下载'), '必须提示不支持下载')
  const loading = epStub.__calls.find(([tag]) => tag === 'ElLoading.service')
  assert(!loading, '不得弹出下载 loading / 不发请求')
})

/* ============================ G. db 生命周期 ============================ */
test('G1', '模块加载即初始化：表齐全、无 undefined', async () => {
  const db = await import(src('mock/db'))
  const d = db.getDb()
  const tables = Object.keys(d)
  assertEq(tables.length, 28, `表数量 ${tables.length}`)
  for (const t of tables) assert(Array.isArray(d[t]), `${t} 必须是数组`)
  assertEq(d.notices.length, 2)
  // depts 与真实接口一致：扁平列表（children 均为空，树由前端构建）
  assertEq(d.depts.length, 6, '部门扁平列表 6 条')
  assert(d.depts.every(x => Array.isArray(x.children) && x.children.length === 0), 'children 必须全部为空数组')
  // 系统组角色列表：super + 三门户专岗
  assertEq(d.roles.length, 4, '角色 4 条')
  assertEq(d.roles[0].roleKey, 'super')
  // 用户管理蓝本：3 个岗位 + 5 个账号（含 1 个停用示例、1 个受保护 super）
  assertEq(d.posts.length, 3, '岗位 3 条')
  assertEq(d.users.length, 5, '用户 5 条')
  assertEq(d.users[0].userName, 'super', '首条为受保护 super 账号')
})

test('G2', 'resetDb 还原 + 与 fixtures 深隔离', async () => {
  const db = await import(src('mock/db'))
  const { tables } = await import(src('mock/fixtures/index'))
  const before = tables.depts.length
  db.getDb().notices.push({ noticeId: 998 })
  db.getDb().depts[0].leader = '篡改者'
  db.resetDb()
  assertEq(db.getDb().notices.length, 2, 'reset 还原 notices')
  assert(db.getDb().depts[0].leader !== '篡改者', '深克隆：嵌套对象互不影响')
  assertEq(tables.depts.length, before, 'fixtures 源数据不被 db 污染')
  // 两份新库互不影响
  const a = db.getDb()
  db.resetDb()
  const b = db.getDb()
  a.notices.push({ noticeId: 997 })
  assertEq(b.notices.length, 2, '旧库改动不影响新库')
})

test('G3', '演示时钟凝固：相对窗口/年龄/时间戳全部锚定 2026-10-05，不随真实日期漂移', async () => {
  const clk = await import(src('mock/clock'))
  assertEq(clk.today(), '2026-10-05')
  assertEq(clk.daysAgo(365), '2025-10-05', '近 365 天窗口固定')
  assertEq(clk.daysAgo(0), '2026-10-05')
  assertEq(clk.monthsAgoDate(12), '2025-10-05')
  assertEq(clk.monthStart(), '2026-10-01')
  assertEq(clk.nextJanFirst(), '2027-01-01')
  // 1001 张志远 2009-03-15 生 → 锚点日 17 周岁（不受真实运行日期影响）
  assertEq(clk.ageAtToday('2009-03-15'), 17)
  // 2009-11-25 生 → 锚点日尚未过生日，16 周岁
  assertEq(clk.ageAtToday('2009-11-25'), 16)
  assert(clk.nowTs().startsWith('2026-10-05 12:00'), '时间戳凝固到锚点')
  assertEq(clk.nowTs(), '2026-10-05 12:00:01', '时间戳内部逐秒递增')
})

/* ============================ H. 业务 handler 集成 ============================ */
const dbMod = await import(src('mock/db'))
const engine = await import(MOCK_URL)
const call = (method, path, query = {}, body = {}) =>
  engine.mockDispatch({ method, path, query, body })
const reset = () => dbMod.resetDb()
const db = () => dbMod.getDb()
const expect200 = (r, what) => assertEq(r.code, 200, `${what} 应 200，实际 ${JSON.stringify(r).slice(0, 200)}`)

test('H0', '蓝本数据已入库（15 队员/5 指标/7 任务/4 组合成分/12 附件）', async () => {
  reset()
  assertEq(db().athletes.length, 15)
  assertEq(db().indicators.length, 5)
  assertEq(db().testTasks.length, 7)
  assertEq(db().comboComponents.length, 4)
  assertEq(db().medicalFiles.length, 12)
  assert(db().athletes.some(a => a.athleteId === 1001 && a.name === '张志远'), '蓝本队员存在')
})

test('H1', '花名册：分页/模糊/队别/年龄组筛选 + 当前小组聚合 + rtpSummary', async () => {
  reset()
  const all = call('get', '/apms/athlete/list', { pageNum: '1', pageSize: '10' })
  expect200(all, 'athlete list'); assertEq(all.total, 15); assertEq(all.rows.length, 10)
  const page2 = call('get', '/apms/athlete/list', { pageNum: '2', pageSize: '10' })
  assertEq(page2.rows.length, 5, '第二页 5 条')
  const byName = call('get', '/apms/athlete/list', { name: '张' })
  assert(byName.rows.every(r => r.name.includes('张')), '模糊筛选')
  const u18 = call('get', '/apms/athlete/list', { primaryTeamId: '201' })
  assert(u18.rows.length >= 1 && u18.rows.every(r => String(r.primaryTeamId) === '201'), '队别筛选')
  // 列表行带当前在组小组名（1001 当前在 203 速度专项组；205 力量组已离组不计入）
  const a1001 = call('get', '/apms/athlete/list', { pageSize: '50' }).rows.find(r => r.athleteId === 1001)
  assert(a1001 && a1001.currentGroups === '速度专项组', '当前在组小组聚合（已离组不计）：' + (a1001 && a1001.currentGroups))
  const ageGrp = call('get', '/apms/athlete/list', { ageGroups: ['17'] })
  assert(ageGrp.rows.every(r => Number(r.age) + 1 === 17), '年龄组多选（age+1 口径）')
  // 真实 tansParams 把数组序列化为 ageGroups[0]=17&ageGroups[1]=18，必须端到端还原
  const norm = engine.normalizeRequest({
    method: 'get',
    url: '/apms/athlete/list?pageNum=1&pageSize=50&ageGroups%5B0%5D=17&ageGroups%5B1%5D=18',
    params: {}, headers: {}
  })
  assertDeep(norm.query.ageGroups, ['17', '18'], '方括号下标 query 还原为数组')
  const br = engine.mockDispatch(norm)
  assertEq(br.code, 200)
  assert(br.rows.length >= 1 && br.rows.every(r => [17, 18].includes(Number(r.age) + 1)),
    'tansParams 方括号形态下年龄组筛选必须生效')
  // 不选年龄组时不得误伤（空数组/缺键都返回全量）
  assertEq(call('get', '/apms/athlete/list', { pageSize: '50' }).total, 15)
  const detail = call('get', '/apms/athlete/1001')
  expect200(detail, 'athlete detail'); assertEq(detail.data.name, '张志远')
  const summary = call('get', '/apms/athlete/rtpSummary')
  const summed = summary.data.reduce((s, x) => s + x.cnt, 0)
  assertEq(summed, 15, 'rtpSummary 覆盖全部在队队员（含未评估无 status 项）')
})

test('H2', '花名册 CRUD 内存生效：增（负 ID）→ 改 → 逻辑删 → reset 还原', async () => {
  reset()
  const add = call('post', '/apms/athlete', {}, { name: '测试小将', gender: 'M', primaryTeamId: 201, birthday: '2010-06-01' })
  expect200(add, 'add athlete')
  assertEq(db().athletes.length, 16)
  const created = db().athletes[0]
  assert(/^\d+$/.test(String(created.athleteId)), '新行正整数 ID（匹配静态路由 \\d+ 约束）')
  assert(created.athleteId > 1015, '正数 ID 不与蓝本冲突')
  assertEq(created.teamName, 'U18 梯队', '队名冗余回填')
  // 表单只提交 birthday，age 由查询端按周岁实时派生（2010-06-01 → 2026-09-29 为 16 岁，年龄组 U17）
  assertEq(created.age, undefined, 'age 不落库')
  const detailNew = call('get', `/apms/athlete/${created.athleteId}`)
  expect200(detailNew, '新队员详情可按正数 ID 取回')
  assertEq(detailNew.data.age, 16, '详情按 birthday 实时派生周岁')
  const listNew = call('get', '/apms/athlete/list', { pageSize: '50', name: '测试小将' })
  assertEq(listNew.rows[0].age, 16, '列表按 birthday 实时派生周岁（年龄组不再显示 —）')
  const grpFilter = call('get', '/apms/athlete/list', { pageSize: '50', ageGroups: ['17'] })
  assert(grpFilter.rows.some(r => r.athleteId === created.athleteId), '新队员可被 U17 年龄组筛中')
  const detail2 = detailNew
  const upd = call('put', '/apms/athlete', {}, { athleteId: created.athleteId, phone: '13900000000' })
  expect200(upd); assertEq(db().athletes[0].phone, '13900000000')
  // 编辑出生日期后年龄/年龄段必须按新生日重算（蓝本 1001：2009-03-15 原 17 岁/U18）
  const editBd = call('put', '/apms/athlete', {}, { athleteId: 1001, birthday: '2012-09-01' })
  expect200(editBd)
  const after = call('get', '/apms/athlete/list', { pageSize: '50', name: '张志远' })
  assertEq(after.rows[0].age, 14, '改生日后列表年龄重算为 14 岁')
  const inU15 = call('get', '/apms/athlete/list', { pageSize: '50', ageGroups: ['15'] })
  assert(inU15.rows.some(r => r.athleteId === 1001), '改生日后落入 U15 组')
  const inU18 = call('get', '/apms/athlete/list', { pageSize: '50', ageGroups: ['18'] })
  assert(!inU18.rows.some(r => r.athleteId === 1001), '改生日后不再属于 U18 组')

  // —— 赛季整队晋升：预览/口径/执行落队 ——
  const pv = call('post', '/apms/athlete/promotion/preview', {}, { cutoffDate: '2027-01-01' })
  expect200(pv, 'promotion preview')
  assertEq(pv.data.cutoffDate, '2027-01-01')
  assert(pv.data.teams.some(t => t.bracket === 16), '识别出 U16 梯队')
  assert(pv.data.teams.some(t => t.bracket === 18), '识别出 U18 梯队')
  const promotes0 = pv.data.items.filter(i => i.action === 'PROMOTE')
  promotes0.forEach(p => {
    assertEq(p.fromBracket, 16, '2027 cut-off 仅 U16 超龄者晋升')
    assertEq(p.toBracket, 18)
    assert(p.ageAtCutoff >= 16 && p.ageAtCutoff < 18, '晋升者 cut-off 周岁满足 16<=age<18')
  })
  assert(pv.data.items.every(i => ['PROMOTE', 'STAY_YOUNG', 'STAY_OVERAGE', 'NO_BIRTHDAY', 'INVALID_TEAM'].includes(i.action)),
    '动作枚举合法')
  // 远期 cut-off：全员超龄且 U18 无更高档 → 没有可晋升的人
  const future = call('post', '/apms/athlete/promotion/preview', {}, { cutoffDate: '2030-01-01' })
  assertEq(future.data.promoteCount, 0, '2030 cut-off 无人可晋升')
  assert(future.data.items.some(i => i.action === 'STAY_OVERAGE'), '最高档超龄标记留队')
  const emptyExec = call('post', '/apms/athlete/promotion/execute', {}, { cutoffDate: '2020-01-01' })
  assertEq(emptyExec.code, 601, '无人可晋升时执行被拒绝')
  if (promotes0.length) {
    const ex = call('post', '/apms/athlete/promotion/execute', {}, { cutoffDate: '2027-01-01' })
    expect200(ex, 'promotion execute')
    assert(/^P\d{8}-\d+$/.test(ex.data.batchNo), '返回批次号')
    promotes0.forEach(p => {
      assertEq(db().athletes.find(a => a.athleteId === p.athleteId).primaryTeamId, p.toTeamId,
        `队员 ${p.athleteId} 主队已改为目标梯队`)
    })
    // 同一 cut-off 重跑：已晋升者不再出现在晋升名单
    const pv2 = call('post', '/apms/athlete/promotion/preview', {}, { cutoffDate: '2027-01-01' })
    assertEq(pv2.data.promoteCount, 0, '晋升不重复：同 cut-off 再预览无人晋升')
  }
  // 归属无效：挂到非 U 档部门（速度专项组 203）/已删除部门（999）单列、不晋升
  const victim = db().athletes.find(a => String(a.status) === '0')
  victim.primaryTeamId = 203
  victim.teamName = '速度专项组'
  const ghost = db().athletes.find(a => String(a.status) === '0' && a.athleteId !== victim.athleteId)
  ghost.primaryTeamId = 999
  ghost.teamName = null
  const pvInvalid = call('post', '/apms/athlete/promotion/preview', {}, { cutoffDate: '2027-01-01' })
  expect200(pvInvalid)
  const invalidRows = pvInvalid.data.items.filter(i => i.action === 'INVALID_TEAM')
  assertEq(invalidRows.length, 2, '非 U 档/已失效部门队员单列')
  assertEq(pvInvalid.data.invalidTeamCount, 2, '归属无效计数正确')
  assert(invalidRows.every(i => i.action !== 'PROMOTE'), '归属无效者不参与晋升')

  const del = call('delete', `/apms/athlete/${created.athleteId}`)
  expect200(del)
  assertEq(db().athletes.find(a => a.athleteId === created.athleteId).status, '1', '逻辑删 status=1')
  reset()
  assertEq(db().athletes.length, 15, '刷新（reset）还原蓝本')
})

test('H3', '指标库：列表筛选/详情组装 refs+levels/主子 CRUD 不错配', async () => {
  reset()
  const list = call('get', '/apms/indicator/list', { pageNum: '1', pageSize: '10', category: '素质' })
  expect200(list, 'indicator list')
  assert(list.rows.every(r => r.category === '素质'), 'category 精确筛选')
  assert(!('refs' in (list.rows[0] || {})), '列表行不内联 refs')
  const detail = call('get', '/apms/indicator/5')
  expect200(detail, 'indicator detail')
  assert(Array.isArray(detail.data.refs) && detail.data.refs.length >= 1, '详情挂 refs')
  assert(Array.isArray(detail.data.refs[0].levels), 'ref 内嵌 levels')
  const refs = call('get', '/apms/indicator/ref/list/5')
  expect200(refs, 'ref list'); assert(refs.data.length >= 1)
  const levels = call('get', '/apms/indicator/level/list/3')
  expect200(levels, 'level list'); assert(levels.data.length >= 1)
  // —— 评级配置校验（与正式后端 IndicatorRefLevelValidator 同口径）——
  const draft = call('post', '/apms/indicator/level', {}, { refId: 3, level: 'critical', minValue: null, maxValue: null })
  expect200(draft, '空边界草稿档允许先建后填')
  const draftRow = db().indicatorLevels.find(l => String(l.refId) === '3' && l.level === 'CRITICAL')
  assert(draftRow, '评级码自动 trim+大写')
  assertEq(call('post', '/apms/indicator/level', {}, { refId: 3, level: 'CRITICAL' }).code, 601, '大小写不敏感去重')
  const renamed = call('put', '/apms/indicator/level', {}, { id: draftRow.id, refId: 3, level: 'weak' })
  expect200(renamed, '评级改名可保存'); assertEq(db().indicatorLevels.find(l => l.id === draftRow.id).level, 'WEAK')
  assertEq(call('put', '/apms/indicator/level', {}, { id: draftRow.id, refId: 3, level: 'WEAK', minValue: 25, maxValue: 20 }).code,
    601, 'min>=max 拦截')
  assertEq(call('put', '/apms/indicator/level', {}, { id: draftRow.id, refId: 3, level: 'WEAK', minValue: 5, maxValue: 8 }).code,
    601, '与既有档 3~6 重叠拦截')
  const openEnded = call('put', '/apms/indicator/level', {}, { id: draftRow.id, refId: 3, level: 'WEAK', minValue: 20, maxValue: null })
  expect200(openEnded, '开放区间 [20,+∞) 允许（邻接 Poor 上限 10，留 gap 仅警告不拦截）')
  expect200(call('delete', `/apms/indicator/level/${draftRow.id}`), '草稿档可删除')
  const before = db().indicatorRefs.length
  const addRef = call('post', '/apms/indicator/ref', {}, { indicatorId: 5, gender: 'M', ageGroup: 'U15', refMin: 0, refMax: 10 })
  expect200(addRef); assertEq(db().indicatorRefs.length, before + 1)
  const newId = db().indicatorRefs[db().indicatorRefs.length - 1].id
  const delRef = call('delete', `/apms/indicator/ref/${newId}`)
  expect200(delRef); assertEq(db().indicatorRefs.length, before, 'ref 删后等级连带清理')
  // 指标编码唯一/必填校验
  const seedCode = list.rows[0].code
  assertEq(call('post', '/apms/indicator', {}, { code: seedCode, name: '重复码', evaluationDirection: 'HIGHER_BETTER' }).code,
    601, '重复指标编码拦截')
  assertEq(call('post', '/apms/indicator', {}, { code: 'my_ind', name: '' }).code, 601, '指标名称必填拦截')
  const addInd = call('post', '/apms/indicator', {}, { code: 'my_ind', name: '自定义', evaluationDirection: 'RANGE_BEST' })
  expect200(addInd, '自定义指标可新增')
  assertEq(db().indicators[0].code, 'MY_IND', '编码规范化大写')
})

test('H4', '测试模型/组合模型：字段、成分子路由 + 主表 CRUD', async () => {
  reset()
  const fields = call('get', '/apms/test-model/field/list/3')
  expect200(fields); assert(fields.data.length >= 1, '字段列表')
  const md = call('get', '/apms/test-model/3')
  expect200(md); assert(Array.isArray(md.data.fields) && md.data.fields.length >= 1, '模型详情挂 fields')
  const addF = call('post', '/apms/test-model/field', { modelId: 3, fieldKey: 'x', fieldName: 'X', dataType: 'decimal' })
  expect200(addF)
  const comps = call('get', '/apms/combo-model/component/list/1')
  expect200(comps); assertEq(comps.data.length, 4)
  const cmd = call('get', '/apms/combo-model/1')
  expect200(cmd); assertEq(cmd.data.components.length, 4, '组合模型详情挂 components')
  // 关联模式：非组合类模型（id=1 YOYO_IR1, is_combo=0）必须被拒，不增加行数
  const badC = call('post', '/apms/combo-model', {}, { modelId: 1, versionLabel: '错误关联' })
  assertEq(badC.code, 601, '非组合类模型关联拦截')
  // 方案名称必填拦截
  assertEq(call('post', '/apms/combo-model', {}, {
    modelId: 4, versionLabel: '   '
  }).code, 601, '方案空名称拦截')
  // 关联模式：COMPOSITE_FITNESS（id=4, is_combo=1）；蓝本 id=1 已是默认，新行应自动为非默认
  const addC = call('post', '/apms/combo-model', {}, {
    modelId: 4, versionLabel: '综合体能评价 v2', normalizationMethod: 'z_score'
  })
  expect200(addC); assertEq(db().comboModels.length, 2, '关联模式新增一条')
  const v2 = db().comboModels.find(m => m.versionLabel === '综合体能评价 v2')
  assert(v2 && v2.isDefault === '0', '已有默认时新方案不抢默认')
  assertEq(db().comboModels.filter(m => m.isDefault === '1').length, 1, '默认方案仍只有 1 个')
  // 把 v2 设为默认：互斥生效，蓝本 id=1 被挤下
  const setDef = call('put', '/apms/combo-model', {}, { ...v2, isDefault: '1' })
  expect200(setDef, '设为默认 200')
  const refreshed = db().comboModels
  assertEq(refreshed.find(m => m.id === v2.id).isDefault, '1', 'v2 已成为默认')
  assertEq(refreshed.find(m => m.id === 1).isDefault, '0', '原默认被清除')
  // 停用保护：默认方案（v2）停用必须被拒
  assertEq(call('put', '/apms/combo-model', {}, { ...v2, isDefault: '1', status: '1' }).code,
    601, '默认方案停用拦截')
  // 停用非默认方案（蓝本 id=1）后，计算接口必须拒绝该方案
  const m1 = refreshed.find(m => m.id === 1)
  expect200(call('put', '/apms/combo-model', {}, { ...m1, status: '1' }), '非默认方案可停用')
  const calcBlocked = call('post', '/apms/combo-score/calculate', {}, { comboModelId: 1, taskId: 1 })
  assertEq(calcBlocked.code, 601, '停用方案参与计算被拦截')
  // 新建模式：同事务创建 is_combo=1 载体 + 组合模型（新载体自动成为默认）
  const newC = call('post', '/apms/combo-model', {}, {
    newModelCode: 'DEMO_NEW_COMPOSITE', newModelName: '演示新建体系',
    versionLabel: '演示体系首版', normalizationMethod: 'z_score'
  })
  expect200(newC, '新建模式 200')
  assertEq(db().comboModels.length, 3, '新建模式再增一条')
  const carrier = db().testModels.find(m => m.code === 'DEMO_NEW_COMPOSITE')
  assert(carrier && carrier.isCombo === '1', '载体已建且 is_combo=1')
  const linked = db().comboModels.find(m => m.testModelCode === 'DEMO_NEW_COMPOSITE')
  assert(linked && linked.modelId === carrier.id && linked.isDefault === '1', '新载体首方案自动默认')
  // 新建模式防护：编码重复、空编码
  assertEq(call('post', '/apms/combo-model', {}, {
    newModelCode: 'DEMO_NEW_COMPOSITE', newModelName: '重复体系', versionLabel: '重复'
  }).code, 601, '体系编码重复拦截')
  assertEq(call('post', '/apms/combo-model', {}, {
    newModelCode: '   ', newModelName: '空编码', versionLabel: 'x'
  }).code, 601, '空编码拦截')

  // 测试模型删除引用校验：id=4 被蓝本组合模型引用，删除必须被拒且不产生删除
  const beforeModelCnt = db().testModels.length
  const delBlocked = call('delete', '/apms/test-model/4')
  assertEq(delBlocked.code, 601, '被组合方案引用的模型删除拦截')
  assert(String(delBlocked.msg).includes('引用'), '拦截信息说明引用去向: ' + delBlocked.msg)
  assertEq(db().testModels.length, beforeModelCnt, '拦截后模型未被删除')
  // 无引用的新建模型可正常删除（字段子表级联）
  const freeModel = call('post', '/apms/test-model', {}, {
    category: '敏捷', code: 'TEMP_FREE_MODEL', name: '临时无引用模型', isCombo: '0', status: '0'
  })
  expect200(freeModel)
  const freeId = db().testModels.find(m => m.code === 'TEMP_FREE_MODEL').id
  expect200(call('delete', '/apms/test-model/' + freeId), '无引用模型允许删除')
  assert(!db().testModels.some(m => m.id === freeId), '无引用模型已删除')

  // 组合评分方案删除：蓝本 id=1 有历史 comboScores，必须拒绝物理删除
  const scoreBefore = db().comboScores.length
  const delScored = call('delete', '/apms/combo-model/1')
  assertEq(delScored.code, 601, '有历史评分的方案删除拦截')
  assert(String(delScored.msg).includes('停用'), '拦截信息引导改用停用: ' + delScored.msg)
  assertEq(db().comboScores.length, scoreBefore, '拦截后历史评分未受影响')
  assert(db().comboModels.some(m => m.id === 1), '拦截后方案仍存在')
  // 无历史评分的新建方案（v2）允许删除，其组成项一并清理
  const v2Id = db().comboModels.find(m => m.versionLabel === '综合体能评价 v2').id
  expect200(call('delete', '/apms/combo-model/' + v2Id), '无评分方案允许删除')
  assert(!db().comboModels.some(m => m.id === v2Id), '无评分方案已删除')
})

test('H5', '测试任务：详情聚合 items/members/统计，报名/批量/移除/状态', async () => {
  reset()
  const detail = call('get', '/apms/test-task/4')
  expect200(detail, 'task detail')
  assert(Array.isArray(detail.data.items) && detail.data.items.length >= 1, '挂 items')
  assert(Array.isArray(detail.data.members) && detail.data.members.length >= 1, '挂 members')
  const membersBefore = db().taskMembers.filter(m => m.taskId === 4).length
  // 单人报名（找一个不在名单的在队队员）
  const outsider = db().athletes.find(a =>
    !db().taskMembers.some(m => m.taskId === 4 && m.athleteId === a.athleteId) && String(a.status) === '0')
  assert(outsider, '蓝本里存在可报名队员')
  expect200(call('post', '/apms/test-task/member/enroll', {}, { taskId: 4, athleteId: outsider.athleteId }))
  assertEq(db().taskMembers.filter(m => m.taskId === 4).length, membersBefore + 1)
  // 重复报名必须失败（不假成功）
  const dup = call('post', '/apms/test-task/member/enroll', {}, { taskId: 4, athleteId: outsider.athleteId })
  assertEq(dup.code, 601, '重复报名 601')
  // 批量报名
  const two = db().athletes.filter(a =>
    !db().taskMembers.some(m => m.taskId === 4 && m.athleteId === a.athleteId)).slice(0, 2)
  const batch = call('post', '/apms/test-task/member/batch-enroll', { taskId: 4 }, two.map(a => a.athleteId))
  expect200(batch); assert(batch.msg.includes('2'), 'msg 报新增人数')
  // 状态更新联动统计
  const first = db().taskMembers.find(m => m.taskId === 4)
  expect200(call('put', '/apms/test-task/member/status', {},
    { taskId: 4, athleteId: first.athleteId, status: 'completed' }))
  const t = db().testTasks.find(x => x.id === 4)
  assert(t.memberCompleted >= 1 && t.progressPercent > 0, '统计字段联动')
  // 移除
  expect200(call('delete', '/apms/test-task/member', { taskId: 4, athleteId: first.athleteId }))
  assert(!db().taskMembers.some(m => m.taskId === 4 && m.athleteId === first.athleteId), '成员已移除')
})

test('H6', '测试结果：列表默认只看当前结果，自动选择取最新一次（不看方向），手动指定，按任务清空', async () => {
  reset()
  const list = call('get', '/apms/test-result/list', { pageNum: '1', pageSize: '50', taskId: '1' })
  expect200(list)
  assert(list.rows.every(r => String(r.isSelected) === '1'), '默认 isSelected=1')
  const all = call('get', '/apms/test-result/list', { pageNum: '1', pageSize: '50', taskId: '1', isSelected: '' })
  assert(all.total >= list.total, '显式不限选中时条数更多')
  // LOWER_BETTER 组（30 米冲刺）：新口径下自动选择与方向无关，必须取最新一次有效测量
  const sprintGroup = (() => {
    for (const r0 of db().testResults) {
      if (r0.indicatorDirection !== 'LOWER_BETTER') continue
      const g = db().testResults.filter(r =>
        r.taskItemId === r0.taskItemId && r.athleteId === r0.athleteId)
      if (g.length >= 2) return g
    }
    return null
  })()
  assert(sprintGroup, '蓝本存在多条尝试的 LOWER_BETTER 结果组')
  {
    const taskItemId = sprintGroup[0].taskItemId
    const athleteId = sprintGroup[0].athleteId
    sprintGroup.forEach(r => { r.isSelected = '0' })
    expect200(call('post', '/apms/test-result/auto-select', { taskItemId, athleteId }))
    // 期望规则与 mock/后端一致：measureDate 倒序 → createTime 倒序 → 同日 id 大为新
    const want = sprintGroup
      .filter(r => String(r.isValid) !== '0')
      .sort((a, b) => {
        const da = String(a.measureDate ?? ''), db2 = String(b.measureDate ?? '')
        if (da !== db2) return da < db2 ? 1 : -1
        const ta = String(a.createTime ?? ''), tb = String(b.createTime ?? '')
        if (ta || tb) { if (ta !== tb) return ta < tb ? 1 : -1 }
        return b.id - a.id
      })[0].id
    assertEq(db().testResults.find(r => r.id === want).isSelected, '1', '自动选择取最新一次（与 LOWER_BETTER 方向无关）')
    const other = sprintGroup.find(r => r.id !== want)
    expect200(call('post', `/apms/test-result/select-attempt/${other.id}`))
    assertEq(db().testResults.find(r => r.id === other.id).isSelected, '1', '手动「使用此结果」可覆盖')
  }
  const btm = call('get', '/apms/test-result/by-task-member', { taskId: '1', athleteId: '1001' })
  expect200(btm); assert(Array.isArray(btm.data) && btm.data.length >= 1)
  // 网格成绩带出契约（ResultGridEntryDialog.loadExistingValues 依赖）：
  // 选中行必须带 itemType/indicatorId，主值可经 values.result.numericValue 取到
  const selected = btm.data.find(r => r.isSelected === '1' && r.itemType === 'INDICATOR')
  assert(selected, '存在 isSelected=1 的 INDICATOR 行供网格带出')
  const mainVal = selected.values?.find(v => v.fieldKey === 'result') ?? selected.values?.[0]
  assert(mainVal && mainVal.numericValue != null, '带出主值取 values.result.numericValue')
  const before = db().testResults.filter(r => r.taskId === 1).length
  expect200(call('delete', '/apms/test-result/task/1'))
  assertEq(db().testResults.filter(r => r.taskId === 1).length, 0)
  assert(before > 0, '清空前确有数据')
})

test('H6b', '设备接入：注册→列表→密钥鉴权→推送成绩真实落库（dataSource=DEVICE:xxx）', async () => {
  reset()
  const n0 = db().testResults.length
  const reg = call('post', '/apms/device/register', {}, {
    deviceCode: 'GATE-T1', deviceName: '计时门', deviceType: 'TIMING_GATE', vendor: 'XX'
  })
  expect200(reg)
  assert(reg.data.apiKey && reg.data.apiKey.startsWith('dk-'), '注册返回 dk- 开头密钥')
  const dup = call('post', '/apms/device/register', {}, { deviceCode: 'GATE-T1' })
  assert(dup.code === 601, '重复编码拒绝')
  const lst = call('get', '/apms/device/list')
  expect200(lst); assert(lst.data.some(d => d.deviceCode === 'GATE-T1'), '列表含新设备')

  const bad = call('post', '/apms/device/push', {}, { apiKey: 'dk-wrong', athleteId: 1001, indicatorCode: 'HEIGHT', value: 180 })
  assertEq(bad.code, 401, '错误密钥 401')
  const badInd = call('post', '/apms/device/push', {}, { apiKey: reg.data.apiKey, athleteId: 1001, indicatorCode: 'NO_SUCH', value: 1 })
  assertEq(badInd.code, 601, '未知指标 601')

  const push = call('post', '/apms/device/push', {}, {
    apiKey: reg.data.apiKey, athleteId: 1001, indicatorCode: 'height', value: 180.5,
    measureDate: '2026-09-30', sessionKey: 'S1'
  })
  expect200(push)
  assertEq(db().testResults.length, n0 + 1, '推送成绩落库一条')
  const row = db().testResults.find(r => r.id === push.data.resultId)
  assert(row, '返回 resultId 可定位')
  assertEq(row.dataSource, 'DEVICE:GATE-T1', 'dataSource 带设备编码')
  assertEq(row.indicatorCode, 'HEIGHT', '指标 code 大小写不敏感匹配')
  assertEq(row.values[0].numericValue, 180.5, '主值落 numericValue')
  assertEq(row.taskId, null, '设备推送默认不绑任务')
})

test('H6c', '手动录入：AddBody{result,values} 契约落库，散录（无任务）回填指标冗余字段', async () => {
  reset()
  const n0 = db().testResults.length
  const r = call('post', '/apms/test-result', {}, {
    result: {
      taskId: null, taskItemId: null, athleteId: 1001,
      itemType: 'INDICATOR', indicatorId: 1, modelId: null,
      measureDate: '2026-09-30', sessionKey: 'S2',
      isValid: '1', isSelected: '1', dataSource: 'MANUAL'
    },
    values: [{ indicatorId: 1, fieldKey: 'result', isDerived: '0', numericValue: 181.2, textValue: null }]
  })
  expect200(r)
  assertEq(db().testResults.length, n0 + 1, '新增一条')
  const row = db().testResults[db().testResults.length - 1]
  assertEq(row.indicatorCode, 'HEIGHT', '散录回填指标 code')
  assertEq(row.indicatorName, '身高', '散录回填指标名')
  assertEq(row.athleteName, db().athletes.find(a => a.athleteId === 1001).name, '回填队员名')
  assertEq(row.dataSource, 'MANUAL')
  assertEq(row.values[0].numericValue, 181.2, 'values 随主表保存')
})

test('H6d', '散录指定最佳：无 taskItemId 时只影响同队员同指标的散录行，不串其他指标/任务行', async () => {
  reset()
  const mk = (over) => call('post', '/apms/test-result', {}, {
    result: {
      taskId: null, taskItemId: null, athleteId: 1001,
      itemType: 'INDICATOR', indicatorId: over.indicatorId, modelId: null,
      measureDate: '2026-10-03', sessionKey: over.sessionKey,
      isValid: '1', isSelected: over.sel ?? '1', dataSource: 'MANUAL'
    },
    values: [{ indicatorId: over.indicatorId, fieldKey: 'result', isDerived: '0', numericValue: over.v, textValue: null }]
  })
  mk({ indicatorId: 1, sessionKey: 'FA', v: 180, sel: '1' }) // 散录 身高 A
  mk({ indicatorId: 1, sessionKey: 'FB', v: 182, sel: '1' }) // 散录 身高 B
  mk({ indicatorId: 2, sessionKey: 'FC', v: 70, sel: '1' })  // 散录 体重，不应受影响
  // 找 FB 的真实 id
  const rowB = db().testResults.find(r => r.sessionKey === 'FB')
  // 找一条任务内行作为哨兵（蓝本里有 taskItemId）
  const sentinel = db().testResults.find(r => r.taskItemId != null && String(r.athleteId) === '1001')
  if (sentinel) sentinel.isSelected = '1'
  expect200(call('post', `/apms/test-result/select-attempt/${rowB.id}`))
  const a = db().testResults.find(r => r.sessionKey === 'FA')
  const b = db().testResults.find(r => r.sessionKey === 'FB')
  const c = db().testResults.find(r => r.sessionKey === 'FC')
  assertEq(a.isSelected, '0', '同指标另一条被取消')
  assertEq(b.isSelected, '1', '目标被选中')
  assertEq(c.isSelected, '1', '其他指标散录行不受影响')
  if (sentinel) assertEq(sentinel.isSelected, '1', '任务内行不受散录选择影响')
})

test('H6e', '散录归一：指标/模型统一最新一次当选（不看数值大小与评价方向）；attemptNo 递增', async () => {
  reset()
  const mk = (o) => call('post', '/apms/test-result', {}, {
    result: {
      taskId: null, taskItemId: null, athleteId: 1001,
      itemType: o.itemType, indicatorId: o.indicatorId ?? null, modelId: o.modelId ?? null,
      measureDate: o.date, sessionKey: o.sessionKey,
      isValid: '1', isSelected: '1', dataSource: 'MANUAL'
    },
    values: [{ fieldKey: 'result', isDerived: '0', numericValue: o.v,
      indicatorId: o.indicatorId ?? null, modelId: o.modelId ?? null }]
  })
  // 模型 YOYO（无方向）：先 1000m@10-01，再 900m@10-03 → 数值更小但日期更新，应当选
  mk({ itemType: 'MODEL', modelId: 1, date: '2026-10-01', sessionKey: 'MA', v: 1000 })
  mk({ itemType: 'MODEL', modelId: 1, date: '2026-10-03', sessionKey: 'MB', v: 900 })
  // 指标 VJUMP（HIGHER_BETTER，id=4）：先 57 再 55——新口径下后录入的 55 仍当选，
  // 与「越高越好」方向相反，以此证明方向择优已废弃、最新一次统一当选
  mk({ itemType: 'INDICATOR', indicatorId: 4, date: '2026-10-01', sessionKey: 'VA', v: 57 })
  mk({ itemType: 'INDICATOR', indicatorId: 4, date: '2026-10-03', sessionKey: 'VB', v: 55 })

  const modelRows = db().testResults.filter(r => r.sessionKey === 'MA' || r.sessionKey === 'MB')
  const indRows = db().testResults.filter(r => r.sessionKey === 'VA' || r.sessionKey === 'VB')
  assertEq(modelRows.find(r => r.sessionKey === 'MA').isSelected, '0', '旧模型记录转备选')
  assertEq(modelRows.find(r => r.sessionKey === 'MB').isSelected, '1', '最新模型记录当选（与数值大小无关）')
  assertEq(indRows.find(r => r.sessionKey === 'VA').isSelected, '0', '先录入的高值转备选')
  assertEq(indRows.find(r => r.sessionKey === 'VB').isSelected, '1', '指标也按最新一次当选（与方向/数值无关）')
  assertEq(modelRows.find(r => r.sessionKey === 'MB').attemptNo, 2, '模型尝试序号递增')
  assertEq(indRows.find(r => r.sessionKey === 'VB').attemptNo, 2, '指标尝试序号递增')
  // by-free-group：只返回同队员同模型的散录行，不串指标
  const fg = call('get', '/apms/test-result/by-free-group', { athleteId: '1001', modelId: '1' })
  expect200(fg)
  assertEq(fg.data.length, 2, '散录同组返回两条')
  assert(fg.data.every(r => String(r.modelId) === '1'), '全是该模型')
})

test('H6f', '结构化采集配置：算法注册表可枚举；RSA 绑定算法；字段角色可配置且 CRUD 保留；设备模型推送永远 401', async () => {
  reset()
  // 算法注册表
  const algos = call('get', '/apms/test-model/algorithms')
  expect200(algos)
  assert(algos.data.some(a => a.algoId === 'rsa-sdec'), '注册表含 rsa-sdec')
  // RSA 模型绑定算法
  const rsa = db().testModels.find(m => m.code === 'RSA_10X20')
  assertEq(rsa.algoId, 'rsa-sdec', 'RSA 模型绑定派生算法')
  // 字段角色：RSA 冲刺为 INPUT，sdec/best/mean 为 DERIVED
  const fields = call('get', '/apms/test-model/field/list/2')
  const byKey = Object.fromEntries(fields.data.map(f => [f.fieldKey, f.collectMode]))
  assertEq(byKey.sprint_1, 'INPUT', '冲刺趟次人工采集')
  assertEq(byKey.sdec, 'DERIVED', 'Sdec 系统计算')
  assertEq(byKey.best_time, 'DERIVED', '最佳时间系统计算')
  // 字段 CRUD 保留 collectMode
  call('post', '/apms/test-model/field', {}, { modelId: 3, fieldKey: 'probe', fieldName: '探针', collectMode: 'DERIVED' })
  const probe = db().testFields.find(f => f.fieldKey === 'probe')
  assertEq(probe.collectMode, 'DERIVED', '新字段角色落库')
  // 设备模型推送假门禁：任意密钥一律 401
  const push = call('post', '/apms/device/model-push', {}, { apiKey: 'anything', modelCode: 'RSA_10X20' })
  assertEq(push.code, 401, '设备模型推送永远拒绝')
})

test('H6g', '修改成绩：EditBody{result:{id,...},values} 原地改值，保留元数据并按最新口径重算当前结果', async () => {
  reset()
  // 同队员同指标两条散录：55（先）与 57（后，最新一次当选）
  const mk = (v, date, sk) => call('post', '/apms/test-result', {}, {
    result: {
      taskId: null, taskItemId: null, athleteId: 1001,
      itemType: 'INDICATOR', indicatorId: 4, modelId: null,
      measureDate: date, sessionKey: sk,
      isValid: '1', isSelected: '1', dataSource: 'MANUAL'
    },
    values: [{ indicatorId: 4, fieldKey: 'result', fieldLabel: '结果', unit: 'cm', isDerived: '0', numericValue: v, textValue: null }]
  })
  mk(55, '2026-10-01', 'EA')
  mk(57, '2026-10-03', 'EB')
  const target = db().testResults.find(r => r.sessionKey === 'EB')
  const oldValId = target.values[0].valueId
  assertEq(target.isSelected, '1', '前置：后录入的 EB 为当前结果')

  // 契约与前端 ResultEntryDialog 一致：包装体 result.id 在 result 内
  const upd = call('put', '/apms/test-result', {}, {
    result: {
      id: target.id, taskId: null, taskItemId: target.taskItemId ?? null,
      athleteId: 1001, itemType: 'INDICATOR', indicatorId: 4, modelId: null,
      measureDate: '2026-10-04', sessionKey: 'EB',
      isValid: '1', isSelected: '1', dataSource: 'MANUAL'
    },
    values: [{ indicatorId: 4, fieldKey: 'result', isDerived: '0', numericValue: 50, textValue: null }]
  })
  expect200(upd, '包装体 PUT 不应再报「结果不存在」')
  const after = db().testResults.find(r => r.id === target.id)
  assertEq(after.values[0].numericValue, 50, '数值原地更新')
  assertEq(after.values[0].valueId, oldValId, '保留既有 valueId')
  assertEq(after.values[0].fieldLabel, '结果', '保留 fieldLabel 元数据')
  assertEq(after.measureDate, '2026-10-04', '业务字段可改')
  assertEq(after.indicatorCode, 'VJUMP', '冗余编码不被包装体破坏')
  // 重算（新口径）：编辑后该行日期 10-04 仍是组内最新，继续当选；数值大小不再影响选择
  assertEq(after.isSelected, '1', '被编辑的最新一行保持当前结果')
  assertEq(db().testResults.find(r => r.sessionKey === 'EA').isSelected, '0', '旧记录维持备选，不按数值回退')
  // 不存在的 id
  const miss = call('put', '/apms/test-result', {}, { result: { id: 999999 }, values: [] })
  assertEq(miss.code, 601, '未知 id 仍 601')
})

test('H6h', '网格录入模型批：cells 按 modelId 合并为一条 MODEL result；任务归属/字段校验；指标批不受影响', async () => {
  reset()
  const n0 = db().testResults.length

  // 任务 3（CMJ）：模型 T_TEST(id=3，taskItem id=9)，字段 time=20 / trial_count=21
  // 队员 1001（张志远，任务成员）一次填两格 → 合并为 1 条 MODEL result
  const ok = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'MODEL', measureDate: '2026-10-14', sessionKey: 'S1',
    rows: [{
      athleteId: 1001,
      cells: [
        { modelId: 3, fieldId: 20, fieldKey: 'time', value: 9.85 },
        { modelId: 3, fieldId: 21, fieldKey: 'trial_count', value: 2 }
      ]
    }]
  })
  expect200(ok, '模型网格提交应成功（回归「成功 0 人」）')
  assertEq(ok.data.committed, 1, '成功 1 人')
  assertEq(ok.data.failed, 0)
  const added = db().testResults.find(r => r.athleteId === 1001 && r.itemType === 'MODEL' && r.taskItemId === 9)
  assert(added, '产出一条挂任务模型项(taskItemId=9)的 MODEL 记录')
  assertEq(added.modelId, 3)
  assertEq(added.modelCode, 'T_TEST')
  assertEq(added.values.length, 2, '同模型两字段合并到同一条 result')
  const byKey = Object.fromEntries(added.values.map(v => [v.fieldKey, v]))
  assertEq(byKey.time.numericValue, 9.85)
  assertEq(byKey.trial_count.numericValue, 2)
  assertEq(byKey.time.fieldId, 20)
  assertEq(added.isSelected, '1')
  assertEq(db().testResults.length, n0 + 1, '仅新增一条（不是每字段一条）')

  // 模型不属于该任务 → 整人失败（RSA modelId=2 不在任务 3 的模型项里）
  const badModel = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'MODEL', measureDate: '2026-10-14',
    rows: [{ athleteId: 1002, cells: [{ modelId: 2, fieldId: 7, fieldKey: 'sprint_1', value: 3.1 }] }]
  })
  expect200(badModel); assertEq(badModel.data.failed, 1, '越权模型整人失败')
  assertEq(badModel.data.committed, 0)

  // 字段不属于模型/派生字段 → 整人失败
  const badField = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'MODEL', measureDate: '2026-10-14',
    rows: [{ athleteId: 1002, cells: [{ modelId: 3, fieldId: 999, fieldKey: 'ghost', value: 1 }] }]
  })
  expect200(badField); assertEq(badField.data.failed, 1, '非法字段整人失败')

  // 非任务成员 → 失败
  const outsider = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'MODEL', measureDate: '2026-10-14',
    rows: [{ athleteId: 1014, cells: [{ modelId: 3, fieldId: 20, fieldKey: 'time', value: 10 }] }]
  })
  expect200(outsider); assertEq(outsider.data.failed, 1, '非任务成员失败')

  // 散录模型（taskId 为空）：合法模型+字段可提交，taskItemId 为 null
  const free = call('post', '/apms/test-result/batch-grid', {}, {
    itemType: 'MODEL', measureDate: '2026-10-14',
    rows: [{ athleteId: 1001, cells: [{ modelId: 3, fieldId: 20, fieldKey: 'time', value: 9.9 }] }]
  })
  expect200(free); assertEq(free.data.committed, 1)
  const freeRow = db().testResults.find(r => r.athleteId === 1001 && r.itemType === 'MODEL' && r.taskItemId == null)
  assert(freeRow, '散录模型行 taskItemId=null')

  // 回归（模型部分字段更新丢数据 bug）：写入层不做跨 attempt 字段合并，完整快照是前端契约。
  // 1) 复现残片机理：只提交 time 单字段，新 attempt 确实只剩 time——证明修复必须在前端组包
  const partial = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'MODEL', measureDate: '2026-10-15',
    rows: [{ athleteId: 1001, cells: [{ modelId: 3, fieldId: 20, fieldKey: 'time', value: 10.2 }] }]
  })
  expect200(partial)
  const partialRow = db().testResults.find(r =>
    r.athleteId === 1001 && r.itemType === 'MODEL' && r.taskItemId === 9 && r.measureDate === '2026-10-15')
  assert(partialRow, '残片尝试已落库')
  assertEq(partialRow.values.length, 1, '单字段提交只存单字段（trial_count 不会被自动补回）')
  // 2) 修复后前端契约：改 time 时把同模型未改的 trial_count 原值随快照一并提交
  const snap = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'MODEL', measureDate: '2026-10-16',
    rows: [{
      athleteId: 1001,
      cells: [
        { modelId: 3, fieldId: 20, fieldKey: 'time', value: 10.5 },
        { modelId: 3, fieldId: 21, fieldKey: 'trial_count', value: 2 }
      ]
    }]
  })
  expect200(snap)
  const snapRow = db().testResults.find(r =>
    r.athleteId === 1001 && r.itemType === 'MODEL' && r.taskItemId === 9 && r.measureDate === '2026-10-16')
  assert(snapRow, '快照尝试已落库')
  assertEq(snapRow.values.length, 2, '完整快照：新 attempt 两字段齐全，不丢原有数据')
  const snapVals = Object.fromEntries(snapRow.values.map(v => [v.fieldKey, v.numericValue]))
  assertEq(snapVals.time, 10.5, '修改字段为新值')
  assertEq(snapVals.trial_count, 2, '未改字段随快照保留原值')

  // 指标批回归：任务 3 的 VJUMP（taskItem id=8）仍正常
  const ind = call('post', '/apms/test-result/batch-grid', {}, {
    taskId: 3, itemType: 'INDICATOR', measureDate: '2026-10-14',
    rows: [{ athleteId: 1001, cells: [{ indicatorId: 4, value: 43.5 }] }]
  })
  expect200(ind); assertEq(ind.data.committed, 1, '指标批不受模型改造影响')
  const indRow = db().testResults.find(r => r.athleteId === 1001 && r.itemType === 'INDICATOR' && r.taskItemId === 8)
  assert(indRow && indRow.values[0].numericValue === 43.5)
})

test('H7', '体态测量：data 数组列表/最新/upsert 幂等', async () => {
  reset()
  const list = call('get', '/apms/body-measure/list', {})
  // 蓝本 10 条 + 测量周期并入的记录（fixtures 注释「id 接 11+」），至少 10 条
  expect200(list); assert(Array.isArray(list.data) && list.data.length >= 10, '列表返回 data 数组')
  // JOIN 派生 athleteAge（TIMESTAMPDIFF 口径，演示时钟锚点）：缺失会让头像年龄组配色全灰
  assert(list.data.every(r => r.athleteAge != null), '每行都带 athleteAge（头像配色依据）')
  const row1001 = list.data.find(r => String(r.athleteId) === '1001')
  assertEq(row1001.athleteAge, 17, '张志远 2009-03-15 → 锚点日 17 周岁')
  assertEq(row1001.athleteName, '张志远')
  const latest = call('get', '/apms/body-measure/athlete/1001/latest')
  expect200(latest); assert(latest.data && String(latest.data.athleteId) === '1001')
  assertEq(latest.data.athleteAge, 17, 'latest 出口同样派生 athleteAge')
  const n0 = db().bodyMeasures.length
  const payload = { athleteId: 1001, measureDate: '2026-09-28', height: 176, sitHeight: 90, weight: 66 }
  const u1 = call('post', '/apms/body-measure/upsert', {}, payload)
  expect200(u1); assertEq(db().bodyMeasures.length, n0 + 1, '首次 upsert 新增')
  const u2 = call('post', '/apms/body-measure/upsert', {}, { ...payload, weight: 67 })
  expect200(u2); assertEq(db().bodyMeasures.length, n0 + 1, '同人同日 upsert 更新不新增')
  assertEq(db().bodyMeasures.find(r => r.id === u1.data.id).weight, 67)
})

test('H8', 'PHV：直填计算产出有效数值，测量记录计算，删除还原', async () => {
  reset()
  const n0 = db().phvs.length
  const r = call('post', '/apms/phv/calculate-direct', {}, {
    athleteId: 1001, height: 175.2, sitHeight: 90, weight: 65, gender: '0',
    measureDate: '2026-09-28'
  })
  expect200(r)
  assert(r.data.decimalAge != null && r.data.maturityOffset != null, 'decimalAge/maturityOffset 已算')
  assert(Number.isFinite(r.data.predictedPhvAge), 'predictedPhvAge 为数值')
  assertEq(db().phvs.length, n0 + 1)
  const list = call('get', '/apms/phv/list', {})
  expect200(list); assert(list.data[0].athleteName === '张志远', '列表冗余队员名供散点图')
  // 由测量记录计算
  const m = db().bodyMeasures[0]
  const r2 = call('post', '/apms/phv/calculate', { athleteId: m.athleteId, measureId: m.id })
  expect200(r2); assertEq(r2.data.sourceMeasureId, m.id)
  expect200(call('delete', `/apms/phv/${r.data.id}`))
  assertEq(db().phvs.length, n0 + 1, '删一条后回到 n0+1')
})

test('H9', 'RTP：列表/详情/更新写日志并同步花名册/清除回未评估', async () => {
  reset()
  const list = call('get', '/apms/rtp/status/list')
  expect200(list); assertEq(list.data.length, 14)
  const s1001 = call('get', '/apms/rtp/status/1001')
  expect200(s1001)
  const log0 = call('get', '/apms/rtp/log/1001').data.length
  const upd = call('post', '/apms/rtp/update', {}, {
    athleteId: 1001, status: 'r', reason: '演示复检', trainingLimit: '限非对抗训练',
    nextReviewDate: '2026-10-10'
  })
  expect200(upd)
  assertEq(call('get', '/apms/rtp/status/1001').data.status, 'r')
  assertEq(db().athletes.find(a => a.athleteId === 1001).rtpStatus, 'r', '花名册冗余同步')
  assertEq(call('get', '/apms/rtp/log/1001').data.length, log0 + 1, '日志 +1')
  // /status/list 不得错配到 /status/:athleteId
  assertEq(call('get', '/apms/rtp/status/list').data.length, 14, '字面 list 优先于 :id')
  expect200(call('post', '/apms/rtp/clear/1001', {}, { reason: '演示清除' }))
  assertEq(call('get', '/apms/rtp/status/1001').data, null, '清除后详情 null')
  assertEq(db().athletes.find(a => a.athleteId === 1001).rtpStatus, null)
})

test('H10', '组合评分：批量计算返回汇总并落行，重复计算跳过；删除', async () => {
  reset()
  const before = db().comboScores.length
  // task 1：12 名成员且有指标 3/4/5 的已选最佳结果（成分 3/4/5/1）
  const r = call('post', '/apms/combo-score/calculate', {}, { comboModelId: 1, taskId: 1 })
  expect200(r)
  assertEq(r.data.totalAthletes, db().taskMembers.filter(m => m.taskId === 1).length, '处理人数=名单人数')
  assert(r.data.items.every(i => i.status === 'OK' || i.status === 'SKIP'), '逐项 OK/SKIP')
  assert(r.data.successCount >= 1, '至少 1 人成功')
  assert(db().comboScores.length > before, '评分已落库')
  const r2 = call('post', '/apms/combo-score/calculate', {}, { comboModelId: 1, taskId: 1 })
  expect200(r2); assert(r2.data.skipCount >= 1, '重复计算走 SKIP 不重复落行')
  const list = call('get', '/apms/combo-score/list', {})
  expect200(list); assert(Array.isArray(list.data))
})

test('H11', '医疗：筛选/详情挂附件/附件删除独立于主表删除', async () => {
  reset()
  const list = call('get', '/apms/medical-record/list', { pageNum: '1', pageSize: '10', recordType: 'injury' })
  expect200(list)
  assert(list.rows.length >= 1 && list.rows.every(r => r.recordType === 'injury'), 'recordType 筛选')
  const d = call('get', '/apms/medical-record/1')
  expect200(d); assert(Array.isArray(d.data.files), '详情挂 files')
  const fileTotal = db().medicalFiles.length
  const f = db().medicalFiles[0]
  expect200(call('delete', `/apms/medical-record/file/${f.id}`))
  assertEq(db().medicalFiles.length, fileTotal - 1)
  assert(db().medicals.some(r => r.id === f.recordId), '删附件不动主表')
})

test('H11b', '伤病部位：部位统计聚合/闭环口径/部位筛选/录入校验/路由不错配', async () => {
  reset()
  // 蓝本 injury/surgery 部位：
  // 2024 旧伤 4 部位（THIGH_BACK_R/WRIST_L 活跃旧口径、KNEE_R/ANKLE_L 已康复）+
  // 近期新增 THIGH_R/ANKLE_R/LOW_BACK（活跃）与 KNEE_R(活跃)/ANKLE_L（injury+rehab 闭环），
  // range=all 去重后共 7 个部位
  const all = call('get', '/apms/medical-record/site-stats', { range: 'all' })
  expect200(all, 'site-stats 200')
  assert(Array.isArray(all.data) && all.data.length === 7, `7 个部位聚合，实际 ${all.data.length}`)
  const bySite = Object.fromEntries(all.data.map(x => [x.site, x]))
  assertEq(bySite.THIGH_BACK_R.total, 1); assertEq(bySite.THIGH_BACK_R.active, 1, '右大腿后群：无康复记录=活跃')
  assertEq(bySite.WRIST_L.total, 1); assertEq(bySite.WRIST_L.active, 1, '左手腕：活跃')
  // KNEE_R：2024 旧伤 1 条已康复 + 2026-09 手术 1 条未闭环 → total 2、active 1
  assertEq(bySite.KNEE_R.total, 2); assertEq(bySite.KNEE_R.active, 1, '右膝：一新一旧，仅新伤活跃')
  // ANKLE_L：2024 旧伤 1 条已康复 + 2026 新伤有康复复评 → total 2、active 0
  assertEq(bySite.ANKLE_L.total, 2); assertEq(bySite.ANKLE_L.active, 0, '左踝：两条均已康复')
  assertEq(bySite.LOW_BACK.active, 1, '腰背：近期活跃')
  // 近 12 个月（mock 以当前日期回看；近期蓝本 4 条活跃伤病的部位）
  const y1 = call('get', '/apms/medical-record/site-stats', { range: '12m' })
  expect200(y1)
  const y1Active = y1.data.reduce((n, x) => n + x.active, 0)
  assertEq(y1Active, 4, '近 12 个月活跃 4 例（KNEE_R/THIGH_R/ANKLE_R/LOW_BACK 各 1）')
  // 部位筛选
  const filtered = call('get', '/apms/medical-record/list', { pageSize: '10', bodySite: 'KNEE_R' })
  expect200(filtered); assert(filtered.rows.length === 2 && filtered.rows.every(r => r.bodySite === 'KNEE_R'), 'bodySite 精确筛选 2 条')
  // 精确路由不落到 :id
  expect200(call('get', '/apms/medical-record/site-stats'))
  // 录入校验：损伤无部位 → 601；非伤病类型部位被清空
  const noSite = call('post', '/apms/medical-record', {}, {
    record: { athleteId: 1001, recordType: 'injury', recordDate: '2026-10-05', title: '测试伤' }
  })
  assertEq(noSite.code, 601, '损伤必须选部位')
  // 用蓝本未占用的部位 ELBOW_R，避免与近期踝扭伤蓝本叠加
  const okAdd = call('post', '/apms/medical-record', {}, {
    record: { athleteId: 1001, recordType: 'injury', bodySite: 'ELBOW_R', recordDate: '2026-10-05', title: '测试网球肘' }
  })
  expect200(okAdd)
  const added = db().medicals.find(r => r.title === '测试网球肘')
  assertEq(added.bodySite, 'ELBOW_R', 'AddBody.record 正确解包落库')
  const statsAfter = call('get', '/apms/medical-record/site-stats', { range: '12m' }).data
  assertEq(statsAfter.find(x => x.site === 'ELBOW_R').active, 1, '新伤进入近 12 月活跃统计')
  // 疾病记录带部位也会被清空
  const illness = call('post', '/apms/medical-record', {}, {
    record: { athleteId: 1001, recordType: 'illness', bodySite: 'KNEE_L', recordDate: '2026-10-05', title: '感冒' }
  })
  expect200(illness)
  assertEq(db().medicals.find(r => r.title === '感冒').bodySite, null, '非伤病类型部位强制清空')
})

test('H12', '报告：类型筛选/生成回填任务冗余/删除', async () => {
  reset()
  const list = call('get', '/apms/report/list', { pageNum: '1', pageSize: '10', reportType: 'INDIVIDUAL' })
  expect200(list); assert(list.rows.every(r => r.reportType === 'INDIVIDUAL'))
  const n0 = db().reports.length
  const g = call('post', '/apms/report/generate', { reportType: 'TEAM', taskId: 4 })
  expect200(g)
  assertEq(db().reports.length, n0 + 1)
  const row = db().reports[0]
  assert(row.taskName && row.deptName, '任务/队伍名回填')
  assertEq(row.filePath, null, '演示报告无真实文件')
  expect200(call('delete', `/apms/report/${row.id}`))
  assertEq(db().reports.length, n0)
})

test('H13', '归属：多组并存/加入校验/按组离开互不影响', async () => {
  reset()
  // 蓝本：1001 当前在 203（速度专项组），205（力量组）已离组
  const hist = call('get', '/apms/athlete-group/athlete/1001')
  expect200(hist); assert(hist.data.length >= 1)
  const cur = call('get', '/apms/athlete-group/athlete/1001/current')
  expect200(cur); assertEq(cur.data.deptId, 203, '当前在速度专项组')
  const activeDepts = () => call('get', '/apms/athlete-group/athlete/1001').data
    .filter(g => String(g.status) === '0' && !g.leaveDate).map(g => Number(g.deptId))

  // 多组并存：加入 204（康复组）不影响其在 203 的记录
  expect200(call('post', '/apms/athlete-group/join', {}, { athleteId: 1001, deptId: 204, joinDate: '2026-09-28' }))
  const joined = activeDepts().sort((a, b) => a - b)
  assertEq(joined.join(','), '203,204', '加入新组后同时在两个组')
  // 同组重复加入：业务拒绝（601），不是幂等成功
  assertEq(call('post', '/apms/athlete-group/join', {}, { athleteId: 1001, deptId: 204 }).code, 601, '重复加入拒绝')
  // 目标必须是 30/40/50 小组：201 是 U18 队伍（deptType=20）
  assertEq(call('post', '/apms/athlete-group/join', {}, { athleteId: 1001, deptId: 201 }).code, 601, '队伍不能当小组加入')
  // 离组必须指定 deptId
  assertEq(call('post', '/apms/athlete-group/leave/1001', {}, { leaveDate: '2026-09-29' }).code, 601, '缺 deptId 拒绝')
  // 只离开 204：203 仍在组（多组互不影响）
  expect200(call('post', '/apms/athlete-group/leave/1001', {}, { deptId: 204, leaveDate: '2026-09-29' }))
  assertEq(activeDepts().join(','), '203', '离开康复组后速度组仍在')
  // 已离组再离一次：拒绝
  assertEq(call('post', '/apms/athlete-group/leave/1001', {}, { deptId: 204 }).code, 601, '重复离组拒绝')
})

test('H14', '总览看板：形状与内存聚合正确（含门面区 5 块）', async () => {
  reset()
  const o = call('get', '/apms/dashboard/overview').data
  for (const k of ['summary', 'comboScoreRanking', 'indicatorRadar', 'phvScatter', 'taskCompletion', 'teamDistribution',
    'rtpDistribution', 'activeTasks', 'injurySummary', 'phvBands', 'healthAlerts']) {
    assert(k in o, `overview 缺 ${k}`)
  }
  assertEq(o.summary.totalAthletes, 15)
  assertEq(o.summary.testTasks, 7)
  const ranks = o.comboScoreRanking.map(x => x.comboScore)
  assert(JSON.stringify(ranks) === JSON.stringify([...ranks].sort((a, b) => b - a)), '排名降序')
  assert(o.indicatorRadar.every(r => r.dimensions.length > 0), '雷达维度来自 refSnapshot')
  assert(o.taskCompletion.length === 7)
  const tc = o.taskCompletion.find(t => t.taskId === 1)
  assert(tc.athleteCount >= 1 && tc.resultCount >= 1, '任务完成度聚合')
  const teamHeads = Object.values(o.teamDistribution).reduce((a, b) => a + b, 0)
  assertEq(teamHeads, 15, '队伍分布人数合计')

  // 门面区：RTP 分布（g/y/r/none 合计=在训 15 人；byTeam 桶合计一致）
  const rtp = o.rtpDistribution
  assertEq(rtp.total, 15, 'RTP total=在训人数')
  assertEq(rtp.green + rtp.yellow + rtp.red + rtp.none, 15, '四态合计')
  const teamSum = rtp.byTeam.reduce((n, t) => n + t.green + t.yellow + t.red + t.none, 0)
  assertEq(teamSum, 15, 'byTeam 桶合计=在训人数')

  // 门面区：本周活跃任务（任务 1/3 窗口覆盖锚点 2026-10-05）
  assertEq(o.activeTasks.list.length, 2, '两个本周活跃任务')
  assert(o.activeTasks.list.every(t => typeof t.progress === 'number'), '进度字段齐全')
  assert(o.activeTasks.avgProgress > 0, '平均完成率 > 0')

  // 门面区：伤病摘要（4 活跃含本月 1、1 已康复；近 12 月窗口排除 2024 旧伤）
  assertEq(o.injurySummary.active, 4, '活跃伤病 4 例')
  assertEq(o.injurySummary.newThisMonth, 1, '本月新发 1 例')
  assert(o.injurySummary.recovered >= 1, '至少 1 例已康复')
  assert(o.injurySummary.recent.length > 0 && o.injurySummary.recent.length <= 3, '最近活跃最多 3 条')

  // 门面区：PHV 4 档合计=评估人数；新增两条峰期后窗口人数 >=2
  const bandSum = o.phvBands.bands.reduce((n, b) => n + b.count, 0)
  assertEq(bandSum, o.phvBands.total, '4 档合计=评估人数')
  assert(o.phvBands.windowCount >= 2, '±1 年窗口至少 2 人')

  // 门面区：健康预警=锚点日 ACTIVE 快照（1 WARNING/1 ATTENTION/3 INFO），TOP3 红黄优先
  assertEq(o.healthAlerts.warning, 1, '红警 1')
  assertEq(o.healthAlerts.attention, 1, '黄警 1')
  assert(o.healthAlerts.list.length === 3, 'TOP3 名单')
  assertEq(o.healthAlerts.list[0].level, 'WARNING', '首位是 WARNING')
})

test('H15', '子路径不错配：具体路径绝不落到 :param 泛匹配', async () => {
  reset()
  // 这些请求一旦错配会返回 601（"不存在"）或形状不符
  expect200(call('get', '/apms/athlete/rtpSummary'), 'rtpSummary')
  expect200(call('get', '/apms/test-result/by-task-member', { taskId: '4', athleteId: '1001' }), 'by-task-member')
  expect200(call('get', '/apms/body-measure/athlete/1001/latest'), 'bm latest')
  expect200(call('get', '/apms/phv/athlete/1001/latest'), 'phv latest')
  expect200(call('get', '/apms/rtp/status/1001'), 'rtp status')
  expect200(call('get', '/apms/indicator/ref/list/5'), 'ref list')
  expect200(call('get', '/apms/indicator/level/list/3'), 'level list')
  expect200(call('get', '/apms/test-model/field/list/3'), 'field list')
  expect200(call('get', '/apms/test-task/item/list/4'), 'item list')
  expect200(call('get', '/apms/test-task/member/list/4'), 'member list')
  expect200(call('get', '/apms/combo-model/component/list/1'), 'component list')
})

test('H17', 'RTP 风险预警：双维度筛选/统计/知悉/忽略/采纳单接口原子语义/幂等', async () => {
  reset()
  const list = call('get', '/apms/rtp-risk/list', { pageNum: '1', pageSize: '10' })
  expect200(list, 'risk list')
  assertEq(list.total, 4, '当日 ACTIVE 4 条（ACKED 不入待办）')
  assertEq(list.rows[0].suggestedLevel, 'WARNING', '排序首条 WARNING（priority 最高）')
  const stat = call('get', '/apms/rtp-risk/stat').data
  assertEq(stat.total, 4); assertEq(stat.warning, 1); assertEq(stat.attention, 1)
  assertEq(stat.infoHealth, 1); assertEq(stat.processOnly, 1, '流程待办独立计数')

  // PROCESS 隔离筛选
  assertEq(call('get', '/apms/rtp-risk/list', { processOnly: '1' }).rows.length, 1, '纯流程待办 1 条')
  assertEq(call('get', '/apms/rtp-risk/list', { processFlag: 'REVIEW_OVERDUE' }).rows.length, 1, '仅看复检逾期')
  assertEq(call('get', '/apms/rtp-risk/list', { suggestedLevel: 'INFO', processOnly: '0' }).rows.length, 1, '健康 INFO 与流程 INFO 分开')
  assertEq(call('get', '/apms/rtp-risk/list', { suggestedLevel: 'WARNING' }).rows[0].athleteId, 1004)
  assertEq(call('get', '/apms/rtp-risk/list', { status: 'ACKED,ACCEPTED,DISMISSED' }).total, 1, '已处理列表含 ACKED')
  assertEq(call('get', '/apms/rtp-risk/athlete/1004/latest').data.suggestedLevel, 'WARNING', '详情页当前建议')
  assertEq(call('get', '/apms/rtp-risk/athlete/1005/latest').data, null, '已 ACKED 当日不再作 ACTIVE 建议')

  // INFO 才能 ACK；ACK 幂等
  assertEq(call('post', '/apms/rtp-risk/-901/ack', {}, { remark: 'x' }).code, 601, 'WARNING 不可知悉')
  expect200(call('post', '/apms/rtp-risk/-904/ack', {}, { remark: '已知悉' }))
  assertEq(db().rtpRiskSnapshots.find(s => s.id === -904).status, 'ACKED')
  expect200(call('post', '/apms/rtp-risk/-904/ack', {}, { remark: '再点' }), 'ACK 幂等')
  assertEq(db().rtpRiskSnapshots.filter(s => s.status === 'ACKED' && s.handledBy === 'super').length, 2)

  // DISMISS 必须填理由
  assertEq(call('post', '/apms/rtp-risk/-903/dismiss', {}, { remark: '' }).code, 601, '忽略理由必填')
  expect200(call('post', '/apms/rtp-risk/-903/dismiss', {}, { remark: '线下已复检，系统未采集' }))
  assertEq(db().rtpRiskSnapshots.find(s => s.id === -903).status, 'DISMISSED')

  // 采纳：级别白名单（ATTENTION→y / WARNING→r，拒绝 g）
  assertEq(call('post', '/apms/rtp-risk/-902/accept', {}, { status: 'g' }).code, 601, 'ATTENTION 拒绝 green')
  const acc = call('post', '/apms/rtp-risk/-902/accept', {}, {
    status: 'y', reason: '采纳测试', trainingLimit: '限制跳跃', nextReviewDate: '2026-10-20'
  })
  expect200(acc)
  assertEq(acc.data.status, 'ACCEPTED'); assertEq(acc.data.acceptedStatus, 'y')
  const rtpRow = db().rtpStatuses.find(s => s.athleteId === 1015)
  assertEq(rtpRow.status, 'y'); assertEq(rtpRow.reason, '采纳测试')
  assertEq(rtpRow.nextReviewDate, '2026-10-20')
  assert(db().rtpLogs.some(l => l.athleteId === 1015 && l.toStatus === 'y' && l.reason === '采纳测试'),
    '采纳同调用写 rtp_log')
  assertEq(db().athletes.find(a => a.athleteId === 1015).rtpStatus, 'y', '同步花名册冗余')
  // 重复采纳幂等：不重复写日志
  const logsBefore = db().rtpLogs.filter(l => l.athleteId === 1015).length
  expect200(call('post', '/apms/rtp-risk/-902/accept', {}, { status: 'y' }))
  assertEq(db().rtpLogs.filter(l => l.athleteId === 1015).length, logsBefore, '重复采纳不重复写 RTP/日志')

  // 不降级校验（同级允许）：陈嘉宇当前已是 r，WARNING 采纳 r 不拦截；rank(r)>rank(y) 的拦截由后端同口径保证
  const sameLevel = call('post', '/apms/rtp-risk/-901/accept', {}, { status: 'r' })
  expect200(sameLevel, '同级 r→r 允许')
  // 规则只读
  expect200(call('get', '/apms/rtp-risk/rules'), '规则列表 200')
  assertEq(call('get', '/apms/rtp-risk/rules').data.length, 4, '一期 4 条规则')
  // 扫描
  const scan = call('post', '/apms/rtp-risk/scan')
  expect200(scan); assertEq(scan.data.withRisk, 0, '全部处置后当日无剩余 ACTIVE')
})

test('H16', 'strict 模式：super 分组页面真实请求序列零 MISS', async () => {
  reset()
  globalThis.__VITE_ENV__.VITE_DEMO_MOCK_STRICT = 'true'
  missLog.length = 0
  const seq = [
    ['get', '/getInfo'], ['get', '/getRouters'],
    ['get', '/system/notice/listTop'], ['get', '/system/user/profile'],
    ['get', '/system/dict/data/type/apms_position'],
    ['get', '/system/dict/data/type/apms_athlete_status'],
    ['get', '/system/dept/list'],
    // 锁屏已改为免鉴权纯前端解锁（lock.vue 直接 unlockScreen()），不再有 /unlockscreen 请求
    ['get', '/apms/dashboard/overview'],
    ['get', '/apms/athlete/list?pageNum=1&pageSize=10'],
    ['get', '/apms/athlete/rtpSummary'],
    ['get', '/apms/athlete/1001'],
    ['get', '/apms/athlete-group/athlete/1001'],
    ['get', '/apms/athlete-group/athlete/1001/current'],
    ['get', '/apms/body-measure/list'],
    ['get', '/apms/body-measure/athlete/1001'],
    ['get', '/apms/phv/list'],
    ['get', '/apms/phv/athlete/1001'],
    ['get', '/apms/rtp/status/list'],
    ['get', '/apms/rtp/status/1001'],
    ['get', '/apms/rtp/log/1001'],
    ['get', '/apms/rtp-risk/athlete/1001/latest'],
    ['get', '/apms/rtp-risk/list?pageNum=1&pageSize=10'],
    ['get', '/apms/rtp-risk/stat'],
    ['get', '/apms/rtp-risk/-901'],
    ['get', '/apms/indicator/list?pageNum=1&pageSize=10'],
    ['get', '/apms/indicator/5'],
    ['get', '/apms/indicator/ref/list/5'],
    ['get', '/apms/indicator/level/list/3'],
    ['get', '/apms/test-model/list?pageNum=1&pageSize=10'],
    ['get', '/apms/test-model/algorithms'],
    ['get', '/apms/test-model/3'],
    ['get', '/apms/test-model/field/list/3'],
    ['get', '/apms/test-task/list?pageNum=1&pageSize=10'],
    ['get', '/apms/test-task/4'],
    ['get', '/apms/test-task/item/list/4'],
    ['get', '/apms/test-task/member/list/4'],
    ['get', '/apms/test-result/list?pageNum=1&pageSize=10&taskId=1&isSelected=1'],
    ['get', '/apms/test-result/by-task-member?taskId=1&athleteId=1001'],
    ['get', '/apms/test-result/10'],
    ['get', '/apms/combo-model/list?pageNum=1&pageSize=10'],
    ['get', '/apms/combo-model/1'],
    ['get', '/apms/combo-model/component/list/1'],
    ['get', '/apms/combo-score/list'],
    ['get', '/apms/medical-record/list?pageNum=1&pageSize=10'],
    ['get', '/apms/medical-record/site-stats?range=12m'],
    ['get', '/apms/medical-record/1'],
    ['get', '/apms/report/list?pageNum=1&pageSize=10'],
    ['get', '/apms/report/1'],
    // 系统组：角色权限管理 + 组织架构（/system/dept/list 已在序列前部）+ 用户管理
    ['get', '/system/role/list?pageNum=1&pageSize=10'],
    ['get', '/system/user/list?pageNum=1&pageSize=10'],
    ['get', '/system/user/deptTree']
  ]
  // mockDispatch 只收 path/query，序列里的 querystring 先规范化
  for (const [method, raw] of seq) {
    const u = new URL(raw, 'http://demo.local')
    const query = {}
    for (const [k, v] of u.searchParams.entries()) query[k] = v
    const r = engine.mockDispatch({ method, path: u.pathname, query, body: {} })
    assertEq(r.code, 200, `${method.toUpperCase()} ${raw} strict 下必须 200`)
  }
  assertEq(missLog.length, 0, '全序列零 MISS')
  delete globalThis.__VITE_ENV__.VITE_DEMO_MOCK_STRICT
})

test('H18', '用户管理：列表筛选/部门树/CRUD/受保护账号/状态与重置密码', async () => {
  reset()
  // 会话身份必须携带归属部门 200：用户管理页对非 admin 账号按本部门裁剪部门树，
  // 缺 deptId 会被 cropTreeToOwnDept 裁成空树（与真实 super 归属 APMS 总部一致）
  const info = call('get', '/getInfo')
  expect200(info)
  assertEq(info.user.deptId, 200, '演示 super 会话归属 APMS 总部')
  // 列表分页 + 蓝本 5 个账号
  const list = call('get', '/system/user/list', { pageNum: '1', pageSize: '10' })
  expect200(list); assertEq(list.total, 5, '蓝本 5 个用户')
  // 模糊筛选（登录账号）
  const byName = call('get', '/system/user/list', { pageNum: '1', pageSize: '10', userName: 'coach' })
  assertEq(byName.rows.length, 2, 'userName 模糊命中 2 个 coach')
  // 状态等值筛选
  const disabled = call('get', '/system/user/list', { pageNum: '1', pageSize: '10', status: '1' })
  assertEq(disabled.rows.length, 1, '停用账号 1 个')
  assertEq(disabled.rows[0].userName, 'coach_wang', '停用示例账号正确')
  // 部门筛选含子部门：选 APMS 总部(200) 命中全部
  const byDept = call('get', '/system/user/list', { pageNum: '1', pageSize: '10', deptId: '200' })
  assertEq(byDept.total, 5, '总部部门含全部子部门账号')
  // 部门树契约：id/label/children，三级结构 总部→梯队→小组
  const tree = call('get', '/system/user/deptTree')
  expect200(tree)
  const root = tree.data[0]
  assertEq(root.label, 'APMS 总部', '部门树根节点')
  assertEq(root.children.length, 2, '根下 2 支梯队')
  const u18 = root.children.find(n => n.label === 'U18 梯队')
  const u16 = root.children.find(n => n.label === 'U16 梯队')
  assertEq(u18.children.map(n => n.label).join(','), '速度专项组,康复组', 'U18 挂 2 个小组')
  assertEq(u16.children.map(n => n.label).join(','), '力量组', 'U16 挂 1 个小组')
  // 新增弹窗选项（无参 getUser，URL 末尾斜杠）
  const opts = call('get', '/system/user/')
  expect200(opts); assert(opts.roles.length >= 4 && opts.posts.length === 3, '角色/岗位选项')
  // 详情回显：data + roleIds + postIds
  const detail = call('get', '/system/user/101')
  expect200(detail)
  assertEq(detail.data.userName, 'coach_li', '详情账号')
  assertEq(detail.roleIds[0], 201, '角色 id 回显')
  assert(Array.isArray(detail.postIds) && detail.postIds.length === 1, '岗位 id 回显')
  // 重复账号拦截
  const dup = call('post', '/system/user', {}, { userName: 'super', nickName: '重复', roleIds: [201] })
  assertEq(dup.code, 601, '重复登录账号拦截')
  // 正常新增（专岗账号：短信登录，无密码）
  const before = db().users.length
  const add = call('post', '/system/user', {}, {
    userName: 'coach_zhao', nickName: '赵教练', deptId: 201,
    loginPhonenumber: '13900000900', phonenumber: '13900000900',
    sex: '0', status: '0', roleIds: [201], postIds: [10]
  })
  expect200(add, '新增用户成功')
  assertEq(db().users.length, before + 1, '用户表 +1')
  const created = db().users.find(u => u.userName === 'coach_zhao')
  assert(created.userId > 1000, '新用户使用正数样本外 id')
  assertEq(created.roles[0].roleName, '教练', '新用户角色显示对象已组装')
  assertEq(created.dept.deptName, 'U18 梯队', '新用户部门显示对象已组装')
  // 修改用户
  const upd = call('put', '/system/user', {}, { ...created, nickName: '赵教练（改）', status: '0' })
  expect200(upd)
  assertEq(db().users.find(u => u.userId === created.userId).nickName, '赵教练（改）', '修改落库')
  // 受保护账号：停用 super 必须被拒
  const blockStatus = call('put', '/system/user/changeStatus', {}, { userId: 100, status: '1' })
  assertEq(blockStatus.code, 601, 'super 停用拦截')
  // 普通账号停用成功
  expect200(call('put', '/system/user/changeStatus', {}, { userId: 104, status: '0' }), '普通账号启停用')
  // 重置密码（演示仅回成功）
  expect200(call('put', '/system/user/resetPwd', {}, { userId: 101, password: 'Demo@123456' }), '重置密码')
  // 受保护账号：删除 super 整批拒绝且数据不动
  const delBlock = call('delete', '/system/user/100')
  assertEq(delBlock.code, 601, 'super 删除拦截')
  assert(db().users.some(u => u.userId === 100), 'super 仍存在')
  // 普通账号可删（含新账号）
  expect200(call('delete', '/system/user/' + created.userId), '普通账号删除')
  assert(!db().users.some(u => u.userId === created.userId), '目标账号已移除')
})

test('H19', '组织架构：dept/list 响应副本隔离，重复建树不污染内存库（部门不累加）', async () => {
  reset()
  // 复刻 utils/ruoyi.js handleTree 的原地建树：节点上直接写 children
  const buildTree = (rows) => {
    const map = {}
    rows.forEach(d => { map[d.deptId] = d; if (!d.children) d.children = [] })
    rows.forEach(d => { if (map[d.parentId]) map[d.parentId].children.push(d) })
  }
  // 第一次进入组织架构页：拉取并建树（三级：总部 200 → 梯队 201/202 → 小组）
  const r1 = call('get', '/system/dept/list')
  expect200(r1)
  buildTree(r1.data)
  assertEq(r1.data.find(d => d.deptId === 200).children.length, 2, '响应副本可正常建树（根下 2 支梯队）')
  assertEq(r1.data.find(d => d.deptId === 201).children.length, 2, 'U18 下挂 2 个小组')
  // 内存库必须保持扁平蓝本，不被响应侧的原地建树污染
  assert(db().depts.every(x => x.children.length === 0), '内存库 children 保持空数组')
  // 切走再切回：再次拉取仍是干净的 6 条扁平数据（修复前此处会累加到 11/16…）
  const r2 = call('get', '/system/dept/list')
  expect200(r2)
  assertEq(r2.data.length, 6, '重复拉取条数稳定为 6')
  assert(r2.data.every(x => x.children.length === 0), '新响应 children 仍为空')
  assert(r1.data[0] !== r2.data[0], '两次响应对象相互隔离')
})

test('H20', '组织架构：详情/排除子树/筛选/增改删排序/三重删除拦截/副本隔离', async () => {
  reset()
  // 详情回显 + 副本隔离（弹窗 v-model 不得直改内存库）
  const detail = call('get', '/system/dept/200')
  expect200(detail)
  assertEq(detail.data.deptName, 'APMS 总部', '详情回显')
  detail.data.deptName = '被前端改了'
  assertEq(db().depts.find(d => d.deptId === 200).deptName, 'APMS 总部', '详情副本不污染内存库')
  assertEq(call('get', '/system/dept/999999').code, 601, '不存在部门返回 601')

  // 排除节点：剔除自身及整棵子树。201 子树含 201/203/204，剩 200/202/205 共 3 条；
  // 202 子树含 202/205，剩 4 条；根 200 连同整棵树剔除后为空
  const exLeaf = call('get', '/system/dept/list/exclude/201')
  expect200(exLeaf)
  assertEq(exLeaf.data.length, 3, '排除 U18 子树后剩 3 条')
  assert(!exLeaf.data.some(d => [201, 203, 204].includes(d.deptId)), '被排除子树节点均不在结果中')
  assertEq(call('get', '/system/dept/list/exclude/202').data.length, 4, '排除 U16 子树后剩 4 条')
  assertEq(call('get', '/system/dept/list/exclude/200').data.length, 0, '排除根节点整棵子树为空')

  // 列表筛选：名称模糊 / 状态等值
  assertEq(call('get', '/system/dept/list', { deptName: 'U18' }).data.length, 1, '名称模糊命中 1 条')
  assertEq(call('get', '/system/dept/list', { status: '1' }).data.length, 0, '蓝本无停用部门')

  // 新增校验：顶级/建机构/层级错配仍 601；演示库 APMS 总部(200,类型10)是受管子树顶端，其下建队伍放行
  assertEq(call('post', '/system/dept', {}, { deptName: 'X', parentId: 0, deptType: '20' }).code, 601, '禁止顶级部门')
  const underHq = call('post', '/system/dept', {}, { deptName: '临时梯队', parentId: 200, deptType: '20', orderNum: 9, status: '0' })
  expect200(underHq, 'APMS 总部下允许新增队伍')
  const hqChild = db().depts.find(d => d.deptName === '临时梯队')
  assertEq(hqChild.ancestors, '0,200', '新队伍 ancestors 物化祖先链')
  assertEq(hqChild.parentName, 'APMS 总部', '新队伍 parentName 回填')
  expect200(call('delete', '/system/dept/' + hqChild.deptId), '临时队伍清理（无引用可删）')
  assertEq(call('post', '/system/dept', {}, { deptName: 'X', parentId: 201, deptType: '10' }).code, 601, '非 admin 不能建机构')
  assertEq(call('post', '/system/dept', {}, { deptName: 'X', parentId: 203, deptType: '20' }).code, 601, '队伍不能挂小组下')

  // 正常新增：U18 梯队(201, 类型20) 下建训练小组(30)
  const before = db().depts.length
  const add = call('post', '/system/dept', {}, {
    deptName: '弹跳专项组', parentId: 201, deptType: '30', orderNum: 9,
    leader: '测试教练', phone: '13800001234', email: 't@apms.demo', status: '0'
  })
  expect200(add, '新增小组成功')
  assertEq(db().depts.length, before + 1, '部门表 +1')
  const created = db().depts.find(d => d.deptName === '弹跳专项组')
  assert(created.deptId > 900000, '新部门使用样本外 id')
  assertEq(created.ancestors, '0,200,201', 'ancestors 物化祖先链')
  assertEq(created.parentName, 'U18 梯队', 'parentName 回填')
  // 同级重名拦截（同 parentId 口径）
  assertEq(call('post', '/system/dept', {}, { deptName: '弹跳专项组', parentId: 201, deptType: '30' }).code, 601, '同级重名拦截')

  // 修改：重命名 + 移动到 U16 梯队(202)，ancestors 联动重算
  const upd = call('put', '/system/dept', {}, { ...created, deptName: '弹跳专项组（改）', parentId: 202 })
  expect200(upd, '修改并移动部门成功')
  const moved = db().depts.find(d => d.deptId === created.deptId)
  assertEq(moved.deptName, '弹跳专项组（改）', '重命名落库')
  assertEq(moved.ancestors, '0,200,202', '移动后 ancestors 重算')
  // 上级不能是自己
  assertEq(call('put', '/system/dept', {}, { ...moved, parentId: moved.deptId }).code, 601, '自引用上级拦截')
  // 停用含正常子部门的节点（200 下全是正常子部门）；不传 deptType 走兼容分支
  assertEq(
    call('put', '/system/dept', {}, { deptId: 200, parentId: 0, deptName: 'APMS 总部', status: '1' }).code,
    601,
    '停用有正常子部门的节点拦截'
  )

  // 保存排序：逗号串按下标配对落库
  expect200(call('put', '/system/dept/updateSort', {}, { deptIds: '203,204', orderNums: '99,98' }), '排序保存')
  assertEq(db().depts.find(d => d.deptId === 203).orderNum, 99, '排序落库 203')
  assertEq(db().depts.find(d => d.deptId === 204).orderNum, 98, '排序落库 204')

  // 删除三重引用校验（顺序对齐后端：下级 → 用户 → 运动员/在组成员）
  assertEq(call('delete', '/system/dept/200').code, 601, '总部有下级部门拒绝删除')
  assertEq(call('delete', '/system/dept/201').code, 601, 'U18 有下级小组拒绝删除')
  assertEq(call('delete', '/system/dept/203').code, 601, '速度专项组有用户拒绝删除')
  assertEq(call('delete', '/system/dept/205').code, 601, '力量组有在组成员拒绝删除')
  // 新建部门无任何引用，可删且数量还原
  expect200(call('delete', '/system/dept/' + moved.deptId), '无引用部门删除成功')
  assert(!db().depts.some(d => d.deptId === moved.deptId), '目标部门已移除')
  assertEq(db().depts.length, before, '删除后数量还原为蓝本 6 条')
})

/* ============================ I. xlsxLite 零依赖 XLSX 生成器 ============================ */
// 独立实现一份 CRC32 与 STORE zip 解析，避免与被测代码共享实现，做端到端校验
const CRC32_REF_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()
function crc32Ref(bytes) {
  let crc = 0xFFFFFFFF
  for (const b of bytes) crc = CRC32_REF_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

test('I1', 'CRC32 参考实现满足标准向量（空串=0，123456789=0xCBF43926）', async () => {
  assertEq(crc32Ref(new TextEncoder().encode('')), 0, '空串 CRC')
  assertEq(crc32Ref(new TextEncoder().encode('123456789')), 0xCBF43926, '标准向量')
})

test('I2', 'buildXlsxBytes：STORE zip 结构/5 个部件/CRC 与尺寸自洽/sheet 内容可还原', async () => {
  const { buildXlsxBytes } = await import(src('utils/xlsxLite'))
  const rows = [
    ['#说明行', '姓名'],
    ['athlete_id', 'athlete_name', ...Array.from({ length: 25 }, (_, i) => `C${i}`)],
    ['1001', '张<三>&"A"', ...Array.from({ length: 25 }, (_, i) => String(i))]
  ]
  const bytes = buildXlsxBytes(rows)
  assertEq(bytes[0], 0x50, 'PK 签名字节 1'); assertEq(bytes[1], 0x4B, 'PK 签名字节 2')

  // 解析 EOCD（末尾 22 字节）
  const eocd = new DataView(bytes.buffer, bytes.length - 22)
  assertEq(eocd.getUint32(0, true), 0x06054b50, 'EOCD 签名')
  assertEq(eocd.getUint16(8, true), 5, '5 个 zip 条目')
  assertEq(eocd.getUint16(10, true), 5, '中央目录条目数一致')

  // 遍历本地文件头，STORE 方式提取原始数据
  const entries = new Map()
  let p = 0
  while (p < bytes.length - 22 && new DataView(bytes.buffer, p).getUint32(0, true) === 0x04034b50) {
    const dv = new DataView(bytes.buffer, p)
    const method = dv.getUint16(8, true)
    const crc = dv.getUint32(14, true)
    const size = dv.getUint32(18, true)
    const nameLen = dv.getUint16(26, true)
    const extraLen = dv.getUint16(28, true)
    assertEq(method, 0, '必须为 STORE(0)，不依赖 deflate')
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + nameLen))
    const dataStart = p + 30 + nameLen + extraLen
    const data = bytes.subarray(dataStart, dataStart + size)
    assertEq(crc32Ref(data), crc, `CRC32 自洽：${name}`)
    entries.set(name, new TextDecoder().decode(data))
    p = dataStart + size
  }
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml']) {
    assert(entries.has(part), `包含部件 ${part}`)
  }
  const sheet = entries.get('xl/worksheets/sheet1.xml')
  assert(sheet.includes('<?xml') && sheet.includes('</worksheet>'), 'sheet XML 完整')
  assert(sheet.includes('r="A1"') && sheet.includes('r="B1"'), '单元格引用 A1/B1')
  assert(sheet.includes('r="AA2"'), '第 27 列引用为 AA2（列号进位正确）')
  assert(sheet.includes('张&lt;三&gt;&amp;&quot;A&quot;'), 'XML 特殊字符转义')
  assert(sheet.includes('t="inlineStr"'), 'inlineStr 文本单元格')
  assert(entries.get('xl/workbook.xml').includes('name="import"'), 'workbook 表名 import')
})

test('I3', 'buildXlsxBytes：空表与中文 BOM 无关场景不抛错，单行可生成', async () => {
  const { buildXlsxBytes } = await import(src('utils/xlsxLite'))
  const one = buildXlsxBytes([['a', 'b']])
  assert(one.length > 0 && one[0] === 0x50, '单行模板生成成功')
  const empty = buildXlsxBytes([])
  const dv = new DataView(empty.buffer, empty.length - 22)
  assertEq(dv.getUint16(8, true), 5, '无数据行时部件仍为 5 个')
})

/* ------------------------------ 汇总（串行执行） ------------------------------ */
console.error = origError
for (const runCase of queue) {
  // 全程用探针：记录 [DEMO MOCK MISS]，其余 error 静默
  console.error = (...args) => { if (String(args[0]).includes('[DEMO MOCK MISS]')) missLog.push(args) }
  await runCase()
}
console.error = origError

console.log('\n================ 演示模式桩测结果 ================')
console.log(`通过：${passed}`)
if (failures.length) {
  console.log(`失败：${failures.length}`)
  failures.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
} else {
  console.log('全部通过 ✅')
}
