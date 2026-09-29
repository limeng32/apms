/**
 * 演示模式 · 内存 DB
 *
 * 实现不变量（详见 demo_mode_plan.md §五「内存 DB 生命周期」）：
 * 模块加载即初始化——文件末尾立即执行 resetDb()。刷新页面不会重跑 enterDemo()，
 * 守卫只跑 getInfo/getRouters，因此"刷新即还原"必须由模块自身保证：
 *
 *   首次点「一键体验」 → enterDemo() 显式 resetDb()，一份全新数据；
 *   F5 / 整页跳转      → JS 模块重新求值，本文件末尾的 resetDb() 自动再生成一份；
 *   标签内路由切换     → 沿用当前 db，假增删改持续可见。
 *
 * handler 一律 getDb() 取库，不自行持有引用（避免 reset 后操作旧对象）。
 */
import { tables } from './fixtures/index'

let db

function createDbFromFixtures() {
  // fixtures 全为 JSON 兼容纯数据（无函数/DOM/Date 特殊对象）；
  // structuredClone 在目标浏览器与 Node 18+ 均可用。
  return structuredClone(tables)
}

export function resetDb() {
  db = createDbFromFixtures()
  return db
}

export function getDb() {
  return db
}

// 不变量：模块首次被 import（request.js → mock/index.js → db）即生成一份。
resetDb()
