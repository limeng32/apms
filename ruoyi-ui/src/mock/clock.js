/**
 * 演示模式 · 演示时钟（单一时间事实源）
 *
 * 为什么需要固定时钟：
 *   mock 的蓝本（运动员生日、伤病/PHV/任务日期、RTP 快照、规则阈值）都是围绕某一天
 *   构造的静态样本。若查询侧用真实 Date.now() 做相对窗口（近 12 个月、本周、本月、
 *   当前年龄），随真实日期推移样本会陆续滑出窗口——几个月后演示页又变成一片 0。
 *   因此整个演示世界的"今天"凝固在 TODAY：所有相对窗口、年龄计算、写操作默认日期与
 *   审计时间戳都从这里推导，任何时候打开演示数据都自洽、不过期。
 *
 * 唯一例外：handle.js 的 nextId() 用 Date.now() 生成负数 ID，只承担唯一性，不含业务日期。
 */

/** 演示世界的"今天"（与 rtpRisk 快照蓝本 snapshotDate 对齐） */
export const TODAY = '2026-10-05'

const ANCHOR_DATE = new Date(TODAY + 'T12:00:00') // 正午避免夏令时边界
const DAY_MS = 24 * 3600 * 1000
const pad2 = (n) => String(n).padStart(2, '0')

function fmtDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 演示今天（YYYY-MM-DD） */
export function today() {
  return TODAY
}

/** 演示今天往前 n 天的日期（YYYY-MM-DD） */
export function daysAgo(n) {
  return fmtDate(new Date(ANCHOR_DATE.getTime() - n * DAY_MS))
}

/** 演示今天往前 n 个自然月的同日日期（YYYY-MM-DD） */
export function monthsAgoDate(n) {
  const d = new Date(ANCHOR_DATE)
  d.setMonth(d.getMonth() - n)
  return fmtDate(d)
}

/** 演示今天所在自然月的 1 号（YYYY-MM-01） */
export function monthStart() {
  return `${ANCHOR_DATE.getFullYear()}-${pad2(ANCHOR_DATE.getMonth() + 1)}-01`
}

/**
 * 演示内写入用的完整时间戳（YYYY-MM-DD HH:mm:ss）。
 * 时间凝固到锚点，内部计数器逐秒递增，保证同批次多条记录时间戳可区分且不产生
 * "锚点未来"的记录（窗口判断不会把演示新写的数据排除）。
 */
let tick = 0
export function nowTs() {
  const d = new Date(ANCHOR_DATE.getTime() + tick * 1000)
  tick++
  return `${fmtDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/**
 * 基于演示今天的周岁（与后端 SQL TIMESTAMPDIFF(YEAR, birthday, CURDATE()) 同口径）。
 * 读取侧实时算年龄时必须用它，不能用 new Date()。
 */
export function ageAtToday(birthday) {
  if (!birthday) return null
  const b = new Date(String(birthday) + 'T00:00:00')
  if (Number.isNaN(b.getTime())) return null
  let age = ANCHOR_DATE.getFullYear() - b.getFullYear()
  const m = ANCHOR_DATE.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && ANCHOR_DATE.getDate() < b.getDate())) age--
  return age < 0 ? 0 : age
}

/** 演示今天的下一个 1 月 1 日（晋升预览默认截止日口径，与后端默认次年 1 月 1 日一致） */
export function nextJanFirst() {
  const y = (ANCHOR_DATE.getMonth() > 0 || (ANCHOR_DATE.getMonth() === 0 && ANCHOR_DATE.getDate() > 1))
    ? ANCHOR_DATE.getFullYear() + 1
    : ANCHOR_DATE.getFullYear()
  return `${y}-01-01`
}
