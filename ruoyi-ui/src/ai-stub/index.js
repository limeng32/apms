/**
 * AI 容器空桩（standard 构建经 @ai 别名解析到这里）。
 *
 * 必须与 src/ai/index.js 逐键同形（由 .trae/demo-tests 契约测试兜底），
 * 保证主干代码在零 AI 代码的 standard 产物中正常运行。
 */
import { defineComponent, h } from 'vue'

const aiState = {
  edition: 'standard',
  loaded: true,
  plugins: {}
}

/** 幂等初始化：standard 永远无插件 */
export async function initAi() {
  return aiState
}

/** standard demo 不注册任何 AI mock */
export function aiMockHandlers() {
  return []
}

/** standard 无 AI 会话可清理 */
export function clearAiSession() {}

/** 不渲染任何入口 */
export const AiLaunchers = defineComponent({
  name: 'AiLaunchers',
  render: () => h(null)
})

export function pluginEnabled() {
  return false
}

export function loadAiFeatures() {
  return Promise.resolve(aiState)
}

export { aiState }
