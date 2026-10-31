/**
 * 演示模式 · 助手能力 handler（第二道防线）。
 * 正常情况下 assistantClient 会在 isDemoMode() 时直接返回本地能力表，不走 axios；
 * 该 handler 保证即使未来有人误用 axios，Demo Adapter 也不会发出真实请求。
 */
import { route, detail } from '../handle'
import { demoCapabilities } from '@/components/Assistant/assistantDemo'

export const assistantHandlers = [
  route('get', '/apms/assistant/capabilities', () => detail(demoCapabilities()))
]
