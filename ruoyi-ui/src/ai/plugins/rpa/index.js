/**
 * RPA 助手插件描述符（前端）。与后端 rpa 插件及 features.plugins.rpa 对齐。
 */
import AssistantLauncher from './AssistantLauncher.vue'
import { clearAssistantSession } from './assistantSession'
import { assistantHandlers } from './mock/assistantHandlers'

export default {
  key: 'rpa',
  name: 'RPA 助手',
  /** 挂到 layout 的悬浮入口；Alt+A 快捷键在组件内部注册 */
  Launcher: AssistantLauncher,
  /** demo 模式 mock 端点（非 demo 不调用） */
  mockHandlers: () => assistantHandlers,
  /** 登出 / 进出演示模式时的会话清理 */
  clearSession: () => clearAssistantSession()
}
