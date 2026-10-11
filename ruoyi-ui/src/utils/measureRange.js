/**
 * 数值录入区间工具（前端双层校验）
 *
 * 区间来源：系统字典（管理员可在字典管理调整，无需改代码）
 *   apms_measure_range   体态测量字段，dict_value=height/weight/sitHeight/bodyFatRate/waist
 *   apms_indicator_range 成绩指标，dict_value=指标编码（未配置的指标不校验范围）
 * 每条字典 remark 为 JSON：{"hardMin":..,"hardMax":..,"warnMin":..,"warnMax":..}
 *
 * 双层语义（与后端 InputRangeValidator 对齐）：
 *   hard* 硬限：前端拦截提交，后端也兜底（API/CSV/设备同样拦）
 *   warn* 合理区间：超出弹确认框、确认可保存；列表中红色高亮提醒
 *
 * 字典缓存：单次会话内缓存（与 useDict 同口径，改字典后刷新页面生效）。
 */
import { reactive } from 'vue'
import { getDicts } from '@/api/system/dict/data'

export const BODY_DICT = 'apms_measure_range'
export const INDICATOR_DICT = 'apms_indicator_range'

/** 体态字段内置默认（字典缺失时兜底；标签/单位与字典 dict_label 同口径） */
export const BODY_DEFAULTS = {
  height:      { label: '身高', unit: 'cm', hardMin: 50, hardMax: 250, warnMin: 100, warnMax: 220 },
  weight:      { label: '体重', unit: 'kg', hardMin: 10, hardMax: 200, warnMin: 30,  warnMax: 150 },
  sitHeight:   { label: '坐高', unit: 'cm', hardMin: 30, hardMax: 150, warnMin: 55,  warnMax: 120 },
  bodyFatRate: { label: '体脂率', unit: '%',  hardMin: 2,  hardMax: 60,  warnMin: 5,   warnMax: 35 },
  waist:       { label: '腰围', unit: 'cm', hardMin: 30, hardMax: 200, warnMin: 45,  warnMax: 130 }
}

/** 体态字段中文（确认框/错误提示用） */
export const BODY_FIELDS = Object.keys(BODY_DEFAULTS)

let bodyMap = null
let indicatorMap = null
let loadPromise = null

function num(v) {
  return v === null || v === undefined || v === '' ? null : Number(v)
}

/** 从「身高(cm)」类标签中提取单位 */
function unitOf(label) {
  const m = /[（(](.+?)[)）]/.exec(label || '')
  return m ? m[1] : ''
}

function parseRange(p) {
  let r = {}
  try {
    r = JSON.parse(p.remark || '{}')
  } catch {
    return null
  }
  const range = {
    label: String(p.dictLabel || '').replace(/[（(].+?[)）]/, ''),
    unit: unitOf(p.dictLabel),
    hardMin: num(r.hardMin), hardMax: num(r.hardMax),
    warnMin: num(r.warnMin), warnMax: num(r.warnMax)
  }
  if (range.hardMin == null && range.hardMax == null) return null
  return range
}

/** 预加载两个区间字典（页面挂载时调用；重复调用共享同一次请求） */
export function loadRanges() {
  if (loadPromise) return loadPromise
  loadPromise = Promise.all([
    getDicts(BODY_DICT).catch(() => ({ data: [] })),
    getDicts(INDICATOR_DICT).catch(() => ({ data: [] }))
  ]).then(([body, indicator]) => {
    bodyMap = new Map()
    ;(body.data || []).forEach(p => {
      const r = parseRange(p)
      if (r) bodyMap.set(p.dictValue, r)
    })
    indicatorMap = new Map()
    ;(indicator.data || []).forEach(p => {
      const r = parseRange(p)
      if (r) indicatorMap.set(p.dictValue, r)
    })
  }).finally(() => { loadPromise = null })
  return loadPromise
}

/** 体态字段区间：字典优先，缺失时回退内置默认 */
export function getBodyRange(key) {
  return (bodyMap && bodyMap.get(key)) || BODY_DEFAULTS[key] || null
}

/** 成绩指标区间：仅字典配置时返回，否则 null（不做范围校验） */
export function getIndicatorRange(code) {
  return indicatorMap ? indicatorMap.get(code) || null : null
}

/**
 * 判定值所处级别：
 *   empty=未填  invalid=非数字  hard-low/high=超出硬限
 *   warn-low/high=超出合理区间  ok=正常
 */
export function classify(range, value) {
  if (value === null || value === undefined || value === '') return 'empty'
  const v = Number(value)
  if (!Number.isFinite(v)) return 'invalid'
  if (!range) return 'ok'
  if (range.hardMin != null && v < range.hardMin) return 'hard-low'
  if (range.hardMax != null && v > range.hardMax) return 'hard-high'
  if (range.warnMin != null && v < range.warnMin) return 'warn-low'
  if (range.warnMax != null && v > range.warnMax) return 'warn-high'
  return 'ok'
}

export const isHard = level => level === 'hard-low' || level === 'hard-high'
export const isWarn = level => level === 'warn-low' || level === 'warn-high'
/** 是否异常（超出合理区间，含硬限）——用于列表红色高亮 */
export const isAbnormal = level => isHard(level) || isWarn(level)

function withUnit(range) {
  return range.unit ? ' ' + range.unit : ''
}

/** 硬限拦截提示 */
export function hardMessage(range, value) {
  const v = Number(value)
  return `${range.label} ${v} 超出允许范围（${range.hardMin}~${range.hardMax}${withUnit(range)}），请核对后重新录入`
}

/** 软区间确认文案（单字段） */
export function warnMessage(range, value) {
  const v = Number(value)
  return `${range.label} ${v} 超出合理区间（${range.warnMin}~${range.warnMax}${withUnit(range)}）`
}

/**
 * 汇总体态表单的越界字段。
 * @param {object} values {height, weight, ...}
 * @returns {{hard: string[], warn: string[]}} 两类提示文案数组
 */
export function collectBodyIssues(values) {
  const hard = []
  const warn = []
  BODY_FIELDS.forEach(key => {
    const range = getBodyRange(key)
    const level = classify(range, values[key])
    if (isHard(level) || level === 'invalid') hard.push(hardMessage(range, values[key]))
    else if (isWarn(level)) warn.push(warnMessage(range, values[key]))
  })
  return { hard, warn }
}

/* ===== 体态弹窗复用件（三处录入入口共用同一交互） ===== */

export function makeBodyHints() {
  return reactive({ height: '', weight: '', sitHeight: '', bodyFatRate: '', waist: '' })
}

export function clearBodyHints(hints) {
  BODY_FIELDS.forEach(k => { hints[k] = '' })
}

/** 单字段变更后更新该字段的浅红提示（el-input-number @change 调用） */
export function checkBodyField(form, hints, key) {
  const range = getBodyRange(key)
  const level = classify(range, form[key])
  if (isHard(level) || level === 'invalid') hints[key] = hardMessage(range, form[key])
  else if (isWarn(level)) hints[key] = warnMessage(range, form[key])
  else hints[key] = ''
}

export function checkAllBody(form, hints) {
  BODY_FIELDS.forEach(k => checkBodyField(form, hints, k))
}
