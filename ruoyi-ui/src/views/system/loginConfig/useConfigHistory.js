import { computed, ref, watch } from 'vue'

/**
 * 登录页设计器：按内容页签分区的撤销/重做历史（节点 + 游标模型）。
 *
 * 设计要点（详见 .trae/documents/designer_undo_import_plan.md）：
 * - 每个 scope（文案/外观/桌面布局/移动布局）一条节点数组 + 游标，互不影响；
 * - 每个 scope 一个「本 scope 子树 JSON」watcher + 500ms 防抖，不做路径 diff；
 * - pending：防抖未结算的修改也让 canUndo 立即为 true，undo 时先 flushPending；
 * - 程序化回填（undo/redo/loadData/导入）期间 restoring=true，不入栈；
 * - seed(config)：载入后建单节点基线；rebase(savedSnap)：保存成功登记已保存基线，
 *   不丢弃在途新修改；beginImportSession(before, after)：导入前后按页签各成节点。
 */

/** scope → 叶子路径归属（叶子路径互斥、完整覆盖全部可编辑字段） */
export const HISTORY_SCOPES = ['content', 'appearance', 'layout', 'mobileLayout']

/** 叶子路径 → scope 的映射表（用于 pick/apply，写死归属，避免遗漏） */
const LEAF_OWNER = buildOwnerMap()

const DEBOUNCE_MS = 500
const MAX_NODES = 50

function isPlain(v) { return Object.prototype.toString.call(v) === '[object Object]' }

/**
 * 归属表：值为 scope 的叶子；brand/layout 的叶子按归属互斥切分。
 * 用显式列举保证「每个可编辑叶子恰好归属一个 scope」（配合桩测全集 diff 校验）。
 */
function buildOwnerMap() {
  const map = {}
  const set = (scope, paths) => paths.forEach((p) => { map[p] = scope })

  // 文案：品牌区文字 + Hero + 表单 + 版权
  set('content', [
    'brand.name', 'brand.browserTitle', 'brand.subTitle',
    'hero', 'form', 'footer'
  ])
  // 外观：配色 / 字体 / 全局圆角 / 入场动效
  set('appearance', [
    'colors', 'typography', 'layout.cardRadius', 'animation.entrance'
  ])
  // 桌面端布局：模板/分栏/窄屏 + 背景 + 桌面 logo 组 + favicon
  set('layout', [
    'layout.template', 'layout.splitRatio', 'layout.showBrandOnMobile',
    'background',
    'brand.logo', 'brand.logoClient', 'brand.logoSpace', 'brand.favicon'
  ])
  // 移动端：整棵 mobile.*
  set('mobileLayout', ['mobile'])
  return map
}

/** 判断叶子路径归属哪个 scope；未登记的顶层键（如 version）返回 null（不记录） */
function ownerOf(path) {
  if (Object.prototype.hasOwnProperty.call(LEAF_OWNER, path)) return LEAF_OWNER[path]
  // 长路径前缀匹配（如 footer.police.number → footer；colors.xxx → colors）
  const keys = Object.keys(LEAF_OWNER).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (path === k || path.startsWith(k + '.')) return LEAF_OWNER[k]
  }
  return null
}

/** 深拷贝纯 JSON 配置（配置始终可被 JSON 序列化） */
function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v))
}

/** 按路径取值（a.b.c） */
function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj)
}

/** 仅当父对象存在时按路径写值 */
function setPath(obj, path, value) {
  const ks = path.split('.')
  let cur = obj
  for (let i = 0; i < ks.length - 1; i++) {
    if (!isPlain(cur[ks[i]])) cur[ks[i]] = {}
    cur = cur[ks[i]]
  }
  cur[ks[ks.length - 1]] = value
}

/**
 * 提取某 scope 拥有的全部叶子，组成「子树快照」（普通对象，内部用 JSON 序列化为节点串）。
 * 子树键即叶子路径，写回时按路径还原，天然做到只改本 scope、其他页签不动。
 */
export function pickScope(config, scope) {
  const out = {}
  for (const path of Object.keys(LEAF_OWNER)) {
    if (LEAF_OWNER[path] !== scope) continue
    const v = getPath(config, path)
    if (v !== undefined) out[path] = clone(v)
  }
  return out
}

/** 把某 scope 的子树快照写回完整配置（只覆盖本 scope 叶子） */
export function applyScope(config, scope, snapshot) {
  for (const path of Object.keys(snapshot)) {
    if (ownerOf(path) !== scope) continue
    setPath(config, path, clone(snapshot[path]))
  }
  return config
}

/**
 * @param {import('vue').Ref<object>} configRef localConfig
 * @param {import('vue').ComputedRef<string>|Ref<string>} activeScopeRef 当前页签
 * @param {import('vue').Ref<string>} [savedSnapshotRef] 已保存快照（JSON 串）；
 *   传入后暴露 dirtyScopes（按页签的未保存痕迹），不传则不计算
 */
export function useConfigHistory(configRef, activeScopeRef, savedSnapshotRef) {
  // 每 scope：nodes（子树 JSON 串）、index（游标，**必须是 ref**：undo/redo/导入只改游标，
  // 若用普通数字，canUndo/canRedo 在无 pending 变化时不会重算，按钮状态会停在旧值）、
  // pending（有无未结算修改）、timer
  const nodes = {}
  const index = {}
  const pending = {}
  const timers = {}
  HISTORY_SCOPES.forEach((s) => {
    nodes[s] = []
    index[s] = ref(0)
    pending[s] = ref(false)
    timers[s] = null
  })

  /** 程序化回填中：屏蔽 watcher 入栈 */
  let restoring = false

  function curSnapshot(scope) {
    return JSON.stringify(pickScope(configRef.value, scope))
  }

  /** 载入/导入/重置后：以某完整配置为唯一基线，清栈 */
  function seed(config) {
    clearAllTimers()
    restoring = true
    HISTORY_SCOPES.forEach((s) => {
      nodes[s] = [JSON.stringify(pickScope(config, s))]
      index[s].value = 0
      pending[s].value = false
    })
    // 释放 restoring：nextTick 后 watcher 已因本次赋值触发过，回调里 restoring 仍为 true
    // 用微任务之后复位即可（回填是同步完成的）
    queueMicrotask(() => { restoring = false })
  }

  /** 取消所有 scope 的待执行防抖 */
  function clearAllTimers() {
    HISTORY_SCOPES.forEach((s) => {
      if (timers[s]) { clearTimeout(timers[s]); timers[s] = null }
      // 注意：不主动清 pending；调用方若要丢弃未结算修改应配合 seed/重置
    })
  }

  /** watcher 回调：调度一次防抖入栈 */
  function schedulePush(scope) {
    if (restoring) return
    pending[scope].value = true
    if (timers[scope]) clearTimeout(timers[scope])
    timers[scope] = setTimeout(() => commit(scope), DEBOUNCE_MS)
  }

  /** 立即结算某 scope 未入栈的修改为一个节点；无 pending 则空操作 */
  function flushPending(scope) {
    if (timers[scope]) { clearTimeout(timers[scope]); timers[scope] = null }
    if (!pending[scope].value) return
    commit(scope)
  }

  /** 把当前子树追加为新节点（undo 分叉：丢弃游标之后的 redo） */
  function commit(scope) {
    timers[scope] = null
    const snap = curSnapshot(scope)
    // 已在最新节点：丢弃
    if (nodes[scope][index[scope].value] === snap) {
      pending[scope].value = false
      return
    }
    // 丢弃 redo 尾
    nodes[scope] = nodes[scope].slice(0, index[scope].value + 1)
    nodes[scope].push(snap)
    if (nodes[scope].length > MAX_NODES) nodes[scope].shift()
    index[scope].value = nodes[scope].length - 1
    pending[scope].value = false
  }

  /** 把指定子树串写回配置（restoring 窗口） */
  function writeNode(scope, nodeStr) {
    restoring = true
    try {
      applyScope(configRef.value, scope, JSON.parse(nodeStr))
    } finally {
      queueMicrotask(() => { restoring = false })
    }
  }

  function undo() {
    const scope = activeScopeValue()
    flushPending(scope)
    if (index[scope].value <= 0) return
    index[scope].value -= 1
    writeNode(scope, nodes[scope][index[scope].value])
  }

  function redo() {
    const scope = activeScopeValue()
    // 有未结算编辑时 redo 不允许（编辑分叉语义）
    if (pending[scope].value) return
    if (index[scope].value >= nodes[scope].length - 1) return
    index[scope].value += 1
    writeNode(scope, nodes[scope][index[scope].value])
  }

  function activeScopeValue() {
    const v = activeScopeRef && activeScopeRef.value
    return HISTORY_SCOPES.includes(v) ? v : 'content'
  }

  const canUndo = computed(() => {
    const s = activeScopeValue()
    return index[s].value > 0 || pending[s].value
  })
  const canRedo = computed(() => {
    const s = activeScopeValue()
    return !pending[s].value && index[s].value < nodes[s].length - 1
  })

  /**
   * 保存成功后登记已保存基线（D8）：仅把某 scope 的「已保存子树」作为参照，
   * 不改变当前草稿节点；在途新修改（pending/新节点）保留，撤销仍可达。
   * savedSnapshot 由调用方维护（全量字符串比较），这里无需重复——rebase 仅清掉
   * 「当前恰好等于已保存」scope 的 pending，避免保存后按钮还亮。
   */
  function rebase(savedFullSnapshot) {
    clearAllTimers()
    let saved
    try { saved = JSON.parse(savedFullSnapshot) } catch (e) { return }
    HISTORY_SCOPES.forEach((s) => {
      // 若当前子树与刚保存的一致，则该 scope 无在途修改，清 pending；否则保留
      if (curSnapshot(s) === JSON.stringify(pickScope(saved, s))) {
        pending[s].value = false
      }
    })
  }

  /**
   * 导入会话：清栈 → 节点0=导入前(before)，变化的 scope 追加节点1=导入后(after)，游标置1。
   * 未变化 scope 保持单节点（撤销禁用）。
   */
  function beginImportSession(before, after) {
    clearAllTimers()
    restoring = true
    HISTORY_SCOPES.forEach((s) => {
      const b = JSON.stringify(pickScope(before, s))
      const a = JSON.stringify(pickScope(after, s))
      nodes[s] = [b]
      index[s].value = 0
      pending[s].value = false
      if (a !== b) {
        nodes[s].push(a)
        index[s].value = 1
      }
    })
    queueMicrotask(() => { restoring = false })
  }

  /**
   * 按页签的未保存痕迹：该 scope 子树与已保存快照不同即为 true。
   * 用于页签标题上的「未保存」小圆点——与全局 dirty 同一口径（JSON 串比较），
   * 但按归属表切分，改文案只亮「文案」页签，不串到外观/布局。
   * savedSnapshotRef 缺省/解析失败时全部为 false。
   */
  const dirtyScopes = computed(() => {
    const map = {}
    let saved = null
    if (savedSnapshotRef) {
      try { saved = JSON.parse(savedSnapshotRef.value) } catch (e) { saved = null }
    }
    HISTORY_SCOPES.forEach((s) => {
      map[s] = !!saved && curSnapshot(s) !== JSON.stringify(pickScope(saved, s))
    })
    return map
  })

  // 4 个独立 scope 快照 watcher
  const stops = HISTORY_SCOPES.map((s) =>
    watch(
      () => JSON.stringify(pickScope(configRef.value, s)),
      () => schedulePush(s)
    )
  )

  return {
    undo, redo, canUndo, canRedo, dirtyScopes,
    seed, rebase, beginImportSession,
    clearAllTimers, flushPending,
    // 测试/调试用（index 为 ref）
    _state: { nodes, index, pending, restoring: () => restoring },
    stop() { stops.forEach((fn) => fn && fn()) }
  }
}
