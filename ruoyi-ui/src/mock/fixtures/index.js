/**
 * 演示模式 · 可变数据表聚合
 *
 * db.js 仅深拷贝本文件导出的 tables（普通对象，结构化克隆无歧义）。
 * 只读常量（getInfoBody/apmsRouters/dictMap）不入库，handler 直接从 system.js 引用。
 */
import * as system from './system'
import * as business from './business'

export const tables = {
  // 框架可变表
  notices: system.notices,
  depts: system.depts,
  // 业务表（13 模块）
  athletes: business.athletes,
  athleteGroups: business.athleteGroups,
  indicators: business.indicators,
  indicatorRefs: business.indicatorRefs,
  indicatorLevels: business.indicatorLevels,
  testModels: business.testModels,
  testFields: business.testFields,
  testTasks: business.testTasks,
  taskItems: business.taskItems,
  taskMembers: business.taskMembers,
  testResults: business.testResults,
  bodyMeasures: business.bodyMeasures,
  phvs: business.phvs,
  rtpStatuses: business.rtpStatuses,
  rtpLogs: business.rtpLogs,
  comboModels: business.comboModels,
  comboComponents: business.comboComponents,
  comboScores: business.comboScores,
  medicals: business.medicals,
  medicalFiles: business.medicalFiles,
  reports: business.reports
}
