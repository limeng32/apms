/**
 * Trial 演示站入口工具（同域 /trial/ 方案）
 *
 * 两个入口的关系（详见 .trae/documents/trial_demo_plan.md）：
 * - 正式站（standard/ai 任意 Edition）：配置 VITE_TRIAL_URL 后，「一键体验」经本模块
 *   openTrial() 以 noopener 新标签打开演示站，原地口令演示隐藏；
 * - 演示站（trial 构建，VITE_DEMO_LOCKED=true）：不配置 VITE_TRIAL_URL，
 *   「一键体验」始终走本地 DemoPassDialog 口令流程。
 *
 * 本模块是全仓唯一的 trial 打开点，禁止在组件内裸写 window.open。
 */
import { isDemoLocked } from '@/utils/demo'

export { isDemoLocked }

/** 正式站是否配置了外部 trial 演示入口（Edition 无关，standard/ai env 可配同值） */
export function hasTrialUrl() {
  return typeof import.meta.env.VITE_TRIAL_URL === 'string' && import.meta.env.VITE_TRIAL_URL.length > 0
}

/**
 * 锁定闸门路由裁决（纯函数，permission.js 与 Node 桩测共用；裁决矩阵见 trial_demo_plan §3.2.0b）。
 * 调用前提：当前为锁定构建（isDemoLocked()===true）。
 * @param {object} args
 * @param {boolean} args.demo 当前是否演示会话（isDemoMode()，broken/storage-error 也算 true）
 * @param {string} args.toPath 本次导航目标路径
 * @returns {null|true|{path:string, replace:boolean}}
 *   null=不干预，落入下方既有流程；true=放行 /login；普通对象=重定向到 /login
 */
export function resolveLockedNavigation({ demo, toPath }) {
  // demo 态：交给既有 getToken 流程（demo token + mock getInfo/getRouters）
  if (demo) return null
  // 未进入演示会话（none/broken/storage-error）：只放 /login，其余一律弹回（含原白名单 /register、/showcase）
  if (toPath === '/login') return true
  return { path: '/login', replace: true }
}

/**
 * 新开标签打开 trial 演示站。
 * noopener,noreferrer：新浏览上下文 opener=null 且获得空 sessionStorage，
 * 不复制主站标签的会话副本；同时阻断反向 tab 操纵与 referer 泄漏。
 * @returns {boolean} 是否成功发起打开（未配置 URL 时返回 false，调用方回退原地演示）
 */
export function openTrial() {
  const url = import.meta.env.VITE_TRIAL_URL
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
