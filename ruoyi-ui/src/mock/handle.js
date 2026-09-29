/**
 * 演示模式 · handler 公共工具
 *
 * handler 契约（详见 demo_mode_plan.md §五）：
 * - 签名 (ctx)，ctx = { method, path, query, body, params, rawConfig }；
 * - 匹配键只用 ctx.path；参数段在 ctx.params；分页/过滤只从 ctx.query 取；
 * - 一律 getDb() 取库，不持有表引用；返回标准 RuoYi body（不包 AxiosResponse）。
 */
import { getDb } from './db'

export { getDb }

/** 数字参数转换 + 默认值兜底 */
export function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 操作成功（无数据） */
export function ok(msg = '操作成功') {
  return { code: 200, msg }
}

/** 单对象响应 */
export function detail(data, msg = '操作成功') {
  return { code: 200, msg, data }
}

/**
 * 分页响应。
 * @param {Array} rows 已按条件过滤后的全集
 * @param {object} query ctx.query（pageNum/pageSize）
 */
export function paginate(rows, query = {}) {
  const pageNum = toInt(query.pageNum, 1)
  const pageSize = toInt(query.pageSize, 10)
  const start = (pageNum - 1) * pageSize
  return {
    code: 200,
    msg: '操作成功',
    rows: rows.slice(start, start + pageSize),
    total: rows.length
  }
}

/** 不分页列表（接口本身返回 data 数组的场景） */
export function listData(rows, msg = '操作成功') {
  return { code: 200, msg, data: rows }
}

/** 模糊包含（忽略大小写、空值不过滤） */
export function like(rowValue, keyword) {
  if (keyword === undefined || keyword === null || keyword === '') return true
  return String(rowValue ?? '').toLowerCase().includes(String(keyword).toLowerCase())
}

/** 等值过滤（空值不过滤） */
export function eq(rowValue, expected) {
  if (expected === undefined || expected === null || expected === '') return true
  return String(rowValue ?? '') === String(expected)
}

/** 逗号分隔 ids → 数组 */
export function splitIds(value) {
  return String(value).split(',').map(s => Number(s.trim())).filter(Number.isFinite)
}

let seq = 1
/** 演示态新增记录的负数 ID（避免与正整数样本冲突；同标签页内单调） */
export function nextId() {
  return -Date.now() - (seq++ % 1000)
}

/**
 * 演示态新增记录的正数 ID（用于受路由 \d+ 约束或外键必须为正整数的表，如 athlete）。
 * 从样本最大 ID 与 floor 中取较大者 +1：绝不与蓝本 ID 冲突，同标签页内单调，
 * 刷新后随 resetDb 一并还原。
 */
export function nextPositiveId(rows, idKey, floor = 900000) {
  let max = floor
  for (const r of rows) {
    const n = Number(r?.[idKey])
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

/** 当前时间戳字符串（YYYY-MM-DD HH:mm:ss，演示用，不追求本地化精确） */
export function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 新增行审计字段（演示操作人固定 super） */
export function stampCreate(row) {
  if (row && typeof row === 'object') {
    if (!row.createTime) row.createTime = now()
    if (!row.createBy) row.createBy = 'super'
  }
  return row
}

/** 修改行审计字段 */
export function stampUpdate(row) {
  if (row && typeof row === 'object') {
    row.updateTime = now()
    row.updateBy = 'super'
  }
  return row
}

/**
 * 通用列表过滤：specs = [{ key, mode:'like'|'eq', value?, ignore:[''] }]
 * 空值（undefined/null/''）默认跳过。
 */
export function matchSpecs(row, specs) {
  for (const s of specs) {
    const v = s.value
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (s.mode === 'like') {
      if (!like(row[s.key], v)) return false
    } else if (s.mode === 'in') {
      if (!v.map(String).includes(String(row[s.key]))) return false
    } else if (!eq(row[s.key], v)) {
      return false
    }
  }
  return true
}

/** rows/total 风格分页列表的快捷构造（过滤 + 分页） */
export function pageRows(rows, query, specs = []) {
  return paginate(rows.filter(r => matchSpecs(r, specs)), query)
}

/** 注册一条路由定义 */
export function route(method, pattern, handle) {
  return { method: method.toLowerCase(), pattern, handle }
}
