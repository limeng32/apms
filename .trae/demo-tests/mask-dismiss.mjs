/**
 * 助手面板遮罩关闭判定桩测（对应 useMaskDismiss.js，无浏览器依赖）。
 * 运行（仓库根目录）：node .trae/demo-tests/mask-dismiss.mjs
 */
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const HELPER = pathToFileURL(
  '/Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/ai/plugins/rpa/useMaskDismiss.js'
).href
const { clickIsInsidePanel, createDismissState, PANEL_SELECTOR } = await import(HELPER)

let passed = 0
const failures = []
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failures.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}: ${e.message}`) }
}

// 构造最小 DOM 节点：class + closest（按祖先链匹配）
function node(className, parent = null) {
  const el = {
    className,
    parentNode: parent,
    closest(selector) {
      let cur = el
      const cls = selector.replace(/^\./, '')
      while (cur) {
        if (cur.className && cur.className.split(/\s+/).includes(cls)) return cur
        cur = cur.parentNode
      }
      return null
    }
  }
  return el
}

console.log('\n================ 助手面板遮罩关闭判定桩测 ================')
assert.equal(PANEL_SELECTOR, '.as-panel')

test('M1 点遮罩空白（target 即 mask，向上无 .as-panel）→ 判定为面板外，应关闭', () => {
  const mask = node('as-mask')
  assert.equal(clickIsInsidePanel(mask), false)
})

test('M2 点面板根 aside.as-panel → 判定为面板内，不关闭', () => {
  const mask = node('as-mask')
  const panel = node('as-panel', mask)
  assert.equal(clickIsInsidePanel(panel), true)
})

test('M3 点深层建议 chip（mask>aside>main>div>button.as-chip）→ 命中祖先 .as-panel，不关闭', () => {
  const mask = node('as-mask')
  const panel = node('as-panel', mask)
  const main = node('as-body', panel)
  const empty = node('as-empty', main)
  const suggest = node('as-suggest', empty)
  const chip = node('as-chip', suggest)
  assert.equal(clickIsInsidePanel(chip), true)
})

test('M4 点 header 关闭按钮（深层 button）→ 同样判定面板内，关闭由按钮自身 handler 负责，mask 不重复处理', () => {
  const mask = node('as-mask')
  const panel = node('as-panel', mask)
  const head = node('as-head', panel)
  const btn = node('as-icon-btn', head)
  assert.equal(clickIsInsidePanel(btn), true)
})

test('M5 异常 target（null/undefined/无 closest 的对象）→ 兜底视为面板外，允许关闭，不抛错', () => {
  assert.equal(clickIsInsidePanel(null), false)
  assert.equal(clickIsInsidePanel(undefined), false)
  assert.equal(clickIsInsidePanel({}), false)
  assert.equal(clickIsInsidePanel({ closest: 'not-a-function' }), false)
})

test('M6 面板外的业务页面元素（祖先链不含 .as-panel）→ 判定面板外', () => {
  const app = node('app-wrapper')
  const card = node('rk-kpi-card', app)
  assert.equal(clickIsInsidePanel(card), false)
})

/* ---------- 两段式手势状态机（pointerdown 起源 + click 裁决），覆盖线上真实事故 ---------- */

test('M7 关键回归：pointerdown 在 chip（面板内），click 时 chip 已被 v-if 卸载成 detached → 仍不关闭', () => {
  const mask = node('as-mask')
  const panel = node('as-panel', mask)
  const chip = node('as-chip', panel)
  const state = createDismissState()

  // pointerdown 阶段：chip 仍在文档，起源判定为面板内
  state.notePointerDown(chip)
  // 模拟 send 触发重渲染：chip 脱离祖先链（detached，closest 从此返回 null）
  chip.parentNode = null
  assert.equal(clickIsInsidePanel(chip), false, 'detached 节点 closest 确实失效（这正是旧方案的坑）')
  // 但 click 裁决只读 pointerdown 记录，不受 detach 影响 → 不关闭
  assert.equal(state.shouldDismissOnClick(), false, '面板内手势即使 target detach 也不得关闭')
})

test('M8 pointerdown 在遮罩空白 → click 裁决应关闭', () => {
  const mask = node('as-mask')
  const state = createDismissState()
  state.notePointerDown(mask)
  assert.equal(state.shouldDismissOnClick(), true)
})

test('M9 pointerdown 在面板深层元素（输入框/按钮）→ 不关闭', () => {
  const mask = node('as-mask')
  const panel = node('as-panel', mask)
  const foot = node('as-foot', panel)
  const input = node('as-input', foot)
  const state = createDismissState()
  state.notePointerDown(input)
  assert.equal(state.shouldDismissOnClick(), false)
})

test('M10 reset 后状态清空，下一次遮罩手势可正常关闭（无跨手势污染）', () => {
  const mask = node('as-mask')
  const panel = node('as-panel', mask)
  const chip = node('as-chip', panel)
  const state = createDismissState()
  state.notePointerDown(chip)
  assert.equal(state.shouldDismissOnClick(), false)
  state.reset()
  assert.equal(state.shouldDismissOnClick(), true, 'reset 后 downInside 归 false，默认应关闭')
  state.notePointerDown(mask)
  assert.equal(state.shouldDismissOnClick(), true)
})

console.log(`\n通过：${passed}`)
if (failures.length) {
  console.log(`失败：${failures.length}`)
  failures.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
console.log('全部通过 ✅')
