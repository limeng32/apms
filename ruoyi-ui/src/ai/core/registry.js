/**
 * AI 插件注册表：构建期自动发现 src/ai/plugins/<key>/index.js 描述符。
 * 新增插件只需新增目录，无需修改容器主干。
 */
const modules = import.meta.glob('../plugins/*/index.js', { eager: true })

const plugins = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)

export default plugins
