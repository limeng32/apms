/**
 * 演示模式 · handler 路由表汇总
 *
 * 键匹配规则（见 demo_mode_plan.md §五）：
 * - 先精确匹配 'METHOD /path'，再按参数段模板 'GET /xxx/:id' 匹配（注册顺序即优先级）；
 * - 同段数的参数模板靠字面段区分（如 /rtp/status/list 为精确键，天然先于 /rtp/status/:id）；
 * - 新增业务模块时把对应 handlers 展开追加到下方数组即可。
 */
import { frameworkHandlers } from './framework'
import { dashboardHandlers } from './dashboard'
import { athleteHandlers, athleteGroupHandlers } from './athlete'
import { indicatorHandlers } from './indicator'
import { testModelHandlers } from './testModel'
import { testTaskHandlers } from './testTask'
import { testResultHandlers } from './testResult'
import { deviceHandlers } from './device'
import { bodyMeasureHandlers } from './bodyMeasure'
import { measureCycleHandlers } from './measureCycle'
import { phvHandlers } from './phv'
import { rtpHandlers } from './rtp'
import { comboModelHandlers } from './comboModel'
import { comboScoreHandlers } from './comboScore'
import { medicalHandlers } from './medical'
import { reportHandlers } from './report'

export const handlers = [
  ...frameworkHandlers,
  ...dashboardHandlers,
  ...athleteHandlers,
  ...athleteGroupHandlers,
  ...indicatorHandlers,
  ...testModelHandlers,
  ...testTaskHandlers,
  ...testResultHandlers,
  ...deviceHandlers,
  ...bodyMeasureHandlers,
  ...measureCycleHandlers,
  ...phvHandlers,
  ...rtpHandlers,
  ...comboModelHandlers,
  ...comboScoreHandlers,
  ...medicalHandlers,
  ...reportHandlers
]
