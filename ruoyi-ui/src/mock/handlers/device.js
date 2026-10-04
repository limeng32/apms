/**
 * 演示模式 · 设备接入 handler（注册信息仅保存在页面会话内存中，推送成绩真实写入演示库）
 */
import { getDb, route, ok, detail, listData, nextId, stampCreate } from '../handle'

// 模拟服务端内存注册表
const devices = [
  { deviceId: 1, deviceCode: 'GATE-DEMO', deviceName: '计时门（演示）', deviceType: 'TIMING_GATE', vendor: 'APMS', apiKey: 'dk-demo-key-0001', status: 'ACTIVE', registeredAt: '2026-09-01 10:00:00', lastSeenAt: null, pushCount: 0 }
]

export const deviceHandlers = [
  route('post', '/apms/device/register', (ctx) => {
    const b = ctx.body || {}
    if (!b.deviceCode) return { code: 601, msg: '设备编码不能为空' }
    if (devices.some(d => d.deviceCode === b.deviceCode)) return { code: 601, msg: '设备编码已注册' }
    const row = {
      deviceId: nextId(),
      deviceCode: b.deviceCode,
      deviceName: b.deviceName || b.deviceCode,
      deviceType: b.deviceType || 'UNKNOWN',
      vendor: b.vendor || '',
      apiKey: 'dk-' + Math.random().toString(16).slice(2, 10) + Date.now().toString(16),
      status: 'ACTIVE',
      registeredAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      lastSeenAt: null,
      pushCount: 0
    }
    devices.push(row)
    return detail(row, '设备注册成功')
  }),

  route('get', '/apms/device/list', () => listData(devices)),

  route('post', '/apms/device/push', (ctx) => {
    const b = ctx.body || {}
    const apiKey = ctx.headers?.['x-device-key'] || b.apiKey
    const dev = devices.find(d => d.apiKey === apiKey)
    if (!dev) return { code: 401, msg: '设备 API Key 无效' }
    const db = getDb()
    const athlete = db.athletes.find(a =>
      String(a.athleteId) === String(b.athleteId)) ||
      db.athletes.find(a => a.name === b.athleteName)
    if (!athlete) return { code: 601, msg: '未匹配到运动员：' + (b.athleteName || b.athleteId) }
    const indicator = db.indicators?.find(i => String(i.code).toUpperCase() === String(b.indicatorCode).toUpperCase())
    if (!indicator) return { code: 601, msg: '未找到指标编码：' + b.indicatorCode }

    const num = Number(b.value)
    const row = {
      id: nextId(),
      taskId: null, taskItemId: null,
      athleteId: athlete.athleteId, athleteName: athlete.name,
      athleteGender: athlete.gender, athleteTeam: athlete.teamName,
      itemType: 'INDICATOR',
      indicatorId: indicator.id, indicatorCode: indicator.code,
      indicatorName: indicator.name, indicatorDirection: indicator.evaluationDirection,
      indicatorUnit: indicator.unit,
      sessionKey: b.sessionKey || null,
      measureDate: b.measureDate || new Date().toISOString().slice(0, 10),
      isValid: '1', isSelected: '1', invalidReason: null,
      dataSource: 'DEVICE:' + dev.deviceCode,
      values: [{
        valueId: nextId() + 100000, fieldKey: 'result', fieldLabel: '结果',
        numericValue: Number.isFinite(num) ? num : null,
        textValue: Number.isFinite(num) ? null : String(b.value ?? ''),
        unit: indicator.unit, isDerived: '0'
      }]
    }
    stampCreate(row)
    db.testResults.push(row)
    dev.lastSeenAt = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
    dev.pushCount += 1
    return detail({ resultId: row.id, deviceCode: dev.deviceCode, indicatorCode: indicator.code, value: b.value }, '推送成功')
  }),

  // 模型结构化数据设备推送 —— 假门禁：任何密钥一律失效，不写数据
  route('post', '/apms/device/model-push', () => {
    return { code: 401, msg: '设备密钥错误或已失效，模型数据自动采集暂未开通，请联系管理员' }
  })
]
