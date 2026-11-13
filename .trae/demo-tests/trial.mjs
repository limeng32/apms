/**
 * Trial 演示站（/trial/）Node 桩测（不依赖无头浏览器）
 *
 * 运行（必须在仓库根目录）：node .trae/demo-tests/trial.mjs
 *
 * 覆盖（对应 .trae/documents/trial_demo_plan.md 验收条目）：
 * T0. 构建期锁定原语 isDemoLocked / TRIAL_URL 判定 / openTrial noopener 单点
 * T1. 锁定构建 auth 四态：getToken 永不回落真实 Cookie；setToken/removeToken 全 no-op（§3.2.2 规则1、验收5）
 * T2. 锁定闸门路由裁决矩阵全格（§3.2.0b、验收3.2）
 * T3. 零真实请求：publicHttp 拦截器在锁定构建中 reject（§3.2.1 兜底、验收4）
 * T4. 构建产物标识与子路径烘焙（验收1/2/2.1 的文件系统侧证据）
 * T5. 正式构建回归：未锁定时 none 态 Cookie 回落与 Cookie 写删保持原行为
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

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
globalThis.__VITE_ENV__ = { DEV: false, VITE_APP_BASE_API: '/prod-api' }

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
    if (mode === 'storage-error') this.getThrow = true
  }
}
globalThis.sessionStorage = {
  getItem: (k) => { if (ss.getThrow) throw new Error('SecurityError'); return ss.mem.has(k) ? ss.mem.get(k) : null },
  setItem: (k, v) => { if (ss.setThrow || ss.getThrow) throw new Error('SecurityError'); ss.mem.set(k, String(v)) },
  removeItem: (k) => { if (ss.getThrow) throw new Error('SecurityError'); ss.mem.delete(k) }
}

// window 探针：location 供 ruoyi.js cookieName 模块初始化读取（生产 hostname → Cookie 名不加端口后缀）；
// open 记录 openTrial 单点调用
const openCalls = []
globalThis.window = {
  location: { hostname: 'aoti.apms.top', port: '', pathname: '/trial/login' },
  open: (...a) => { openCalls.push(a); return {} }
}

const cookieStub = (await import(STUBS['js-cookie'])).default
const AUTH_URL = src('utils/auth')
const DEMO_URL = src('utils/demo')
const TRIAL_URL = src('utils/trial')
const fresh = (u) => import(`${u}?bust=${Math.random()}`)

const lockOn = () => { globalThis.__VITE_ENV__.VITE_DEMO_LOCKED = 'true' }
const lockOff = () => { delete globalThis.__VITE_ENV__.VITE_DEMO_LOCKED }

/* ============================ T0. 锁定原语与 TRIAL_URL ============================ */
test('T0', 'isDemoLocked 随构建期 env 翻转', async () => {
  lockOff()
  const d0 = await fresh(DEMO_URL)
  assertEq(d0.isDemoLocked(), false, '未配置时 false（正式构建）')
  lockOn()
  const d1 = await fresh(DEMO_URL)
  assertEq(d1.isDemoLocked(), true, "VITE_DEMO_LOCKED='true' 时 true（trial 构建）")
  lockOff()
})

test('T0', 'hasTrialUrl：未配置 false，配置后 true（Edition 无关字符串判定）', async () => {
  lockOff()
  delete globalThis.__VITE_ENV__.VITE_TRIAL_URL
  const t0 = await fresh(TRIAL_URL)
  assertEq(t0.hasTrialUrl(), false)
  globalThis.__VITE_ENV__.VITE_TRIAL_URL = 'https://aoti.apms.top/trial/'
  const t1 = await fresh(TRIAL_URL)
  assertEq(t1.hasTrialUrl(), true)
  delete globalThis.__VITE_ENV__.VITE_TRIAL_URL
})

test('T0', 'openTrial：noopener,noreferrer 新标签单点；未配置返回 false 且不调用 window.open', async () => {
  delete globalThis.__VITE_ENV__.VITE_TRIAL_URL
  const t0 = await fresh(TRIAL_URL)
  openCalls.length = 0
  assertEq(t0.openTrial(), false, '未配置返回 false')
  assertEq(openCalls.length, 0, '未配置不得打开标签')

  globalThis.__VITE_ENV__.VITE_TRIAL_URL = 'https://aoti.apms.top/trial/'
  const t1 = await fresh(TRIAL_URL)
  openCalls.length = 0
  assertEq(t1.openTrial(), true, '配置后返回 true')
  assertEq(openCalls.length, 1)
  assertDeep(openCalls[0], ['https://aoti.apms.top/trial/', '_blank', 'noopener,noreferrer'], '打开参数必须含 noopener,noreferrer')
  delete globalThis.__VITE_ENV__.VITE_TRIAL_URL
})

/* ============================ T1. 锁定构建 auth 四态 ============================ */
const STATES = ['none', 'demo', 'broken-json', 'broken-struct', 'storage-error']

for (const mode of STATES) {
  test('T1', `锁定构建 state=${mode}：getToken 不回落真实 Cookie`, async () => {
    lockOn()
    cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
    ss.set(mode)
    const auth = await fresh(AUTH_URL)
    const token = auth.getToken()
    if (mode === 'demo') {
      assert(String(token).startsWith('demo-static-'), `demo 态只返回 demo token，实际 ${token}`)
    } else {
      assertEq(token, undefined, `${mode} 下即使预置真实 Cookie 也必须 undefined`)
    }
    // 全程只读 Cookie，零写删
    assertEq(cookieStub._log.filter(([op]) => op !== 'get').length, 0, '裁决过程零 Cookie 写删')
  })
}

test('T1', '锁定构建 setToken：no-op，真实 Cookie 不被写入', async () => {
  lockOn()
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('none')
  const auth = await fresh(AUTH_URL)
  const ret = auth.setToken('attacker-token')
  assertEq(ret, undefined, '锁定构建 setToken 返回 undefined')
  assertEq(cookieStub.get('Admin-Token'), 'real-cookie-token', '原 Cookie 保持不变')
  assertEq(cookieStub._log.filter(([op]) => op === 'set').length, 0, '不得发生 Cookie set')
})

test('T1', '锁定构建 removeToken：no-op，主站真实 Cookie 不被删除', async () => {
  lockOn()
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('none')
  const auth = await fresh(AUTH_URL)
  auth.removeToken()
  assertEq(cookieStub.get('Admin-Token'), 'real-cookie-token', 'removeToken 后真实 Cookie 仍在')
  assertEq(cookieStub._log.filter(([op]) => op === 'remove').length, 0, '不得发生 Cookie remove')
})

test('T1', '锁定构建 demo 态 set/remove 仍 no-op（纵深防御，正常路径不可达）', async () => {
  lockOn()
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('demo')
  const auth = await fresh(AUTH_URL)
  auth.setToken('x')
  auth.removeToken()
  assertEq(cookieStub.get('Admin-Token'), 'real-cookie-token')
  assertEq(cookieStub._log.filter(([op]) => op !== 'get').length, 0)
})

/* ============================ T2. 路由裁决矩阵（§3.2.0b 全格） ============================ */
const NON_LOGIN_PATHS = ['/register', '/showcase', '/index', '/apms/athlete', '/overview/cockpit', '/unknown-404']

test('T2', '未进演示会话（none）：/login 放行，其余任意路径（含白名单）一律重定向 /login', async () => {
  const t = await fresh(TRIAL_URL)
  assertEq(t.resolveLockedNavigation({ validDemo: false, toPath: '/login' }), true, '/login 放行')
  for (const p of NON_LOGIN_PATHS) {
    assertDeep(t.resolveLockedNavigation({ validDemo: false, toPath: p }),
      { path: '/login', replace: true }, `${p} 必须重定向`)
  }
})

test('T2', '严格 demo 态：任意路径均不干预（null），落入既有 mock 流程', async () => {
  const t = await fresh(TRIAL_URL)
  for (const p of ['/login', '/index', '/apms/athlete', '/register']) {
    assertEq(t.resolveLockedNavigation({ validDemo: true, toPath: p }), null, `${p} demo 态不干预`)
  }
})

test('T2', 'broken/storage-error 异常态：路由层按未授权处理，/login 放行、白名单与业务路径一律弹回', async () => {
  const t = await fresh(TRIAL_URL)
  // 复刻 permission.js 的严格判定表达式：readDemoSessionState().state === 'demo'
  // （旧实现误用 isDemoMode()，异常态返回 true 会漏过锁定闸门，再被 /register 白名单放行）
  lockOn()
  for (const mode of ['broken-json', 'broken-struct', 'storage-error']) {
    ss.set(mode)
    const auth = await fresh(AUTH_URL)
    const validDemo = auth.readDemoSessionState().state === 'demo'
    assertEq(validDemo, false, `${mode} 不得被路由层承认为有效演示会话`)
    // /login 放行：broken 在登录页 onMounted 自愈后弹框，storage-error 渲染存储阻断页
    assertEq(t.resolveLockedNavigation({ validDemo, toPath: '/login' }), true, `${mode} 访问 /login 放行`)
    // 原白名单（/register、/showcase）与业务/静态/404 路径一律重定向，无任何漏网
    for (const p of NON_LOGIN_PATHS) {
      assertDeep(t.resolveLockedNavigation({ validDemo, toPath: p }),
        { path: '/login', replace: true }, `${mode} 访问 ${p} 必须重定向 /login`)
    }
  }
})

test('T2', '网络层 fail-closed 宽判定保持不变：异常态 isDemoMode() 仍为 true（adapter 绝不卸载）', async () => {
  // 路由层收紧不影响网络层：broken/storage-error 下 isDemoMode() 必须仍为 true，
  // request.js 的 demoAdapter 挂接与 download/upload 守卫继续拦截，零真实请求口径不变
  lockOn()
  for (const mode of ['broken-json', 'broken-struct', 'storage-error']) {
    ss.set(mode)
    const auth = await fresh(AUTH_URL)
    assertEq(auth.isDemoMode(), true, `${mode} 下 isDemoMode() 必须保持 true（网络层 fail-closed）`)
    assertEq(auth.getToken(), undefined, `${mode} 下 getToken() 仍 fail-closed 返回 undefined`)
  }
})

/* ============================ T3. 零真实请求：publicHttp 拦截兜底 ============================ */
test('T3', '锁定构建 getPublicLoginConfig 在请求拦截器即 reject，不进入适配器/网络', async () => {
  lockOn()
  ss.set('none')
  const { getPublicLoginConfig } = await import(src('api/loginConfig'))
  let rejected = null
  try {
    await getPublicLoginConfig('portal')
  } catch (e) { rejected = e }
  assert(rejected && String(rejected.message).includes('demo locked'), '必须以 demo locked 拒绝')
})

test('T3', '非锁定构建拦截器放行（不注入 reject 分支）', async () => {
  lockOff()
  ss.set('none')
  const mod = await import(`${src('api/loginConfig')}?bust=${Math.random()}`)
  // Node 下相对 baseURL 会因真实网络失败，但错误必须是网络/URL 类而非 demo locked 拦截
  let err = null
  try {
    await mod.getPublicLoginConfig('portal')
  } catch (e) { err = e }
  assert(err, '无后端环境下应报错')
  assert(!String(err.message).includes('demo locked'), '正式构建不得被锁定拦截器拦')
})

/* ============================ T4. 构建产物标识与子路径烘焙 ============================ */
const UI_ROOT = path.resolve(UI_SRC, '..')
const DIST_TRIAL = path.join(UI_ROOT, 'dist-trial')
const DIST = path.join(UI_ROOT, 'dist')

test('T4', 'dist-trial：edition=ai + trial 标识 + 独立目录存在', () => {
  assert(fs.existsSync(path.join(DIST_TRIAL, 'edition.txt')), 'dist-trial/edition.txt 存在')
  assertEq(fs.readFileSync(path.join(DIST_TRIAL, 'edition.txt'), 'utf-8').trim(), 'ai')
  assertEq(fs.readFileSync(path.join(DIST_TRIAL, 'trial.txt'), 'utf-8').trim(), 'trial')
})

test('T4', 'dist-trial/index.html：资源全部以 /trial/ 开头，favicon 子路径化', () => {
  const html = fs.readFileSync(path.join(DIST_TRIAL, 'index.html'), 'utf-8')
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  const bad = refs.filter((r) => r.startsWith('/') && !r.startsWith('/trial/'))
  assertEq(bad.length, 0, `不应存在脱离 /trial/ 前缀的根绝对引用：${JSON.stringify(bad)}`)
  assert(html.includes('href="/trial/favicon.ico'), 'favicon 必须子路径化')
})

test('T4', 'dist-trial 打包 JS：router history base 烘焙为 /trial/，4 处跳转均为 /trial/index', () => {
  const jsDir = path.join(DIST_TRIAL, 'static', 'js')
  const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))
  const all = files.map((f) => fs.readFileSync(path.join(jsDir, f), 'utf-8')).join('\n')
  assert(all.includes('"/trial/"'), 'router base 必须烘焙为 /trial/')
  const rootIndex = all.match(/location\.href="\/index"/g)
  assertEq(rootIndex, null, '不得残留根绝对 /index 跳转')
  assert((all.match(/location\.href="\/trial\/index"/g) || []).length >= 4, '4 处 /index 跳转全部子路径化')
})

test('T4', '正式 dist：无 trial.txt（trial 标识不污染正式产物）', () => {
  if (!fs.existsSync(DIST)) return // 本地未构建正式包时跳过
  assert(!fs.existsSync(path.join(DIST, 'trial.txt')), '正式 dist 不得含 trial.txt')
  assert(fs.existsSync(path.join(DIST, 'edition.txt')), '正式 dist 保留 edition.txt')
})

/* ============================ T5. 正式构建行为回归 ============================ */
test('T5', '未锁定 none 态：getToken 保持 Cookie 回落（正式构建原行为）', async () => {
  lockOff()
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('none')
  const auth = await fresh(AUTH_URL)
  assertEq(auth.getToken(), 'real-cookie-token', '正式构建 none 态必须能读到 Cookie')
})

test('T5', '未锁定 setToken/removeToken：Cookie 正常写删（正式构建原行为）', async () => {
  lockOff()
  cookieStub._reset()
  ss.set('none')
  const auth = await fresh(AUTH_URL)
  auth.setToken('formal-token')
  assertEq(cookieStub.get('Admin-Token'), 'formal-token', '正式构建 setToken 必须落 Cookie')
  auth.removeToken()
  assertEq(cookieStub.get('Admin-Token'), undefined, '正式构建 removeToken 必须删 Cookie')
})

test('T5', '未锁定 demo 态：demo token 优先且不碰 Cookie（既有演示机制不回归）', async () => {
  lockOff()
  cookieStub._reset(); cookieStub._seed('Admin-Token', 'real-cookie-token')
  ss.set('demo')
  const auth = await fresh(AUTH_URL)
  assert(String(auth.getToken()).startsWith('demo-static-'), 'demo token 优先')
  assertEq(cookieStub._log.filter(([op]) => op !== 'get').length, 0, '零写删')
})

/* ------------------------------ 汇总（串行执行） ------------------------------ */
for (const runCase of queue) await runCase()

console.log('\n================ Trial 演示站桩测结果 ================')
console.log(`通过：${passed}`)
if (failures.length) {
  console.log(`失败：${failures.length}`)
  failures.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
} else {
  console.log('全部通过 ✅')
}
