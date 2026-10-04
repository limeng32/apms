/**
 * 运动员头像（姓氏圆）配色 —— 全站统一规则：颜色代表年龄组
 *
 * 年龄段推导与花名册/后端 SQL 同口径：g = clamp(floor(年龄) + 1, 13, 18)
 * 13 紫 / 14 青 / 15 蓝 / 16 绿 / 17 橙 / 18 红；无年龄为灰。
 */
export const AGE_AVATAR_COLORS = {
  13: '#8B5CF6',
  14: '#06B6D4',
  15: '#3B82F6',
  16: '#22C55E',
  17: '#F59E0B',
  18: '#EF4444'
}

const NO_AGE_COLOR = '#94A3B8'

/**
 * 按年龄返回头像底色
 * @param {number|string|null|undefined} age 当前周岁年龄
 * @returns {string} hex 颜色
 */
export function ageAvatarColor(age) {
  const n = Number(age)
  if (age == null || age === '' || !Number.isFinite(n)) return NO_AGE_COLOR
  const group = Math.min(18, Math.max(13, Math.floor(n) + 1))
  return AGE_AVATAR_COLORS[group] || NO_AGE_COLOR
}
