/**
 * Trial 演示站入口工具（同域 /trial/ 方案）
 *
 * 两个入口的关系（详见 .trae/documents/trial_demo_plan.md）：
 * - 正式站（standard/ai 任意 Edition）：配置 VITE_TRIAL_URL 后，「一键体验」先在当前页
 *   弹出口令框（口令前置），校验通过经 navigateToTrial() 同标签跳转演示站；
 * - 演示站（trial 构建，VITE_DEMO_LOCKED=true）：不配置 VITE_TRIAL_URL，
 *   「一键体验」始终走本地 DemoPassDialog 口令流程。
 *
 * 本模块是全仓唯一的 trial 跳转点，禁止在组件内裸写 location/window.open。
 *
 * 依赖约束：本模块被 request.js、assistantClient.js 等底层模块引用，必须保持零依赖
 * （不 import demo.js/@ai），否则会经 @ai → rpa 插件链形成 ESM 循环依赖；
 * 锁定判定直接读构建期 env，与 demo.js 的 isDemoLocked() 同源同值。
 */

/** trial 演示锁定构建（构建期常量，正式构建恒 false，本分支随 tree-shaking 剔除） */
export function isDemoLocked() {
  return import.meta.env.VITE_DEMO_LOCKED === 'true'
}

/** 正式站是否配置了外部 trial 演示入口（Edition 无关，standard/ai env 可配同值） */
export function hasTrialUrl() {
  return typeof import.meta.env.VITE_TRIAL_URL === 'string' && import.meta.env.VITE_TRIAL_URL.length > 0
}

/**
 * 锁定闸门路由裁决（纯函数，permission.js 与 Node 桩测共用；裁决矩阵见 trial_demo_plan §3.2.0b）。
 * 调用前提：当前为锁定构建（isDemoLocked()===true）。
 *
 * 注意路由层与网络层的判定严格分离：
 * - 本函数只承认**严格有效**的演示会话（readDemoSessionState().state==='demo'）；
 *   broken/storage-error 属于异常态，一律按未授权弹回 /login，不允许借 isDemoMode() 的
 *   fail-closed 宽判定落入下方既有白名单（/register、/showcase 会被直接放行，构成绕过）；
 * - 网络层（request.js 的 demoAdapter、download/upload 守卫）继续用 isDemoMode() 宽判定，
 *   保证异常态下绝不发出真实请求——两层不变量不可混用。
 *
 * @param {object} args
 * @param {boolean} args.validDemo 当前是否为严格有效的演示会话（仅 state==='demo' 为 true）
 * @param {string} args.toPath 本次导航目标路径
 * @returns {null|true|{path:string, replace:boolean}}
 *   null=不干预，落入下方既有流程；true=放行 /login；普通对象=重定向到 /login
 */
export function resolveLockedNavigation({ validDemo, toPath }) {
  // 严格 demo 态：交给既有 getToken 流程（demo token + mock getInfo/getRouters）
  if (validDemo) return null
  // 未授权（none/broken/storage-error）：只放 /login（broken 在登录页自愈、storage-error 渲染阻断页），
  // 其余一律弹回——含原白名单 /register、/showcase，锁定态下这些路径不可达
  if (toPath === '/login') return true
  return { path: '/login', replace: true }
}

/**
 * 同标签整页跳转到 trial 演示站（口令前置方案）。
 *
 * 调用前提：调用方已通过 enterDemo() 写入合法 demo 会话单键。
 * 同 origin 同浏览上下文导航时 sessionStorage 保留，trial 加载后
 * readDemoSessionState() 识别为有效演示会话，路由闸门直接放行进业务页、不再弹口令框。
 *
 * 安全模型（与早期 noopener 新标签方案的差异）：
 * - 同标签导航无 window.opener 关系，不存在反向 tab 操纵；同站导航不产生外发 referer；
 * - 真实 Admin-Token Cookie 虽物理共存，但 trial 为锁定构建，auth.js 三函数 fail-closed
 *   不读/写/删 Cookie，真实凭证在 trial 内逻辑不可达；
 * - 传递的只是无真实价值的静态 demo 会话键（demo-static- 前缀）。
 *
 * @returns {boolean} 是否成功发起跳转（未配置 URL 时返回 false，调用方回退原地演示）
 */
export function navigateToTrial() {
  const url = import.meta.env.VITE_TRIAL_URL
  if (!url) return false
  window.location.href = url
  return true
}

/**
 * 退出演示后返回同域正式站（仅 trial 锁定构建生效）。
 *
 * 背景：trial 是独立子路径应用，退出演示若只跳 `${BASE_URL}index`（即 /trial/index），
 * 会被锁定守卫弹回 /trial/login，用户被困在演示应用内。同域部署下正式站由 nginx
 * `location /` 承载，origin 根 '/' 即正式入口，跳 '/' 才能真正离开 trial。
 *
 * 真实 Admin-Token Cookie 不受影响：退出路径上的 logOut/exitDemo 在 demo 态均不调
 * /logout、不 removeToken（见 user.js logOut 的 isDemoMode 分支），正式站登录态保留。
 *
 * @returns {boolean} true=锁定构建，已发起回正式站跳转；false=非锁定构建，调用方走原有入口页逻辑
 */
export function exitToFormal() {
  if (!isDemoLocked()) return false
  window.location.href = '/'
  return true
}
