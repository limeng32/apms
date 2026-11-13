/**
 * RPA 悬浮球拖拽纯逻辑桩测（不依赖浏览器/DOM；对应 useLauncherDrag.js）。
 * 运行（仓库根目录）：node .trae/demo-tests/launcher-drag.mjs
 *
 * 覆盖：
 * D1. 位移边界 computeDragLimits：桌面/移动两种锚点下，球始终被限制在视口内
 * D2. nextPosition：普通位移透传 + 四向越界 clamp + 累计位移（二次拖拽接续）
 * D3. isDragTail：6px 阈值区分真实点击与拖拽收尾 click
 * D4. clampToViewport：旋转屏/窗口缩小时历史位置收敛，不出现负下限以下或正值
 */
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const HELPER = pathToFileURL(
  '/Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/ai/plugins/rpa/useLauncherDrag.js'
).href
const {
  DRAG_THRESHOLD,
  computeDragLimits,
  nextPosition,
  isDragTail,
  clampToViewport
} = await import(HELPER)

let passed = 0
const failures = []
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failures.push(`${name}: ${e.message}`); console.log(`  ✗ ${name}: ${e.message}`) }
}

console.log('\n================ RPA 悬浮球拖拽纯逻辑桩测 ================')

/* D1. 边界计算：桌面（锚点 24）与移动（锚点 14，球 44） */
test('D1 桌面视口 1280x800、球 48、锚点 24：左/上最大位移恰贴边，右/下不越过锚点', () => {
  const L = computeDragLimits(1280, 800, 48, 24, 24)
  assert.equal(L.minDx, -(1280 - 48 - 24), '最左 dx=-1208')
  assert.equal(L.maxDx, 24, '最右只能回到锚点 dx=24')
  assert.equal(L.minDy, -(800 - 48 - 24), '最上 dy=-728')
  assert.equal(L.maxDy, 24)
})

test('D1 移动视口 390x740（iPhone 12 量级）、球 44、锚点 14：边界同样完整在屏内', () => {
  const L = computeDragLimits(390, 740, 44, 14, 14)
  assert.equal(L.minDx, -(390 - 44 - 14)) // -332
  assert.equal(L.maxDx, 14)
  assert.equal(L.minDy, -(740 - 44 - 14)) // -682
  assert.equal(L.maxDy, 14)
  // 最左位置球右边沿 = 视口宽：332 + 44 = 376，加右锚点 14 = 390，恰好贴边不出屏
  assert.equal(-L.minDx + 44 + 14, 390)
})

/* D2. 位置计算 */
test('D2 阈值内普通位移原样透传（从原点左移 100、上移 50）', () => {
  const L = computeDragLimits(1280, 800, 48, 24, 24)
  const p = nextPosition(0, 0, -100, -50, L)
  assert.deepEqual(p, { dx: -100, dy: -50 })
})

test('D2 向左猛烈拖拽被 clamp 到贴左边，不会穿出视口', () => {
  const L = computeDragLimits(390, 740, 44, 14, 14)
  const p = nextPosition(0, 0, -9999, 0, L)
  assert.equal(p.dx, -332)
})

test('D2 向右/向下拖拽不超过 CSS 锚点（防止盖住右侧系统手势区/溢出底沿）', () => {
  const L = computeDragLimits(390, 740, 44, 14, 14)
  const p = nextPosition(0, 0, 500, 800, L)
  assert.deepEqual(p, { dx: 14, dy: 14 })
})

test('D2 二次拖拽接续：已有位移 -200 时再拖，按手势起点累计且仍受边界约束', () => {
  const L = computeDragLimits(390, 740, 44, 14, 14)
  // 起点 dx=-200，本次手势再向左 300 → 目标 -500，clamp 到 -332
  const p = nextPosition(-200, 0, -300, 0, L)
  assert.equal(p.dx, -332)
  // 小幅向右回拖 60 → -140，正常透传
  const p2 = nextPosition(-200, 0, 60, 0, L)
  assert.equal(p2.dx, -140)
})

/* D3. 点击/拖拽收尾分类 */
test('D3 真实点击（位移 0 与阈值内抖动 5px）判定为非拖拽，应正常打开面板', () => {
  assert.equal(isDragTail(100, 200, 100, 200), false, '零位移点击')
  assert.equal(isDragTail(100, 200, 104, 203), false, 'hypot=5 ≤ 阈值 6')
  assert.equal(DRAG_THRESHOLD, 6, '阈值契约固定为 6px')
})

test('D3 拖拽收尾 click（释放点偏离按下点超阈值）判定为拖拽，吞掉不打开面板', () => {
  assert.equal(isDragTail(100, 200, 260, 70), true, '左移 160 上移 130 的收尾 click')
  // 阈值边界：恰好 7px 单向位移即超阈值
  assert.equal(isDragTail(0, 0, 7, 0), true)
})

/* D4. 视口变化收敛 */
test('D4 横屏转竖屏（视口变窄）后历史 dx 被收敛，球不留在屏外', () => {
  // 横屏时曾拖到 dx=-700；竖屏宽 390、球 44，允许下限 -(390-44)=-346
  const r = clampToViewport(-700, -100, 390, 740, 44)
  assert.equal(r.dx, -346)
  assert.equal(r.dy, -100, 'dy 未越界则保持')
})

test('D4 收敛结果永不为正（CSS 右锚点模型下正位移无意义）且不低于负下限', () => {
  const r = clampToViewport(999, 999, 390, 740, 44)
  assert.deepEqual(r, { dx: 0, dy: 0 })
  const r2 = clampToViewport(-10, -5, 390, 740, 44)
  assert.deepEqual(r2, { dx: -10, dy: -5 }, '视口充足时原样保留')
})

console.log(`\n通过：${passed}`)
if (failures.length) {
  console.log(`失败：${failures.length}`)
  failures.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
console.log('全部通过 ✅')
