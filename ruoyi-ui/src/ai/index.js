/**
 * ruoyi-ai 前端容器入口（ai 构建）。
 *
 * 主干代码只允许通过别名 `@ai` 引用本文件；standard 构建时别名指向 src/ai-stub。
 * 契约（stub 必须逐键同形）：
 *   - AiLaunchers：layout 中唯一的 AI 入口挂载组件
 *   - initAi(app, router)：登录后初始化（拉功能表，幂等）
 *   - aiMockHandlers()：demo mock 路由聚合
 *   - clearAiSession()：登出/进出演示时清理各插件会话
 *   - aiState / pluginEnabled / loadAiFeatures：功能表只读访问
 */
import { defineComponent, h, onMounted } from 'vue'
import plugins from './core/registry'
import { aiState, loadAiFeatures, pluginEnabled } from './core/features'

/** 幂等初始化；登录布局挂载时调用，失败静默（features.js 内部已吞错） */
export async function initAi() {
  await loadAiFeatures()
}

/** demo mock：聚合所有已注册插件的 handler 数组 */
export function aiMockHandlers() {
  return plugins.flatMap((p) => (typeof p.mockHandlers === 'function' ? p.mockHandlers() : []))
}

/** 遍历调用各插件清理回调 */
export function clearAiSession() {
  for (const p of plugins) {
    if (typeof p.clearSession === 'function') p.clearSession()
  }
}

/**
 * AI 入口聚合组件：功能表加载完成后，仅渲染已启用插件的 Launcher。
 * 组件自管理显隐与快捷键，容器只负责按开关挂载。
 */
export const AiLaunchers = defineComponent({
  name: 'AiLaunchers',
  setup() {
    onMounted(() => {
      if (!aiState.loaded) loadAiFeatures()
    })
    return () =>
      plugins
        .filter((p) => pluginEnabled(p.key))
        .map((p, idx) => h(p.Launcher, { key: p.key || idx }))
  }
})

export { aiState, pluginEnabled, loadAiFeatures }
