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
  assertEq(info.roles[0], 'business_admin')
  assertEq(info.permissions[0], '*:*:*')
  assertEq(info.user.userName, 'super')
  assert(info.user.userId < 0, '演示 userId 必须为负数，避免与真实账号撞 ID')

  const routers = mockDispatch({ method: 'get', path: '/getRouters', query: {}, body: {} })
  assertEq(routers.data[0].path, '/apms')
  assertEq(routers.data[0].children.length, 14, '14 个业务子菜单（含 RTP 风险预警）')
  assert(routers.data[0].children.some(c => c.path === 'rtpWarning'
    && c.meta.title === 'RTP 风险预警'), '新增 RTP 风险预警菜单')
  assert(routers.data[0].children.some(c => c.path === 'rtp'
    && c.meta.title === 'RTP 状态管理'), '旧 RTP 菜单改名为 RTP 状态管理')

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
test('G1', '模块加载即初始化：21 张表齐全、无 undefined', async () => {
  const db = await import(src('mock/db'))
  const d = db.getDb()
  const tables = Object.keys(d)
  assertEq(tables.length, 25, `表数量 ${tables.length}`)
  for (const t of tables) assert(Array.isArray(d[t]), `${t} 必须是数组`)
  assertEq(d.notices.length, 2)
  // depts 与真实接口一致：扁平列表（children 均为空，树由前端构建）
  assertEq(d.depts.length, 6, '部门扁平列表 6 条')
  assert(d.depts.every(x => Array.isArray(x.children) && x.children.length === 0), 'children 必须全部为空数组')
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

test('H1', '花名册：分页/模糊/队别/位置/年龄组筛选 + rtpSummary + 球衣号查重', async () => {
  reset()
  const all = call('get', '/apms/athlete/list', { pageNum: '1', pageSize: '10' })
  expect200(all, 'athlete list'); assertEq(all.total, 15); assertEq(all.rows.length, 10)
  const page2 = call('get', '/apms/athlete/list', { pageNum: '2', pageSize: '10' })
  assertEq(page2.rows.length, 5, '第二页 5 条')
  const byName = call('get', '/apms/athlete/list', { name: '张' })
  assert(byName.rows.every(r => r.name.includes('张')), '模糊筛选')
  const u18 = call('get', '/apms/athlete/list', { primaryTeamId: '201' })
  assert(u18.rows.length >= 1 && u18.rows.every(r => String(r.primaryTeamId) === '201'), '队别筛选')
  const fw = call('get', '/apms/athlete/list', { position: 'MF' })
  assert(fw.rows.every(r => r.position === 'MF'), '位置筛选')
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
  const dup = call('get', '/apms/athlete/check_jersey_no', { jerseyNo: '10', primaryTeamId: '201' })
  assertEq(dup.code, 601, '同队同号应判重')
  const okUnique = call('get', '/apms/athlete/check_jersey_no', { jerseyNo: '77', primaryTeamId: '201' })
  assertEq(okUnique.code, 200)
})

test('H2', '花名册 CRUD 内存生效：增（负 ID）→ 改 → 逻辑删 → reset 还原', async () => {
  reset()
  const add = call('post', '/apms/athlete', {}, { name: '测试小将', gender: 'M', primaryTeamId: 201, jerseyNo: 77, birthday: '2010-06-01' })
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
  const upd = call('put', '/apms/athlete', {}, { athleteId: created.athleteId, position: 'GK' })
  expect200(upd); assertEq(db().athletes[0].position, 'GK')
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
  const addC = call('post', '/apms/combo-model', { name: '演示新组合', code: 'DEMO_C' })
  expect200(addC); assertEq(db().comboModels.length, 2)
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

test('H6', '测试结果：列表默认只看最佳，自动选最佳遵守方向，手动指定，按任务清空', async () => {
  reset()
  const list = call('get', '/apms/test-result/list', { pageNum: '1', pageSize: '50', taskId: '1' })
  expect200(list)
  assert(list.rows.every(r => String(r.isSelected) === '1'), '默认 isSelected=1')
  const all = call('get', '/apms/test-result/list', { pageNum: '1', pageSize: '50', taskId: '1', isSelected: '' })
  assert(all.total >= list.total, '显式不限选中时条数更多')
  // LOWER_BETTER 组（30 米冲刺）：自动选择必须取最小尝试
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
    const vals = sprintGroup.map(r => ({ id: r.id, v: Number(r.values?.[0]?.numericValue) }))
    const want = vals.reduce((a, b) => (b.v < a.v ? b : a)).id
    assertEq(db().testResults.find(r => r.id === want).isSelected, '1', 'LOWER_BETTER 选最小')
    const other = vals.find(x => x.id !== want)
    expect200(call('post', `/apms/test-result/select-attempt/${other.id}`))
    assertEq(db().testResults.find(r => r.id === other.id).isSelected, '1', '手动选尝试')
  }
  const btm = call('get', '/apms/test-result/by-task-member', { taskId: '1', athleteId: '1001' })
  expect200(btm); assert(Array.isArray(btm.data) && btm.data.length >= 1)
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

test('H6e', '散录归一：模型无方向→最新一次当选（不看数值大小）；指标有方向→按方向取优；attemptNo 递增', async () => {
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
  // 指标 VJUMP（HIGHER_BETTER，id=4）：55 再 57 → 57 当选
  mk({ itemType: 'INDICATOR', indicatorId: 4, date: '2026-10-01', sessionKey: 'VA', v: 55 })
  mk({ itemType: 'INDICATOR', indicatorId: 4, date: '2026-10-03', sessionKey: 'VB', v: 57 })

  const modelRows = db().testResults.filter(r => r.sessionKey === 'MA' || r.sessionKey === 'MB')
  const indRows = db().testResults.filter(r => r.sessionKey === 'VA' || r.sessionKey === 'VB')
  assertEq(modelRows.find(r => r.sessionKey === 'MA').isSelected, '0', '旧模型记录转备选')
  assertEq(modelRows.find(r => r.sessionKey === 'MB').isSelected, '1', '最新模型记录当选（与数值大小无关）')
  assertEq(indRows.find(r => r.sessionKey === 'VA').isSelected, '0', '低指标值转备选')
  assertEq(indRows.find(r => r.sessionKey === 'VB').isSelected, '1', '高指标值按方向当选')
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

test('H7', '体态测量：data 数组列表/最新/upsert 幂等', async () => {
  reset()
  const list = call('get', '/apms/body-measure/list', {})
  expect200(list); assert(Array.isArray(list.data) && list.data.length === 10, '列表返回 data 数组')
  const latest = call('get', '/apms/body-measure/athlete/1001/latest')
  expect200(latest); assert(latest.data && String(latest.data.athleteId) === '1001')
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

test('H13', '归属：在组/历史/加入幂等/离开', async () => {
  reset()
  const hist = call('get', '/apms/athlete-group/athlete/1001')
  expect200(hist); assert(hist.data.length >= 1)
  const cur = call('get', '/apms/athlete-group/athlete/1001/current')
  expect200(cur)
  const deptId = cur.data ? 202 : 201
  const j1 = call('post', '/apms/athlete-group/join', {}, { athleteId: 1001, deptId, joinDate: '2026-09-28' })
  expect200(j1)
  const j2 = call('post', '/apms/athlete-group/join', {}, { athleteId: 1001, deptId, joinDate: '2026-09-28' })
  expect200(j2, '重复加入幂等返回 200')
  const nowCur = call('get', '/apms/athlete-group/athlete/1001/current').data
  assertEq(nowCur.deptId, deptId)
  expect200(call('post', '/apms/athlete-group/leave/1001', {}, { leaveDate: '2026-09-29' }))
  assertEq(call('get', '/apms/athlete-group/athlete/1001/current').data, null)
})

test('H14', '总览看板：形状与内存聚合正确', async () => {
  reset()
  const o = call('get', '/apms/dashboard/overview').data
  for (const k of ['summary', 'comboScoreRanking', 'indicatorRadar', 'phvScatter', 'taskCompletion', 'teamDistribution']) {
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

test('H16', 'strict 模式：14 页面真实请求序列零 MISS', async () => {
  reset()
  globalThis.__VITE_ENV__.VITE_DEMO_MOCK_STRICT = 'true'
  missLog.length = 0
  const seq = [
    ['get', '/getInfo'], ['get', '/getRouters'],
    ['get', '/system/notice/listTop'], ['get', '/system/user/profile'],
    ['get', '/system/dict/data/type/apms_position'],
    ['get', '/system/dict/data/type/apms_athlete_status'],
    ['get', '/system/dept/list'],
    ['post', '/unlockscreen'],
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
    ['get', '/apms/medical-record/1'],
    ['get', '/apms/report/list?pageNum=1&pageSize=10'],
    ['get', '/apms/report/1']
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
