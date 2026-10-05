/**
 * 伤病部位标准字典（19 点位）
 * 坐标基于 body-map.svg viewBox 400×588（已裁掉底部空白）：正面人体中心 x≈105，背面 x≈295。
 * 与后端 RtpRiskEvaluator 闭环口径配合使用；坐标只在前端维护，不入库。
 */

export const BODY_SITES = [
  // 躯干
  { code: 'LOWER_BACK', label: '腰部（下背）', group: '躯干', x: 295, y: 232 },

  // 上肢（正面）
  { code: 'SHOULDER_L', label: '左肩', group: '上肢', x: 76, y: 104 },
  { code: 'SHOULDER_R', label: '右肩', group: '上肢', x: 134, y: 104 },
  { code: 'WRIST_L', label: '左手腕', group: '上肢', x: 52, y: 218 },
  { code: 'WRIST_R', label: '右手腕', group: '上肢', x: 158, y: 218 },

  // 下肢·髋/大腿（腹股沟与大腿前侧正面，大腿后侧背面）
  { code: 'GROIN_L', label: '左腹股沟', group: '下肢', x: 94, y: 266 },
  { code: 'GROIN_R', label: '右腹股沟', group: '下肢', x: 116, y: 266 },
  { code: 'THIGH_L', label: '左大腿（前）', group: '下肢', x: 89, y: 320 },
  { code: 'THIGH_R', label: '右大腿（前）', group: '下肢', x: 121, y: 320 },
  { code: 'THIGH_BACK_L', label: '左大腿后侧', group: '下肢', x: 278, y: 322 },
  { code: 'THIGH_BACK_R', label: '右大腿后侧', group: '下肢', x: 312, y: 322 },

  // 下肢·膝/小腿/踝/足
  { code: 'KNEE_L', label: '左膝', group: '下肢', x: 89, y: 392 },
  { code: 'KNEE_R', label: '右膝', group: '下肢', x: 121, y: 392 },
  { code: 'SHIN_L', label: '左胫骨（小腿）', group: '下肢', x: 88, y: 448 },
  { code: 'SHIN_R', label: '右胫骨（小腿）', group: '下肢', x: 122, y: 448 },
  { code: 'ANKLE_L', label: '左踝', group: '下肢', x: 72, y: 502 },
  { code: 'ANKLE_R', label: '右踝', group: '下肢', x: 130, y: 502 },
  { code: 'HEEL_L', label: '左足跟', group: '下肢', x: 278, y: 508 },
  { code: 'HEEL_R', label: '右足跟', group: '下肢', x: 322, y: 508 },

  // 无法归入具体点位的伤病（仅下拉/统计可选，人体图上无热点坐标）
  { code: 'OTHER', label: '其它', group: '其它' }
]

export const BODY_SITE_MAP = Object.fromEntries(BODY_SITES.map(s => [s.code, s]))

export function siteLabel(code) {
  return BODY_SITE_MAP[code]?.label || code || '—'
}

export function siteCoord(code) {
  const s = BODY_SITE_MAP[code]
  return s && s.x != null ? { x: s.x, y: s.y } : null
}

/** 分组下拉用（躯干 / 上肢 / 下肢 / 其它，保持声明顺序） */
export const BODY_SITE_GROUPS = ['躯干', '上肢', '下肢', '其它']
  .map(g => ({ group: g, items: BODY_SITES.filter(s => s.group === g) }))
