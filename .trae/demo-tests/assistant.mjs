/**
 * RPA 助手 · Node 桩测（不依赖浏览器）
 *
 * 运行：node .trae/demo-tests/assistant.mjs
 * 覆盖：Demo 零网络、意图动作严格一致、SSE \n/\r\n 分帧、多行 data、心跳注释。
 */
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const SRC = '/Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/components/Assistant'
const demo = await import(pathToFileURL(`${SRC}/assistantDemo.js`).href)
const { parseSse } = await import(pathToFileURL(`${SRC}/assistantSse.js`).href)

let fetchCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (...args) => {
  fetchCalls += 1
  return realFetch ? realFetch(...args) : Promise.reject(new Error('unexpected fetch'))
}

let passed = 0
const failures = []
async function test(name, fn) {
  try {
    await fn()
    passed += 1
  } catch (e) {
    failures.push(`${name}: ${e.stack || e}`)
  }
}

await test('demoCapabilities 返回 8 条业务路径', () => {
  const caps = demo.demoCapabilities()
  assert.equal(caps.paths.length, 8)
  assert.ok(caps.paths.includes('/athletes/roster'))
  assert.ok(caps.paths.includes('/analytics/report-center'))
})

await test('Demo 聊天零网络，并下发 meta/delta/done', async () => {
  fetchCalls = 0
  const events = []
  await demo.demoChatStream({ message: '怎么新增运动员' }, {
    onEvent: (event, data) => events.push([event, data])
  })
  assert.equal(fetchCalls, 0)
  assert.equal(events[0][0], 'meta')
  assert.ok(events.some(([e]) => e === 'delta'))
  assert.equal(events[events.length - 1][0], 'done')
})

await test('新增运动员带 athlete-add / requiresPerm', async () => {
  const events = []
  await demo.demoChatStream({ message: '怎么新增运动员' }, {
    onEvent: (event, data) => events.push([event, data])
  })
  const action = events.find(([e]) => e === 'action')[1]
  assert.equal(action.path, '/athletes/roster')
  assert.equal(action.highlightKey, 'athlete-add')
  assert.deepEqual(action.requiresPerm, ['apms:athlete:add'])
})

await test('导入成绩/报告下载只导航，不返回错误高亮', async () => {
  for (const [message, path] of [
    ['怎么导入成绩', '/testings/dispatch'],
    ['报告在哪下载', '/analytics/report-center'],
    ['组合评分怎么算', '/testings/combo-dispatch']
  ]) {
    const events = []
    await demo.demoChatStream({ message }, {
      onEvent: (event, data) => events.push([event, data])
    })
    const action = (events.find(([e]) => e === 'action') || [])[1]
    assert.equal(action.path, path)
    assert.equal(action.highlightKey, undefined)
  }
})

await test('推荐问法的口语短语必须命中正确意图（语序/插入字）', async () => {
  const cases = [
    ['怎么导入测试成绩', '/testings/dispatch'],
    ['报告在哪下载', '/analytics/report-center'],
    ['报告在哪里下载', '/analytics/report-center'],
    ['在哪下载pdf', '/analytics/report-center']
  ]
  for (const [message, path] of cases) {
    const events = []
    await demo.demoChatStream({ message }, {
      onEvent: (event, data) => events.push([event, data])
    })
    const delta = events.find(([e]) => e === 'delta')
    const action = (events.find(([e]) => e === 'action') || [])[1]
    assert.ok(delta, `缺少回答: ${message}`)
    assert.ok(action && action.path === path, `${message} → ${action && action.path}`)
    assert.equal(action.highlightKey, undefined)
  }
})

await test('SSE 支持 CRLF 跨块、多行 data 与心跳注释', async () => {
  const chunks = [
    ': heartbeat\n\n',
    'event: del',
    'ta\r\ndata: {"text":"你',
    '好"}\r\n\r\n',
    'event: done\r',
    '\ndata: {"finishReason":"stop"}\r\n\r\n'
  ]
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      chunks.forEach(c => controller.enqueue(encoder.encode(c)))
      controller.close()
    }
  })
  const events = []
  await parseSse(stream, (event, data) => events.push([event, data]))
  assert.deepEqual(events, [
    ['delta', { text: '你好' }],
    ['done', { finishReason: 'stop' }]
  ])
})

await test('SSE 坏帧丢弃，不影响后续帧', async () => {
  const frame = 'event: delta\r\ndata: {bad json}\r\n\r\n'
    + 'event: done\r\ndata: {"finishReason":"stop"}\r\n\r\n'
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(frame))
      controller.close()
    }
  })
  const events = []
  await parseSse(stream, (event, data) => events.push([event, data]))
  assert.deepEqual(events, [['done', { finishReason: 'stop' }]])
})

globalThis.fetch = realFetch

if (failures.length) {
  console.error(`\n❌ ${failures.length} failed, ${passed} passed\n`)
  failures.forEach(f => console.error(f))
  process.exit(1)
}
console.log(`✅ assistant tests passed: ${passed}`)
